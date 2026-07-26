// ============================================
// بوت الطالب - جامعة العلوم والتكنولوجيا
// Mockup على Cloudflare Workers + grammY
// 12 شاشة كاملة + Pagination + تنقل كامل
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
  getSubjectsBySpecialtyLevelSemester,
  getMockFilesForSubject,
  NO_SUBJECTS_MESSAGE,
} from "../shared/data/subjects";
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
  contributionKeyboard,
  searchKeyboard,
  searchResultsKeyboard,
  leaderboardKeyboard,
  profileKeyboard,
  backOnlyKeyboard,
} from "../shared/keyboards";

// ============================================
// حالة المستخدم (محاكاة - في الإنتاج ستكون في KV)
// ============================================
interface UserState {
  telegram_id: number;
  username?: string;
  first_name?: string;
  current_college_id?: number;
  current_specialty_id?: number;
  current_level?: number;
  total_downloads: number;
  accepted_contributions: number;
  subscriptions: Set<number>;
  recent_downloads: Array<{ file_name: string; date: string }>;
  my_contributions: Array<{ id: number; file_name: string; status: string }>;
  awaiting_contribution_for_subject?: number;
  awaiting_search?: boolean;
}

// مخزن مؤقت للحالات (ينتهي عند إعادة تشغيل الـ Worker)
const userStates = new Map<number, UserState>();

function getUserState(telegramId: number): UserState {
  if (!userStates.has(telegramId)) {
    userStates.set(telegramId, {
      telegram_id: telegramId,
      total_downloads: Math.floor(Math.random() * 50) + 5,
      accepted_contributions: Math.floor(Math.random() * 5),
      subscriptions: new Set(),
      recent_downloads: [
        { file_name: "مقدمة في تقنية المعلومات - المقرر النظري.pdf", date: "اليوم" },
        { file_name: "برمجة حاسوب (1) - اختبار نهائي.pdf", date: "أمس" },
        { file_name: "تراكيب البيانات - ملخص شامل.pdf", date: "قبل 3 أيام" },
      ],
      my_contributions: [
        { id: 1, file_name: "ملخص Python.pdf", status: "approved" },
        { id: 2, file_name: "نموذج اختبار قواعد بيانات.pdf", status: "pending" },
      ],
    });
  }
  return userStates.get(telegramId)!;
}

// ============================================
// مساعدات callback parsing
// ============================================
function parseCallback(data: string): { action: string; params: Record<string, string> } {
  // صيغ مثل: col_5, major_16, level_1_spec_16, sem_1_spec_16_lvl_1
  // نُعيد action = أول قطعة، params = باقي الأزواج
  const parts = data.split("_");
  const action = parts[0];
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      params[parts[i]] = parts[i + 1];
    }
  }
  return { action, params };
}

// ============================================
// إنشاء البوت
// ============================================
export function createStudentBot(token: string): Bot {
  const bot = new Bot(token);

  // ====== S1: القائمة الرئيسية ======
  bot.command("start", async (ctx) => {
    const userState = getUserState(ctx.from.id);
    if (ctx.from.username) userState.username = ctx.from.username;
    if (ctx.from.first_name) userState.first_name = ctx.from.first_name;

    await ctx.reply(
      TEXTS.main_menu.welcome + "\n\n" + TEXTS.common.mockup_notice,
      {
        reply_markup: mainMenuKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== تنقلات الأزرار (callback queries) ======
  bot.callbackQuery(/menu_colleges/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.choose_college.title + TEXTS.choose_college.footer, {
      reply_markup: collegesKeyboard(0),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/colleges_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.choose_college.title + TEXTS.choose_college.footer, {
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

    await ctx.editMessageText(
      `🏛 *${college.name}*\n\n${TEXTS.choose_major.title}`,
      {
        reply_markup: majorsKeyboard(collegeId, 0),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/majors_(\d+)_page_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const page = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    await ctx.editMessageText(
      `🏛 *${college?.name}*\n\n${TEXTS.choose_major.title}`,
      {
        reply_markup: majorsKeyboard(collegeId, page),
        parse_mode: "Markdown",
      }
    );
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

    const userState = getUserState(ctx.from.id);
    userState.current_specialty_id = specId;
    userState.current_college_id = spec.college_id;

    await ctx.editMessageText(
      `📚 *${spec.name}*\n\n${TEXTS.choose_level.title}`,
      {
        reply_markup: levelsKeyboard(specId),
        parse_mode: "Markdown",
      }
    );
  });

  // الخطة الاسترشادية
  bot.callbackQuery(/plan_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `🗺 *الخطة الاسترشادية - ${spec?.name}*\n\n${TEXTS.choose_level.plan_message}`,
      {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_levels,
          `back_to_levels_${specId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار مستوى → قائمة الفصول
  bot.callbackQuery(/level_(\d+)_spec_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();

    const userState = getUserState(ctx.from.id);
    userState.current_level = level;

    await ctx.editMessageText(
      `📊 *${spec?.name} - المستوى ${level}*\n\n${TEXTS.choose_semester.title}`,
      {
        reply_markup: semestersKeyboard(specId, level),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار فصل → قائمة المواد
  bot.callbackQuery(/sem_(\d+)_spec_(\d+)_lvl_(\d+)/, async (ctx) => {
    const semester = parseInt(ctx.match[1]) as 1 | 2;
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();

    const subjects = getSubjectsBySpecialtyLevelSemester(specId, level, semester);
    if (subjects.length === 0) {
      await ctx.editMessageText(NO_SUBJECTS_MESSAGE, {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_semesters,
          `back_to_semesters_${specId}_${level}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(
      `📅 *${spec?.name} - المستوى ${level} - الفصل ${semester}*\n\n${TEXTS.choose_subject.title}`,
      {
        reply_markup: subjectsKeyboard(specId, level, semester, 0),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/subjects_(\d+)_(\d+)_(\d+)_page_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const semester = parseInt(ctx.match[3]) as 1 | 2;
    const page = parseInt(ctx.match[4]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    await ctx.editMessageText(
      `📅 *${spec?.name} - المستوى ${level} - الفصل ${semester}*\n\n${TEXTS.choose_subject.title}`,
      {
        reply_markup: subjectsKeyboard(specId, level, semester, page),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار مادة → قائمة المادة (S7)
  bot.callbackQuery(/subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectById(subjectId);
    await ctx.answerCallbackQuery();

    if (!subject) {
      await ctx.reply("⚠️ المادة غير موجودة.");
      return;
    }

    const userState = getUserState(ctx.from.id);
    const isSubscribed = userState.subscriptions.has(subjectId);

    await ctx.editMessageText(TEXTS.subject_menu.title(subject.name), {
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical, isSubscribed),
      parse_mode: "Markdown",
    });
  });

  // S8: عرض الملفات حسب النوع
  bot.callbackQuery(/type_book_theory_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "book_theory", "المقرر (نظري)");
  });

  bot.callbackQuery(/type_book_practical_(\d+)/, async (ctx) => {
    const subject = getSubjectById(parseInt(ctx.match[1]));
    if (!subject?.has_practical) {
      await ctx.answerCallbackQuery({ text: TEXTS.book_type.theory_only, show_alert: true });
      return;
    }
    await showFilesList(ctx, parseInt(ctx.match[1]), "book_practical", "المقرر (عملي)");
  });

  bot.callbackQuery(/type_exams_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "exam", "نماذج اختبارات");
  });

  bot.callbackQuery(/type_summaries_(\d+)/, async (ctx) => {
    await showFilesList(ctx, parseInt(ctx.match[1]), "summary", "ملخصات");
  });

  async function showFilesList(ctx: any, subjectId: number, category: string, typeLabel: string) {
    const subject = getSubjectById(subjectId);
    if (!subject) {
      await ctx.answerCallbackQuery();
      await ctx.reply("⚠️ المادة غير موجودة.");
      return;
    }
    await ctx.answerCallbackQuery();

    const files = getMockFilesForSubject(subjectId, category);
    if (files.length === 0) {
      await ctx.reply(
        `📭 *${subject.name} - ${typeLabel}*\n\n${TEXTS.book_type.no_files}`,
        {
          reply_markup: new InlineKeyboard().text(
            TEXTS.navigation.back_to_subject_menu,
            `back_to_subject_menu_${subjectId}`
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const kb = filesListKeyboard(files);
    kb.text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`);

    await ctx.reply(
      `📄 *${subject.name} - ${typeLabel}*\n\n${TEXTS.book_type.files_list}`,
      {
        reply_markup: kb,
        parse_mode: "Markdown",
      }
    );
  }

  // تحميل ملف (محاكاة)
  bot.callbackQuery(/file_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery({ text: TEXTS.common.loading });

    const userState = getUserState(ctx.from.id);
    userState.total_downloads++;

    // استخراج اسم الملف من البيانات
    const parts = fileId.split("_");
    const subjectId = parseInt(parts[1]);
    const category = parts[2];
    const subject = getSubjectById(subjectId);

    await ctx.reply(
      `✅ *تم تحميل الملف بنجاح!*\n\n` +
      `📄 الملف: \`mockup_${fileId}.pdf\`\n` +
      `📚 المادة: ${subject?.name || "غير معروف"}\n` +
      `🏷 التصنيف: ${category}\n\n` +
      `ℹ️ *وضع التجربة:* يتم محاكاة التحميل. في الإنتاج سيصلك الملف الفعلي من قناة التخزين.`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_subject_menu,
          `back_to_subject_menu_${subjectId}`
        ),
      }
    );
  });

  // S9: المساهمة
  bot.callbackQuery(/contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectById(subjectId);
    await ctx.answerCallbackQuery();

    const userState = getUserState(ctx.from.id);
    userState.awaiting_contribution_for_subject = subjectId;

    await ctx.reply(TEXTS.contribution.intro(subject?.name || ""), {
      reply_markup: contributionKeyboard(subjectId),
      parse_mode: "Markdown",
    });
  });

  // استقبال ملف المساهمة (محاكاة)
  bot.on(":document", async (ctx) => {
    const userState = getUserState(ctx.from.id);
    if (!userState.awaiting_contribution_for_subject) {
      await ctx.reply(
        "ℹ️ لم تختر مادة للمساهمة. ابدأ من: قائمة الكليات → التخصص → المادة → 💡 مساهمة"
      );
      return;
    }

    const doc = ctx.message.document;
    const subjectId = userState.awaiting_contribution_for_subject;
    const subject = getSubjectById(subjectId);
    const contributionId = Math.floor(Math.random() * 10000) + 1;

    userState.my_contributions.push({
      id: contributionId,
      file_name: doc.file_name || "ملف بدون اسم",
      status: "pending",
    });
    userState.awaiting_contribution_for_subject = undefined;

    await ctx.reply(TEXTS.contribution.received.replace("{id}", String(contributionId)), {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/cancel_contribute_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    userState.awaiting_contribution_for_subject = undefined;
    await ctx.reply(TEXTS.contribution.cancel, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
    });
  });

  // الاشتراك/إلغاء الاشتراك
  bot.callbackQuery(/subscribe_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🔔 تم الاشتراك!" });
    const userState = getUserState(ctx.from.id);
    userState.subscriptions.add(subjectId);
    const subject = getSubjectById(subjectId);
    const isSubscribed = userState.subscriptions.has(subjectId);
    await ctx.editMessageReplyMarkup({
      reply_markup: subjectMenuKeyboard(subjectId, subject?.has_practical || false, isSubscribed),
    });
  });

  bot.callbackQuery(/unsubscribe_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🔕 تم إلغاء الاشتراك" });
    const userState = getUserState(ctx.from.id);
    userState.subscriptions.delete(subjectId);
    const subject = getSubjectById(subjectId);
    const isSubscribed = userState.subscriptions.has(subjectId);
    await ctx.editMessageReplyMarkup({
      reply_markup: subjectMenuKeyboard(subjectId, subject?.has_practical || false, isSubscribed),
    });
  });

  // S10: البحث
  bot.callbackQuery(/menu_search/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    userState.awaiting_search = true;
    await ctx.editMessageText(TEXTS.search.intro, {
      reply_markup: searchKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.on(":text", async (ctx) => {
    const userState = getUserState(ctx.from.id);
    if (userState.awaiting_search) {
      userState.awaiting_search = false;
      const query = ctx.message.text.toLowerCase();
      // بحث بسيط في المواد والملفات
      const results: Array<{ id: string; file_name: string }> = [];
      for (const subject of SUBJECTS) {
        if (
          subject.name.toLowerCase().includes(query) ||
          subject.name.includes(ctx.message.text)
        ) {
          const files = getMockFilesForSubject(subject.id, "book_theory");
          files.forEach((f) => results.push({ id: f.id, file_name: f.file_name }));
        }
      }
      if (results.length === 0) {
        await ctx.reply(TEXTS.search.no_results, {
          reply_markup: new InlineKeyboard()
            .text("🔍 بحث جديد", "menu_search")
            .row()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
        });
        return;
      }
      await ctx.reply(TEXTS.search.results_header(results.length), {
        reply_markup: searchResultsKeyboard(results, 0),
        parse_mode: "Markdown",
      });
    } else {
      // أي رسالة نصية أخرى → توجيه للقائمة الرئيسية
      await ctx.reply(
        "👋 اكتب /start للعودة للقائمة الرئيسية، أو استخدم الأزرار للتنقل.",
        { reply_markup: mainMenuKeyboard() }
      );
    }
  });

  bot.callbackQuery(/search_result_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    userState.total_downloads++;
    await ctx.reply(
      `✅ *تم تحميل الملف من نتائج البحث*\n\n📄 الملف: \`mockup_${fileId}.pdf\``,
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/search_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    // عرض صفحة أخرى من النتائج (محاكاة)
    await ctx.reply(`📄 صفحة ${page + 1} من نتائج البحث (محاكاة)`);
  });

  // S11: لوحة الشرف
  bot.callbackQuery(/menu_leaderboard/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      TEXTS.leaderboard.title + "\n\n" + TEXTS.leaderboard.no_data,
      {
        reply_markup: leaderboardKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/leader_(colleges|majors|refresh)/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "ℹ️ محاكاة - لا توجد بيانات" });
  });

  // S12: حسابي
  bot.callbackQuery(/menu_profile/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    const college = userState.current_college_id
      ? getCollegeById(userState.current_college_id)?.name
      : undefined;
    const specialty = userState.current_specialty_id
      ? getSpecialtyById(userState.current_specialty_id)?.name
      : undefined;

    const msg =
      TEXTS.profile.title +
      TEXTS.profile.stats({
        total_downloads: userState.total_downloads,
        accepted_contributions: userState.accepted_contributions,
        current_college: college,
        current_specialty: specialty,
        current_level: userState.current_level,
      });

    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/my_contributions/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    let msg = "📋 *مساهماتي:*\n\n";
    if (userState.my_contributions.length === 0) {
      msg += "لا توجد مساهمات بعد.";
    } else {
      userState.my_contributions.forEach((c) => {
        const statusIcon = c.status === "approved" ? "✅" : c.status === "pending" ? "⏳" : "❌";
        msg += `${statusIcon} #${c.id} - ${c.file_name}\n`;
      });
    }
    await ctx.reply(msg, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_main,
        "back_to_main"
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/my_downloads/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = getUserState(ctx.from.id);
    let msg = "📥 *آخر تحميلاتي:*\n\n";
    if (userState.recent_downloads.length === 0) {
      msg += "لا توجد تحميلات بعد.";
    } else {
      userState.recent_downloads.forEach((d) => {
        msg += `📄 ${d.file_name} — ${d.date}\n`;
      });
    }
    await ctx.reply(msg, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_main,
        "back_to_main"
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/change_major/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🔄 *تغيير التخصص*\n\nاختر كليتك الجديدة:",
      {
        reply_markup: collegesKeyboard(0),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== أزرار الرجوع ======
  bot.callbackQuery(/back_to_main/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      TEXTS.main_menu.welcome + "\n\n" + TEXTS.common.mockup_notice,
      {
        reply_markup: mainMenuKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_colleges/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      TEXTS.choose_college.title + TEXTS.choose_college.footer,
      {
        reply_markup: collegesKeyboard(0),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_majors_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    const college = getCollegeById(spec.college_id);
    await ctx.editMessageText(
      `🏛 *${college?.name}*\n\n${TEXTS.choose_major.title}`,
      {
        reply_markup: majorsKeyboard(spec.college_id, 0),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_levels_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;
    await ctx.editMessageText(
      `📚 *${spec.name}*\n\n${TEXTS.choose_level.title}`,
      {
        reply_markup: levelsKeyboard(specId),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_semesters_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📊 *${spec?.name} - المستوى ${level}*\n\n${TEXTS.choose_semester.title}`,
      {
        reply_markup: semestersKeyboard(specId, level),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_subjects_from_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectById(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) return;
    const spec = getSpecialtyById(subject.specialty_id);
    await ctx.editMessageText(
      `📅 *${spec?.name} - المستوى ${subject.level} - الفصل ${subject.semester}*\n\n${TEXTS.choose_subject.title}`,
      {
        reply_markup: subjectsKeyboard(subject.specialty_id, subject.level, subject.semester, 0),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_subject_menu_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectById(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) return;
    const userState = getUserState(ctx.from.id);
    const isSubscribed = userState.subscriptions.has(subjectId);
    await ctx.editMessageText(TEXTS.subject_menu.title(subject.name), {
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical, isSubscribed),
      parse_mode: "Markdown",
    });
  });

  // ====== قناة اللجنة + تواصل ======
  bot.callbackQuery(/menu_committee/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "📢 *قناة اللجنة العلمية المركزية*\n\n" +
      "للحصول على آخر التحديثات والإعلانات:\n\n" +
      "🔗 [انضم لقناة اللجنة](https://t.me/+ust_central_committee)",
      {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_main,
          "back_to_main"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/menu_contact/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "📞 *تواصل معنا*\n\n" +
      "للدعم والملاحظات:\n" +
      "📧 البريد: support@ust.edu.ye\n" +
      "📱 تيليجرام: @ust_support\n\n" +
      "سعداء بتلقي ملاحظاتك!",
      {
        reply_markup: new InlineKeyboard().text(
          TEXTS.navigation.back_to_main,
          "back_to_main"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== معالجة الأخطاء ======
  bot.catch((err) => {
    console.error("Student bot error:", err);
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

      // فحص الصحة
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Webhook endpoint
      if (url.pathname === "/webhook") {
        const callback = webhookCallback(botInstance, "cloudflare-mod");
        return callback(request);
      }

      // الصفحة الرئيسية
      return new Response(
        "🎓 UST Student Bot - Mockup\n\n" +
          "Webhook: /webhook\n" +
          "Health: /health\n\n" +
          "Open this bot in Telegram: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
