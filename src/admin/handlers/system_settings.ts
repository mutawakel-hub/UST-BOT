// ============================================
// ⚙️ System Settings Handlers — إعدادات النظام
// ============================================
// المرحلة أ: معلومات النظام ✅
// المرحلة ب: إدارة الواجهة (الأزرار + الرسائل) ✅
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS, TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getStatistics, getAdminPrimaryPositionId } from "../helpers";
import { BOT_VERSION, BOT_VERSION_DATE } from "../../shared/version";
import {
  saveCustomText,
  resetCustomText,
  getCustomTextsForScreen,
  invalidateTextCache,
} from "../../shared/text-resolver";

// ============================================
// Helper: فحص صلاحية system_settings
// ============================================
async function requireSystemSettings(ctx: any): Promise<boolean> {
  const perms = await getUserPermissions(ctx.from.id);
  if (!perms.permissions.has("system_settings")) {
    await ctx.editMessageText(
      "❌ *ليست لديك صلاحية.*\n\nهذه الميزة متاحة فقط لرئيس اللجنة العلمية المركزية.",
      {
        reply_markup: new InlineKeyboard().text("🔙 لوحة الإدارة", "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
    return false;
  }
  return true;
}

// ============================================
// تعريف الأزرار والرسائل القابلة للتخصيص
// ============================================
const EDITABLE_BUTTONS = [
  { screen_key: "main_menu", text_key: "btn_colleges", label: "زر الكليات", default: TEXTS.main_menu.btn_colleges },
  { screen_key: "main_menu", text_key: "btn_search", label: "زر البحث", default: TEXTS.main_menu.btn_search },
  { screen_key: "main_menu", text_key: "btn_leaderboard", label: "زر روّاد الإحسان", default: TEXTS.main_menu.btn_leaderboard },
  { screen_key: "main_menu", text_key: "btn_profile", label: "زر حسابي", default: TEXTS.main_menu.btn_profile },
  { screen_key: "main_menu", text_key: "btn_committee", label: "زر قناة اللجنة", default: TEXTS.main_menu.btn_committee },
  { screen_key: "main_menu", text_key: "btn_contact", label: "زر تواصل معنا", default: TEXTS.main_menu.btn_contact },
  { screen_key: "main_menu", text_key: "btn_contribute", label: "زر إحسان علمي", default: TEXTS.main_menu.btn_contribute },
];

const EDITABLE_MESSAGES = [
  { screen_key: "main_menu", text_key: "welcome", label: "رسالة الترحيب (لغير المسجلين)", default: TEXTS.main_menu.welcome },
  { screen_key: "registration", text_key: "intro", label: "رسالة التسجيل", default: TEXTS.registration.intro },
  { screen_key: "common", text_key: "file_sent", label: "رسالة نجاح التحميل", default: TEXTS.common.file_sent },
  { screen_key: "common", text_key: "error", label: "رسالة الخطأ العامة", default: TEXTS.common.error },
];

// تصدير للاستخدام في messages.ts
export { EDITABLE_BUTTONS, EDITABLE_MESSAGES };

export function registerSystemSettingsHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // القائمة الرئيسية لإعدادات النظام
  // ============================================
  bot.callbackQuery("system_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

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
  // 📝 إدارة واجهة البوت
  // ============================================
  bot.callbackQuery("settings_interface", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    const kb = new InlineKeyboard()
      .text("🔘 إدارة الأزرار", "settings_buttons").row()
      .text("💬 إدارة الرسائل", "settings_messages").row()
      .text(ADMIN_TEXTS.navigation.back_to_settings, "system_settings");

    await ctx.editMessageText(
      "📝 *إدارة واجهة البوت*\n\nاختر ما تريد تخصيصه:",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ============================================
  // 🔘 إدارة الأزرار — قائمة الأزرار
  // ============================================
  bot.callbackQuery("settings_buttons", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    // اقرأ التخصيصات الحالية من DB
    const customTexts = await getCustomTextsForScreen(supabase, "main_menu");
    const customMap = new Map<string, string>();
    for (const ct of customTexts) {
      if (ct.custom_value) customMap.set(ct.text_key, ct.custom_value);
    }

    let msg = "🔘 *إدارة الأزرار*\n\nالقائمة الرئيسية:\n\n";
    const kb = new InlineKeyboard();
    for (let i = 0; i < EDITABLE_BUTTONS.length; i++) {
      const btn = EDITABLE_BUTTONS[i];
      const currentVal = customMap.get(btn.text_key) || btn.default;
      const isCustom = customMap.has(btn.text_key);
      msg += `${isCustom ? "✏️" : "▪️"} ${btn.label}: \`${currentVal}\`\n`;
      kb.text(`✏️ ${btn.label}`, `edit_btn_${i}`);
      if (i % 2 === 1) kb.row();
    }
    kb.row().text(ADMIN_TEXTS.navigation.back_to_settings, "settings_interface");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // تعديل زر معين — طلب النص الجديد
  // ============================================
  bot.callbackQuery(/^edit_btn_(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    const btn = EDITABLE_BUTTONS[idx];
    if (!btn) {
      await ctx.reply("⚠️ زر غير موجود.");
      return;
    }

    // اقرأ القيمة الحالية
    const customTexts = await getCustomTextsForScreen(supabase, btn.screen_key);
    const existing = customTexts.find((ct: any) => ct.text_key === btn.text_key);
    const currentVal = existing?.custom_value || btn.default;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_text_edit = `btn:${idx}`;
    session.awaiting_text_value = true;
    await saveSession(session);

    await ctx.editMessageText(
      `🔘 *تعديل زر*\n\n` +
      `📝 *الاسم:* ${btn.label}\n` +
      `📄 *القيمة الحالية:* \`${currentVal}\`\n\n` +
      `أرسل *القيمة الجديدة* للزر:\n\n` +
      `_أرسل '-' لاستعادة الافتراضي._`,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "settings_buttons"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 💬 إدارة الرسائل — قائمة الرسائل
  // ============================================
  bot.callbackQuery("settings_messages", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    let msg = "💬 *إدارة الرسائل*\n\nاختر رسالة لتخصيصها:\n\n";
    const kb = new InlineKeyboard();
    for (let i = 0; i < EDITABLE_MESSAGES.length; i++) {
      const m = EDITABLE_MESSAGES[i];
      msg += `• ${m.label}\n`;
      kb.text(`✏️ ${m.label}`, `edit_msg_${i}`);
      kb.row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_settings, "settings_interface");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // تعديل رسالة معينة — عرض النص الحالي + طلب الجديد
  // ============================================
  bot.callbackQuery(/^edit_msg_(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    const m = EDITABLE_MESSAGES[idx];
    if (!m) {
      await ctx.reply("⚠️ رسالة غير موجودة.");
      return;
    }

    // اقرأ القيمة الحالية
    const customTexts = await getCustomTextsForScreen(supabase, m.screen_key);
    const existing = customTexts.find((ct: any) => ct.text_key === m.text_key);
    const currentVal = existing?.custom_value || m.default;
    const isCustom = !!existing?.custom_value;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_text_edit = `msg:${idx}`;
    session.awaiting_text_value = true;
    await saveSession(session);

    // اعرض النص الحالي (مقتطع لو طويل)
    const displayVal = currentVal.length > 200
      ? currentVal.substring(0, 200) + "..."
      : currentVal;

    await ctx.editMessageText(
      `💬 *تعديل رسالة*\n\n` +
      `📝 *الرسالة:* ${m.label}\n` +
      `${isCustom ? "✏️ *مخصصة*" : "▪️ *افتراضية*"}\n\n` +
      `📄 *النص الحالي:*\n\`\`\`\n${displayVal}\n\`\`\`\n\n` +
      `أرسل *النص الجديد*:\n\n` +
      `_أرسل '-' لاستعادة الافتراضي._`,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "settings_messages"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // ℹ️ معلومات النظام
  // ============================================
  bot.callbackQuery("settings_system_info", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏳ جارٍ جمع المعلومات..." });
    if (!(await requireSystemSettings(ctx))) return;

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
      last_update: BOT_VERSION_DATE,
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
}
