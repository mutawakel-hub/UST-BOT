// ============================================
// 🏆 Leaderboard Handlers — روّاد الإحسان
// ============================================
// هذا الملف يحتوي على:
//   - menu_leaderboard   (الشاشة الرئيسية: الترتيب الحالي / أرشيف الدورات)
//   - leader_current     (رسالة واحدة بكل الكليات والتخصصات والمستويات)
//   - leader_archive     (رابط قناة الأرشيف)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../../shared/data/colleges";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient, getTopContributorsForLevel } from "../../shared/db";
import { leaderboardKeyboard } from "../../shared/keyboards";

// قناة أرشيف الدورات السابقة
const ARCHIVE_CHANNEL_URL = "https://t.me/ust_ihsan_archive";

export function registerLeaderboardHandlers(bot: Bot, supabase: SupabaseClient): void {
  // الشاشة الرئيسية: روّاد الإحسان
  bot.callbackQuery("menu_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.leaderboard.title, {
      reply_markup: leaderboardKeyboard(),
      parse_mode: "Markdown",
    });
  });

  // 🌍 الترتيب الحالي → رسالة واحدة بكل الترتيب
  bot.callbackQuery("leader_current", async (ctx) => {
    await ctx.answerCallbackQuery();

    let msg = "🏆 *روّاد الإحسان — الفصل الحالي*\n\n";

    // اقرأ كل الطلاب بالنقاط دفعة واحدة
    let allStudents: any[] = [];
    try {
      const result = await supabase.select("students", {
        columns: "telegram_id,first_name,total_points_current_cycle,accepted_contributions,current_college_id,current_specialty_id,current_level",
        filter: "total_points_current_cycle=gt.0&is_blocked=eq.false",
        order: "total_points_current_cycle.desc",
        limit: 200,
      });
      allStudents = Array.isArray(result) ? result : [];
    } catch (e) {
      console.error("Leaderboard query error:", e);
    }

    if (allStudents.length === 0) {
      msg += "📭 لا يوجد محسنون بعد.\nكن أنت أول من يُحسن! 🌟";
      await ctx.editMessageText(msg, {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "menu_leaderboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // جمّع الطلاب حسب (college → specialty → level)
    const byScope: Record<string, any[]> = {};
    for (const s of allStudents) {
      const key = `${s.current_college_id || 0}-${s.current_specialty_id || 0}-${s.current_level || 0}`;
      if (!byScope[key]) byScope[key] = [];
      byScope[key].push(s);
    }

    const badges = ["🥇", "🥈", "🥉"];

    // مرّ على كل كلية → تخصص → مستوى
    for (const college of COLLEGES) {
      const specialties = getSpecialtiesByCollege(college.id);
      let hasCollegeContent = false;
      let collegeSection = `${college.emoji} *${college.short_name}*\n`;

      for (const spec of specialties) {
        const levels = getLevelsForSpecialty(spec.id);
        let hasSpecContent = false;
        let specSection = `  📚 ${spec.short_name}\n`;

        for (const level of levels) {
          const key = `${college.id}-${spec.id}-${level}`;
          const students = (byScope[key] || []).slice(0, 3);

          if (students.length === 0) continue; // تخطّى المستويات الفارغة

          hasSpecContent = true;
          hasCollegeContent = true;
          specSection += `    📊 م${level}: `;

          students.forEach((s, i) => {
            specSection += `${badges[i]} ${s.first_name} (${s.total_points_current_cycle}⭐) `;
          });
          specSection += "\n";
        }

        if (hasSpecContent) {
          collegeSection += specSection;
        }
      }

      if (hasCollegeContent) {
        msg += collegeSection + "\n";
      }
    }

    // لو الرسالة طويلة جداً (حد تلغرام 4096 حرف)
    if (msg.length > 4000) {
      // اعرض أول 3950 حرف + نقاط متقطعة
      msg = msg.substring(0, 3950) + "\n\n... (عرض جزئي)";
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "menu_leaderboard"),
      parse_mode: "Markdown",
    });
  });

  // 📜 أرشيف الدورات السابقة
  bot.callbackQuery("leader_archive", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      TEXTS.leaderboard.archive_message,
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 فتح القناة", ARCHIVE_CHANNEL_URL)
          .row()
          .text(TEXTS.navigation.back_to_main, "menu_leaderboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
