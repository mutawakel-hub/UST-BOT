// ============================================
// ⚙️ System Settings Handlers — إعدادات النظام
// ============================================
// المرحلة أ: معلومات النظام
// المرحلة ب: إدارة الواجهة (قريباً)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession } from "../state";
import { getStatistics } from "../helpers";
import { BOT_VERSION, BOT_VERSION_DATE } from "../../shared/version";

export function registerSystemSettingsHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // القائمة الرئيسية لإعدادات النظام
  // ============================================
  bot.callbackQuery("system_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("system_settings")) {
      await ctx.editMessageText(
        "❌ *ليست لديك صلاحية الوصول لإعدادات النظام.*\n\nهذه الميزة متاحة فقط لرئيس اللجنة العلمية المركزية.",
        {
          reply_markup: new InlineKeyboard().text("🔙 لوحة الإدارة", "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.system_settings.btn_interface, "settings_interface").row()
      .text(ADMIN_TEXTS.system_settings.btn_system_info, "settings_system_info").row()
      .text("🔙 لوحة الإدارة", "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.system_settings.title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // ℹ️ معلومات النظام
  // ============================================
  bot.callbackQuery("settings_system_info", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏳ جارٍ جمع المعلومات..." });
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("system_settings")) {
      await ctx.editMessageText("❌ ليست لديك صلاحية.", {
        reply_markup: new InlineKeyboard().text("🔙 لوحة الإدارة", "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // اجمع الإحصائيات
    let stats: any = null;
    try {
      stats = await getStatistics(supabase);
    } catch (e) {
      console.error("settings_system_info: getStatistics error:", e);
    }

    if (!stats) {
      stats = {
        total_users: 0, total_files: 0, pending_contributions: 0,
        total_downloads: 0, total_contributions: 0, total_broadcasts: 0,
        total_admins: 0, active_today: 0, new_this_week: 0,
      };
    }

    // حجم قاعدة البيانات
    let dbSize = "غير متاح";
    try {
      const sizeResult = await supabase.rpc("get_db_size", {});
      if (Array.isArray(sizeResult) && sizeResult.length > 0) {
        dbSize = sizeResult[0].size_pretty || "غير متاح";
      } else if (sizeResult && (sizeResult as any).size_pretty) {
        dbSize = (sizeResult as any).size_pretty;
      }
    } catch (e) {
      console.warn("get_db_size RPC failed:", e);
    }

    // آخر تحديث — نستخدم تاريخ الإصدار
    const lastUpdate = BOT_VERSION_DATE;

    const msg = ADMIN_TEXTS.system_settings.info_content({
      version: BOT_VERSION,
      version_date: BOT_VERSION_DATE,
      total_students: stats.total_users || 0,
      total_admins: stats.total_admins || 0,
      total_content: stats.total_files || 0,
      total_downloads: stats.total_downloads || 0,
      total_contributions: stats.total_contributions || 0,
      total_broadcasts: stats.total_broadcasts || 0,
      pending_contributions: stats.pending_contributions || 0,
      new_this_week: stats.new_this_week || 0,
      db_size: dbSize,
      last_update: lastUpdate,
      status: "نشط ✅",
    });

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.system_settings.btn_refresh, "settings_system_info")
      .row()
      .text(ADMIN_TEXTS.navigation.back_to_settings, "system_settings");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 📝 إدارة واجهة البوت (قريباً)
  // ============================================
  bot.callbackQuery("settings_interface", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("system_settings")) {
      await ctx.editMessageText("❌ ليست لديك صلاحية.", {
        reply_markup: new InlineKeyboard().text("🔙 لوحة الإدارة", "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(
      "📝 *إدارة واجهة البوت*\n\n" +
      "🔧 إدارة الأزرار — _قريباً_\n" +
      "💬 إدارة الرسائل — _قريباً_\n" +
      "👀 معاينة الواجهة — _قريباً_",
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_settings,
          "system_settings"
        ),
        parse_mode: "Markdown",
      }
    );
  });
}
