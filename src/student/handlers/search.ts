// ============================================
// 🔍 Search Handlers — البحث عن الملفات
// ============================================
// هذا الملف يحتوي على:
//   - bot.callbackQuery("menu_search")
//   - bot.callbackQuery(/search_page_(\d+)/)
// (استقبال نص البحث الفعلي يحدث في handlers/messages.ts ضمن bot.on(":text"))
// ============================================

import { Bot } from "grammy";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { searchKeyboard } from "../../shared/keyboards";
import { getUserState } from "../state";

export function registerSearchHandlers(bot: Bot, supabase: SupabaseClient): void {
  // S10: البحث
  bot.callbackQuery("menu_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_search = true;
    await ctx.editMessageText(TEXTS.search.intro, {
      reply_markup: searchKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/search_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.reply(`📄 صفحة ${page + 1} من نتائج البحث`);
  });
}
