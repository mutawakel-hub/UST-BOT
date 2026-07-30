// ============================================
// ⚙️ Texts Handlers — تخصيص النصوص
// ============================================
// هذا الملف يحتوي على:
//   - customize_texts (القائمة الرئيسية لتخصيص النصوص)
//   - custom_screen_(.+) (تحديد شاشة لتخصيصها)
//   - reset_default (استعادة النص الافتراضي)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS, TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getOrCreateSession, saveSession } from "../state";
import { customTexts } from "../helpers";

export function registerTextHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A10: تخصيص النصوص ======
  bot.callbackQuery("customize_texts", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.customize.btn_main_menu, "custom_screen_main_menu")
          .text(ADMIN_TEXTS.customize.btn_choose_college, "custom_screen_choose_college")
          .row()
          .text(ADMIN_TEXTS.customize.btn_subject_menu, "custom_screen_subject_menu")
          .text(ADMIN_TEXTS.customize.btn_search, "custom_screen_search")
          .row()
          .text("↩️ استعادة الافتراضي", "reset_default")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/custom_screen_(.+)/, async (ctx) => {
    const screenKey = ctx.match[1];
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_text_edit = screenKey;
    session.awaiting_text_value = true;
    await ctx.answerCallbackQuery();
    const currentTexts: Record<string, string> = {
      main_menu: customTexts.get("main_menu") || TEXTS.main_menu.welcome,
      choose_college: customTexts.get("choose_college") || TEXTS.choose_college.title,
      subject_menu: customTexts.get("subject_menu") || "(ديناميكي)",
      search: customTexts.get("search") || TEXTS.search.intro,
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.edit_prompt(currentTexts[screenKey] || "(نص افتراضي)"),
      {
        reply_markup: new InlineKeyboard()
          .text("↩️ استعادة الافتراضي", "reset_default")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("reset_default", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_text_edit) {
      customTexts.delete(session.awaiting_text_edit);
      session.awaiting_text_edit = undefined;
      session.awaiting_text_value = undefined;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.reset,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
