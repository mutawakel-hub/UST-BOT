// ============================================
// بوت الطالب - جامعة العلوم والتكنولوجيا
// Cloudflare Workers + grammY + Supabase
// 12 شاشة + شاشة معاينة ملف + breadcrumb
// ============================================

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtiesByCollege,
  getSpecialtyById,
  getLevelsForSpecialty,
} from "../shared/data/colleges";
import {
  SUBJECTS,
  getSubjectById,
  getSubjectByIdWithFallback,
  getSubjectsBySpecialtyLevelSemester,
} from "../shared/data/subjects";
import { TEXTS } from "../shared/texts";
import { SupabaseClient, registerStudent, isStudentRegistered, getStudent,
  getContentForSubject, getContentById, incrementDownloadCount,
  getCommitteeChannelsFromDB, getStudentNotifications, getUnreadNotificationsCount,
  markNotificationsRead, getTopContributorsFromDB, getStudentContributions,
  logDownload, getRecentDownloads
} from "../shared/db";
import { SessionStore, TTL } from "../shared/session";
import { deliverFileToUser } from "../shared/storage";
import { initCallbackSigning } from "../shared/callback-signing";
import {
  mainMenuKeyboard,
  collegesKeyboard,
  majorsKeyboard,
  levelsKeyboard,
  semestersKeyboard,
  subjectsKeyboard,
  subjectMenuKeyboard,
  filesListKeyboard,
  filePreviewKeyboard,
  searchKeyboard,
  searchResultsKeyboard,
  leaderboardKeyboard,
  profileKeyboard,
  breadcrumb,
} from "../shared/keyboards";

// URL لملف PDF التجريبي - يُستخدم فقط كآخر خيار إذا فشل forwardMessage
const FALLBACK_PDF_URL = "https://ust-pdf-server.atow73768.workers.dev/sample.pdf";

// تصنيفات الملفات
const TYPE_LABELS: Record<string, string> = {
  book_theory: "📘 المقرر (نظري)",
  book_practical: "📗 المقرر (عملي)",
  exam: "📑 نماذج اختبارات",
  summary: "📝 ملخصات",
};

// ============================================
// حالة المستخدم (محاكاة - في الإنتاج ستكون في KV)
// ============================================
interface DownloadHistoryEntry {
  file_name: string;
  subject_name: string;
  date: string;
}

interface ContributionEntry {
  id: number;
  file_name: string;
  subject_name: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
}

interface UserState {
  telegram_id: number;
  username?: string;
  first_name?: string;
  // حالة التسجيل الإلزامي
  is_registered: boolean;
  current_college_id?: number;
  current_specialty_id?: number;
  current_level?: number;
  total_downloads: number;
  accepted_contributions: number;
  recent_downloads: DownloadHistoryEntry[];
  my_contributions: ContributionEntry[];
  // المسار القصير للمساهمة (من شاشة المادة - 4 خطوات)
  awaiting_contribution_for_subject?: number;
  awaiting_contribution_type?: string;
  awaiting_contribution_step?: "title" | "file";
  awaiting_contribution_title?: string;
  // المسار الكامل للمساهمة (من القائمة الرئيسية - 9 خطوات)
  contribution_main_context?: {
    college_id?: number;
    specialty_id?: number;
    level?: number;
    semester?: number;
    subject_id?: number;
    content_type?: string;
  };
  contribution_main_step?: "college" | "specialty" | "level" | "semester" | "subject" | "type" | "title" | "file";
  contribution_main_title?: string;
  // التسجيل الإلزامي
  registration_step?: "college" | "specialty" | "level";
  registration_context?: { college_id?: number; specialty_id?: number };
  awaiting_search?: boolean;
  last_file_id?: string;
}

// مخزن الجلسات عبر KV (يحل مشكلة Map بين isolates)
let sessionStore: SessionStore<UserState>;

// إنشاء حالة افتراضية فارغة (تُملأ من DB عند الحاجة)
function createDefaultState(telegramId: number, firstName?: string, username?: string): UserState {
  return {
    telegram_id: telegramId,
    first_name: firstName,
    username,
    is_registered: false,
    total_downloads: 0,
    accepted_contributions: 0,
    recent_downloads: [],
    my_contributions: [],
  };
}

// قراءة/إنشاء حالة المستخدم — من KV، مع fallback إلى default
// ملاحظة: أصبحت async لأن KV.async
async function getUserState(
  telegramId: number,
  firstName?: string,
  username?: string
): Promise<UserState> {
  // 1. اقرأ من KV
  const cached = await sessionStore.get(telegramId);
  if (cached) {
    // حدّث first_name/username لو تغيرت (Telegram قد يُرجع قيماً مختلفة)
    let changed = false;
    if (firstName && cached.first_name !== firstName) {
      cached.first_name = firstName;
      changed = true;
    }
    if (username && cached.username !== username) {
      cached.username = username;
      changed = true;
    }
    if (changed) {
    await sessionStore.set(telegramId, cached, TTL.SESSION_DEFAULT);
    }
    return cached;
  }

  // 2. أنشئ حالة افتراضية
  const fresh = createDefaultState(telegramId, firstName, username);
  await sessionStore.set(telegramId, fresh, TTL.SESSION_DEFAULT);
  return fresh;
}

// حفظ حالة مستخدم (upsert في KV)
async function saveUserState(state: UserState): Promise<void> {
  await sessionStore.set(state.telegram_id, state, TTL.SESSION_DEFAULT);
}

// تحديث جزئي للحالة (merge)
async function updateUserState(
  telegramId: number,
  patch: Partial<UserState>
): Promise<UserState | null> {
  return await sessionStore.update(telegramId, patch, TTL.SESSION_DEFAULT);
}

// ============================================
// إنشاء البوت
// ============================================
export function createStudentBot(
  token: string,
  supabase: SupabaseClient,
  sessionsKv: KVNamespace,
  cacheKv: KVNamespace,
  callbackSecret: string
): Bot {
  // تهيئة SessionStore (KV-bound)
  sessionStore = new SessionStore<UserState>(sessionsKv, "student", TTL.SESSION_DEFAULT);
  // تهيئة نظام توقيع callbacks (HMAC-SHA256)
  if (callbackSecret) {
    initCallbackSigning(callbackSecret);
  }
  const bot = new Bot(token);

  // ====== S1: القائمة الرئيسية ======
  bot.command("start", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name, ctx.from.username);
    if (ctx.from.username) userState.username = ctx.from.username;
    if (ctx.from.first_name) userState.first_name = ctx.from.first_name;

    // التحقق من حالة التسجيل (أولاً من Supabase، ثم من الذاكرة)
    let dbRegistered = false;
    let dbStudent: any = null;
    try {
        dbRegistered = await isStudentRegistered(supabase, ctx.from.id);
        if (dbRegistered) {
          dbStudent = await getStudent(supabase, ctx.from.id);
        }
    } catch (e) {
        console.error("Supabase registration check error:", e);
    }

    if (!dbRegistered && !userState.is_registered) {
    // طالب جديد - عرض شاشة التسجيل الإلزامي
    await ctx.reply(TEXTS.registration.intro, {
        reply_markup: new InlineKeyboard()
          .text(TEXTS.registration.btn_start, "start_registration")
          .row()
          .text(TEXTS.registration.btn_later, "skip_registration"),
        parse_mode: "Markdown",
      });
    return;
    }

    // طالب مسجّل - استخدام بيانات Supabase إن وجدت
    const collegeId = dbStudent?.current_college_id || userState.current_college_id;
    const specialtyId = dbStudent?.current_specialty_id || userState.current_specialty_id;
    const level = dbStudent?.current_level || userState.current_level;

    const college = getCollegeById(collegeId || 0);
    const specialty = getSpecialtyById(specialtyId || 0);
    await ctx.reply(
      TEXTS.main_menu.welcome_registered(
        userState.first_name || "طالب",
        college?.name || "غير محدد",
        specialty?.name || "غير محدد",
        level || 0
      ),
      {
        reply_markup: mainMenuKeyboard(),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== شاشة التسجيل الإلزامي ======
  bot.callbackQuery("start_registration", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.registration_step = "college";
    await ctx.editMessageText(
      TEXTS.registration.step(1, 3, TEXTS.registration.select_college),
      {
        reply_markup: collegesKeyboard(0, "reg_col"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("skip_registration", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      TEXTS.registration.later_notice,
      {
        reply_markup: mainMenuKeyboard(),
        parse_mode: "Markdown",
    }
    );
  });

  // handlers لخطوات التسجيل (تستخدم prefix "reg_" لتمييزها)
  bot.callbackQuery(/reg_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.registration_context = { college_id: collegeId };
    userState.registration_step = "specialty";
    await ctx.editMessageText(
      TEXTS.registration.step(2, 3, TEXTS.registration.select_specialty),
      {
        reply_markup: majorsKeyboard(collegeId, 0, "reg_major"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/reg_major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.registration_context = { ...userState.registration_context, specialty_id: specId };
    userState.registration_step = "level";
    await ctx.editMessageText(
      TEXTS.registration.step(3, 3, TEXTS.registration.select_level),
      {
        reply_markup: levelsKeyboard(specId, "reg_level"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/reg_level_(\d+)_spec_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const spec = getSpecialtyById(specId);
    const college = getCollegeById(spec?.college_id || 0);

    // إكمال التسجيل في الذاكرة
    userState.is_registered = true;
    userState.current_college_id = spec?.college_id;
    userState.current_specialty_id = specId;
    userState.current_level = level;
    userState.registration_step = undefined;
    userState.registration_context = undefined;

    // حفظ في Supabase
    try {
        await registerStudent(
          supabase,
          ctx.from.id,
          userState.first_name || "طالب",
          userState.username,
          spec?.college_id || 0,
          specId,
          level
        );
        console.log(`✅ Student ${ctx.from.id} registered in Supabase`);
    } catch (e) {
        console.error("Supabase registration error:", e);
    }

    await ctx.editMessageText(
      TEXTS.registration.complete(
        userState.first_name || "طالب",
        college?.name || "غير معروف",
        spec?.name || "غير معروف",
        level
      ),
      {
        reply_markup: mainMenuKeyboard(),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== S2: اختيار الكلية ======
  bot.callbackQuery("menu_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    const bc = breadcrumb("🏛 الكليات");
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_college.title}${TEXTS.choose_college.footer}`, {
      reply_markup: collegesKeyboard(0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/colleges_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const bc = breadcrumb("🏛 الكليات");
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_college.title}${TEXTS.choose_college.footer}`, {
      reply_markup: collegesKeyboard(page),
      parse_mode: "Markdown",
    });
  });

  // اختيار كلية → قائمة التخصصات
  bot.callbackQuery(/col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const college = getCollegeById(collegeId);
    await ctx.answerCallbackQuery();
    if (!college) {
    await ctx.reply("⚠️ الكلية غير موجودة.");
    return;
    }
    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
    await ctx.reply(TEXTS.choose_major.no_specialties);
    return;
    }
    const bc = breadcrumb("🏛 الكليات", `${college.emoji} ${college.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_major.title}`, {
      reply_markup: majorsKeyboard(collegeId, 0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/majors_(\d+)_page_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const page = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_major.title}`, {
      reply_markup: majorsKeyboard(collegeId, page),
      parse_mode: "Markdown",
    });
  });

  // اختيار تخصص → قائمة المستويات
  bot.callbackQuery(/major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) {
    await ctx.reply("⚠️ التخصص غير موجود.");
    return;
    }
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.current_specialty_id = specId;
    userState.current_college_id = spec.college_id;

    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`, `📚 ${spec.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_level.title}`, {
      reply_markup: levelsKeyboard(specId),
      parse_mode: "Markdown",
    });
  });

  // الخطة الاسترشادية
  bot.callbackQuery(/plan_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;

    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`, `📚 ${spec.short_name}`, "🗺 الخطة");

    await ctx.reply(`${bc}\n\n${TEXTS.choose_level.plan_message}`, {
      reply_markup: new InlineKeyboard().url(
        "📥 تحميل الخطة (PDF تجريبي)",
        FALLBACK_PDF_URL
      ).row().text(
        TEXTS.navigation.back_to_levels,
        `back_to_levels_${specId}`
      ),
      parse_mode: "Markdown",
    });
  });

  // اختيار مستوى → قائمة الفصول
  bot.callbackQuery(/level_(\d+)_spec_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.current_level = level;

    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb(
      "🏛 الكليات",
      `${college?.emoji} ${college?.short_name}`,
      `📚 ${spec.short_name}`,
      `📊 المستوى ${level}`
    );

    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_semester.title}`, {
      reply_markup: semestersKeyboard(specId, level),
      parse_mode: "Markdown",
    });
  });

  // اختيار فصل → قائمة المواد
  bot.callbackQuery(/sem_(\d+)_spec_(\d+)_lvl_(\d+)/, async (ctx) => {
    const semester = parseInt(ctx.match[1]) as 1 | 2;
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;

    const subjects = getSubjectsBySpecialtyLevelSemester(specId, level, semester);
    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb(
      "🏛 الكليات",
      `${college?.emoji} ${college?.short_name}`,
      `📚 ${spec.short_name}`,
      `📊 المستوى ${level}`,
      `📅 الفصل ${semester}`
    );

    if (subjects.length === 0) {
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_subject.no_subjects}`, {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_semesters,
          `back_to_semesters_${specId}_${level}`
        ),
        parse_mode: "Markdown",
      });
    return;
    }

    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_subject.title}`, {
      reply_markup: subjectsKeyboard(specId, level, semester, 0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/subjects_(\d+)_(\d+)_(\d+)_page_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const semester = parseInt(ctx.match[3]) as 1 | 2;
    const page = parseInt(ctx.match[4]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const college = getCollegeById(spec?.college_id || 0);
    const bc = breadcrumb(
      "🏛 الكليات",
      `${college?.emoji} ${college?.short_name}`,
      `📚 ${spec?.short_name}`,
      `📊 المستوى ${level}`,
      `📅 الفصل ${semester}`
    );
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_subject.title}`, {
      reply_markup: subjectsKeyboard(specId, level, semester, page),
      parse_mode: "Markdown",
    });
  });

  // S7: اختيار مادة → قائمة المادة
  bot.callbackQuery(/subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) {
    await ctx.reply("⚠️ المادة غير موجودة.");
    return;
    }
    const spec = getSpecialtyById(subject.specialty_id);
    const college = getCollegeById(spec?.college_id || 0);

    const bc = subject.specialty_id === 16
      ? breadcrumb(
          "🏛 الكليات",
          `${college?.emoji} ${college?.short_name}`,
          `📚 ${spec?.short_name}`,
          `📊 المستوى ${subject.level}`,
          `📅 الفصل ${subject.semester}`,
          `📖 ${subject.name.substring(0, 30)}`
        )
      : `📖 *${subject.name}*`;

    await ctx.editMessageText(`${bc}\n\n${TEXTS.subject_menu.title(subject.name)}`, {
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical),
      parse_mode: "Markdown",
    });
  });

  // S8: عرض الملفات حسب النوع
  bot.callbackQuery(/type_book_theory_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "book_theory");
  });

  bot.callbackQuery(/type_book_practical_(\d+)/, async (ctx) => {
    const subject = getSubjectByIdWithFallback(parseInt(ctx.match[1]));
    if (!subject?.has_practical) {
    await ctx.answerCallbackQuery({ text: "⚠️ هذه المادة لا تحتوي على مقرر عملي.", show_alert: true });
    return;
    }
    await showFilesList(ctx, parseInt(ctx.match[1]), "book_practical");
  });

  bot.callbackQuery(/type_exams_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "exam");
  });

  bot.callbackQuery(/type_summaries_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "summary");
  });

  async function showFilesList(ctx: any, subjectId: number, category: string) {
    const subject = getSubjectByIdWithFallback(subjectId);
    if (!subject) {
    await ctx.answerCallbackQuery();
    await ctx.reply("⚠️ المادة غير موجودة.");
    return;
    }
    await ctx.answerCallbackQuery();

    // قراءة المحتوى من Supabase فقط
    let files: any[] = [];
    try {
        files = await getContentForSubject(supabase, subjectId, category);
    } catch (e) {
        console.error("Supabase content read error:", e);
    }

    if (files.length === 0) {
    const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
    await ctx.editMessageText(`${bc}\n\n📭 لا توجد ملفات في هذا التصنيف حالياً.\n💡 يمكنك المساهمة بأول ملف!`, {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_subject_menu,
          `back_to_subject_menu_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
    return;
    }

    // تحويل البيانات من Supabase إلى صيغة موحدة
    const unifiedFiles = files.map((f: any) => ({
      id: f.id.toString(),
      file_name: f.title || f.file_name || "ملف",
      file_size_mb: parseFloat(f.file_size_mb) || 0,
      is_starred: f.is_starred || false,
      download_count: f.download_count || 0,
      telegram_message_id: f.telegram_message_id,
      telegram_file_id: f.telegram_file_id,
      uploaded_at: f.added_at || "غير معروف",
      uploaded_by: "المسؤول",
    }));

    const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
    await ctx.editMessageText(`${bc}\n\n${TEXTS.files_list.title(subject.name, TYPE_LABELS[category])}`, {
      reply_markup: filesListKeyboard(unifiedFiles, subjectId),
      parse_mode: "Markdown",
    });
  }

  // S8b: شاشة معاينة الملف
  bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();

    let fileData: any = null;
    let subjectId: number = 0;
    let category: string = "";

    // قراءة من Supabase فقط (fileId هو رقم المحتوى في DB)
    if (/^\d+$/.test(fileId)) {
    const contentId = parseInt(fileId);
        try {
          fileData = await getContentById(supabase, contentId);
        } catch (e) {
          console.error("Supabase content read error:", e);
        }
    if (fileData) {
        subjectId = fileData.subject_id;
        category = fileData.content_type_id;
    }
    }

    if (!fileData) {
    await ctx.reply("⚠️ الملف غير موجود.");
    return;
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    const msg =
      TEXTS.file_preview.title +
      TEXTS.file_preview.details({
        file_name: fileData.title || fileData.file_name || "ملف",
        file_size_mb: parseFloat(fileData.file_size_mb) || 0,
        type_label: TYPE_LABELS[category] || category,
        subject_name: subject?.name || "غير معروف",
        uploaded_at: fileData.added_at || fileData.uploaded_at || "غير معروف",
        download_count: fileData.download_count || 0,
        uploaded_by: "المسؤول",
        is_starred: fileData.is_starred || false,
      });

    await ctx.editMessageText(msg, {
      reply_markup: filePreviewKeyboard(fileId, subjectId),
      parse_mode: "Markdown",
    });
  });

  // تحميل الملف (إرسال PDF فعلي)
  bot.callbackQuery(/download_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery({ text: TEXTS.common.loading });

    let fileData: any = null;
    let subjectId: number = 0;
    let category: string = "";

    // قراءة من Supabase فقط
    if (/^\d+$/.test(fileId)) {
    const contentId = parseInt(fileId);
        try {
          fileData = await getContentById(supabase, contentId);
        } catch (e) {
          console.error("Supabase content read error:", e);
        }
    if (fileData) {
        subjectId = fileData.subject_id;
        category = fileData.content_type_id;
    }
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    if (!fileData || !subject) {
    await ctx.reply("⚠️ الملف غير موجود.");
    return;
    }

    const fileName = fileData.title || fileData.file_name || "ملف";
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.total_downloads++;
    userState.recent_downloads.unshift({
      file_name: fileName,
      subject_name: subject.name,
      date: "الآن",
    });
    if (userState.recent_downloads.length > 5) userState.recent_downloads.pop();

    // تحديث عدّاد التحميلات في Supabase
    if (supabase && /^\d+$/.test(fileId)) {
    try {
        await incrementDownloadCount(supabase, parseInt(fileId));
        await logDownload(supabase, ctx.from.id, parseInt(fileId));
    } catch (e) {
        console.error("Supabase download log error:", e);
    }
    }

    // إرسال الملف من قناة التخزين (deliverFileToUser = forward + fallback)
    const spec = getSpecialtyById(subject.specialty_id);
    const college = getCollegeById(spec?.college_id || 0);
    const storageChannelId = college?.storage_channel_id;
    const telegramMessageId = fileData.telegram_message_id;
    const telegramFileId = fileData.telegram_file_id;

    const result = await deliverFileToUser(bot, ctx.chat.id, {
      storageChannelId: storageChannelId || null,
      messageId: telegramMessageId || null,
      fileId: telegramFileId || null,
      fileName,
    }, {
      caption: TEXTS.common.file_sent_with_caption
        .replace("{fileName}", fileName)
        .replace("{subjectName}", subject.name),
      parseMode: "Markdown",
      errorMessage: "⚠️ تعذّر إرسال الملف. تأكد من أن البوت مشرف في قناة التخزين.",
    });

    if (result.delivered) {
      console.log(`📥 File delivered via ${result.method} to user ${ctx.from.id}`);
    } else {
      console.error(`❌ File delivery failed: ${result.error}`);
      await ctx.reply(result.error || "⚠️ تعذّر إرسال الملف.", {
        parse_mode: "Markdown",
      });
    }

    // زر العودة
    await ctx.reply("اختر الإجراء التالي:", {
      reply_markup: new InlineKeyboard()
        .text("📥 تحميل ملف آخر", `back_to_files_${subjectId}_${category}`)
        .row()
        .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_main"),
    });
  });

  // معاينة ملف من نتائج البحث
  bot.callbackQuery(/preview_search_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();

    // قراءة من Supabase
    let fileData: any = null;
    if (/^\d+$/.test(fileId) && supabase) {
    try {
        fileData = await getContentById(supabase, parseInt(fileId));
    } catch (e) {
        console.error("Supabase content read error:", e);
    }
    }

    if (!fileData) {
    await ctx.reply("⚠️ الملف غير موجود.");
    return;
    }

    const subject = getSubjectByIdWithFallback(fileData.subject_id);
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    const msg =
      TEXTS.file_preview.title +
      TEXTS.file_preview.details({
        file_name: fileData.title || fileData.file_name || "ملف",
        file_size_mb: parseFloat(fileData.file_size_mb) || 0,
        type_label: TYPE_LABELS[fileData.content_type_id] || fileData.content_type_id,
        subject_name: subject?.name || "غير معروف",
        uploaded_at: fileData.added_at || "غير معروف",
        download_count: fileData.download_count || 0,
        uploaded_by: "المسؤول",
        is_starred: fileData.is_starred || false,
      });

    await ctx.reply(msg, {
      reply_markup: filePreviewKeyboard(fileId, fileData.subject_id),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // S9: المساهمة من شاشة المادة (4 خطوات)
  // ============================================
  bot.callbackQuery(/contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = subjectId;

    // بناء keyboard لأنواع المساهمة
    const kb = new InlineKeyboard();
    if (subject?.has_theory) kb.text("📘 المقرر النظري", `ctype_book_theory_${subjectId}`);
    if (subject?.has_practical) kb.text("📗 المقرر العملي", `ctype_book_practical_${subjectId}`);
    kb.row();
    kb.text("📑 نماذج اختبارات", `ctype_exam_${subjectId}`);
    kb.text("📝 ملخصات", `ctype_summary_${subjectId}`);
    kb.row();
    kb.text("🎥 مرئيات", `ctype_video_${subjectId}`);
    kb.text("📚 مراجع", `ctype_reference_${subjectId}`);
    kb.row();
    kb.text("❌ إلغاء", `cancel_contribute_${subjectId}`);

    await ctx.editMessageText(
      TEXTS.contribution.intro(subject?.name || ""),
      {
        reply_markup: kb,
        parse_mode: "Markdown",
    }
    );
  });

  // اختيار نوع المساهمة → طلب العنوان
  bot.callbackQuery(/ctype_(\w+)_(\d+)/, async (ctx) => {
    const contentType = ctx.match[1];
    const subjectId = parseInt(ctx.match[2]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_type = contentType;
    userState.awaiting_contribution_step = "title";

    const typeLabel = {
      book_theory: "📘 المقرر النظري",
      book_practical: "📗 المقرر العملي",
      exam: "📑 نماذج اختبارات",
      summary: "📝 ملخصات",
      video: "🎥 مرئيات",
      reference: "📚 مراجع",
    }[contentType] || contentType;

    await ctx.editMessageText(
      TEXTS.contribution.prompt_title(subject?.name || "", typeLabel),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${subjectId}`),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/cancel_contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = undefined;
    userState.awaiting_contribution_type = undefined;
    userState.awaiting_contribution_step = undefined;
    userState.awaiting_contribution_title = undefined;
    await ctx.editMessageText(TEXTS.contribution.cancel, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
    });
  });

  // ============================================
  // S13: المساهمة من القائمة الرئيسية (9 خطوات)
  // ============================================
  bot.callbackQuery("menu_contribute_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.contribution_main.intro, {
      reply_markup: new InlineKeyboard()
        .text("🚀 ابدأ المساهمة", "contribute_main_start")
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_main"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("contribute_main_start", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {};
    userState.contribution_main_step = "college";
    // عرض الكليات
    await ctx.editMessageText(
      TEXTS.contribution_main.step(1, 6, TEXTS.contribution_main.select_college),
      {
        reply_markup: collegesKeyboard(0),
        parse_mode: "Markdown",
    }
    );
  });

  // handlers لكل خطوة من مسار المساهمة الكامل
  bot.callbackQuery(/cm_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, college_id: collegeId };
    userState.contribution_main_step = "specialty";
    await ctx.editMessageText(
      TEXTS.contribution_main.step(2, 6, TEXTS.contribution_main.select_specialty),
      { reply_markup: majorsKeyboard(collegeId, 0), parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/cm_major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, specialty_id: specId };
    userState.contribution_main_step = "level";
    await ctx.editMessageText(
      TEXTS.contribution_main.step(3, 6, TEXTS.contribution_main.select_level),
      { reply_markup: levelsKeyboard(specId), parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/cm_level_(\d+)_spec_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, level };
    userState.contribution_main_step = "semester";
    const kb = new InlineKeyboard();
    kb.text("🍂 الفصل الأول", `cm_sem_1_spec_${specId}_lvl_${level}`).row();
    kb.text("🌸 الفصل الثاني", `cm_sem_2_spec_${specId}_lvl_${level}`).row();
    kb.text("🔙 رجوع", `cm_major_${specId}`);
    await ctx.editMessageText(
      TEXTS.contribution_main.step(4, 6, TEXTS.contribution_main.select_semester),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/cm_sem_(\d+)_spec_(\d+)_lvl_(\d+)/, async (ctx) => {
    const semester = parseInt(ctx.match[1]) as 1 | 2;
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, semester };
    userState.contribution_main_step = "subject";
    const subjects = getSubjectsBySpecialtyLevelSemester(specId, level, semester);
    if (subjects.length === 0) {
    await ctx.editMessageText("⚠️ لا توجد مواد في هذا الفصل.");
    return;
    }
    const kb = new InlineKeyboard();
    subjects.forEach((s) => kb.text(`📖 ${s.name}`, `cm_subj_${s.id}`).row());
    kb.text("🔙 رجوع", `cm_level_${level}_spec_${specId}`);
    await ctx.editMessageText(
      TEXTS.contribution_main.step(5, 6, TEXTS.contribution_main.select_subject),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/cm_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, subject_id: subjectId };
    userState.contribution_main_step = "type";
    // عرض أنواع المساهمة
    const kb = new InlineKeyboard();
    if (subject?.has_theory) kb.text("📘 المقرر النظري", `cm_type_book_theory`);
    if (subject?.has_practical) kb.text("📗 المقرر العملي", `cm_type_book_practical`);
    kb.row();
    kb.text("📑 نماذج اختبارات", "cm_type_exam");
    kb.text("📝 ملخصات", "cm_type_summary");
    kb.row();
    kb.text("🎥 مرئيات", "cm_type_video");
    kb.text("📚 مراجع", "cm_type_reference");
    kb.row();
    kb.text("🔙 رجوع", `cm_sem_${userState.contribution_main_context.semester}_spec_${userState.contribution_main_context.specialty_id}_lvl_${userState.contribution_main_context.level}`);
    await ctx.editMessageText(
      TEXTS.contribution_main.step(6, 6, TEXTS.contribution_main.select_type),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/cm_type_(\w+)/, async (ctx) => {
    const contentType = ctx.match[1];
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = { ...userState.contribution_main_context, content_type: contentType };
    userState.contribution_main_step = "title";
    const subject = getSubjectByIdWithFallback(userState.contribution_main_context.subject_id);
    const typeLabel = {
      book_theory: "📘 المقرر النظري",
      book_practical: "📗 المقرر العملي",
      exam: "📑 نماذج اختبارات",
      summary: "📝 ملخصات",
      video: "🎥 مرئيات",
      reference: "📚 مراجع",
    }[contentType] || contentType;
    await ctx.editMessageText(
      TEXTS.contribution_main.prompt_title(subject?.name || "", typeLabel),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("cancel_contribute_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = undefined;
    userState.contribution_main_step = undefined;
    userState.contribution_main_title = undefined;
    await ctx.editMessageText(
      TEXTS.contribution_main.cancel,
      {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  // استقبال ملف المساهمة (للمسارين: القصير + الكامل)
  bot.on(":document", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const doc = ctx.message.document;
    const contributionId = 9900 + Math.floor(Math.random() * 1000);

    // المسار القصير (من شاشة المادة - 4 خطوات)
    if (userState.awaiting_contribution_for_subject && userState.awaiting_contribution_step === "file") {
    const subjectId = userState.awaiting_contribution_for_subject;
    const subject = getSubjectByIdWithFallback(subjectId);
    const contentType = userState.awaiting_contribution_type || "summary";
    const title = userState.awaiting_contribution_title || doc.file_name || "بدون عنوان";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;

      userState.my_contributions.unshift({
        id: contributionId,
        file_name: doc.file_name || "ملف بدون اسم",
        subject_name: subject?.name || "غير معروف",
        status: "pending",
        submitted_at: "الآن",
      });

    // حفظ المساهمة في Supabase
        try {
          // أولاً: التأكد من وجود الطالب في admin_users (مطلوب FK)
          await supabase.insert("admin_users", {
            telegram_id: ctx.from.id,
            first_name: ctx.from.first_name || "طالب",
            username: ctx.from.username || null,
          }).catch(() => {}); // تجاهل لو موجود مسبقاً

          // ثانياً: حفظ المساهمة
          await supabase.insert("contributions", {
            user_telegram_id: ctx.from.id,
            subject_id: subjectId,
            content_type_id: contentType,
            file_name: doc.file_name || "ملف بدون اسم",
            file_size_mb: (doc.file_size / 1024 / 1024).toFixed(2),
            telegram_file_id: doc.file_id || null,
            description: title,
            status: "pending",
          });
          console.log(`✅ Contribution saved to Supabase for student ${ctx.from.id}`);
        } catch (e) {
          console.error("Supabase contribution save error:", e);
        }

    // إعادة ضبط حالة المساهمة
      userState.awaiting_contribution_for_subject = undefined;
      userState.awaiting_contribution_type = undefined;
      userState.awaiting_contribution_step = undefined;
      userState.awaiting_contribution_title = undefined;

    await ctx.reply(
        TEXTS.contribution.received(
          contributionId,
          doc.file_name || "ملف",
          subject?.name || "غير معروف",
          typeLabel,
          title
        ),
        {
          reply_markup: new InlineKeyboard()
            .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
            .row()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // المسار الكامل (من القائمة الرئيسية - 9 خطوات)
    if (userState.contribution_main_step === "file" && userState.contribution_main_context?.subject_id) {
    const ctx_data = userState.contribution_main_context;
    const subject = getSubjectByIdWithFallback(ctx_data.subject_id);
    const contentType = ctx_data.content_type || "summary";
    const title = userState.contribution_main_title || doc.file_name || "بدون عنوان";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;

      userState.my_contributions.unshift({
        id: contributionId,
        file_name: doc.file_name || "ملف بدون اسم",
        subject_name: subject?.name || "غير معروف",
        status: "pending",
        submitted_at: "الآن",
      });

    // حفظ المساهمة في Supabase (المسار الكامل)
        try {
          await supabase.insert("admin_users", {
            telegram_id: ctx.from.id,
            first_name: ctx.from.first_name || "طالب",
            username: ctx.from.username || null,
          }).catch(() => {});

          await supabase.insert("contributions", {
            user_telegram_id: ctx.from.id,
            subject_id: ctx_data.subject_id,
            content_type_id: contentType,
            file_name: doc.file_name || "ملف بدون اسم",
            file_size_mb: (doc.file_size / 1024 / 1024).toFixed(2),
            telegram_file_id: doc.file_id || null,
            description: title,
            status: "pending",
          });
          console.log(`✅ Contribution (main flow) saved to Supabase for student ${ctx.from.id}`);
        } catch (e) {
          console.error("Supabase contribution save error:", e);
        }

    // إعادة ضبط الحالة
      userState.contribution_main_context = undefined;
      userState.contribution_main_step = undefined;
      userState.contribution_main_title = undefined;

    await ctx.reply(
        TEXTS.contribution.received(
          contributionId,
          doc.file_name || "ملف",
          subject?.name || "غير معروف",
          typeLabel,
          title
        ),
        {
          reply_markup: new InlineKeyboard()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // لو وصل ملف بدون طلب
    await ctx.reply(
      "ℹ️ لم تبدأ عملية مساهمة بعد.\n\n" +
      "ابدأ من: 🌟 المساهمة (في القائمة الرئيسية) أو 💡 مساهمة (في شاشة المادة)"
    );
  });

  // S10: البحث
  bot.callbackQuery("menu_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_search = true;
    await ctx.editMessageText(TEXTS.search.intro, {
      reply_markup: searchKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.on(":text", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);

    // استقبال عنوان المساهمة (المسار القصير - من شاشة المادة)
    if (userState.awaiting_contribution_step === "title" && userState.awaiting_contribution_for_subject) {
      userState.awaiting_contribution_title = ctx.message.text;
      userState.awaiting_contribution_step = "file";
    const subject = getSubjectByIdWithFallback(userState.awaiting_contribution_for_subject);
    const contentType = userState.awaiting_contribution_type || "summary";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;
    await ctx.reply(
        TEXTS.contribution.prompt_file(subject?.name || "", typeLabel, ctx.message.text),
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${userState.awaiting_contribution_for_subject}`),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // استقبال عنوان المساهمة (المسار الكامل - من القائمة الرئيسية)
    if (userState.contribution_main_step === "title") {
      userState.contribution_main_title = ctx.message.text;
      userState.contribution_main_step = "file";
    await ctx.reply(
        TEXTS.contribution_main.prompt_file(ctx.message.text),
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    if (userState.awaiting_search) {
      userState.awaiting_search = false;
    const query = ctx.message.text;

    // البحث في Supabase
    let results: any[] = [];
        try {
          results = await supabase.select("content", {
            columns: "id,title,file_name,subject_id,content_type_id,file_size_mb,is_starred,download_count",
            filter: `title=ilike.%${encodeURIComponent(query)}%`,
            order: "download_count.desc",
            limit: 20,
          }) as any[];
        } catch (e) {
          console.error("Supabase search error:", e);
        }

    if (results.length === 0) {
        await ctx.reply(TEXTS.search.no_results, {
          reply_markup: new InlineKeyboard()
            .text("🔍 بحث جديد", "menu_search")
            .row()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        });
        return;
    }

    const mappedResults = results.map((r: any) => ({
        id: r.id.toString(),
        file_name: r.title || r.file_name || "ملف",
        subject_name: getSubjectByIdWithFallback(r.subject_id)?.name || "غير معروف",
      }));
    await ctx.reply(TEXTS.search.results_header(results.length), {
        reply_markup: searchResultsKeyboard(mappedResults, 0),
        parse_mode: "Markdown",
      });
    } else {
    await ctx.reply(
        "👋 اكتب /start للعودة للقائمة الرئيسية، أو استخدم الأزرار للتنقل.",
        { reply_markup: mainMenuKeyboard() }
      );
    }
  });

  bot.callbackQuery(/search_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.reply(`📄 صفحة ${page + 1} من نتائج البحث`);
  });

  // S11: لوحة الشرف
  bot.callbackQuery("menu_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeaderboard(ctx, "global");
  });

  bot.callbackQuery("leader_all", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeaderboard(ctx, "global");
  });

  bot.callbackQuery("leader_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🏛 *تصفية لوحة الشرف بالكلية*\n\nاختر الكلية:",
      {
        reply_markup: new InlineKeyboard()
          .text("🏥 الطب", "leader_col_1")
          .text("🦷 الأسنان", "leader_col_2")
          .row()
          .text("💊 الصيدلة", "leader_col_3")
          .text("⚙️ الهندسة", "leader_col_4")
          .row()
          .text("💻 الحاسبات", "leader_col_5")
          .text("📊 الإدارية", "leader_col_6")
          .row()
          .text("📚 الإنسانية", "leader_col_7")
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/leader_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await showLeaderboard(ctx, "college", collegeId);
  });

  bot.callbackQuery("leader_majors", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📚 *تصفية لوحة الشرف بالتخصص*\n\nاختر الكلية أولاً:",
      {
        reply_markup: new InlineKeyboard()
          .text("💻 الحاسبات", "leader_majors_col_5")
          .text("⚙️ الهندسة", "leader_majors_col_4")
          .row()
          .text("🏥 الطب", "leader_majors_col_1")
          .text("📊 الإدارية", "leader_majors_col_6")
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/leader_majors_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s, i) => {
      kb.text(s.short_name, `leader_spec_${s.id}`);
    if (i % 2 === 1) kb.row();
    });
    kb.row();
    kb.text("🔙 الكليات", "leader_majors");
    await ctx.editMessageText(`📚 *تخصصات ${college?.name}*\n\nاختر التخصص:`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/leader_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await showLeaderboard(ctx, "specialty", specId);
  });

  bot.callbackQuery("leader_refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    await showLeaderboard(ctx, "global");
  });

  async function showLeaderboard(ctx: any, scope: "global" | "college" | "specialty", id?: number) {
    let entries: any[] = [];
    let scopeLabel = "🌍 لوحة الشرف العالمية";

    // قراءة من Supabase
    try {
        entries = await getTopContributorsFromDB(supabase, 10);
    } catch (e) {
        console.error("Supabase leaderboard error:", e);
    }
    // Fallback للبيانات المحلية
    if (entries.length === 0) {
    entries = []; // لا fallback — Supabase فقط
    }

    if (scope === "college" && id) {
    const college = getCollegeById(id);
    // فلترة حسب الكلية
    entries = entries.filter((e: any) => e.current_college_id === id || e.college_id === id);
      scopeLabel = `🏛 لوحة شرف - ${college?.name}`;
    } else if (scope === "specialty" && id) {
    const spec = getSpecialtyById(id);
    entries = entries.filter((e: any) => e.current_specialty_id === id || e.specialty_id === id);
      scopeLabel = `📚 لوحة شرف - ${spec?.name}`;
    }

    let msg = `${scopeLabel}\n\n`;
    if (entries.length === 0) {
      msg += TEXTS.leaderboard.empty_filtered;
    } else {
      entries.slice(0, 10).forEach((e, idx) => {
        const rank = idx + 1;
        const badge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
        msg += `${badge} *${e.student_name}* — ${e.points} نقطة\n`;
        msg += `     📥 ${e.contributions_count} مساهمة • 📚 ${e.specialty_name}\n\n`;
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: leaderboardKeyboard(),
      parse_mode: "Markdown",
    });
  }

  // S12: حسابي
  bot.callbackQuery("menu_profile", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);

    // قراءة بيانات الطالب من Supabase
    let dbStudent: any = null;
    let unreadCount = 0;
    let pendingCount = 0;
    let totalDownloads = 0;
    let acceptedContribs = 0;

    try {
        dbStudent = await getStudent(supabase, ctx.from.id);
        unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id);
        const contribs = await getStudentContributions(supabase, ctx.from.id);
        pendingCount = contribs.filter((c: any) => c.status === "pending").length;
        if (dbStudent) {
          totalDownloads = dbStudent.total_downloads || 0;
          acceptedContribs = dbStudent.accepted_contributions || 0;
        }
    } catch (e) {
        console.error("Supabase profile error:", e);
    }

    const collegeId = dbStudent?.current_college_id || userState.current_college_id;
    const specialtyId = dbStudent?.current_specialty_id || userState.current_specialty_id;
    const level = dbStudent?.current_level || userState.current_level;

    const college = collegeId ? getCollegeById(collegeId)?.name : undefined;
    const specialty = specialtyId ? getSpecialtyById(specialtyId)?.name : undefined;

    const msg =
      TEXTS.profile.title(dbStudent?.first_name || userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: totalDownloads || userState.total_downloads,
        accepted_contributions: acceptedContribs || userState.accepted_contributions,
        pending_contributions: pendingCount,
        current_college: college,
        current_specialty: specialty,
        current_level: level,
      });

    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_contributions", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = "📋 *مساهماتي*\n\n";

    // قراءة من Supabase
    let dbContribs: any[] = [];
    try {
        dbContribs = await getStudentContributions(supabase, ctx.from.id);
    } catch (e) {
        console.error("Supabase contributions error:", e);
    }

    if (dbContribs.length === 0) {
      msg += TEXTS.profile.no_contributions;
    } else {
      dbContribs.forEach((c: any) => {
        const icon = c.status === "approved" ? "✅" : c.status === "pending" ? "⏳" : "❌";
        const statusLabel = c.status === "approved" ? "مقبولة" : c.status === "pending" ? "قيد المراجعة" : "مرفوضة";
        const subject = getSubjectByIdWithFallback(c.subject_id);
        msg += `${icon} #${c.id} - ${c.file_name}\n`;
        msg += `   📚 ${subject?.name || "غير معروف"}\n   📅 ${new Date(c.created_at).toLocaleDateString("ar")} • ${statusLabel}\n`;
        if (c.reject_reason) msg += `   ❓ ${c.reject_reason}\n`;
        msg += "\n";
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_downloads", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = "📥 *آخر تحميلاتي*\n\n";

    // قراءة من Supabase
    let dbDownloads: any[] = [];
    try {
        dbDownloads = await getRecentDownloads(supabase, ctx.from.id, 5);
    } catch (e) {
        console.error("Supabase downloads error:", e);
    }

    if (dbDownloads.length === 0) {
      msg += TEXTS.profile.no_downloads;
    } else {
    for (let i = 0; i < dbDownloads.length; i++) {
        const d = dbDownloads[i];
        // قراءة عنوان المحتوى
        let contentTitle = "ملف";
          try {
            const content = await getContentById(supabase, d.content_id);
            if (content) contentTitle = content.title || content.file_name || "ملف";
          } catch {}
        msg += `${i + 1}. 📄 ${contentTitle}\n   📅 ${new Date(d.downloaded_at).toLocaleDateString("ar")}\n\n`;
    }
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  // شاشة الإشعارات
  bot.callbackQuery("my_notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
    // محاكاة: نستخدم MOCK_STUDENT_NOTIFICATIONS (في الإنتاج ستُستعلم من DB)
    let notifications: any[] = [];
    try { notifications = await getStudentNotifications(supabase, ctx.from.id); } catch(e) { console.error('getStudentNotifications error:', e); }
    let msg = "🔔 *الإشعارات*\n\n";
    if (notifications.length === 0) {
      msg += "📭 لا توجد إشعارات حالياً.";
    } else {
      notifications.forEach((n) => {
        const icon = n.is_read ? "📭" : "🆕";
        msg += `${icon} *${n.title}*\n   📅 ${n.created_at}\n   ${n.body}\n\n`;
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("✅ تعليم الكل كمقروء", "mark_notifications_read")
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("mark_notifications_read", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    try { await markNotificationsRead(supabase, ctx.from.id); } catch(e) { console.error('markNotificationsRead error:', e); }
    await ctx.editMessageText(
      "✅ *تم تعليم كل الإشعارات كمقروءة.*",
      {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("change_major", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🔄 *تغيير التخصص*\n\nاختر كليتك الجديدة:",
      {
        reply_markup: collegesKeyboard(0),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("back_to_profile", async (ctx) => {
    await ctx.answerCallbackQuery();
    // محاكاة العودة للحساب
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const college = userState.current_college_id ? getCollegeById(userState.current_college_id)?.name : undefined;
    const specialty = userState.current_specialty_id ? getSpecialtyById(userState.current_specialty_id)?.name : undefined;
    const pending = userState.my_contributions.filter((c) => c.status === "pending").length;
    let unreadCount = 0;
    try { unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id); } catch(e) { console.error('getUnreadNotificationsCount error:', e); }
    const msg =
      TEXTS.profile.title(userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: userState.total_downloads,
        accepted_contributions: userState.accepted_contributions,
        pending_contributions: pending,
        current_college: college,
        current_specialty: specialty,
        current_level: userState.current_level,
      });
    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });

  // ====== أزرار الرجوع ======
  bot.callbackQuery("back_to_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.main_menu.welcome, {
      reply_markup: mainMenuKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    const bc = breadcrumb("🏛 الكليات");
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_college.title}${TEXTS.choose_college.footer}`, {
      reply_markup: collegesKeyboard(0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_majors_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_major.title}`, {
      reply_markup: majorsKeyboard(spec.college_id, 0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_levels_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`, `📚 ${spec.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_level.title}`, {
      reply_markup: levelsKeyboard(specId),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_semesters_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    const college = getCollegeById(spec.college_id);
    const bc = breadcrumb(
      "🏛 الكليات",
      `${college?.emoji} ${college?.short_name}`,
      `📚 ${spec.short_name}`,
      `📊 المستوى ${level}`
    );
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_semester.title}`, {
      reply_markup: semestersKeyboard(specId, level),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_subjects_from_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) return;
    const spec = getSpecialtyById(subject.specialty_id);
    const college = getCollegeById(spec?.college_id || 0);

    const bc = subject.specialty_id === 16
      ? breadcrumb(
          "🏛 الكليات",
          `${college?.emoji} ${college?.short_name}`,
          `📚 ${spec?.short_name}`,
          `📊 المستوى ${subject.level}`,
          `📅 الفصل ${subject.semester}`
        )
      : "📖 اختر المادة";

    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_subject.title}`, {
      reply_markup: subjectsKeyboard(subject.specialty_id, subject.level, subject.semester, 0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_subject_menu_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) return;
    await ctx.editMessageText(TEXTS.subject_menu.title(subject.name), {
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_files_(\d+)_(\w+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const category = ctx.match[2];
    await showFilesList(ctx, subjectId, category);
  });

  // ====== قناة اللجنة + تواصل ======
  bot.callbackQuery("menu_committee", async (ctx) => {
    await ctx.answerCallbackQuery();
    let channelUrl = "https://t.me/+ust_central_committee";
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "central" });
        if (chs.length > 0 && chs[0].channel_url) {
          channelUrl = chs[0].channel_url;
        }
    } catch (e) { console.error("Supabase channels error:", e); }
    await ctx.editMessageText(
      "📢 *قناة اللجنة العلمية المركزية*\n\n" +
        "للحصول على آخر التحديثات والإعلانات المركزية:\n\n" +
        `🔗 ${channelUrl}`,
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channelUrl)
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== قناة لجنة الكلية (زر جديد في شاشة التخصصات) ======
  bot.callbackQuery(/committee_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const college = getCollegeById(collegeId);
    await ctx.answerCallbackQuery();
    let channel: any = null;
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "college", college_id: collegeId });
        channel = chs[0];
    } catch (e) { console.error("Supabase channels error:", e); }
    if (!channel) {
    await ctx.reply("⚠️ لا توجد قناة لجنة مسجّلة لهذه الكلية بعد.");
    return;
    }
    await ctx.reply(
      `📢 *قناة اللجنة العلمية - ${college?.name}*\n\n` +
        `🔗 ${channel.channel_url}\n\n` +
        "انضم لقناة اللجنة لتصلك آخر إعلانات الكلية.",
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channel.channel_url)
          .row()
          .text("🔙 التخصصات", `back_to_college_majors_${collegeId}`),
        parse_mode: "Markdown",
    }
    );
  });

  // العودة لتخصصات كلية محددة (مساعد لزر اللجنة)
  bot.callbackQuery(/back_to_college_majors_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const college = getCollegeById(collegeId);
    await ctx.answerCallbackQuery();
    const bc = breadcrumb("🏛 الكليات", `${college?.emoji} ${college?.short_name}`);
    await ctx.editMessageText(`${bc}\n\n${TEXTS.choose_major.title}`, {
      reply_markup: majorsKeyboard(collegeId, 0),
      parse_mode: "Markdown",
    });
  });

  // ====== قناة لجنة التخصص (زر جديد في شاشة المستويات) ======
  bot.callbackQuery(/committee_specialty_(\d+)/, async (ctx) => {
    const specialtyId = parseInt(ctx.match[1]);
    const specialty = getSpecialtyById(specialtyId);
    await ctx.answerCallbackQuery();
    // البحث عن أي قناة مستوى لهذا التخصص
    let channel: any = null;
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "specialty_level", specialty_id: specialtyId });
        channel = chs[0];
    } catch (e) { console.error("Supabase channels error:", e); }
    if (!channel) {
    await ctx.reply(
        `⚠️ لا توجد قناة لجنة مسجّلة لتخصص *${specialty?.name}* بعد.\n\n` +
          "_في الإنتاج: سيتم توفير قناة لكل مستوى لكل تخصص._",
        { parse_mode: "Markdown" }
      );
    return;
    }
    await ctx.reply(
      `📢 *قناة اللجنة العلمية - ${specialty?.name}*\n\n` +
        `🔗 ${channel.channel_url}\n\n` +
        "انضم لقناة اللجنة لتصلك آخر إعلانات التخصص.",
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channel.channel_url)
          .row()
          .text(TEXTS.navigation.back_to_levels, `back_to_levels_${specialtyId}`),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("menu_contact", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📞 *تواصل معنا*\n\n" +
        "للدعم والملاحظات:\n" +
        "📧 البريد: support@ust.edu.ye\n" +
        "📱 تيليجرام: @ust_support\n\n" +
        "سعداء بتلقي ملاحظاتك!",
      {
        reply_markup: new InlineKeyboard().url("📱 راسلنا", "https://t.me/ust_support").row().text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== معالجة الأخطاء (مهم: لا تُرجع 500، فقط سجّل) ======
  bot.catch(async (err) => {
    const e = err.error as any;
    const ctx = err.ctx;
    console.error("Student bot error:", e?.message || e);

    // أخطاء يمكن تجاهلها بأمان (لا تُعِد 500)
    const ignorableMessages = [
      "query is too old",
      "message is not modified",
      "chat not found",
      "message to edit not found",
      "message to delete not found",
      "QUERY_ID_INVALID",
      "MESSAGE_ID_INVALID",
    ];
    const errMsg = (e?.message || "").toLowerCase();
    const isIgnorable = ignorableMessages.some((m) => errMsg.includes(m.toLowerCase()));
    if (isIgnorable) {
    // تجاهل هادئ - لن يُعيد Telegram المحاولة
    return;
    }

    // للأخطاء الأخرى، حاول إرسال رسالة خطأ للمستخدم
    try {
    if (ctx?.chat?.id) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى بكتابة /start"
        );
    }
    } catch {
    // تجاهل
    }
  });

  return bot;
}

// ============================================
// Cloudflare Worker Entry Point
// ============================================
export interface Env {
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  ENVIRONMENT: string;
  WORKERS_SUBDOMAIN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  // KV bindings (مضافة في wrangler.student.toml)
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  // HMAC secret لتوقيع callback_data (منع التزوير)
  CALLBACK_SECRET: string;
}

let botInstance: Bot | null = null;
let supabaseClient: SupabaseClient | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
    // تهيئة Supabase (إلزامي في الإنتاج — لا fallback)
    if (!supabaseClient) {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
          return new Response(
            JSON.stringify({
              status: "error",
              error: "SUPABASE_URL or SUPABASE_SERVICE_KEY not set",
              hint: "Run: wrangler secret put SUPABASE_URL --config wrangler.student.toml",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        supabaseClient = new SupabaseClient({
          SUPABASE_URL: env.SUPABASE_URL,
          SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
        });
    }

    // تهيئة البوت مرة واحدة (يحتفظ بالـ KV bindings + callback secret)
    if (!botInstance) {
        botInstance = createStudentBot(env.BOT_TOKEN, supabaseClient!, env.SESSIONS, env.CACHE, env.CALLBACK_SECRET || "");
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            version: "3.0",
            supabase: "connected",
            kv_sessions: env.SESSIONS ? "bound" : "missing",
            kv_cache: env.CACHE ? "bound" : "missing",
            callback_signing: env.CALLBACK_SECRET ? "enabled" : "disabled",
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
    }

    if (url.pathname === "/webhook") {
        // معالجة الـ webhook بشكل آمن - إرجاع 200 دائماً لمنع إعادة المحاولة
        try {
          const callback = webhookCallback(botInstance, "cloudflare-mod");
          return await callback(request);
        } catch (err) {
          console.error("Webhook handler error (returning 200 to stop retries):", (err as Error)?.message || err);
          return new Response("", { status: 200 });
        }
    }

    return new Response(
        "🎓 UST Student Bot v3.0 (Production)\n\nWebhook: /webhook\nHealth: /health\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
    console.error("Worker fetch error:", error);
    return new Response("Internal Server Error", { status: 500 });
    }
  },
};
