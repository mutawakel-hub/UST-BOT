// ============================================
// 👤 Profile Handlers — حساب الطالب
// ============================================
// هذا الملف يحتوي على:
//   - menu_profile
//   - my_contributions (إحساناتي — الملخص + التفاصيل)
//   - ihsanati_details
//   - my_notifications, mark_notifications_read
//   - change_major, back_to_profile
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getCollegeById,
  getSpecialtyById,
} from "../../shared/data/colleges";
import { getSubjectByIdWithFallback } from "../../shared/data/subjects";
import { getContentTypeLabel } from "../../shared/data/admins";
import { TEXTS } from "../../shared/texts";
import {
  SupabaseClient,
  getStudent,
  getStudentNotifications,
  getUnreadNotificationsCount,
  markNotificationsRead,
  getStudentContributions,
  getStudentRankInLevel,
} from "../../shared/db";
import {
  collegesKeyboard,
  profileKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

// ============================================
// مساعد: حساب إحصائيات إحساناتي
// ============================================
interface IhsanatiSummary {
  total: number;
  approved: number;
  approved_starred: number;
  pending: number;
  rejected: number;
  total_points: number;
}

function computeIhsanatiSummary(contribs: any[], studentPoints: number): IhsanatiSummary {
  let approved = 0;
  let approvedStarred = 0;
  let pending = 0;
  let rejected = 0;
  let awardedPoints = 0;

  for (const c of contribs) {
    if (c.status === "approved" || c.status === "published") {
      approved++;
      if (c.is_starred) approvedStarred++;
      awardedPoints += Number(c.points_awarded) || 0;
    } else if (c.status === "pending" || c.status === "revision_requested") {
      pending++;
    } else if (c.status === "rejected") {
      rejected++;
    }
  }

  // نُفضّل نقاط students.total_points_current_cycle لأنها المصدر الرسمي
  const totalPoints = studentPoints > 0 ? studentPoints : awardedPoints;

  return {
    total: contribs.length,
    approved,
    approved_starred: approvedStarred,
    pending,
    rejected,
    total_points: totalPoints,
  };
}

// ============================================
// مساعد: تنسيق إحسان واحد في عرض التفاصيل
// ============================================
function formatIhsanEntry(c: any): string {
  const subject = getSubjectByIdWithFallback(c.subject_id);
  const subjectName = subject?.name || "غير معروف";
  const typeLabel = getContentTypeLabel(c.content_type_id);

  let statusIcon = "❓";
  let statusLabel = "غير معروف";
  if (c.status === "approved" || c.status === "published") {
    statusIcon = c.is_starred ? "✅" : "✅";
    statusLabel = "معتمد";
  } else if (c.status === "pending") {
    statusIcon = "🟡";
    statusLabel = "قيد المراجعة";
  } else if (c.status === "revision_requested") {
    statusIcon = "🟡";
    statusLabel = "يحتاج تعديل";
  } else if (c.status === "rejected") {
    statusIcon = "❌";
    statusLabel = "مرفوض";
  }

  // العنوان: نُفضّل title، ثم file_name
  const title = (c.title && c.title.trim()) ? c.title : (c.file_name || "بدون عنوان");

  let pendingSince: string | undefined;
  if ((c.status === "pending" || c.status === "revision_requested") && c.created_at) {
    pendingSince = formatTimeAgo(c.created_at);
  }

  return TEXTS.ihsanati.entry({
    status_icon: statusIcon,
    title,
    subject_name: subjectName,
    type_label: typeLabel,
    points: Number(c.points_awarded) || 0,
    status_label: statusLabel,
    is_starred: !!c.is_starred,
    reject_reason: c.reject_reason || undefined,
    pending_since: pendingSince,
  });
}

// تنسيق وقت نسبي بسيط (ساعة / يوم / أيام)
function formatTimeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} ساعة`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "منذ يوم";
    if (diffDay < 7) return `منذ ${diffDay} أيام`;
    const diffWk = Math.floor(diffDay / 7);
    if (diffWk === 1) return "منذ أسبوع";
    return `منذ ${diffWk} أسابيع`;
  } catch {
    return "";
  }
}

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
    let totalPoints = 0;
    let rank = 0;

    try {
      dbStudent = await getStudent(supabase, ctx.from.id);
      unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id);
      const contribs = await getStudentContributions(supabase, ctx.from.id);
      pendingCount = contribs.filter(
        (c: any) => c.status === "pending" || c.status === "revision_requested"
      ).length;
      if (dbStudent) {
        totalDownloads = dbStudent.total_downloads || 0;
        acceptedContribs = dbStudent.accepted_contributions || 0;
        totalPoints = Number(dbStudent.total_points_current_cycle) || 0;
      }
    } catch (e) {
      console.error("Supabase profile error:", e);
    }

    const collegeId = dbStudent?.current_college_id || userState.current_college_id;
    const specialtyId = dbStudent?.current_specialty_id || userState.current_specialty_id;
    const level = dbStudent?.current_level || userState.current_level;

    const college = collegeId ? getCollegeById(collegeId)?.name : undefined;
    const specialty = specialtyId ? getSpecialtyById(specialtyId)?.name : undefined;

    // حساب الترتيب في المستوى
    if (specialtyId && level && totalPoints > 0) {
      try {
        rank = await getStudentRankInLevel(supabase, ctx.from.id, specialtyId, level, totalPoints);
      } catch (e) {
        console.error("getStudentRankInLevel error:", e);
      }
    }

    const msg =
      TEXTS.profile.title(dbStudent?.first_name || userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: totalDownloads || userState.total_downloads,
        accepted_contributions: acceptedContribs || userState.accepted_contributions,
        pending_contributions: pendingCount,
        total_points: totalPoints,
        rank,
        current_college: college,
        current_specialty: specialty,
        current_level: level,
      });

    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });

  // 🌟 إحساناتي — الملخص
  bot.callbackQuery("my_contributions", async (ctx) => {
    await ctx.answerCallbackQuery();

    let dbStudent: any = null;
    let dbContribs: any[] = [];
    try {
      dbStudent = await getStudent(supabase, ctx.from.id);
      dbContribs = await getStudentContributions(supabase, ctx.from.id);
    } catch (e) {
      console.error("Supabase contributions error:", e);
    }

    const studentPoints = dbStudent ? (Number(dbStudent.total_points_current_cycle) || 0) : 0;
    const summary = computeIhsanatiSummary(dbContribs, studentPoints);

    // حساب الترتيب في المستوى
    let rank = 0;
    const specialtyId = dbStudent?.current_specialty_id;
    const level = dbStudent?.current_level;
    if (specialtyId && level && summary.total_points > 0) {
      try {
        rank = await getStudentRankInLevel(supabase, ctx.from.id, specialtyId, level, summary.total_points);
      } catch (e) {
        console.error("getStudentRankInLevel error:", e);
      }
    }

    let msg = TEXTS.ihsanati.title(summary.total);
    if (summary.total === 0) {
      msg += TEXTS.profile.no_contributions;
    } else {
      msg += TEXTS.ihsanati.summary({
        total_points: summary.total_points,
        rank,
        approved: summary.approved,
        approved_starred: summary.approved_starred,
        pending: summary.pending,
        rejected: summary.rejected,
      });
    }

    const kb = new InlineKeyboard();
    if (summary.total > 0) {
      kb.text(TEXTS.ihsanati.btn_details, "ihsanati_details").row();
    }
    kb.text(TEXTS.navigation.back_to_main, "back_to_profile");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // 🌟 إحساناتي — التفاصيل
  bot.callbackQuery("ihsanati_details", async (ctx) => {
    await ctx.answerCallbackQuery();

    let dbContribs: any[] = [];
    try {
      dbContribs = await getStudentContributions(supabase, ctx.from.id);
    } catch (e) {
      console.error("Supabase contributions (details) error:", e);
    }

    let msg = TEXTS.ihsanati.details_title;
    if (dbContribs.length === 0) {
      msg += TEXTS.profile.no_contributions;
    } else {
      for (const c of dbContribs) {
        msg += formatIhsanEntry(c) + "\n";
      }
    }

    const kb = new InlineKeyboard()
      .text(TEXTS.ihsanati.btn_back_to_summary, "my_contributions").row()
      .text(TEXTS.navigation.back_to_main, "back_to_profile");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // شاشة الإشعارات
  bot.callbackQuery("my_notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
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
    // قراءة بيانات الطالب من Supabase (نفس منطق menu_profile)
    let dbStudent: any = null;
    let unreadCount = 0;
    let pendingCount = 0;
    let totalDownloads = 0;
    let acceptedContribs = 0;
    let totalPoints = 0;
    let rank = 0;

    try {
      dbStudent = await getStudent(supabase, ctx.from.id);
      unreadCount = await getUnreadNotificationsCount(supabase, ctx.from.id);
      const contribs = await getStudentContributions(supabase, ctx.from.id);
      pendingCount = contribs.filter(
        (c: any) => c.status === "pending" || c.status === "revision_requested"
      ).length;
      if (dbStudent) {
        totalDownloads = dbStudent.total_downloads || 0;
        acceptedContribs = dbStudent.accepted_contributions || 0;
        totalPoints = Number(dbStudent.total_points_current_cycle) || 0;
      }
    } catch (e) {
      console.error("Supabase profile (back) error:", e);
    }

    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const collegeId = dbStudent?.current_college_id || userState.current_college_id;
    const specialtyId = dbStudent?.current_specialty_id || userState.current_specialty_id;
    const level = dbStudent?.current_level || userState.current_level;

    const college = collegeId ? getCollegeById(collegeId)?.name : undefined;
    const specialty = specialtyId ? getSpecialtyById(specialtyId)?.name : undefined;

    if (specialtyId && level && totalPoints > 0) {
      try {
        rank = await getStudentRankInLevel(supabase, ctx.from.id, specialtyId, level, totalPoints);
      } catch (e) {
        console.error("getStudentRankInLevel error:", e);
      }
    }

    const msg =
      TEXTS.profile.title(dbStudent?.first_name || userState.first_name || "طالب") +
      TEXTS.profile.stats({
        total_downloads: totalDownloads || userState.total_downloads,
        accepted_contributions: acceptedContribs || userState.accepted_contributions,
        pending_contributions: pendingCount,
        total_points: totalPoints,
        rank,
        current_college: college,
        current_specialty: specialty,
        current_level: level,
      });

    await ctx.editMessageText(msg, {
      reply_markup: profileKeyboard(unreadCount),
      parse_mode: "Markdown",
    });
  });
}
