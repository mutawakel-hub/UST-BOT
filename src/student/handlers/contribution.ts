// ============================================
// 🤝 Contribution Handlers — المساهمة (مساران)
// ============================================
// هذا الملف يحتوي على:
//   - المسار القصير (من شاشة المادة - 4 خطوات):
//       contribute_(\d+), ctype_(\w+)_(\d+), cancel_contribute_(\d+)
//   - المسار الكامل (من القائمة الرئيسية - 9 خطوات):
//       menu_contribute_main, contribute_main_start,
//       cm_col_(\d+), cm_major_(\d+), cm_level_(\d+)_spec_(\d+),
//       cm_sem_(\d+)_spec_(\d+)_lvl_(\d+), cm_subj_(\d+),
//       cm_type_(\w+), cancel_contribute_main
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getSubjectByIdWithFallback,
  getSubjectsBySpecialtyLevelSemester,
} from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  collegesKeyboard,
  majorsKeyboard,
  levelsKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

export function registerContributionHandlers(bot: Bot, supabase: SupabaseClient): void {
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
        .text("🚀 ابدأ الإحسان", "contribute_main_start")
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
}
