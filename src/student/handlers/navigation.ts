// ============================================
// 🧭 Navigation Handlers — التنقل بين الشاشات
// ============================================
// هذا الملف يحتوي على:
//   - menu_colleges, colleges_page_(\d+)
//   - col_(\d+), majors_(\d+)_page_(\d+)
//   - major_(\d+), plan_(\d+)
//   - level_(\d+)_spec_(\d+), sem_(\d+)_spec_(\d+)_lvl_(\d+)
//   - subjects_(\d+)_(\d+)_(\d+)_page_(\d+)
//   - subj_(\d+)
//   - جميع back_to_* (main, colleges, majors, levels, semesters, subjects_from, subject_menu, files, college_majors)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getCollegeById,
  getSpecialtiesByCollege,
  getSpecialtyById,
} from "../../shared/data/colleges";
import {
  getSubjectByIdWithFallback,
  getSubjectsBySpecialtyLevelSemester,
} from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import { resolveTextSync } from "../../shared/text-resolver";
import { SupabaseClient } from "../../shared/db";
import {
  mainMenuKeyboard,
  collegesKeyboard,
  majorsKeyboard,
  levelsKeyboard,
  semestersKeyboard,
  subjectsKeyboard,
  subjectMenuKeyboard,
  breadcrumb,
} from "../../shared/keyboards";
import { getUserState } from "../state";
import { showFilesList } from "./files";

// URL لملف PDF التجريبي - يُستخدم فقط كآخر خيار إذا فشل forwardMessage
const FALLBACK_PDF_URL = "https://ust-pdf-server.atow73768.workers.dev/sample.pdf";

export function registerNavigationHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== S2: اختيار الكلية (Inline Keyboard) ======
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
  bot.callbackQuery(/^col_(\d+)$/, async (ctx) => {
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
  bot.callbackQuery(/^major_(\d+)$/, async (ctx) => {
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
  bot.callbackQuery(/^subj_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    if (!subject) {
    await ctx.reply("⚠️ المادة غير موجودة.");
    return;
    }
    const spec = getSpecialtyById(subject.specialty_id);
    const college = getCollegeById(spec?.college_id || 0);

    // اقرأ عدّادات الملفات من Supabase
    let fileCounts: Record<string, number> | undefined;
    try {
      const result = await supabase.select("content", {
        columns: "content_type_id",
        filter: `subject_id=eq.${subjectId}&is_active=eq.true`,
      });
      if (Array.isArray(result) && result.length > 0) {
        fileCounts = {};
        for (const row of result) {
          const ct = row.content_type_id;
          fileCounts[ct] = (fileCounts[ct] || 0) + 1;
        }
      }
    } catch (e) {
      // تجاهل — سنستخدم 0
    }

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
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical, fileCounts),
      parse_mode: "Markdown",
    });
  });

  // ====== أزرار الرجوع ======
  bot.callbackQuery("back_to_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    const welcomeText = resolveTextSync("main_menu", "welcome", TEXTS.main_menu.welcome);
    await ctx.editMessageText(welcomeText, {
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

    // اقرأ عدّادات الملفات من Supabase
    let fileCounts: Record<string, number> | undefined;
    try {
      const result = await supabase.select("content", {
        columns: "content_type_id",
        filter: `subject_id=eq.${subjectId}&is_active=eq.true`,
      });
      if (Array.isArray(result) && result.length > 0) {
        fileCounts = {};
        for (const row of result) {
          const ct = row.content_type_id;
          fileCounts[ct] = (fileCounts[ct] || 0) + 1;
        }
      }
    } catch {}

    await ctx.editMessageText(TEXTS.subject_menu.title(subject.name), {
      reply_markup: subjectMenuKeyboard(subjectId, subject.has_practical, fileCounts),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/back_to_files_(\d+)_(\w+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const category = ctx.match[2];
    await showFilesList(supabase, ctx, subjectId, category);
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
}
