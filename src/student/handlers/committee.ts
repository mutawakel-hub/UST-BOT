// ============================================
// 📢 Committee Handlers — قنوات اللجان + تواصل
// ============================================
// هذا الملف يحتوي على:
//   - menu_committee
//   - committee_college_(\d+)
//   - committee_specialty_(\d+)
//   - menu_contact
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { getCollegeById, getSpecialtyById } from "../../shared/data/colleges";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient, getCommitteeChannelsFromDB } from "../../shared/db";

export function registerCommitteeHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== قناة اللجنة + تواصل ======
  bot.callbackQuery("menu_committee", async (ctx) => {
    await ctx.answerCallbackQuery();
    let channelUrl = "https://t.me/+ust_central_committee";
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "central" });
        if (chs.length > 0 && chs[0].channel_url) {
          channelUrl = chs[0].channel_url;
        }
    } catch (e) { console.error("Supabase channels error:", e); }
    await ctx.editMessageText(
      "📢 *قناة اللجنة العلمية المركزية*\n\n" +
        "للحصول على آخر التحديثات والإعلانات المركزية:\n\n" +
        `🔗 ${channelUrl}`,
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channelUrl)
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== قناة لجنة الكلية (زر جديد في شاشة التخصصات) ======
  bot.callbackQuery(/committee_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const college = getCollegeById(collegeId);
    await ctx.answerCallbackQuery();
    let channel: any = null;
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "college", college_id: collegeId });
        channel = chs[0];
    } catch (e) { console.error("Supabase channels error:", e); }
    if (!channel) {
    await ctx.reply("⚠️ لا توجد قناة لجنة مسجّلة لهذه الكلية بعد.");
    return;
    }
    await ctx.reply(
      `📢 *قناة اللجنة العلمية - ${college?.name}*\n\n` +
        `🔗 ${channel.channel_url}\n\n` +
        "انضم لقناة اللجنة لتصلك آخر إعلانات الكلية.",
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channel.channel_url)
          .row()
          .text("🔙 التخصصات", `back_to_college_majors_${collegeId}`),
        parse_mode: "Markdown",
    }
    );
  });

  // ====== قناة لجنة التخصص (زر جديد في شاشة المستويات) ======
  bot.callbackQuery(/committee_specialty_(\d+)/, async (ctx) => {
    const specialtyId = parseInt(ctx.match[1]);
    const specialty = getSpecialtyById(specialtyId);
    await ctx.answerCallbackQuery();
    // البحث عن أي قناة مستوى لهذا التخصص
    let channel: any = null;
    try {
        const chs = await getCommitteeChannelsFromDB(supabase, { scope_type: "specialty_level", specialty_id: specialtyId });
        channel = chs[0];
    } catch (e) { console.error("Supabase channels error:", e); }
    if (!channel) {
    await ctx.reply(
        `⚠️ لا توجد قناة لجنة مسجّلة لتخصص *${specialty?.name}* بعد.\n\n` +
          "_في الإنتاج: سيتم توفير قناة لكل مستوى لكل تخصص._",
        { parse_mode: "Markdown" }
      );
    return;
    }
    await ctx.reply(
      `📢 *قناة اللجنة العلمية - ${specialty?.name}*\n\n` +
        `🔗 ${channel.channel_url}\n\n` +
        "انضم لقناة اللجنة لتصلك آخر إعلانات التخصص.",
      {
        reply_markup: new InlineKeyboard()
          .url("🔗 انضم الآن", channel.channel_url)
          .row()
          .text(TEXTS.navigation.back_to_levels, `back_to_levels_${specialtyId}`),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("menu_contact", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📞 *تواصل معنا*\n\n" +
        "للدعم والملاحظات:\n" +
        "📧 البريد: support@ust.edu.ye\n" +
        "📱 تيليجرام: @ust_support\n\n" +
        "سعداء بتلقي ملاحظاتك!",
      {
        reply_markup: new InlineKeyboard().url("📱 راسلنا", "https://t.me/ust_support").row().text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
    }
    );
  });
}
