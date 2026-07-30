// ============================================
// 🏆 Leaderboard Handlers — لوحة الشرف
// ============================================
// هذا الملف يحتوي على:
//   - menu_leaderboard, leader_all
//   - leader_colleges, leader_col_(\d+)
//   - leader_majors, leader_majors_col_(\d+)
//   - leader_spec_(\d+), leader_refresh
//   - showLeaderboard (دالة مساعدة)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
} from "../../shared/data/colleges";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient, getTopContributorsFromDB } from "../../shared/db";
import { leaderboardKeyboard } from "../../shared/keyboards";

// ============================================
// showLeaderboard — دالة مساعدة
// ============================================
async function showLeaderboard(
  supabase: SupabaseClient,
  ctx: any,
  scope: "global" | "college" | "specialty",
  id?: number
): Promise<void> {
  let entries: any[] = [];
  let scopeLabel = "🌍 روّاد الإحسان العالمية";

  // قراءة من Supabase
  try {
    entries = await getTopContributorsFromDB(supabase, 10);
  } catch (e) {
    console.error("Supabase leaderboard error:", e);
  }
  // Fallback للبيانات المحلية
  if (entries.length === 0) {
    entries = []; // لا fallback — Supabase فقط
  }

  if (scope === "college" && id) {
    const college = getCollegeById(id);
    // فلترة حسب الكلية
    entries = entries.filter((e: any) => e.current_college_id === id || e.college_id === id);
    scopeLabel = `🏛 روّاد الإحسان - ${college?.name}`;
  } else if (scope === "specialty" && id) {
    const spec = getSpecialtyById(id);
    entries = entries.filter((e: any) => e.current_specialty_id === id || e.specialty_id === id);
    scopeLabel = `📚 روّاد الإحسان - ${spec?.name}`;
  }

  let msg = `${scopeLabel}\n\n`;
  if (entries.length === 0) {
    msg += TEXTS.leaderboard.empty_filtered;
  } else {
    entries.slice(0, 10).forEach((e, idx) => {
      const rank = idx + 1;
      const badge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
      msg += `${badge} *${e.student_name}* — ${e.points} نقطة\n`;
      msg += `     📥 ${e.contributions_count} إحسان • 📚 ${e.specialty_name}\n\n`;
    });
  }
  await ctx.editMessageText(msg, {
    reply_markup: leaderboardKeyboard(),
    parse_mode: "Markdown",
  });
}

export function registerLeaderboardHandlers(bot: Bot, supabase: SupabaseClient): void {
  // S11: لوحة الشرف
  bot.callbackQuery("menu_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeaderboard(supabase, ctx, "global");
  });

  bot.callbackQuery("leader_all", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeaderboard(supabase, ctx, "global");
  });

  bot.callbackQuery("leader_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🏛 *تصفية روّاد الإحسان بالكلية*\n\nاختر الكلية:",
      {
        reply_markup: new InlineKeyboard()
          .text("🏥 الطب", "leader_col_1")
          .text("🦷 الأسنان", "leader_col_2")
          .row()
          .text("💊 الصيدلة", "leader_col_3")
          .text("⚙️ الهندسة", "leader_col_4")
          .row()
          .text("💻 الحاسبات", "leader_col_5")
          .text("📊 الإدارية", "leader_col_6")
          .row()
          .text("📚 الإنسانية", "leader_col_7")
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/leader_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await showLeaderboard(supabase, ctx, "college", collegeId);
  });

  bot.callbackQuery("leader_majors", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📚 *تصفية روّاد الإحسان بالتخصص*\n\nاختر الكلية أولاً:",
      {
        reply_markup: new InlineKeyboard()
          .text("💻 الحاسبات", "leader_majors_col_5")
          .text("⚙️ الهندسة", "leader_majors_col_4")
          .row()
          .text("🏥 الطب", "leader_majors_col_1")
          .text("📊 الإدارية", "leader_majors_col_6")
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery(/leader_majors_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s, i) => {
      kb.text(s.short_name, `leader_spec_${s.id}`);
    if (i % 2 === 1) kb.row();
    });
    kb.row();
    kb.text("🔙 الكليات", "leader_majors");
    await ctx.editMessageText(`📚 *تخصصات ${college?.name}*\n\nاختر التخصص:`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/leader_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await showLeaderboard(supabase, ctx, "specialty", specId);
  });

  bot.callbackQuery("leader_refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    await showLeaderboard(supabase, ctx, "global");
  });
}
