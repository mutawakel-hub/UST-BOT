// ============================================
// بوت الطالب - جامعة العلوم والتكنولوجيا (محسّن)
// Mockup على Cloudflare Workers + grammY
// 12 شاشة + شاشة معاينة ملف + breadcrumb + ملف PDF فعلي
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
  getMockFilesForSubject,
  searchFiles,
  type MockFile,
} from "../shared/data/subjects";
import {
  GLOBAL_LEADERBOARD,
  getLeaderboardByCollege,
  getLeaderboardBySpecialty,
} from "../shared/data/leaderboard";
import { TEXTS } from "../shared/texts";
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
  contributionKeyboard,
  searchKeyboard,
  searchResultsKeyboard,
  leaderboardKeyboard,
  profileKeyboard,
  breadcrumb,
} from "../shared/keyboards";

// URL لملف PDF التجريبي (من Worker منفصل)
const MOCK_PDF_URL = "https://ust-pdf-server.atow73768.workers.dev/sample.pdf";

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
  current_college_id?: number;
  current_specialty_id?: number;
  current_level?: number;
  total_downloads: number;
  accepted_contributions: number;
  recent_downloads: DownloadHistoryEntry[];
  my_contributions: ContributionEntry[];
  awaiting_contribution_for_subject?: number;
  awaiting_search?: boolean;
  last_file_id?: string; // لاستخدامه في زر التحميل
}

// مخزن مؤقت للحالات
const userStates = new Map<number, UserState>();

function getUserState(telegramId: number, firstName?: string, username?: string): UserState {
  if (!userStates.has(telegramId)) {
    // بيانات ثابتة لكل مستخدم (بدل Math.random)
    const seed = telegramId % 100;
    userStates.set(telegramId, {
      telegram_id: telegramId,
      first_name: firstName,
      username,
      total_downloads: 12 + (seed % 30),
      accepted_contributions: 1 + (seed % 4),
      recent_downloads: [
        {
          file_name: "مقدمة في تقنية المعلومات - المقرر النظري.pdf",
          subject_name: "مقدمة في تقنية المعلومات",
          date: "اليوم",
        },
        {
          file_name: "برمجة حاسوب (1) - اختبار نهائي.pdf",
          subject_name: "برمجة حاسوب (1) - Python",
          date: "أمس",
        },
        {
          file_name: "تراكيب البيانات - ملخص شامل.pdf",
          subject_name: "تراكيب البيانات",
          date: "قبل 3 أيام",
        },
      ],
      my_contributions: [
        {
          id: 9901,
          file_name: "ملخص Python.pdf",
          subject_name: "برمجة حاسوب (1) - Python",
          status: "approved",
          submitted_at: "قبل أسبوع",
        },
        {
          id: 9902,
          file_name: "نموذج اختبار قواعد بيانات.pdf",
          subject_name: "قواعد البيانات (1)",
          status: "pending",
          submitted_at: "قبل يومين",
        },
      ],
    });
  }
  return userStates.get(telegramId)!;
}

// ============================================
// إنشاء البوت
// ============================================
export function createStudentBot(token: string): Bot {
  const bot = new Bot(token);

  // ====== S1: القائمة الرئيسية ======
  bot.command("start", async (ctx) => {
    const userState = getUserState(ctx.from.id, ctx.from.first_name, ctx.from.username);
    if (ctx.from.username) userState.username = ctx.from.username;
    if (ctx.from.first_name) userState.first_name = ctx.from.first_name;

    await ctx.reply(TEXTS.main_menu.welcome, {
      reply_markup: mainMenuKeyboard(),
      parse_mode: "Markdown",
    });
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
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
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
        MOCK_PDF_URL
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
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
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

    const files = getMockFilesForSubject(subjectId, category);
    if (files.length === 0) {
      const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
      await ctx.editMessageText(`${bc}\n\n${TEXTS.files_list.no_files}`, {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_subject_menu,
          `back_to_subject_menu_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
    await ctx.editMessageText(`${bc}\n\n${TEXTS.files_list.title(subject.name, TYPE_LABELS[category])}`, {
      reply_markup: filesListKeyboard(files, subjectId),
      parse_mode: "Markdown",
    });
  }

  // S8b: شاشة معاينة الملف (جديدة)
  bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();

    // استخراج معلومات الملف
    const parts = fileId.split("_");
    const subjectId = parseInt(parts[1]);
    const category = parts[2];
    const fileIdx = parseInt(parts[3]) - 1;

    const files = getMockFilesForSubject(subjectId, category);
    const file = files[fileIdx];
    if (!file) {
      await ctx.reply("⚠️ الملف غير موجود.");
      return;
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    const msg =
      TEXTS.file_preview.title +
      TEXTS.file_preview.details({
        file_name: file.file_name,
        file_size_mb: file.file_size_mb,
        type_label: TYPE_LABELS[category] || category,
        subject_name: subject?.name || "غير معروف",
        uploaded_at: file.uploaded_at,
        download_count: file.download_count,
        uploaded_by: file.uploaded_by,
        is_starred: file.is_starred,
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

    const parts = fileId.split("_");
    const subjectId = parseInt(parts[1]);
    const category = parts[2];
    const fileIdx = parseInt(parts[3]) - 1;

    const files = getMockFilesForSubject(subjectId, category);
    const file = files[fileIdx];
    const subject = getSubjectByIdWithFallback(subjectId);
    if (!file || !subject) {
      await ctx.reply("⚠️ الملف غير موجود.");
      return;
    }

    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.total_downloads++;
    file.download_count++;
    userState.recent_downloads.unshift({
      file_name: file.file_name,
      subject_name: subject.name,
      date: "الآن",
    });
    if (userState.recent_downloads.length > 5) userState.recent_downloads.pop();

    // إرسال ملف PDF فعلي عبر URL
    try {
      await ctx.replyWithDocument(MOCK_PDF_URL, {
        caption: TEXTS.common.file_sent_with_caption
          .replace("{fileName}", file.file_name)
          .replace("{subjectName}", subject.name),
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("File send error:", err);
      await ctx.reply(
        `✅ *تم تسجيل تحميلك للملف*\n\n📄 ${file.file_name}\n📚 ${subject.name}\n\n⚠️ تعذّر إرسال الملف تلقائياً، أعد المحاولة لاحقاً.`,
        { parse_mode: "Markdown" }
      );
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

    const parts = fileId.split("_");
    const subjectId = parseInt(parts[1]);
    const category = parts[2];
    const fileIdx = parseInt(parts[3]) - 1;

    const files = getMockFilesForSubject(subjectId, category);
    const file = files[fileIdx];
    if (!file) {
      await ctx.reply("⚠️ الملف غير موجود.");
      return;
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    const msg =
      TEXTS.file_preview.title +
      TEXTS.file_preview.details({
        file_name: file.file_name,
        file_size_mb: file.file_size_mb,
        type_label: TYPE_LABELS[category] || category,
        subject_name: subject?.name || "غير معروف",
        uploaded_at: file.uploaded_at,
        download_count: file.download_count,
        uploaded_by: file.uploaded_by,
        is_starred: file.is_starred,
      });

    await ctx.reply(msg, {
      reply_markup: filePreviewKeyboard(fileId, subjectId),
      parse_mode: "Markdown",
    });
  });

  // S9: المساهمة
  bot.callbackQuery(/contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = subjectId;
    await ctx.editMessageText(TEXTS.contribution.intro(subject?.name || ""), {
      reply_markup: contributionKeyboard(subjectId),
      parse_mode: "Markdown",
    });
  });

  // استقبال ملف المساهمة
  bot.on(":document", async (ctx) => {
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    if (!userState.awaiting_contribution_for_subject) {
      await ctx.reply(
        "ℹ️ لم تختر مادة للمساهمة بعد.\n\nابدأ من: 🏛 الكليات → التخصص → المادة → 💡 مساهمة"
      );
      return;
    }

    const doc = ctx.message.document;
    const subjectId = userState.awaiting_contribution_for_subject;
    const subject = getSubjectByIdWithFallback(subjectId);
    const contributionId = 9900 + Math.floor(Math.random() * 1000);

    userState.my_contributions.unshift({
      id: contributionId,
      file_name: doc.file_name || "ملف بدون اسم",
      subject_name: subject?.name || "غير معروف",
      status: "pending",
      submitted_at: "الآن",
    });
    userState.awaiting_contribution_for_subject = undefined;

    await ctx.reply(
      TEXTS.contribution.received(contributionId, doc.file_name || "ملف"),
      {
        reply_markup: new InlineKeyboard()
          .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/cancel_contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = undefined;
    await ctx.editMessageText(TEXTS.contribution.cancel, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
    });
  });

  // S10: البحث
  bot.callbackQuery("menu_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_search = true;
    await ctx.editMessageText(TEXTS.search.intro, {
      reply_markup: searchKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.on(":text", async (ctx) => {
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    if (userState.awaiting_search) {
      userState.awaiting_search = false;
      const query = ctx.message.text;
      const results = searchFiles(query);

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

      const mappedResults = results.map((r) => ({
        id: r.file.id,
        file_name: r.file.file_name,
        subject_name: r.subject_name,
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
    let entries = GLOBAL_LEADERBOARD;
    let scopeLabel = "🌍 لوحة الشرف العالمية";
    if (scope === "college" && id) {
      const college = getCollegeById(id);
      entries = getLeaderboardByCollege(id);
      scopeLabel = `🏛 لوحة شرف - ${college?.name}`;
    } else if (scope === "specialty" && id) {
      const spec = getSpecialtyById(id);
      entries = getLeaderboardBySpecialty(id);
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
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    const college = userState.current_college_id ? getCollegeById(userState.current_college_id)?.name : undefined;
    const specialty = userState.current_specialty_id ? getSpecialtyById(userState.current_specialty_id)?.name : undefined;

    const pending = userState.my_contributions.filter((c) => c.status === "pending").length;

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
      reply_markup: profileKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_contributions", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    let msg = "📋 *مساهماتي*\n\n";
    if (userState.my_contributions.length === 0) {
      msg += TEXTS.profile.no_contributions;
    } else {
      userState.my_contributions.forEach((c) => {
        const icon = c.status === "approved" ? "✅" : c.status === "pending" ? "⏳" : "❌";
        const statusLabel = c.status === "approved" ? "مقبولة" : c.status === "pending" ? "قيد المراجعة" : "مرفوضة";
        msg += `${icon} #${c.id} - ${c.file_name}\n`;
        msg += `   📚 ${c.subject_name}\n   📅 ${c.submitted_at} • ${statusLabel}\n\n`;
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_downloads", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    let msg = "📥 *آخر تحميلاتي*\n\n";
    if (userState.recent_downloads.length === 0) {
      msg += TEXTS.profile.no_downloads;
    } else {
      userState.recent_downloads.forEach((d, i) => {
        msg += `${i + 1}. 📄 ${d.file_name}\n   📚 ${d.subject_name} • 📅 ${d.date}\n\n`;
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
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
    const userState = getUserState(ctx.from.id, ctx.from.first_name);
    const college = userState.current_college_id ? getCollegeById(userState.current_college_id)?.name : undefined;
    const specialty = userState.current_specialty_id ? getSpecialtyById(userState.current_specialty_id)?.name : undefined;
    const pending = userState.my_contributions.filter((c) => c.status === "pending").length;
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
      reply_markup: profileKeyboard(),
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
    await ctx.editMessageText(
      "📢 *قناة اللجنة العلمية المركزية*\n\n" +
        "للحصول على آخر التحديثات والإعلانات:\n\n" +
        "🔗 [انضم لقناة اللجنة](https://t.me/+ust_central_committee)",
      {
        reply_markup: new InlineKeyboard().url("🔗 انضم الآن", "https://t.me/+ust_central_committee").row().text(TEXTS.navigation.back_to_main, "back_to_main"),
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
}

let botInstance: Bot | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (!botInstance) {
        botInstance = createStudentBot(env.BOT_TOKEN);
      }

      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            version: "2.2",
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
          console.error("Webhook handler error (returning 200 to stop retries):", err?.message || err);
          return new Response("", { status: 200 });
        }
      }

      return new Response(
        "🎓 UST Student Bot v2.0 - Mockup\n\nWebhook: /webhook\nHealth: /health\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
