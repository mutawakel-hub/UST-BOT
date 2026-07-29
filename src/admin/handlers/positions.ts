// ============================================
// 👥 Positions Handlers — إدارة المناصب
// ============================================
// هذا الملف يحتوي على:
//   - manage_admins (قائمة رئيسية للمناصب)
//   - list_positions (قائمة المناصب القابلة للإدارة)
//   - position_detail_(.+) (تفاصيل منصب)
//   - assign_position_(.+) (تعيين شاغل)
//   - confirm_revoke_(.+) (تأكيد إزالة شاغل)
//   - my_positions (مناصب المستخدم الحالي)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  getUserPermissions,
  getManageablePositions,
  getPositionScopeText,
  getPositionLevelLabel,
} from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getPositionById, getPositionHolder, getAdminUser } from "../helpers";

export function registerPositionHandlers(bot: Bot, supabase: SupabaseClient): void {
  bot.callbackQuery("manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(
        "❌ *ليست لديك صلاحية إدارة المناصب.*\n\nهذه الميزة متاحة فقط للمسؤول المركزي.",
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await ctx.editMessageText(
      ADMIN_TEXTS.positions.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.positions.btn_list_positions, "list_positions")
          .row()
          .text(ADMIN_TEXTS.positions.btn_my_positions, "my_positions")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("list_positions", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const manageablePositions = await getManageablePositions(
      ctx.from.id
    );

    if (manageablePositions.length === 0) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.empty,
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    let msg = ADMIN_TEXTS.positions.list_title(manageablePositions.length);
    const kb = new InlineKeyboard();
    for (const p of manageablePositions) {
      const holder = await getPositionHolder(supabase, p.position_id);
      const holderUser = holder ? await getAdminUser(supabase, holder.user_telegram_id) : null;
      msg += ADMIN_TEXTS.positions.position_entry({
        title: p.title,
        scope: await getPositionScopeText(p),
        holder_name: holderUser?.first_name,
        is_vacant: !holder,
      });
      kb.text(`${p.title.substring(0, 25)}...`, `position_detail_${p.position_id}`).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery(/position_detail_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const position = await getPositionById(supabase, positionId);
    await ctx.answerCallbackQuery();
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود.");
      return;
    }
    const holder = await getPositionHolder(supabase, positionId);
    const holderUser = holder ? await getAdminUser(supabase, holder.user_telegram_id) : null;

    let msg = `💼 *تفاصيل المنصب*\n\n`;
    msg += `👤 *العنوان:* ${position.title}\n`;
    msg += `📝 *الوصف:* ${position.description}\n`;
    msg += `📍 *النطاق:* ${getPositionScopeText(position)}\n\n`;
    if (holderUser) {
      msg += `✅ *الشاغل الحالي:* ${holderUser.first_name}\n`;
      msg += `🆔 *معرّفه:* \`${holderUser.telegram_id}\`\n`;
      msg += `📅 *منذ:* ${holder?.assigned_at}\n`;
    } else {
      msg += `⚠️ *المنصب شاغر*\n`;
    }

    const kb = new InlineKeyboard();
    if (holderUser) {
      kb.text(ADMIN_TEXTS.positions.btn_revoke, `revoke_position_${positionId}`);
    } else {
      kb.text(ADMIN_TEXTS.positions.btn_assign, `assign_position_${positionId}`);
    }
    kb.row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // تعيين شاغل منصب
  bot.callbackQuery(/assign_position_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_position_assign = { step: "name", position_id: positionId };
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.positions.assign_prompt_name,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `position_detail_${positionId}`),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/confirm_revoke_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    // تعطيل شاغل المنصب في DB
    try {
      await supabase.update("position_holders",
        { is_active: false },
        `position_id=eq.${positionId}&is_active=eq.true`
      );
    } catch (e) {
      console.error("Failed to revoke position holder:", e);
    }
    await ctx.answerCallbackQuery({ text: "✅ تم الإزالة" });
    await ctx.editMessageText(
      ADMIN_TEXTS.positions.revoke_success,
      {
        reply_markup: new InlineKeyboard()
          .text("📋 قائمة المناصب", "list_positions")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("my_positions", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    // قراءة مناصب المستخدم من getUserPermissions (من DB)
    const userPerms = await getUserPermissions(ctx.from.id);
    const myPositions = userPerms.positions;

    if (myPositions.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.my_positions_empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.positions.my_positions_title(myPositions.length);
    for (const p of myPositions) {
      const scope = await getPositionScopeText(p);
      msg += `• ${p.title}\n  📍 ${scope}\n\n`;
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });
}
