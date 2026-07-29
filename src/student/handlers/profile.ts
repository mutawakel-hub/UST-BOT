// ============================================
// 👤 Profile Handlers — حساب الطالب
// ============================================
// هذا الملف يحتوي على:
//   - menu_profile
//   - my_contributions, my_downloads
//   - my_notifications, mark_notifications_read
//   - change_major, back_to_profile
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getCollegeById,
  getSpecialtyById,
} from "../../shared/data/colleges";
import { getSubjectByIdWithFallback } from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import {
  SupabaseClient,
  getStudent,
  getStudentNotifications,
  getUnreadNotificationsCount,
  markNotificationsRead,
  getStudentContributions,
  getRecentDownloads,
  getContentById,
} from "../../shared/db";
import {
  collegesKeyboard,
  profileKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

export function registerProfileHandlers(bot: Bot, supabase: SupabaseClient): void {
  // S12: حسابي
  bot.callbackQuery("menu_profile", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);

    // قراءة بيانات الطالب من Supabase
    let dbStudent: any = null;
    let unreadCount = 0;
    let pendingCount = 0;
    let totalDownloads = 0;
    let acceptedContribs = 0;

    try {
        dbStudent = await getStudent(supabase, ctx.from.id);
        unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id);
        const contribs = await getStudentContributions(supabase, ctx.from.id);
        pendingCount = contribs.filter((c: any) => c.status === "pending").length;
        if (dbStudent) {
          totalDownloads = dbStudent.total_downloads || 0;
          acceptedContribs = dbStudent.accepted_contributions || 0;
        }
    } catch (e) {
        console.error("Supabase profile error:", e);
    }

    const collegeId = dbStudent?.current_college_id || userState.current_college_id;
    const specialtyId = dbStudent?.current_specialty_id || userState.current_specialty_id;
    const level = dbStudent?.current_level || userState.current_level;

    const college = collegeId ? getCollegeById(collegeId)?.name : undefined;
    const specialty = specialtyId ? getSpecialtyById(specialtyId)?.name : undefined;

    const msg =
      TEXTS.profile.title(dbStudent?.first_name || userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: totalDownloads || userState.total_downloads,
        accepted_contributions: acceptedContribs || userState.accepted_contributions,
        pending_contributions: pendingCount,
        current_college: college,
        current_specialty: specialty,
        current_level: level,
      });

    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_contributions", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = "📋 *مساهماتي*\n\n";

    // قراءة من Supabase
    let dbContribs: any[] = [];
    try {
        dbContribs = await getStudentContributions(supabase, ctx.from.id);
    } catch (e) {
        console.error("Supabase contributions error:", e);
    }

    if (dbContribs.length === 0) {
      msg += TEXTS.profile.no_contributions;
    } else {
      dbContribs.forEach((c: any) => {
        const icon = c.status === "approved" ? "✅" : c.status === "pending" ? "⏳" : "❌";
        const statusLabel = c.status === "approved" ? "مقبولة" : c.status === "pending" ? "قيد المراجعة" : "مرفوضة";
        const subject = getSubjectByIdWithFallback(c.subject_id);
        msg += `${icon} #${c.id} - ${c.file_name}\n`;
        msg += `   📚 ${subject?.name || "غير معروف"}\n   📅 ${new Date(c.created_at).toLocaleDateString("ar")} • ${statusLabel}\n`;
        if (c.reject_reason) msg += `   ❓ ${c.reject_reason}\n`;
        msg += "\n";
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("my_downloads", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = "📥 *آخر تحميلاتي*\n\n";

    // قراءة من Supabase
    let dbDownloads: any[] = [];
    try {
        dbDownloads = await getRecentDownloads(supabase, ctx.from.id, 5);
    } catch (e) {
        console.error("Supabase downloads error:", e);
    }

    if (dbDownloads.length === 0) {
      msg += TEXTS.profile.no_downloads;
    } else {
    for (let i = 0; i < dbDownloads.length; i++) {
        const d = dbDownloads[i];
        // قراءة عنوان المحتوى
        let contentTitle = "ملف";
          try {
            const content = await getContentById(supabase, d.content_id);
            if (content) contentTitle = content.title || content.file_name || "ملف";
          } catch {}
        msg += `${i + 1}. 📄 ${contentTitle}\n   📅 ${new Date(d.downloaded_at).toLocaleDateString("ar")}\n\n`;
    }
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  // شاشة الإشعارات
  bot.callbackQuery("my_notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
    // محاكاة: نستخدم MOCK_STUDENT_NOTIFICATIONS (في الإنتاج ستُستعلم من DB)
    let notifications: any[] = [];
    try { notifications = await getStudentNotifications(supabase, ctx.from.id); } catch(e) { console.error('getStudentNotifications error:', e); }
    let msg = "🔔 *الإشعارات*\n\n";
    if (notifications.length === 0) {
      msg += "📭 لا توجد إشعارات حالياً.";
    } else {
      notifications.forEach((n) => {
        const icon = n.is_read ? "📭" : "🆕";
        msg += `${icon} *${n.title}*\n   📅 ${n.created_at}\n   ${n.body}\n\n`;
      });
    }
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("✅ تعليم الكل كمقروء", "mark_notifications_read")
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_profile"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("mark_notifications_read", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    try { await markNotificationsRead(supabase, ctx.from.id); } catch(e) { console.error('markNotificationsRead error:', e); }
    await ctx.editMessageText(
      "✅ *تم تعليم كل الإشعارات كمقروءة.*",
      {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_profile"),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("change_major", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🔄 *تغيير التخصص*\n\nاختر كليتك الجديدة:",
      {
        reply_markup: collegesKeyboard(0),
        parse_mode: "Markdown",
    }
    );
  });

  bot.callbackQuery("back_to_profile", async (ctx) => {
    await ctx.answerCallbackQuery();
    // محاكاة العودة للحساب
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const college = userState.current_college_id ? getCollegeById(userState.current_college_id)?.name : undefined;
    const specialty = userState.current_specialty_id ? getSpecialtyById(userState.current_specialty_id)?.name : undefined;
    const pending = userState.my_contributions.filter((c) => c.status === "pending").length;
    let unreadCount = 0;
    try { unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id); } catch(e) { console.error('getUnreadNotificationsCount error:', e); }
    const msg =
      TEXTS.profile.title(userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: userState.total_downloads,
        accepted_contributions: userState.accepted_contributions,
        pending_contributions: pending,
        current_college: college,
        current_specialty: specialty,
        current_level: userState.current_level,
      });
    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });
}
