// ============================================
// 📢 Broadcast Handlers — التعميم (ديناميكي حسب الصلاحية)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient, logBroadcast } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";
import { getStudentCountByScope } from "../helpers";

export function registerBroadcastHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A7: التعميم (ديناميكي حسب الصلاحية) ======
  bot.callbackQuery("broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    const kb = new InlineKeyboard();
    let title: string = ADMIN_TEXTS.broadcast.title;

    if (perms.is_central) {
      // المركزي: 4 خيارات
      title = ADMIN_TEXTS.broadcast.title_for_central;
      kb.text(ADMIN_TEXTS.broadcast.btn_all, "broadcast_scope_all").row();
      kb.text("🏛 لكلية محددة", "broadcast_select_college").row();
      kb.text("📚 لتخصص محدد", "broadcast_select_specialty").row();
      kb.text("📊 لمستوى محدد", "broadcast_select_level").row();
    } else if (perms.positions.some((p) => p.level === "college")) {
      // مسؤول الكلية: 3 خيارات (كلّيته + تخصص في كليته + مستوى في تخصص كليته)
      const collegePos = perms.positions.find((p) => p.level === "college");
      const college = getCollegeById(collegePos?.college_id || 0);
      const collegeCount = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: collegePos?.college_id });
      title = ADMIN_TEXTS.broadcast.title_for_college(college?.name || "");
      kb.text(ADMIN_TEXTS.broadcast.btn_my_college(college?.short_name || "", collegeCount), `broadcast_scope_college_${collegePos?.college_id}`).row();
      kb.text("📚 لتخصص محدد في كليتي", "broadcast_select_specialty_in_my_college").row();
      kb.text("📊 لمستوى محدد في كليتي", "broadcast_select_level_in_my_college").row();
    } else if (perms.positions.some((p) => p.level === "level")) {
      // مسؤول الدفعة: 1 خيار (مستواه فقط)
      const levelPos = perms.positions.find((p) => p.level === "level");
      const spec = getSpecialtyById(levelPos?.specialty_id || 0);
      const levelCount = await getStudentCountByScope(supabase, {
        scope_type: "level",
        scope_college_id: levelPos?.college_id,
        scope_specialty_id: levelPos?.specialty_id,
        scope_level: levelPos?.level_num,
      });
      title = ADMIN_TEXTS.broadcast.title_for_level(spec?.short_name || "", levelPos?.level_num || 0);
      kb.text(
        ADMIN_TEXTS.broadcast.btn_my_level(spec?.short_name || "", levelPos?.level_num || 0, levelCount),
        `broadcast_scope_level_${levelPos?.college_id}_${levelPos?.specialty_id}_${levelPos?.level_num}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار الكلية للتعاميم
  bot.callbackQuery("broadcast_select_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    for (const c of COLLEGES) {
      const count = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: c.id });
      kb.text(`${c.emoji} ${c.short_name} (${count})`, `broadcast_scope_college_${c.id}`).row();
    }
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_college, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار التخصص للتعاميم (أولاً يختار الكلية)
  bot.callbackQuery("broadcast_select_specialty", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_spec_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📚 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_spec_select_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    for (const s of specialties) {
      const count = await getStudentCountByScope(supabase, { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: s.id });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegeId}_${s.id}`).row();
    }
    kb.text("🔙 الكليات", "broadcast_select_specialty");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار التخصص في كليته
  bot.callbackQuery("broadcast_select_specialty_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const college = getCollegeById(collegePos?.college_id || 0);
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    for (const s of specialties) {
      const count = await getStudentCountByScope(supabase, {
        scope_type: "specialty",
        scope_college_id: collegePos?.college_id,
        scope_specialty_id: s.id,
      });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegePos?.college_id}_${s.id}`).row();
    }
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي + مسؤول الكلية: اختيار المستوى (أولاً يختار التخصص)
  bot.callbackQuery("broadcast_select_level", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_lvl_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_lvl_select_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegeId}_${s.id}`).row();
    });
    kb.text("🔙 الكليات", "broadcast_select_level");
    await ctx.editMessageText(`📊 اختر التخصص في ${college?.name}:`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_lvl_select_spec_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const levels = getLevelsForSpecialty(specId);
    const kb = new InlineKeyboard();
    for (let i = 0; i < levels.length; i += 3) {
      for (let j = 0; j < 3 && i + j < levels.length; j++) {
        const lvl = levels[i + j];
        const count = await getStudentCountByScope(supabase, {
          scope_type: "level",
          scope_college_id: collegeId,
          scope_specialty_id: specId,
          scope_level: lvl,
        });
        kb.text(`مستوى ${lvl} (${count})`, `broadcast_scope_level_${collegeId}_${specId}_${lvl}`);
      }
      kb.row();
    }
    kb.text("🔙 التخصصات", `broadcast_lvl_select_college_${collegeId}`);
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_level(spec?.short_name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار المستوى في كليته
  bot.callbackQuery("broadcast_select_level_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegePos?.college_id}_${s.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر التخصص في كليتك:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // عند اختيار النطاق النهائي → طلب نص/صورة/ملف التعميم
  bot.callbackQuery(/broadcast_scope_all/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const count = await getStudentCountByScope(supabase, { scope_type: "all" });
    session.awaiting_broadcast_scope = "all";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "all", scope_label: "🌍 كل الطلاب", count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text("🌍 كل الطلاب", count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const count = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: collegeId });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "college";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "college", scope_college_id: collegeId, scope_label: `🏛 ${college?.name}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`🏛 ${college?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_specialty_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = await getStudentCountByScope(supabase, { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "specialty";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId, scope_label: `📚 ${spec?.name}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📚 ${spec?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_level_(\d+)_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = await getStudentCountByScope(supabase, { scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "level";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level, scope_label: `📊 ${spec?.short_name} - مستوى ${level}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📊 ${spec?.short_name} - مستوى ${level}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("confirm_broadcast", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const ctxData = session.broadcast_context || { scope_label: "غير محدد", count: 0 };
    const text = session.pending_broadcast_text || "(بدون نص)";
    session.awaiting_broadcast_text = undefined;
    session.awaiting_broadcast_scope = undefined;
    session.broadcast_context = undefined;
    session.pending_broadcast_text = undefined;
    await ctx.answerCallbackQuery({ text: "📢 تم الإرسال" });
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.sent(ctxData.count, ctxData.scope_label),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
