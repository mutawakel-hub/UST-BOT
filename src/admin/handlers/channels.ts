// ============================================
// 📢 Channels Handlers — قنوات اللجان
// ============================================
// هذا الملف يحتوي على:
//   - manage_channels (القائمة الرئيسية للقنوات)
//   - edit_channel_(\d+) (تعديل رابط قناة)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getChannelsByScope, getChannelById } from "../helpers";

export function registerChannelHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A12: إدارة روابط قنوات اللجان ======
  bot.callbackQuery("manage_channels", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("manage_committee_channels")) {
      await ctx.editMessageText(
        "❌ *ليست لديك صلاحية إدارة قنوات اللجان.*",
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await ctx.editMessageText(
      ADMIN_TEXTS.channels.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.channels.btn_central, "channels_central")
          .row()
          .text(ADMIN_TEXTS.channels.btn_colleges, "channels_colleges")
          .row()
          .text(ADMIN_TEXTS.channels.btn_levels, "channels_levels")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/edit_channel_(\d+)/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    const channel = await getChannelById(supabase, channelId);
    await ctx.answerCallbackQuery();
    if (!channel) return;
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_edit = channelId;
    await ctx.editMessageText(
      ADMIN_TEXTS.channels.edit_prompt(channel.display_name),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_channels"),
        parse_mode: "Markdown",
      }
    );
  });
}
