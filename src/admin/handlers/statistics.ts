// ============================================
// 📊 Statistics Handlers — الإحصائيات
// ============================================
// هذا الملف يحتوي على:
//   - statistics (عرض الإحصائيات حسب الصلاحية)
//   - stats_refresh (تحديث الإحصائيات)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession } from "../state";
import { getStatistics } from "../helpers";

export function registerStatisticsHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A9: الإحصائيات ======
  bot.callbackQuery("statistics", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    let statsText = ADMIN_TEXTS.statistics.title;
    if (perms.is_central) {
      statsText += ADMIN_TEXTS.statistics.content(await getStatistics(supabase));
    } else {
      // إحصائيات محدودة للنطاق (مسؤول كلية/مستوى)
      const collegeIds = Array.from(perms.effective_scope.colleges);
      statsText += `📊 *إحصائيات نطاقك:*\n\n`;
      // عدّ المحتوى في كليات المستخدم
      let contentCount = 0;
      let pendingCount = 0;
      try {
        if (collegeIds.length > 0) {
          const content = await supabase.select<{ id: number }>("content", {
            columns: "id",
            filter: `college_id=in.(${collegeIds.join(",")})&is_active=eq.true`,
          });
          contentCount = Array.isArray(content) ? content.length : 0;
        }
        const pending = await supabase.select<{ id: number }>("contributions", {
          columns: "id",
          filter: "status=eq.pending",
          limit: 100,
        });
        pendingCount = Array.isArray(pending) ? pending.length : 0;
      } catch (e) {
        console.error("Statistics count error:", e);
      }
      statsText += `📁 إجمالي الملفات في نطاقك: ${contentCount}\n`;
      statsText += `📥 الإحسانات المعلقة: ${pendingCount}\n`;
      statsText += `🏛 الكليات التي تديرها: ${collegeIds.length}\n`;
    }
    await ctx.editMessageText(statsText, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.statistics.refresh, "stats_refresh")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("stats_refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    await ctx.editMessageText(
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(await getStatistics(supabase)),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.statistics.refresh, "stats_refresh")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
