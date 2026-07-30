// ============================================
// 🏆 Honors Handlers — التكريم ولوحة الشرف
// ============================================
// هذا الملف يحتوي على:
//   - leaderboard_update (تحديث لوحة الشرف)
//   - manage_honors (القائمة الرئيسية للتكريم)
//   - honors_pending (التكريمات المعلّقة)
//   - approve_honor_(\d+) (اعتماد تكريم)
//   - reject_honor_(\d+) (رفض تكريم)
//   - honors_approved (سجل التكريمات المعتمدة)
//   - honor_new (تكريم جديد)
//   - manage_reset_points (إعادة ضبط النقاط)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getHonors } from "../helpers";

export function registerHonorHandlers(bot: Bot, supabase: SupabaseClient): void {
  bot.callbackQuery("leaderboard_update", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.leaderboard_update.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.leaderboard_update.btn_global, "leader_global")
          .text(ADMIN_TEXTS.leaderboard_update.btn_college, "leader_college")
          .row()
          .text(ADMIN_TEXTS.leaderboard_update.btn_specialty, "leader_specialty")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("manage_honors", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_honors")) {
      await ctx.editMessageText("❌ *ليست لديك صلاحية إدارة التكريم.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    const pendingHonors = (await getHonors(supabase, "pending"));
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_pending(pendingHonors.length), "honors_pending")
          .row()
          .text(ADMIN_TEXTS.honors.btn_approved, "honors_approved")
          .row()
          .text(ADMIN_TEXTS.honors.btn_new, "honor_new")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("honors_pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = (await getHonors(supabase, "pending"));
    if (pending.length === 0) {
      await ctx.editMessageText(
        "✅ *لا توجد تكريمات معلّقة حالياً.*",
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    let msg = ADMIN_TEXTS.honors.pending_title(pending.length);
    const kb = new InlineKeyboard();
    pending.forEach((h) => {
      msg += ADMIN_TEXTS.honors.honor_entry({
        student_name: h.student_name,
        honor_title: h.honor_title,
        points_at_honor: h.points_at_honor,
        bonus_points: h.bonus_points,
      });
      kb.text(`👤 ${h.student_name} - ${h.honor_title.substring(0, 20)}...`, `honor_detail_${h.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery(/approve_honor_(\d+)/, async (ctx) => {
    const honorId = parseInt(ctx.match[1]);
    const honor = (await getHonors(supabase)).find((h: any) => h.id === honorId);
    await ctx.answerCallbackQuery({ text: "✅ تم الاعتماد" });
    if (honor) {
      honor.status = "approved";
      honor.approved_by_telegram_id = ctx.from.id;
      honor.approved_at = new Date().toISOString().substring(0, 10);
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.approve_success(honor?.student_name || "الطالب", honor?.bonus_points || 0),
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 التكريمات المعلّقة", "honors_pending")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/reject_honor_(\d+)/, async (ctx) => {
    const honorId = parseInt(ctx.match[1]);
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_honor_reject = honorId;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reject_prompt,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `honor_detail_${honorId}`),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("honors_approved", async (ctx) => {
    await ctx.answerCallbackQuery();
    const approved = (await getHonors(supabase, "approved"));
    if (approved.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.honors.log_empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    let msg = ADMIN_TEXTS.honors.log_title(approved.length);
    approved.forEach((h) => {
      msg += ADMIN_TEXTS.honors.log_entry({
        student_name: h.student_name,
        honor_title: h.honor_title,
        bonus_points: h.bonus_points,
        approved_at: h.approved_at || "غير معروف",
      });
    });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("honor_new", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_honor_new_step = "student_id";
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.new_honor_prompt_student,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // A14: إعادة ضبط النقاط (للمركزي فقط)
  // ============================================
  bot.callbackQuery("manage_reset_points", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("reset_points")) {
      await ctx.editMessageText("❌ *ليست لديك صلاحية إعادة ضبط النقاط.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reset_prompt,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_reset_global, "reset_global")
          .row()
          .text(ADMIN_TEXTS.honors.btn_reset_college, "reset_college")
          .text(ADMIN_TEXTS.honors.btn_reset_specialty, "reset_specialty")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
