// ============================================
// بوت الإدارة - جامعة العلوم والتكنولوجيا
// Mockup على Cloudflare Workers + grammY
// نظام RBAC كامل + 13 شاشة
// ============================================

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { TEXTS, ADMIN_TEXTS } from "../shared/texts";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../shared/data/colleges";
import {
  SUBJECTS,
  getSubjectById,
  getSubjectsBySpecialtyLevelSemester,
} from "../shared/data/subjects";
import {
  MOCK_PENDING_CONTRIBUTIONS,
  MOCK_STATISTICS,
  MOCK_POSITIONS,
  MOCK_POSITION_HOLDERS,
  MOCK_ADMIN_USERS,
  MOCK_CONTENT,
  MOCK_COMMITTEE_CHANNELS,
  MOCK_HONORS,
  MOCK_STUDENTS,
  ALL_MOCK_STUDENTS,
  MOCK_SUBSCRIPTIONS,
  CONTENT_TYPES,
  type MockContribution,
  type MockContent,
  type MockHonor,
  getMockContentById,
  getMockContributionById,
  getMockPositionById,
  getMockAdminUser,
  getContentTypeLabel,
  getContentTypeEmoji,
  getSubjectNameById,
  getTopContributors,
  getBroadcastRecipients,
  getStudentCountByScope,
} from "../shared/data/admins";
import {
  getUserPermissions,
  getUserPositions,
  hasPermission,
  getManageablePositions,
  getManageableContent,
  getPositionTitle,
  getPositionScopeText,
  getPositionLevelLabel,
  isUserAdmin,
  type UserPermissions,
} from "../shared/rbac";
import { SupabaseClient, getBroadcastRecipients as dbGetBroadcastRecipients } from "../shared/db";

// ============================================
// حالة الجلسة
// ============================================
interface AdminSession {
  telegram_id: number;
  first_name: string;
  // للحفاظ على التجربة: في الـ Mockup كل المستخدمين يعاملون كمركزيين
  // لكن يمكن للمستخدم تجربة أدوار مختلفة عبر Role Switcher
  simulated_role?: "central" | "college_admin_5" | "level_rep_16_1";
  // حالات الانتظار
  awaiting_broadcast_text?: boolean;
  awaiting_broadcast_scope?: string;
  awaiting_subject_add?: boolean;
  awaiting_text_edit?: string;
  awaiting_text_value?: boolean;
  awaiting_upload_step?: string;
  upload_context?: any;
  awaiting_content_edit?: number; // content_id
  awaiting_content_delete?: number; // content_id
  awaiting_position_assign?: { step: "name" | "telegram_id"; position_id: string; name?: string };
  awaiting_position_revoke?: { position_id: string };
  awaiting_channel_edit?: number; // channel_id
  // تكريم
  awaiting_honor_reject?: number; // honor_id
  awaiting_honor_new_step?: "student_id" | "title" | "bonus";
  awaiting_honor_new_data?: { student_id?: number; title?: string };
  // فلتر استعراض المحتوى
  content_filter?: { college_id?: number; specialty_id?: number; subject_id?: number; content_type?: string };
  // سياق التعميم الحالي (يحفظ النطاق + عدد المستلمين)
  broadcast_context?: { scope_type: string; scope_college_id?: number; scope_specialty_id?: number; scope_level?: number; scope_label: string; count: number };
  // نص التعميم المؤقت (يُحفظ عند المعاينة)
  pending_broadcast_text?: string;
}

const adminSessions = new Map<number, AdminSession>();

let pendingContributions: MockContribution[] = [...MOCK_PENDING_CONTRIBUTIONS];
let mockContent: MockContent[] = [...MOCK_CONTENT];
let mockHolders = [...MOCK_POSITION_HOLDERS];
let mockChannels = [...MOCK_COMMITTEE_CHANNELS];
const customTexts = new Map<string, string>();

function getOrCreateSession(telegramId: number, firstName?: string): AdminSession {
  if (!adminSessions.has(telegramId)) {
    adminSessions.set(telegramId, {
      telegram_id: telegramId,
      first_name: firstName || "مسؤول",
    });
  }
  return adminSessions.get(telegramId)!;
}

// ============================================
// الحصول على صلاحيات المستخدم الفعّالة (مع المحاكاة)
// ============================================
function getEffectivePermissions(telegramId: number, simulatedRole?: string): UserPermissions {
  // لو فيه محاكاة دور، نستخدم telegram_id خاص بذلك الدور
  if (simulatedRole === "college_admin_5") {
    return getUserPermissions(1000002); // أ. سارة - مسؤولة كلية الحاسبات
  }
  if (simulatedRole === "level_rep_16_1") {
    return getUserPermissions(1000004); // أ. فاطمة - مندوب IT مستوى 1
  }
  // الافتراضي: محاكاة كمسؤول مركزي
  return getUserPermissions(1000001);
}

// ============================================
// بناء الـ Dashboard ديناميكياً حسب الصلاحيات
// ============================================
function buildDynamicDashboard(perms: UserPermissions, pendingCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const p = perms.permissions;

  // صف 1: المساهمات (مخفية للمركزي مؤقتاً) + المحتوى
  // ملاحظة: المركزي محروم مؤقتاً من إدارة المساهمات حسب طلب العميل
  if (p.has("approve_level_contributions") && !perms.is_central) {
    kb.text(ADMIN_TEXTS.dashboard.btn_pending(pendingCount), "pending");
  }
  if (p.has("manage_level_content")) {
    kb.text("📁 إدارة المحتوى", "content_mgmt");
  }
  kb.row();

  // صف 2: المواد + التعميم
  if (p.has("manage_subjects")) {
    kb.text("📖 إدارة المواد", "subjects_mgmt");
  }
  if (p.has("central_broadcast") || p.has("college_broadcast") || p.has("level_broadcast")) {
    kb.text("📢 تعميم", "broadcast");
  }
  kb.row();

  // صف 3: الإحصائيات + التخصيص
  if (p.has("view_level_stats") || p.has("view_central_stats")) {
    kb.text("📊 إحصائيات", "statistics");
  }
  if (p.has("system_settings")) {
    kb.text("⚙️ تخصيص النصوص", "customize_texts");
  }
  kb.row();

  // صف 4: المناصب + اللجان (للمركزي فقط)
  if (p.has("manage_admins")) {
    kb.text("👥 إدارة المناصب", "manage_admins");
  }
  if (p.has("manage_committee_channels")) {
    kb.text("📢 قنوات اللجان", "manage_channels");
  }
  kb.row();

  // صف 5: التكريم + إعادة ضبط النقاط (للمركزي فقط)
  if (p.has("manage_honors")) {
    kb.text("🏆 إدارة التكريم", "manage_honors");
  }
  if (p.has("reset_points")) {
    kb.text("🔄 إعادة ضبط النقاط", "manage_reset_points");
  }
  kb.row();

  // صف 6: لوحة الشرف (للمركزي فقط)
  if (perms.is_central) {
    kb.text("🏆 لوحة الشرف", "leaderboard_update").row();
  }

  // Role Switcher (للمحاكاة فقط)
  kb.text("🎭 تبديل الدور (للتجربة)", "role_switcher").row();

  return kb;
}

// ============================================
// إنشاء البوت
// ============================================
export function createAdminBot(token: string, supabase?: SupabaseClient): Bot {
  const bot = new Bot(token);

  // ====== /start ======
  bot.command("start", async (ctx) => {
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

    let roleLabel = "🛡 مسؤول مركزي (تجريبي)";
    if (session.simulated_role === "college_admin_5") roleLabel = "🏛 مسؤول كلية الحاسبات (محاكاة)";
    if (session.simulated_role === "level_rep_16_1") roleLabel = "📊 مندوب IT مستوى 1 (محاكاة)";

    await ctx.reply(
      ADMIN_TEXTS.dashboard.title(session.first_name, roleLabel, pendingContributions.length) +
      "\n\nℹ️ *وضع التجربة:* يتم منحك صلاحية *مسؤول مركزي* افتراضياً.\n" +
      "استخدم زر *🎭 تبديل الدور* لتجربة صلاحيات مختلفة.\n\n" +
      "_في الإنتاج، سيتم التحقق من منصبك في قاعدة البيانات تلقائياً._",
      {
        reply_markup: buildDynamicDashboard(perms, pendingContributions.length),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A2: العودة للوحة الإدارة ======
  bot.callbackQuery("back_to_dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    // إعادة ضبط حالات الانتظار
    session.awaiting_broadcast_text = undefined;
    session.awaiting_broadcast_scope = undefined;
    session.broadcast_context = undefined;
    session.pending_broadcast_text = undefined;
    session.awaiting_subject_add = undefined;
    session.awaiting_text_edit = undefined;
    session.awaiting_text_value = undefined;
    session.awaiting_upload_step = undefined;
    session.upload_context = undefined;
    session.awaiting_content_edit = undefined;
    session.awaiting_content_delete = undefined;
    session.awaiting_position_assign = undefined;
    session.awaiting_position_revoke = undefined;
    session.awaiting_channel_edit = undefined;
    session.awaiting_honor_reject = undefined;
    session.awaiting_honor_new_step = undefined;
    session.awaiting_honor_new_data = undefined;
    session.content_filter = undefined;

    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    let roleLabel = "🛡 مسؤول مركزي (تجريبي)";
    if (session.simulated_role === "college_admin_5") roleLabel = "🏛 مسؤول كلية الحاسبات (محاكاة)";
    if (session.simulated_role === "level_rep_16_1") roleLabel = "📊 مندوب IT مستوى 1 (محاكاة)";

    await ctx.editMessageText(
      ADMIN_TEXTS.dashboard.title(session.first_name, roleLabel, pendingContributions.length),
      {
        reply_markup: buildDynamicDashboard(perms, pendingContributions.length),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== Role Switcher (للمحاكاة) ======
  bot.callbackQuery("role_switcher", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🎭 *تبديل الدور (للمحاكاة فقط)*\n\n" +
      "اختر دوراً لتجربة واجهة المسؤول المختلفة:\n\n" +
      "🛡 *مسؤول مركزي* — كل الصلاحيات\n" +
      "🏛 *مسؤول كلية الحاسبات* — صلاحيات كلية محددة\n" +
      "📊 *مندوب IT مستوى 1* — صلاحيات محدودة جداً\n\n" +
      "_هذه الميزة لتجربة UX فقط — في الإنتاج يُحدّد الدور تلقائياً من قاعدة البيانات._",
      {
        reply_markup: new InlineKeyboard()
          .text("🛡 مسؤول مركزي", "set_role_central")
          .row()
          .text("🏛 مسؤول كلية الحاسبات", "set_role_college")
          .row()
          .text("📊 مندوب IT مستوى 1", "set_role_level")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/set_role_(central|college|level)/, async (ctx) => {
    const role = ctx.match[1];
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (role === "central") session.simulated_role = undefined;
    else if (role === "college") session.simulated_role = "college_admin_5";
    else if (role === "level") session.simulated_role = "level_rep_16_1";
    await ctx.answerCallbackQuery({ text: "✅ تم تبديل الدور" });
    // إعادة بناء الـ dashboard
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    let roleLabel = "🛡 مسؤول مركزي (تجريبي)";
    if (session.simulated_role === "college_admin_5") roleLabel = "🏛 مسؤول كلية الحاسبات (محاكاة)";
    if (session.simulated_role === "level_rep_16_1") roleLabel = "📊 مندوب IT مستوى 1 (محاكاة)";
    await ctx.editMessageText(
      ADMIN_TEXTS.dashboard.title(session.first_name, roleLabel, pendingContributions.length) +
      "\n\nℹ️ لاحظ كيف تغيّرت الأزرار المتاحة حسب الدور.",
      {
        reply_markup: buildDynamicDashboard(perms, pendingContributions.length),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A3: المساهمات المعلقة ======
  bot.callbackQuery("pending", async (ctx) => {
    await ctx.answerCallbackQuery();

    // قراءة المساهمات المعلقة من Supabase
    let dbContributions: any[] = [];
    if (supabase) {
      try {
        dbContributions = await supabase.select("contributions", {
          columns: "id,file_name,subject_id,content_type_id,description,file_size_mb,created_at",
          filter: "status=eq.pending",
          order: "created_at.desc",
          limit: 20,
        }) as any[];
        console.log(`✅ Read ${dbContributions.length} pending contributions from Supabase`);
      } catch (e) {
        console.error("Supabase pending read error:", e);
      }
    }

    // دمج المساهمات من DB + Mock
    const allPending = [
      ...dbContributions.map((c: any) => ({
        id: c.id,
        file_name: c.file_name,
        subject_id: c.subject_id,
        subject_name: getSubjectNameById(c.subject_id) || "غير معروف",
        content_type: c.content_type_id,
        description: c.description,
        file_size_mb: parseFloat(c.file_size_mb) || 0,
        user_name: "طالب",
        user_telegram_id: 0,
        uploaded_at: "حديثاً",
        specialty_id: 0,
        college_id: 0,
        level: 0,
      })),
      ...pendingContributions,
    ];

    if (allPending.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.pending.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    allPending.forEach((c) => {
      kb.text(`#${c.id} • ${c.file_name.substring(0, 25)}`, `review_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      ADMIN_TEXTS.pending.title(allPending.length),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery("back_to_pending", async (ctx) => {
    await ctx.answerCallbackQuery();

    // قراءة من Supabase أيضاً
    let dbContributions: any[] = [];
    if (supabase) {
      try {
        dbContributions = await supabase.select("contributions", {
          columns: "id,file_name",
          filter: "status=eq.pending",
          order: "created_at.desc",
          limit: 20,
        }) as any[];
      } catch (e) {
        console.error("Supabase pending read error:", e);
      }
    }
    const allPending = [
      ...dbContributions.map((c: any) => ({ id: c.id, file_name: c.file_name })),
      ...pendingContributions,
    ];

    const kb = new InlineKeyboard();
    allPending.forEach((c) => {
      kb.text(`#${c.id} • ${c.file_name.substring(0, 25)}`, `review_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      ADMIN_TEXTS.pending.title(allPending.length),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ====== A4: مراجعة مساهمة ======
  bot.callbackQuery(/review_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = pendingContributions.find((c) => c.id === contribId);
    await ctx.answerCallbackQuery();
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة أو تمت معالجتها.");
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.review.title({
        id: contrib.id, fileName: contrib.file_name, subjectName: contrib.subject_name,
        userName: contrib.user_name, uploadedAt: contrib.uploaded_at,
        fileSizeMb: contrib.file_size_mb, description: contrib.description,
      }),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.review.approve, `approve_${contribId}`)
          .text(ADMIN_TEXTS.review.approve_starred, `approve_star_${contribId}`)
          .row()
          .text(ADMIN_TEXTS.review.reject, `reject_${contribId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/approve(?:_star)?_(\d+)/, async (ctx) => {
    const isStarred = ctx.match[0].includes("star");
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: isStarred ? "⭐ تم الاعتماد المميز" : "✅ تم الاعتماد" });
    pendingContributions = pendingContributions.filter((c) => c.id !== contribId);

    // تحديث المساهمة في Supabase
    if (supabase) {
      try {
        // تحديث حالة المساهمة
        await supabase.update("contributions", {
          status: "approved",
          is_starred: isStarred,
          reviewed_by_telegram_id: ctx.from.id,
          reviewed_at: new Date().toISOString(),
        }, `id=eq.${contribId}`);
        console.log(`✅ Contribution ${contribId} approved in Supabase`);

        // منح النقاط للطالب (عبر RPC)
        // نحتاج معرفة user_telegram_id + subject_id من المساهمة
        const contribData = await supabase.select("contributions", {
          columns: "user_telegram_id",
          filter: `id=eq.${contribId}`,
          single: true,
        }) as any;
        if (contribData?.user_telegram_id) {
          const points = isStarred ? 20 : 10;
          await supabase.rpc("award_contribution_points", {
            p_student_telegram_id: contribData.user_telegram_id,
            p_contribution_id: contribId,
            p_awarded_by_telegram_id: ctx.from.id,
            p_awarded_by_position_id: "central_chair",
            p_points: points,
          });
          console.log(`✅ Awarded ${points} points to student ${contribData.user_telegram_id}`);
        }
      } catch (e) {
        console.error("Supabase approve error:", e);
      }
    }

    await ctx.editMessageText(
      `${isStarred ? "⭐" : "✅"} *تم اعتماد المساهمة #${contribId}*\n\nتم نقل الملف لقناة التخزين ونشره للطلاب.\n💎 تم منح الطالب ${isStarred ? "20" : "10"} نقطة.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/reject_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.reject_reason.title, {
      reply_markup: new InlineKeyboard()
        .text("♻️ مكرر", `reject_reason_dup_${contribId}`)
        .text("👁 غير واضح", `reject_reason_bad_${contribId}`)
        .row()
        .text("🚫 لا يتعلق بالمادة", `reject_reason_irrelevant_${contribId}`)
        .text("📝 غير مكتمل", `reject_reason_incomplete_${contribId}`)
        .row()
        .text("⏭ تخطي السبب", `reject_reason_skip_${contribId}`)
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/reject_reason_(dup|bad|irrelevant|incomplete|skip)_(\d+)/, async (ctx) => {
    const reasonKey = ctx.match[1];
    const contribId = parseInt(ctx.match[2]);
    const reasons: Record<string, string> = {
      dup: "♻️ مكرر", bad: "👁 غير واضح",
      irrelevant: "🚫 لا يتعلق بالمادة", incomplete: "📝 غير مكتمل", skip: "بدون سبب محدد",
    };
    await ctx.answerCallbackQuery({ text: "❌ تم الرفض" });
    pendingContributions = pendingContributions.filter((c) => c.id !== contribId);

    // تحديث المساهمة في Supabase
    if (supabase) {
      try {
        // الحصول على user_telegram_id قبل التحديث
        const contribData = await supabase.select("contributions", {
          columns: "user_telegram_id",
          filter: `id=eq.${contribId}`,
          single: true,
        }) as any;

        // تحديث حالة المساهمة
        await supabase.update("contributions", {
          status: "rejected",
          reject_reason: reasons[reasonKey],
          reviewed_by_telegram_id: ctx.from.id,
          reviewed_at: new Date().toISOString(),
        }, `id=eq.${contribId}`);

        // إشعار الطالب بالرفض
        if (contribData?.user_telegram_id) {
          await supabase.rpc("notify_contribution_rejected", {
            p_student_telegram_id: contribData.user_telegram_id,
            p_contribution_id: contribId,
            p_reject_reason: reasons[reasonKey],
          });
        }
        console.log(`✅ Contribution ${contribId} rejected in Supabase`);
      } catch (e) {
        console.error("Supabase reject error:", e);
      }
    }

    await ctx.editMessageText(
      `✅ *تم رفض المساهمة #${contribId}*\n\nالسبب: ${reasons[reasonKey]}\n\n🔔 تم إشعار الطالب بالرفض.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A5: إدارة المحتوى ======
  bot.callbackQuery("content_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

    let kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_mgmt.btn_browse, "browse_content")
      .text(ADMIN_TEXTS.content_mgmt.btn_upload, "upload_content")
      .row();

    if (perms.is_central) {
      kb.text(ADMIN_TEXTS.content_mgmt.btn_filter, "filter_content").row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.content_mgmt.title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("browse_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const manageableContent = getManageableContent(
      ctx.from.id === 1000001 ? 1000001 : (session.simulated_role === "college_admin_5" ? 1000002 : 1000004),
      session.content_filter
    );

    if (manageableContent.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.content_mgmt.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.browse_content.title(manageableContent.length);
    const kb = new InlineKeyboard();
    manageableContent.slice(0, 8).forEach((c) => {
      const icon = c.is_starred ? "⭐" : getContentTypeEmoji(c.content_type);
      kb.text(`${icon} ${c.title.substring(0, 30)} (${c.download_count}⬇️)`, `content_detail_${c.id}`).row();
    });
    if (manageableContent.length > 8) {
      msg += `\n\n📋 عرض أول 8 من ${manageableContent.length} عنصر.`;
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // ====== A5c: تفاصيل المحتوى ======
  bot.callbackQuery(/content_detail_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    const content = mockContent.find((c) => c.id === contentId);
    await ctx.answerCallbackQuery();
    if (!content) {
      await ctx.reply("⚠️ المحتوى غير موجود.");
      return;
    }

    const subject = getSubjectById(content.subject_id);
    const specialty = getSpecialtyById(content.specialty_id);
    const college = getCollegeById(content.college_id);
    const adderUser = getMockAdminUser(content.added_by_telegram_id);

    const msg = ADMIN_TEXTS.content_detail.title +
      ADMIN_TEXTS.content_detail.details({
        title: content.title,
        type_label: getContentTypeLabel(content.content_type),
        subject_name: subject?.name || "غير معروف",
        specialty_name: specialty?.short_name || "غير معروف",
        college_name: college?.short_name || "غير معروف",
        level: content.level,
        semester: content.semester,
        file_size: content.file_size_mb,
        download_count: content.download_count,
        is_starred: content.is_starred,
        added_by: adderUser?.first_name || "غير معروف",
        added_at: content.added_at,
        academic_year: content.academic_year,
      });

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_detail.btn_edit, `edit_content_${contentId}`)
      .text(ADMIN_TEXTS.content_detail.btn_move, `move_content_${contentId}`)
      .row()
      .text(ADMIN_TEXTS.content_detail.btn_delete, `delete_content_${contentId}`)
      .text(content.is_starred ? ADMIN_TEXTS.content_detail.btn_unstar : ADMIN_TEXTS.content_detail.btn_star,
            content.is_starred ? `unstar_content_${contentId}` : `star_content_${contentId}`)
      .row()
      .text("🔙 استعراض المحتوى", "browse_content")
      .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // تمييز/إلغاء تمييز المحتوى
  bot.callbackQuery(/(star|unstar)_content_(\d+)/, async (ctx) => {
    const action = ctx.match[1];
    const contentId = parseInt(ctx.match[2]);
    const content = mockContent.find((c) => c.id === contentId);
    if (!content) return;
    content.is_starred = action === "star";
    content.last_modified_at = new Date().toISOString();
    content.last_modified_by = ctx.from.id;
    await ctx.answerCallbackQuery({ text: action === "star" ? "⭐ تم التمييز" : "☆ تم إلغاء التمييز" });
    // إعادة عرض التفاصيل
    await ctx.callbackQuery?.data && (await bot.api.answerCallbackQuery(ctx.update.callback_query.id));
    // نعيد بناء الشاشة بنفس المنطق
    const subject = getSubjectById(content.subject_id);
    const specialty = getSpecialtyById(content.specialty_id);
    const college = getCollegeById(content.college_id);
    const adderUser = getMockAdminUser(content.added_by_telegram_id);
    const msg = ADMIN_TEXTS.content_detail.title +
      ADMIN_TEXTS.content_detail.details({
        title: content.title,
        type_label: getContentTypeLabel(content.content_type),
        subject_name: subject?.name || "غير معروف",
        specialty_name: specialty?.short_name || "غير معروف",
        college_name: college?.short_name || "غير معروف",
        level: content.level,
        semester: content.semester,
        file_size: content.file_size_mb,
        download_count: content.download_count,
        is_starred: content.is_starred,
        added_by: adderUser?.first_name || "غير معروف",
        added_at: content.added_at,
        academic_year: content.academic_year,
      });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.content_detail.btn_edit, `edit_content_${contentId}`)
        .text(ADMIN_TEXTS.content_detail.btn_move, `move_content_${contentId}`)
        .row()
        .text(ADMIN_TEXTS.content_detail.btn_delete, `delete_content_${contentId}`)
        .text(content.is_starred ? ADMIN_TEXTS.content_detail.btn_unstar : ADMIN_TEXTS.content_detail.btn_star,
              content.is_starred ? `unstar_content_${contentId}` : `star_content_${contentId}`)
        .row()
        .text("🔙 استعراض المحتوى", "browse_content")
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // حذف المحتوى (تأكيد)
  bot.callbackQuery(/delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    const content = mockContent.find((c) => c.id === contentId);
    await ctx.answerCallbackQuery();
    if (!content) return;
    await ctx.editMessageText(
      ADMIN_TEXTS.content_detail.delete_confirm(content.title),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.content_detail.btn_confirm_delete, `confirm_delete_content_${contentId}`)
          .text(ADMIN_TEXTS.content_detail.btn_cancel_delete, `content_detail_${contentId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // تأكيد الحذف
  bot.callbackQuery(/confirm_delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    mockContent = mockContent.filter((c) => c.id !== contentId);
    await ctx.answerCallbackQuery({ text: "🗑 تم الحذف" });
    await ctx.editMessageText(
      ADMIN_TEXTS.content_detail.delete_success,
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 استعراض المحتوى", "browse_content")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // تعديل المحتوى (طالب جديد للعنوان)
  bot.callbackQuery(/edit_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_edit = contentId;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.content_detail.edit_prompt, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", `content_detail_${contentId}`),
      parse_mode: "Markdown",
    });
  });

  // نقل المحتوى (محاكاة)
  bot.callbackQuery(/move_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.content_detail.move_prompt + "\n\n_في الإنتاج: سيُطلب منك اختيار الكلية/التخصص/المادة/المستوى الجديد._",
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard")
          .row()
          .text("🔙 تفاصيل المحتوى", `content_detail_${contentId}`),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A5a: رفع محتوى جديد (محاكاة مبسّطة) ======
  bot.callbackQuery("upload_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    CONTENT_TYPES.forEach((t) => {
      kb.text(`${t.emoji} ${t.name}`, `upload_type_${t.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      "📤 *رفع محتوى جديد*\n\nاختر نوع المحتوى:\n\n_في الإنتاج: سيُطلب منك اختيار المادة ثم رفع الملف._",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/upload_type_(.+)/, async (ctx) => {
    const typeId = ctx.match[1];
    const type = CONTENT_TYPES.find((t) => t.id === typeId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `✅ *تم اختيار النوع:* ${type?.emoji} ${type?.name}\n\n_في الإنتاج: سيُطلب منك اختيار المادة ثم رفع الملف._`,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A6: إدارة المواد ======
  bot.callbackQuery("subjects_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.subjects_mgmt.btn_add, "add_subject")
          .text(ADMIN_TEXTS.subjects_mgmt.btn_list, "list_subjects")
          .row()
          .text(ADMIN_TEXTS.subjects_mgmt.btn_edit, "edit_subject")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_add = true;
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt, {
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("list_subjects", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.subjects_mgmt.list_header(SUBJECTS.length);
    SUBJECTS.slice(0, 10).forEach((s) => {
      msg += `📖 ${s.name} (مستوى ${s.level}, فصل ${s.semester})\n`;
    });
    msg += `\n📋 عرض أول 10 مواد من ${SUBJECTS.length}.`;
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("edit_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "✏️ *تعديل/حذف مادة*\n\nاختر التخصص أولاً (محاكاة - متاح كاملاً في الإنتاج):",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A7: التعميم (ديناميكي حسب الصلاحية) ======
  bot.callbackQuery("broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

    const kb = new InlineKeyboard();
    let title: string = ADMIN_TEXTS.broadcast.title;

    if (perms.is_central) {
      // المركزي: 4 خيارات
      title = ADMIN_TEXTS.broadcast.title_for_central;
      kb.text(ADMIN_TEXTS.broadcast.btn_all, "broadcast_scope_all").row();
      kb.text("🏛 لكلية محددة", "broadcast_select_college").row();
      kb.text("📚 لتخصص محدد", "broadcast_select_specialty").row();
      kb.text("📊 لمستوى محدد", "broadcast_select_level").row();
    } else if (perms.positions.some((p) => p.level === "college")) {
      // مسؤول الكلية: 3 خيارات (كلّيته + تخصص في كليته + مستوى في تخصص كليته)
      const collegePos = perms.positions.find((p) => p.level === "college");
      const college = getCollegeById(collegePos?.college_id || 0);
      const collegeCount = getStudentCountByScope({ scope_type: "college", scope_college_id: collegePos?.college_id });
      title = ADMIN_TEXTS.broadcast.title_for_college(college?.name || "");
      kb.text(ADMIN_TEXTS.broadcast.btn_my_college(college?.short_name || "", collegeCount), `broadcast_scope_college_${collegePos?.college_id}`).row();
      kb.text("📚 لتخصص محدد في كليتي", "broadcast_select_specialty_in_my_college").row();
      kb.text("📊 لمستوى محدد في كليتي", "broadcast_select_level_in_my_college").row();
    } else if (perms.positions.some((p) => p.level === "level")) {
      // مسؤول الدفعة: 1 خيار (مستواه فقط)
      const levelPos = perms.positions.find((p) => p.level === "level");
      const spec = getSpecialtyById(levelPos?.specialty_id || 0);
      const levelCount = getStudentCountByScope({
        scope_type: "level",
        scope_college_id: levelPos?.college_id,
        scope_specialty_id: levelPos?.specialty_id,
        scope_level: levelPos?.level_num,
      });
      title = ADMIN_TEXTS.broadcast.title_for_level(spec?.short_name || "", levelPos?.level_num || 0);
      kb.text(
        ADMIN_TEXTS.broadcast.btn_my_level(spec?.short_name || "", levelPos?.level_num || 0, levelCount),
        `broadcast_scope_level_${levelPos?.college_id}_${levelPos?.specialty_id}_${levelPos?.level_num}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار الكلية للتعاميم
  bot.callbackQuery("broadcast_select_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      const count = getStudentCountByScope({ scope_type: "college", scope_college_id: c.id });
      kb.text(`${c.emoji} ${c.short_name} (${count})`, `broadcast_scope_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_college, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار التخصص للتعاميم (أولاً يختار الكلية)
  bot.callbackQuery("broadcast_select_specialty", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_spec_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📚 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_spec_select_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      const count = getStudentCountByScope({ scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: s.id });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegeId}_${s.id}`).row();
    });
    kb.text("🔙 الكليات", "broadcast_select_specialty");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار التخصص في كليته
  bot.callbackQuery("broadcast_select_specialty_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const college = getCollegeById(collegePos?.college_id || 0);
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      const count = getStudentCountByScope({
        scope_type: "specialty",
        scope_college_id: collegePos?.college_id,
        scope_specialty_id: s.id,
      });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegePos?.college_id}_${s.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي + مسؤول الكلية: اختيار المستوى (أولاً يختار التخصص)
  bot.callbackQuery("broadcast_select_level", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_lvl_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_lvl_select_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegeId}_${s.id}`).row();
    });
    kb.text("🔙 الكليات", "broadcast_select_level");
    await ctx.editMessageText(`📊 اختر التخصص في ${college?.name}:`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_lvl_select_spec_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const levels = getLevelsForSpecialty(specId);
    const kb = new InlineKeyboard();
    for (let i = 0; i < levels.length; i += 3) {
      for (let j = 0; j < 3 && i + j < levels.length; j++) {
        const lvl = levels[i + j];
        const count = getStudentCountByScope({
          scope_type: "level",
          scope_college_id: collegeId,
          scope_specialty_id: specId,
          scope_level: lvl,
        });
        kb.text(`مستوى ${lvl} (${count})`, `broadcast_scope_level_${collegeId}_${specId}_${lvl}`);
      }
      kb.row();
    }
    kb.text("🔙 التخصصات", `broadcast_lvl_select_college_${collegeId}`);
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_level(spec?.short_name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار المستوى في كليته
  bot.callbackQuery("broadcast_select_level_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegePos?.college_id}_${s.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر التخصص في كليتك:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // عند اختيار النطاق النهائي → طلب نص/صورة/ملف التعميم
  bot.callbackQuery(/broadcast_scope_all/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const count = getStudentCountByScope({ scope_type: "all" });
    session.awaiting_broadcast_scope = "all";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "all", scope_label: "🌍 كل الطلاب", count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text("🌍 كل الطلاب", count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const count = getStudentCountByScope({ scope_type: "college", scope_college_id: collegeId });
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "college";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "college", scope_college_id: collegeId, scope_label: `🏛 ${college?.name}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`🏛 ${college?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_specialty_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = getStudentCountByScope({ scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId });
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "specialty";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId, scope_label: `📚 ${spec?.name}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📚 ${spec?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/broadcast_scope_level_(\d+)_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = getStudentCountByScope({ scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level });
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "level";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level, scope_label: `📊 ${spec?.short_name} - مستوى ${level}`, count };
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📊 ${spec?.short_name} - مستوى ${level}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("confirm_broadcast", async (ctx) => {
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const ctxData = session.broadcast_context || { scope_label: "غير محدد", count: 0 };
    const text = session.pending_broadcast_text || "(بدون نص)";
    session.awaiting_broadcast_text = undefined;
    session.awaiting_broadcast_scope = undefined;
    session.broadcast_context = undefined;
    session.pending_broadcast_text = undefined;
    await ctx.answerCallbackQuery({ text: "📢 تم الإرسال" });
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.sent(ctxData.count, ctxData.scope_label),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A8: إدارة المناصب ======
  bot.callbackQuery("manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

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
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const manageablePositions = getManageablePositions(
      session.simulated_role === "college_admin_5" ? 1000002 :
      session.simulated_role === "level_rep_16_1" ? 1000004 : 1000001
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
    manageablePositions.forEach((p) => {
      const holder = mockHolders.find((h) => h.position_id === p.id && h.is_active);
      const holderUser = holder ? getMockAdminUser(holder.user_telegram_id) : null;
      msg += ADMIN_TEXTS.positions.position_entry({
        title: p.title,
        scope: getPositionScopeText(p),
        holder_name: holderUser?.first_name,
        is_vacant: !holder,
      });
      kb.text(`${p.title.substring(0, 25)}...`, `position_detail_${p.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery(/position_detail_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const position = getMockPositionById(positionId);
    await ctx.answerCallbackQuery();
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود.");
      return;
    }
    const holder = mockHolders.find((h) => h.position_id === positionId && h.is_active);
    const holderUser = holder ? getMockAdminUser(holder.user_telegram_id) : null;

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
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
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

  bot.callbackQuery(/revoke_position_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const position = getMockPositionById(positionId);
    const holder = mockHolders.find((h) => h.position_id === positionId && h.is_active);
    const holderUser = holder ? getMockAdminUser(holder.user_telegram_id) : null;
    await ctx.answerCallbackQuery();
    if (!holder || !holderUser || !position) {
      await ctx.reply("⚠️ المنصب غير مشغول أو غير موجود.");
      return;
    }
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_position_revoke = { position_id: positionId };
    await ctx.editMessageText(
      ADMIN_TEXTS.positions.revoke_confirm(holderUser.first_name, position.title),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.positions.btn_confirm_revoke, `confirm_revoke_${positionId}`)
          .text(ADMIN_TEXTS.positions.btn_cancel_revoke, `position_detail_${positionId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/confirm_revoke_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    mockHolders = mockHolders.map((h) =>
      h.position_id === positionId ? { ...h, is_active: false } : h
    );
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
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const simulatedId = session.simulated_role === "college_admin_5" ? 1000002 :
                        session.simulated_role === "level_rep_16_1" ? 1000004 : 1000001;
    const myPositions = getUserPositions(simulatedId);

    if (myPositions.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.my_positions_empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.positions.my_positions_title(myPositions.length);
    myPositions.forEach((p) => {
      msg += `• ${p.title}\n  📍 ${getPositionScopeText(p as any)}\n\n`;
    });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // ====== A9: الإحصائيات ======
  bot.callbackQuery("statistics", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

    let statsText = ADMIN_TEXTS.statistics.title;
    if (perms.is_central) {
      statsText += ADMIN_TEXTS.statistics.content(MOCK_STATISTICS);
    } else {
      // إحصائيات محدودة للنطاق
      statsText += `📊 *إحصائيات نطاقك:*\n\n`;
      statsText += `📁 إجمالي الملفات: ${mockContent.length}\n`;
      statsText += `📥 المساهمات المعلقة: ${pendingContributions.length}\n`;
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
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(MOCK_STATISTICS),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.statistics.refresh, "stats_refresh")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A10: تخصيص النصوص ======
  bot.callbackQuery("customize_texts", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.customize.btn_main_menu, "custom_screen_main_menu")
          .text(ADMIN_TEXTS.customize.btn_choose_college, "custom_screen_choose_college")
          .row()
          .text(ADMIN_TEXTS.customize.btn_subject_menu, "custom_screen_subject_menu")
          .text(ADMIN_TEXTS.customize.btn_search, "custom_screen_search")
          .row()
          .text("↩️ استعادة الافتراضي", "reset_default")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/custom_screen_(.+)/, async (ctx) => {
    const screenKey = ctx.match[1];
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_text_edit = screenKey;
    session.awaiting_text_value = true;
    await ctx.answerCallbackQuery();
    const currentTexts: Record<string, string> = {
      main_menu: customTexts.get("main_menu") || TEXTS.main_menu.welcome,
      choose_college: customTexts.get("choose_college") || TEXTS.choose_college.title,
      subject_menu: customTexts.get("subject_menu") || "(ديناميكي)",
      search: customTexts.get("search") || TEXTS.search.intro,
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.edit_prompt(currentTexts[screenKey] || "(نص افتراضي)"),
      {
        reply_markup: new InlineKeyboard()
          .text("↩️ استعادة الافتراضي", "reset_default")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("reset_default", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_text_edit) {
      customTexts.delete(session.awaiting_text_edit);
      session.awaiting_text_edit = undefined;
      session.awaiting_text_value = undefined;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.customize.reset,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A11: لوحة الشرف ======
  bot.callbackQuery("leaderboard_update", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.leaderboard_update.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.leaderboard_update.btn_global, "leader_global")
          .text(ADMIN_TEXTS.leaderboard_update.btn_college, "leader_college")
          .row()
          .text(ADMIN_TEXTS.leaderboard_update.btn_specialty, "leader_specialty")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/leader_(global|college|specialty)/, async (ctx) => {
    const scope = ctx.match[1];
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    const scopeLabels: Record<string, string> = { global: "العالمية", college: "الكليات", specialty: "التخصصات" };
    await ctx.editMessageText(
      ADMIN_TEXTS.leaderboard_update.refresh_done(scopeLabels[scope]),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A12: إدارة روابط قنوات اللجان ======
  bot.callbackQuery("manage_channels", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);

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

  bot.callbackQuery("channels_central", async (ctx) => {
    await ctx.answerCallbackQuery();
    const central = mockChannels.find((c) => c.scope_type === "central");
    if (!central) {
      await ctx.editMessageText(ADMIN_TEXTS.channels.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.channels.central_title +
      ADMIN_TEXTS.channels.channel_entry({ display_name: central.display_name, channel_url: central.channel_url }),
      {
        reply_markup: new InlineKeyboard()
          .url(ADMIN_TEXTS.channels.btn_open, central.channel_url)
          .row()
          .text(ADMIN_TEXTS.channels.btn_edit, `edit_channel_${central.id}`)
          .row()
          .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("channels_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    const collegeChannels = mockChannels.filter((c) => c.scope_type === "college");
    let msg = ADMIN_TEXTS.channels.colleges_title;
    const kb = new InlineKeyboard();
    collegeChannels.forEach((c) => {
      const college = getCollegeById(c.college_id!);
      msg += ADMIN_TEXTS.channels.channel_entry({ display_name: c.display_name, channel_url: c.channel_url });
      kb.text(`${college?.emoji || "🏛"} ${college?.short_name.substring(0, 20)}`, `edit_channel_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery("channels_levels", async (ctx) => {
    await ctx.answerCallbackQuery();
    const levelChannels = mockChannels.filter((c) => c.scope_type === "specialty_level");
    if (levelChannels.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.channels.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }
    let msg = ADMIN_TEXTS.channels.levels_title;
    levelChannels.forEach((c) => {
      msg += ADMIN_TEXTS.channels.channel_entry({ display_name: c.display_name, channel_url: c.channel_url });
    });
    const kb = new InlineKeyboard();
    levelChannels.forEach((c) => {
      kb.text(`📊 ${c.display_name.substring(0, 30)}`, `edit_channel_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery(/edit_channel_(\d+)/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    const channel = mockChannels.find((c) => c.id === channelId);
    await ctx.answerCallbackQuery();
    if (!channel) return;
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_edit = channelId;
    await ctx.editMessageText(
      ADMIN_TEXTS.channels.edit_prompt(channel.display_name),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_channels"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== استقبال الرسائل النصية ======
  bot.on(":text", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (!session) {
      await ctx.reply("👋 أرسل /start للبدء.");
      return;
    }

    // استقبال نص التعميم (مع عرض المعاينة)
    if (session.awaiting_broadcast_text && session.broadcast_context) {
      session.awaiting_broadcast_text = false;
      session.pending_broadcast_text = ctx.message.text;
      const ctxData = session.broadcast_context;
      await ctx.reply(
        ADMIN_TEXTS.broadcast.preview(ctx.message.text, ctxData.scope_label, ctxData.count),
        {
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TEXTS.broadcast.btn_send, "confirm_broadcast")
            .text(ADMIN_TEXTS.broadcast.btn_cancel, "broadcast"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال اسم مادة جديدة
    if (session.awaiting_subject_add) {
      session.awaiting_subject_add = false;
      await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_done(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال نص مخصص جديد
    if (session.awaiting_text_value) {
      const screenKey = session.awaiting_text_edit!;
      session.awaiting_text_value = false;
      session.awaiting_text_edit = undefined;
      customTexts.set(screenKey, ctx.message.text);
      await ctx.reply(ADMIN_TEXTS.customize.saved(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال تعديل عنوان محتوى
    if (session.awaiting_content_edit) {
      const contentId = session.awaiting_content_edit;
      const content = mockContent.find((c) => c.id === contentId);
      if (content) {
        content.title = ctx.message.text;
        content.last_modified_at = new Date().toISOString();
        content.last_modified_by = ctx.from.id;
      }
      session.awaiting_content_edit = undefined;
      await ctx.reply(ADMIN_TEXTS.content_detail.edit_success, {
        reply_markup: new InlineKeyboard()
          .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال تعيين شاغل منصب
    if (session.awaiting_position_assign) {
      const assign = session.awaiting_position_assign;
      if (assign.step === "name") {
        assign.name = ctx.message.text;
        assign.step = "telegram_id";
        await ctx.reply(
          ADMIN_TEXTS.positions.assign_prompt_id(assign.name),
          {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", `position_detail_${assign.position_id}`),
            parse_mode: "Markdown",
          }
        );
        return;
      }
      if (assign.step === "telegram_id") {
        const tid = parseInt(ctx.message.text);
        if (isNaN(tid)) {
          await ctx.reply("⚠️ المعرّف يجب أن يكون رقماً. أعد المحاولة:");
          return;
        }
        // محاكاة التعيين
        mockHolders = mockHolders.map((h) =>
          h.position_id === assign.position_id ? { ...h, is_active: false } : h
        );
        mockHolders.push({
          position_id: assign.position_id,
          user_telegram_id: tid,
          assigned_at: new Date().toISOString().substring(0, 10),
          assigned_by: ctx.from.id,
          is_active: true,
        });
        // إضافة المستخدم للقائمة (محاكاة)
        const position = getMockPositionById(assign.position_id);
        const successMsg = ADMIN_TEXTS.positions.assign_success(assign.name || "المستخدم", position?.title || "المنصب");
        session.awaiting_position_assign = undefined;
        await ctx.reply(successMsg, {
          reply_markup: new InlineKeyboard()
            .text("📋 قائمة المناصب", "list_positions")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        });
        return;
      }
    }

    // استقبال رابط قناة جديد
    if (session.awaiting_channel_edit) {
      const channelId = session.awaiting_channel_edit;
      const channel = mockChannels.find((c) => c.id === channelId);
      if (channel) {
        channel.channel_url = ctx.message.text;
        channel.updated_at = new Date().toISOString().substring(0, 10);
      }
      session.awaiting_channel_edit = undefined;
      await ctx.reply(ADMIN_TEXTS.channels.edit_success, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال سبب رفض التكريم
    if (session.awaiting_honor_reject) {
      const honorId = session.awaiting_honor_reject;
      const honor = MOCK_HONORS.find((h) => h.id === honorId);
      if (honor) {
        honor.status = "rejected";
        honor.rejection_reason = ctx.message.text;
      }
      session.awaiting_honor_reject = undefined;
      await ctx.reply(
        ADMIN_TEXTS.honors.reject_success,
        {
          reply_markup: new InlineKeyboard()
            .text("🔙 التكريمات المعلّقة", "honors_pending")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال بيانات التكريم اليدوي الجديد
    if (session.awaiting_honor_new_step === "student_id") {
      const tid = parseInt(ctx.message.text);
      if (isNaN(tid)) {
        await ctx.reply("⚠️ المعرّف يجب أن يكون رقماً. أعد المحاولة:");
        return;
      }
      session.awaiting_honor_new_data = { student_id: tid };
      session.awaiting_honor_new_step = "title";
      await ctx.reply(ADMIN_TEXTS.honors.new_honor_prompt_title, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      });
      return;
    }
    if (session.awaiting_honor_new_step === "title") {
      session.awaiting_honor_new_data!.title = ctx.message.text;
      session.awaiting_honor_new_step = "bonus";
      await ctx.reply(ADMIN_TEXTS.honors.new_honor_prompt_bonus, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      });
      return;
    }
    if (session.awaiting_honor_new_step === "bonus") {
      const bonus = parseInt(ctx.message.text);
      if (isNaN(bonus)) {
        await ctx.reply("⚠️ المكافأة يجب أن تكون رقماً. أعد المحاولة:");
        return;
      }
      const data = session.awaiting_honor_new_data!;
      // إنشاء تكريم جديد
      const newHonor: MockHonor = {
        id: MOCK_HONORS.length + 1,
        student_telegram_id: data.student_id!,
        student_name: `طالب ${data.student_id}`,
        honor_type: "manual",
        honor_title: data.title!,
        honor_period: "يدوي",
        points_at_honor: 0,
        bonus_points: bonus,
        status: "approved",
        approved_by_telegram_id: ctx.from.id,
        approved_at: new Date().toISOString().substring(0, 10),
        created_at: new Date().toISOString().substring(0, 10),
      };
      MOCK_HONORS.push(newHonor);
      session.awaiting_honor_new_step = undefined;
      session.awaiting_honor_new_data = undefined;
      await ctx.reply(
        ADMIN_TEXTS.honors.new_honor_success(newHonor.student_name, newHonor.honor_title),
        {
          reply_markup: new InlineKeyboard()
            .text("🏆 إدارة التكريم", "manage_honors")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // رسالة افتراضية
    await ctx.reply("👋 استخدم الأزرار للتنقل، أو /start للعودة للوحة الإدارة.");
  });

  // ====== استقبال ملفات (للتعميمات + رفع محتوى) ======
  bot.on(":document", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);

    // استقبال ملف للتعميم
    if (session?.awaiting_broadcast_text && session.broadcast_context) {
      const ctxData = session.broadcast_context;
      session.awaiting_broadcast_text = false;
      session.broadcast_context = undefined;
      const doc = ctx.message.document;
      await ctx.reply(
        ADMIN_TEXTS.broadcast.sent_file(doc.file_name, ctxData.count, ctxData.scope_label),
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // محاكاة رفع المحتوى
    const doc = ctx.message.document;
    await ctx.reply(
      `✅ *تم استلام الملف!*\n\n📄 *الاسم:* ${doc.file_name}\n📊 *الحجم:* ${(doc.file_size / 1024 / 1024).toFixed(2)} MB\n\n_في الإنتاج: سيُرفع الملف لقناة التخزين ويُسجّل في قاعدة البيانات._`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== استقبال صور (للتعميمات بصورة) ======
  bot.on(":photo", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (session?.awaiting_broadcast_text && session.broadcast_context) {
      const ctxData = session.broadcast_context;
      session.awaiting_broadcast_text = false;
      session.broadcast_context = undefined;
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = ctx.message.caption || "(بدون تعليق)";
      await ctx.reply(
        ADMIN_TEXTS.broadcast.sent_photo(caption, ctxData.count, ctxData.scope_label),
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    await ctx.reply("ℹ️ استخدم الأزرار للتنقل. الصور تُستخدم للتعميمات فقط.");
  });

  // ============================================
  // A13: إدارة التكريم (للمركزي فقط)
  // ============================================
  bot.callbackQuery("manage_honors", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    if (!perms.permissions.has("manage_honors")) {
      await ctx.editMessageText("❌ *ليست لديك صلاحية إدارة التكريم.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    const pendingHonors = MOCK_HONORS.filter((h) => h.status === "pending");
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_pending(pendingHonors.length), "honors_pending")
          .row()
          .text(ADMIN_TEXTS.honors.btn_approved, "honors_approved")
          .row()
          .text(ADMIN_TEXTS.honors.btn_new, "honor_new")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("honors_pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = MOCK_HONORS.filter((h) => h.status === "pending");
    if (pending.length === 0) {
      await ctx.editMessageText(
        "✅ *لا توجد تكريمات معلّقة حالياً.*",
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    let msg = ADMIN_TEXTS.honors.pending_title(pending.length);
    const kb = new InlineKeyboard();
    pending.forEach((h) => {
      msg += ADMIN_TEXTS.honors.honor_entry({
        student_name: h.student_name,
        honor_title: h.honor_title,
        points_at_honor: h.points_at_honor,
        bonus_points: h.bonus_points,
      });
      kb.text(`👤 ${h.student_name} - ${h.honor_title.substring(0, 20)}...`, `honor_detail_${h.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  bot.callbackQuery(/honor_detail_(\d+)/, async (ctx) => {
    const honorId = parseInt(ctx.match[1]);
    const honor = MOCK_HONORS.find((h) => h.id === honorId);
    await ctx.answerCallbackQuery();
    if (!honor) {
      await ctx.reply("⚠️ التكريم غير موجود.");
      return;
    }
    const nominator = honor.nominated_by_telegram_id ? getMockAdminUser(honor.nominated_by_telegram_id) : null;
    const scopeText = honor.scope_specialty_id
      ? `تخصص ${honor.scope_specialty_id}`
      : honor.scope_college_id
      ? `كلية ${honor.scope_college_id}`
      : "عالمي";
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.honor_detail({
        student_name: honor.student_name,
        honor_title: honor.honor_title,
        honor_type: honor.honor_type,
        scope: scopeText,
        honor_period: honor.honor_period,
        points_at_honor: honor.points_at_honor,
        bonus_points: honor.bonus_points,
        nominated_by: nominator?.first_name || "غير معروف",
        created_at: honor.created_at,
      }),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_approve, `approve_honor_${honorId}`)
          .text(ADMIN_TEXTS.honors.btn_reject, `reject_honor_${honorId}`)
          .row()
          .text("🔙 التكريمات المعلّقة", "honors_pending")
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/approve_honor_(\d+)/, async (ctx) => {
    const honorId = parseInt(ctx.match[1]);
    const honor = MOCK_HONORS.find((h) => h.id === honorId);
    await ctx.answerCallbackQuery({ text: "✅ تم الاعتماد" });
    if (honor) {
      honor.status = "approved";
      honor.approved_by_telegram_id = ctx.from.id;
      honor.approved_at = new Date().toISOString().substring(0, 10);
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.approve_success(honor?.student_name || "الطالب", honor?.bonus_points || 0),
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 التكريمات المعلّقة", "honors_pending")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/reject_honor_(\d+)/, async (ctx) => {
    const honorId = parseInt(ctx.match[1]);
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_honor_reject = honorId;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reject_prompt,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `honor_detail_${honorId}`),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("honors_approved", async (ctx) => {
    await ctx.answerCallbackQuery();
    const approved = MOCK_HONORS.filter((h) => h.status === "approved");
    if (approved.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.honors.log_empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    let msg = ADMIN_TEXTS.honors.log_title(approved.length);
    approved.forEach((h) => {
      msg += ADMIN_TEXTS.honors.log_entry({
        student_name: h.student_name,
        honor_title: h.honor_title,
        bonus_points: h.bonus_points,
        approved_at: h.approved_at || "غير معروف",
      });
    });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("honor_new", async (ctx) => {
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_honor_new_step = "student_id";
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.new_honor_prompt_student,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // A14: إعادة ضبط النقاط (للمركزي فقط)
  // ============================================
  bot.callbackQuery("manage_reset_points", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = getEffectivePermissions(ctx.from.id, session.simulated_role);
    if (!perms.permissions.has("reset_points")) {
      await ctx.editMessageText("❌ *ليست لديك صلاحية إعادة ضبط النقاط.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reset_prompt,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_reset_global, "reset_global")
          .row()
          .text(ADMIN_TEXTS.honors.btn_reset_college, "reset_college")
          .text(ADMIN_TEXTS.honors.btn_reset_specialty, "reset_specialty")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/reset_(global|college|specialty)/, async (ctx) => {
    const scope = ctx.match[1];
    await ctx.answerCallbackQuery();
    const scopeLabels: Record<string, string> = {
      global: "🌍 كل الطلاب",
      college: "🏛 كلية محددة",
      specialty: "📚 تخصص محدد",
    };
    // محاكاة الإحصائيات
    const studentsCount = scope === "global" ? 1247 : scope === "college" ? 312 : 89;
    const totalPoints = scope === "global" ? 15420 : scope === "college" ? 3210 : 890;
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reset_confirm(scopeLabels[scope], studentsCount, totalPoints),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.honors.btn_confirm_reset, `confirm_reset_${scope}`)
          .text(ADMIN_TEXTS.honors.btn_cancel_reset, "manage_reset_points")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/confirm_reset_(global|college|specialty)/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم إعادة الضبط" });
    await ctx.editMessageText(
      ADMIN_TEXTS.honors.reset_success,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== معالجة الأخطاء ======
  bot.catch(async (err) => {
    const e = err.error as any;
    const ctx = err.ctx;
    console.error("Admin bot error:", e?.message || e);
    const ignorableMessages = [
      "query is too old", "message is not modified", "chat not found",
      "message to edit not found", "message to delete not found",
      "QUERY_ID_INVALID", "MESSAGE_ID_INVALID",
    ];
    const errMsg = (e?.message || "").toLowerCase();
    if (ignorableMessages.some((m) => errMsg.includes(m.toLowerCase()))) return;
    try {
      if (ctx?.chat?.id) {
        await ctx.api.sendMessage(ctx.chat.id, "⚠️ حدث خطأ. حاول مرة أخرى بكتابة /start");
      }
    } catch { /* ignore */ }
  });

  return bot;
}

// ============================================
// Cloudflare Worker Entry Point
// ============================================
export interface Env {
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  ENVIRONMENT: string;
  WORKERS_SUBDOMAIN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

let botInstance: Bot | null = null;
let supabaseClient: SupabaseClient | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (!supabaseClient && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
        supabaseClient = new SupabaseClient({
          SUPABASE_URL: env.SUPABASE_URL,
          SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
        });
      }
      if (!botInstance) {
        botInstance = createAdminBot(env.BOT_TOKEN, supabaseClient || undefined);
      }
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok", bot: env.BOT_USERNAME, environment: env.ENVIRONMENT,
            version: "3.3", timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname === "/webhook") {
        try {
          const callback = webhookCallback(botInstance, "cloudflare-mod");
          return await callback(request);
        } catch (err) {
          console.error("Webhook handler error:", err);
          return new Response("", { status: 200 });
        }
      }

      return new Response(
        "🛡 UST Admin Bot v3.0 - RBAC Mockup\n\nWebhook: /webhook\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
