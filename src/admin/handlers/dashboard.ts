// ============================================
// 📊 Dashboard Handlers — /start + back_to_dashboard
// ============================================

import { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions, getPositionLevelLabel } from "../../shared/rbac";
import { AdminSession, getOrCreateSession, saveSession, resetSessionAwaitingStates } from "../state";
import { buildDynamicDashboard, getPendingCount, getRoleLabel } from "../helpers";

export function registerDashboardHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== /start ======
  bot.command("start", async (ctx) => {
    console.log(`🚀 [/start] Received from user ${ctx.from.id} (${ctx.from.first_name})`);
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    console.log(`📋 [/start] Perms result for ${ctx.from.id}:`);
    console.log(`   is_central: ${perms.is_central}`);
    console.log(`   positions.length: ${perms.positions.length}`);
    console.log(`   permissions.size: ${perms.permissions.size}`);

    // تحقق أن المستخدم مسؤول فعلًا
    if (!perms.is_central && perms.positions.length === 0) {
      console.error(`❌ [/start] Access DENIED for user ${ctx.from.id} — no active positions`);
      await ctx.reply(
        "⛔ *غير مصرّح لك بالدخول*\n\n" +
        "لا تملك منصباً إدارياً نشطاً في النظام.\n\n" +
        "_لو تعتقد أن هذا خطأ، تأكد من:_" +
        "\n• أنك مسجّل في جدول `admin_users`" +
        "\n• أنك معيّن في `position_holders` كـ `is_active = true`" +
        "\n• أن الـ View `user_permissions` موجود في قاعدة البيانات" +
        "\n\n_ℹ️ تظهر رسالة خطأ مفصّلة في سجلّات Worker — شاركها مع المطوّر._",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const roleLabel = getRoleLabel(perms);
    const pendingCount = await getPendingCount(supabase);

    await ctx.reply(
      ADMIN_TEXTS.dashboard.title(session.first_name, roleLabel, pendingCount),
      {
        reply_markup: buildDynamicDashboard(perms, pendingCount),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== back_to_dashboard ======
  bot.callbackQuery("back_to_dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    resetSessionAwaitingStates(session);
    await saveSession(session);

    const perms = await getUserPermissions(ctx.from.id);
    const roleLabel = getRoleLabel(perms);
    const pendingCount = await getPendingCount(supabase);

    await ctx.editMessageText(
      ADMIN_TEXTS.dashboard.title(session.first_name, roleLabel, pendingCount),
      {
        reply_markup: buildDynamicDashboard(perms, pendingCount),
        parse_mode: "Markdown",
      }
    );
  });
}
