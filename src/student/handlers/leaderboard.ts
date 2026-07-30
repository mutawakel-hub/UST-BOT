// ============================================
// 🏆 Leaderboard Handlers — روّاد الإحسان
// ============================================
// هذا الملف يحتوي على:
//   - menu_leaderboard   (الشاشة الرئيسية: الترتيب الحالي / أرشيف الدورات)
//   - leader_current     (اختر الكلية)
//   - leader_college_{id} (اختر التخصص)
//   - leader_spec_{id}   (اختر المستوى)
//   - leader_level_{specId}_{level}  (أعلى 3 محسنين)
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

// ============================================
// مساعد: بناء لوحة الكليات (للترتيب الحالي)
// ============================================
function leaderboardCollegesKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  // عرض كليتين في كل صف (نفس نمط collegesKeyboard)
  for (let i = 0; i < COLLEGES.length; i += 2) {
    const c1 = COLLEGES[i];
    const c2 = COLLEGES[i + 1];
    kb.text(`${c1.emoji} ${c1.short_name}`, `leader_college_${c1.id}`);
    if (c2) {
      kb.text(`${c2.emoji} ${c2.short_name}`, `leader_college_${c2.id}`);
    }
    kb.row();
  }
  kb.text(TEXTS.navigation.back_to_main, "menu_leaderboard");
  return kb;
}

// ============================================
// مساعد: بناء لوحة التخصصات لكلية
// ============================================
function leaderboardSpecialtiesKeyboard(collegeId: number): InlineKeyboard {
  const specialties = getSpecialtiesByCollege(collegeId);
  const kb = new InlineKeyboard();
  // تخصص في كل صف
  for (const s of specialties) {
    kb.text(s.short_name, `leader_spec_${s.id}`).row();
  }
  kb.text("🔙 الكليات", "leader_current");
  return kb;
}

// ============================================
// مساعد: بناء لوحة المستويات للتخصص
// ============================================
function leaderboardLevelsKeyboard(specialtyId: number): InlineKeyboard {
  const levels = getLevelsForSpecialty(specialtyId);
  const kb = new InlineKeyboard();
  // 3 مستويات في كل صف
  for (let i = 0; i < levels.length; i += 3) {
    for (let j = 0; j < 3 && i + j < levels.length; j++) {
      kb.text(`المستوى ${levels[i + j]}`, `leader_level_${specialtyId}_${levels[i + j]}`);
    }
    kb.row();
  }
  // العودة لاختيار الكلية — نحتاج معرفة الكلية من التخصص
  const spec = getSpecialtyById(specialtyId);
  if (spec) {
    kb.text("🔙 التخصصات", `leader_college_${spec.college_id}`);
  }
  return kb;
}

export function registerLeaderboardHandlers(bot: Bot, supabase: SupabaseClient): void {
  // الشاشة الرئيسية: روّاد الإحسان
  bot.callbackQuery("menu_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.leaderboard.title, {
      reply_markup: leaderboardKeyboard(),
      parse_mode: "Markdown",
    });
  });

  // 🌍 الترتيب الحالي → اختيار الكلية
  bot.callbackQuery("leader_current", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.leaderboard.select_college, {
      reply_markup: leaderboardCollegesKeyboard(),
      parse_mode: "Markdown",
    });
  });

  // اختيار كلية → اختيار التخصص
  bot.callbackQuery(/leader_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const college = getCollegeById(collegeId);
    await ctx.answerCallbackQuery();
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }
    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
      await ctx.reply("⚠️ لا توجد تخصصات في هذه الكلية.");
      return;
    }
    await ctx.editMessageText(TEXTS.leaderboard.select_specialty(college.name), {
      reply_markup: leaderboardSpecialtiesKeyboard(collegeId),
      parse_mode: "Markdown",
    });
  });

  // اختيار تخصص → اختيار المستوى
  bot.callbackQuery(/leader_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }
    await ctx.editMessageText(TEXTS.leaderboard.select_level(spec.name), {
      reply_markup: leaderboardLevelsKeyboard(specId),
      parse_mode: "Markdown",
    });
  });

  // اختيار مستوى → عرض أعلى 3 محسنين
  bot.callbackQuery(/leader_level_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const spec = getSpecialtyById(specId);
    await ctx.answerCallbackQuery();
    if (!spec) return;

    let entries: any[] = [];
    try {
      entries = await getTopContributorsForLevel(supabase, specId, level, 3);
    } catch (e) {
      console.error("getTopContributorsForLevel error:", e);
    }

    let msg = TEXTS.leaderboard.header_level(spec.name, level);
    if (entries.length === 0) {
      msg += TEXTS.leaderboard.empty_level;
    } else {
      const badges = ["🥇", "🥈", "🥉"];
      entries.forEach((e, idx) => {
        const rank = idx + 1;
        msg += TEXTS.leaderboard.entry({
          badge: badges[idx],
          rank,
          name: e.first_name || "طالب",
          points: Number(e.total_points_current_cycle) || 0,
          contributions: Number(e.accepted_contributions) || 0,
        });
        msg += "\n";
      });
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("🔙 المستويات", `leader_spec_${specId}`)
        .row()
        .text(TEXTS.navigation.back_to_main, "menu_leaderboard"),
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
