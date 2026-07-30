// ============================================
// 🚀 Start Handlers — /start + التسجيل الإلزامي
// ============================================
// هذا الملف يحتوي على:
//   - bot.command("start")
//   - bot.callbackQuery("start_registration")
//   - bot.callbackQuery("skip_registration")
//   - bot.callbackQuery(/reg_col_(\d+)/)
//   - bot.callbackQuery(/reg_major_(\d+)/)
//   - bot.callbackQuery(/reg_level_(\d+)_spec_(\d+)/)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getCollegeById,
  getSpecialtyById,
} from "../../shared/data/colleges";
import { TEXTS } from "../../shared/texts";
import {
  SupabaseClient,
  registerStudent,
  isStudentRegistered,
  getStudent,
} from "../../shared/db";
import {
  mainMenuKeyboard,
  collegesKeyboard,
  majorsKeyboard,
  levelsKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

export function registerStartHandlers(bot: Bot, supabase: SupabaseClient): void {
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
}
