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
// تعريف الأزرار والرسائل القابلة للتخصيص (60 عنصر)
// منظّمة في أقسام لتسهيل التصفّح
// ============================================

interface EditableItem {
  screen_key: string;
  text_key: string;
  label: string;
  default: string;
}

const EDITABLE_SECTIONS: { name: string; label: string; items: EditableItem[] }[] = [
  {
    name: "main_menu", label: "🏠 القائمة الرئيسية",
    items: [
      { screen_key: "main_menu", text_key: "welcome", label: "رسالة الترحيب", default: TEXTS.main_menu.welcome },
      { screen_key: "main_menu", text_key: "btn_colleges", label: "زر الكليات", default: TEXTS.main_menu.btn_colleges },
      { screen_key: "main_menu", text_key: "btn_search", label: "زر البحث", default: TEXTS.main_menu.btn_search },
      { screen_key: "main_menu", text_key: "btn_leaderboard", label: "زر روّاد الإحسان", default: TEXTS.main_menu.btn_leaderboard },
      { screen_key: "main_menu", text_key: "btn_profile", label: "زر حسابي", default: TEXTS.main_menu.btn_profile },
      { screen_key: "main_menu", text_key: "btn_committee", label: "زر قناة اللجنة", default: TEXTS.main_menu.btn_committee },
      { screen_key: "main_menu", text_key: "btn_contact", label: "زر تواصل معنا", default: TEXTS.main_menu.btn_contact },
      { screen_key: "main_menu", text_key: "btn_contribute", label: "زر إحسان علمي", default: TEXTS.main_menu.btn_contribute },
    ],
  },
  {
    name: "registration", label: "📝 التسجيل",
    items: [
      { screen_key: "registration", text_key: "intro", label: "مقدمة التسجيل", default: TEXTS.registration.intro },
      { screen_key: "registration", text_key: "btn_start", label: "زر ابدأ التسجيل", default: TEXTS.registration.btn_start },
      { screen_key: "registration", text_key: "btn_later", label: "زر لاحقاً", default: TEXTS.registration.btn_later },
      { screen_key: "registration", text_key: "select_college", label: "تعليمات اختيار الكلية", default: TEXTS.registration.select_college },
      { screen_key: "registration", text_key: "select_specialty", label: "تعليمات اختيار التخصص", default: TEXTS.registration.select_specialty },
      { screen_key: "registration", text_key: "select_level", label: "تعليمات اختيار المستوى", default: TEXTS.registration.select_level },
      { screen_key: "registration", text_key: "later_notice", label: "إشعار تأجيل التسجيل", default: TEXTS.registration.later_notice },
    ],
  },
  {
    name: "navigation_screens", label: "🧭 شاشات التنقل",
    items: [
      { screen_key: "choose_college", text_key: "title", label: "عنوان اختيار الكلية", default: TEXTS.choose_college.title },
      { screen_key: "choose_college", text_key: "footer", label: "تذييل اختيار الكلية", default: TEXTS.choose_college.footer },
      { screen_key: "choose_major", text_key: "title", label: "عنوان اختيار التخصص", default: TEXTS.choose_major.title },
      { screen_key: "choose_major", text_key: "no_specialties", label: "رسالة لا تخصصات", default: TEXTS.choose_major.no_specialties },
      { screen_key: "choose_level", text_key: "title", label: "عنوان اختيار المستوى", default: TEXTS.choose_level.title },
      { screen_key: "choose_level", text_key: "plan_button", label: "زر الخطة الاسترشادية", default: TEXTS.choose_level.plan_button },
      { screen_key: "choose_level", text_key: "plan_message", label: "رسالة الخطة الاسترشادية", default: TEXTS.choose_level.plan_message },
      { screen_key: "choose_semester", text_key: "title", label: "عنوان اختيار الفصل", default: TEXTS.choose_semester.title },
      { screen_key: "choose_semester", text_key: "sem1_label", label: "تسمية الفصل الأول", default: TEXTS.choose_semester.sem1_label },
      { screen_key: "choose_semester", text_key: "sem2_label", label: "تسمية الفصل الثاني", default: TEXTS.choose_semester.sem2_label },
    ],
  },
  {
    name: "subject_files", label: "📚 المواد والملفات",
    items: [
      { screen_key: "subject_menu", text_key: "btn_contribute", label: "زر إحسان (داخل المادة)", default: TEXTS.subject_menu.btn_contribute },
      { screen_key: "subject_menu", text_key: "no_files_in_category", label: "رسالة لا ملفات في التصنيف", default: TEXTS.subject_menu.no_files_in_category },
      { screen_key: "files_list", text_key: "no_files", label: "رسالة لا توجد ملفات", default: TEXTS.files_list.no_files },
      { screen_key: "file_preview", text_key: "title", label: "عنوان معاينة الملف", default: TEXTS.file_preview.title },
      { screen_key: "file_preview", text_key: "btn_download", label: "زر تحميل الملف", default: TEXTS.file_preview.btn_download },
      { screen_key: "file_preview", text_key: "btn_back", label: "زر رجوع للقائمة", default: TEXTS.file_preview.btn_back },
    ],
  },
  {
    name: "search", label: "🔍 البحث",
    items: [
      { screen_key: "search", text_key: "intro", label: "مقدمة البحث", default: TEXTS.search.intro },
      { screen_key: "search", text_key: "no_results", label: "رسالة لا نتائج", default: TEXTS.search.no_results },
      { screen_key: "search", text_key: "new_search", label: "زر بحث جديد", default: TEXTS.search.new_search },
    ],
  },
  {
    name: "leaderboard", label: "🏆 روّاد الإحسان",
    items: [
      { screen_key: "leaderboard", text_key: "title", label: "عنوان الروّاد", default: TEXTS.leaderboard.title },
      { screen_key: "leaderboard", text_key: "btn_current", label: "زر الترتيب الحالي", default: TEXTS.leaderboard.btn_current },
      { screen_key: "leaderboard", text_key: "btn_archive", label: "زر أرشيف الدورات", default: TEXTS.leaderboard.btn_archive },
      { screen_key: "leaderboard", text_key: "archive_message", label: "رسالة الأرشيف", default: TEXTS.leaderboard.archive_message },
      { screen_key: "leaderboard", text_key: "select_college", label: "تعليمات اختيار الكلية", default: TEXTS.leaderboard.select_college },
      { screen_key: "leaderboard", text_key: "empty_level", label: "رسالة فراغ المستوى", default: TEXTS.leaderboard.empty_level },
    ],
  },
  {
    name: "profile", label: "👤 الحساب",
    items: [
      { screen_key: "profile", text_key: "btn_my_contributions", label: "زر إحساناتي", default: TEXTS.profile.btn_my_contributions },
      { screen_key: "profile", text_key: "btn_change_major", label: "زر تغيير التخصص", default: TEXTS.profile.btn_change_major },
      { screen_key: "profile", text_key: "btn_back", label: "زر رجوع", default: TEXTS.profile.btn_back },
      { screen_key: "profile", text_key: "no_contributions", label: "رسالة لا إحسانات", default: TEXTS.profile.no_contributions },
    ],
  },
  {
    name: "common", label: "💬 رسائل عامة",
    items: [
      { screen_key: "common", text_key: "loading", label: "رسالة جارٍ التحميل", default: TEXTS.common.loading },
      { screen_key: "common", text_key: "error", label: "رسالة خطأ عامة", default: TEXTS.common.error },
      { screen_key: "common", text_key: "file_sent", label: "رسالة نجاح الإرسال", default: TEXTS.common.file_sent },
      { screen_key: "common", text_key: "file_sent_with_caption", label: "رسالة نجاح التحميل", default: TEXTS.common.file_sent_with_caption },
    ],
  },
  {
    name: "navigation", label: "🔙 أزرار التنقل",
    items: [
      { screen_key: "navigation", text_key: "back_to_main", label: "رجوع للقائمة الرئيسية", default: TEXTS.navigation.back_to_main },
      { screen_key: "navigation", text_key: "back_to_colleges", label: "رجوع للكليات", default: TEXTS.navigation.back_to_colleges },
      { screen_key: "navigation", text_key: "back_to_majors", label: "رجوع للتخصصات", default: TEXTS.navigation.back_to_majors },
      { screen_key: "navigation", text_key: "back_to_levels", label: "رجوع للمستويات", default: TEXTS.navigation.back_to_levels },
      { screen_key: "navigation", text_key: "back_to_semesters", label: "رجوع للفصول", default: TEXTS.navigation.back_to_semesters },
      { screen_key: "navigation", text_key: "back_to_subjects", label: "رجوع للمواد", default: TEXTS.navigation.back_to_subjects },
      { screen_key: "navigation", text_key: "back_to_subject_menu", label: "رجوع لقائمة المادة", default: TEXTS.navigation.back_to_subject_menu },
      { screen_key: "navigation", text_key: "back_to_files_list", label: "رجوع لقائمة الملفات", default: TEXTS.navigation.back_to_files_list },
      { screen_key: "navigation", text_key: "next_page", label: "زر التالي", default: TEXTS.navigation.next_page },
      { screen_key: "navigation", text_key: "prev_page", label: "زر السابق", default: TEXTS.navigation.prev_page },
    ],
  },
];

// تجميع كل العناصر في قائمة مسطّحة للاستخدام السريع
const ALL_EDITABLE_ITEMS: EditableItem[] = EDITABLE_SECTIONS.flatMap(s => s.items);

// تصدير للاستخدام في messages.ts
export { EDITABLE_SECTIONS, ALL_EDITABLE_ITEMS, type EditableItem };

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

    let msg = "📝 *إدارة واجهة البوت*\n\nاختر قسماً للتخصيص:\n\n";
    const kb = new InlineKeyboard();
    for (let i = 0; i < EDITABLE_SECTIONS.length; i++) {
      const section = EDITABLE_SECTIONS[i];
      msg += `• ${section.label} (${section.items.length})\n`;
      kb.text(section.label, `settings_section_${i}`);
      if (i % 2 === 1) kb.row();
    }
    kb.row().text(ADMIN_TEXTS.navigation.back_to_settings, "system_settings");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // عرض عناصر قسم معين
  // ============================================
  bot.callbackQuery(/^settings_section_(\d+)$/, async (ctx) => {
    const sectionIdx = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    const section = EDITABLE_SECTIONS[sectionIdx];
    if (!section) {
      await ctx.reply("⚠️ قسم غير موجود.");
      return;
    }

    // اقرأ التخصيصات الحالية لكل screen_key في القسم
    const screenKeys = [...new Set(section.items.map(item => item.screen_key))];
    const customMap = new Map<string, string>();
    for (const sk of screenKeys) {
      const customs = await getCustomTextsForScreen(supabase, sk);
      for (const ct of customs) {
        if (ct.custom_value) customMap.set(`${ct.screen_key}:${ct.text_key}`, ct.custom_value);
      }
    }

    let msg = `${section.label}\n\n`;
    const kb = new InlineKeyboard();
    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i];
      const globalIdx = ALL_EDITABLE_ITEMS.indexOf(item);
      const currentVal = customMap.get(`${item.screen_key}:${item.text_key}`) || item.default;
      const isCustom = customMap.has(`${item.screen_key}:${item.text_key}`);
      const displayVal = currentVal.length > 30 ? currentVal.substring(0, 30) + "..." : currentVal;
      msg += `${isCustom ? "✏️" : "▪️"} ${item.label}: \`${displayVal}\`\n`;
      kb.text(`✏️ ${item.label.substring(0, 20)}`, `edit_item_${globalIdx}`);
      if (i % 2 === 1) kb.row();
    }
    kb.row().text(ADMIN_TEXTS.navigation.back_to_settings, "settings_interface");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // تعديل عنصر معين (زر أو رسالة) — طلب النص الجديد
  // ============================================
  bot.callbackQuery(/^edit_item_(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!(await requireSystemSettings(ctx))) return;

    const item = ALL_EDITABLE_ITEMS[idx];
    if (!item) {
      await ctx.reply("⚠️ عنصر غير موجود.");
      return;
    }

    // اقرأ القيمة الحالية
    const customs = await getCustomTextsForScreen(supabase, item.screen_key);
    const existing = customs.find((ct: any) => ct.text_key === item.text_key);
    const currentVal = existing?.custom_value || item.default;
    const isCustom = !!existing?.custom_value;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_text_edit = `item:${idx}`;
    session.awaiting_text_value = true;
    await saveSession(session);

    const displayVal = currentVal.length > 200 ? currentVal.substring(0, 200) + "..." : currentVal;

    await ctx.editMessageText(
      `✏️ *تعديل نص*\n\n` +
      `📝 *الاسم:* ${item.label}\n` +
      `📂 *القسم:* ${item.screen_key}\n` +
      `${isCustom ? "✏️ *مخصصة*" : "▪️ *افتراضية*"}\n\n` +
      `📄 *النص الحالي:*\n\`\`\`\n${displayVal}\n\`\`\`\n\n` +
      `أرسل *النص الجديد*:\n\n` +
      `_أرسل '-' لاستعادة الافتراضي._`,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "settings_interface"),
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
