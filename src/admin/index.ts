// ============================================
// 🛡️ بوت الإدارة - جامعة العلوم والتكنولوجيا
// Production: Cloudflare Workers + grammY + Supabase + KV
// نظام RBAC كامل (من DB) + 13 شاشة
// ============================================
//
// هذا الملف هو orchestrator رفيع فقط:
//   1. يهيّئ البوت والـ stores
//   2. يسجّل كل مجموعات الـ handlers من مجلد handlers/
//   3. يصدّر entry point لـ Cloudflare Worker
//
// الـ handlers الفعلية موزّعة على:
//   handlers/dashboard.ts       — /start, back_to_dashboard
//   handlers/contributions.ts   — pending, review, approve, reject
//   handlers/content.ts         — content_mgmt, browse, upload, edit, delete
//   handlers/subjects.ts        — subjects_mgmt, add, list, edit
//   handlers/broadcast.ts       — broadcast flow
//   handlers/statistics.ts      — statistics, refresh
//   handlers/texts.ts           — customize_texts
//   handlers/positions.ts       — manage_admins, list, detail, assign, revoke
//   handlers/channels.ts        — manage_channels
//   handlers/honors.ts          — manage_honors, leaderboard, reset_points
//   handlers/messages.ts        — :text, :document, :photo
// ============================================

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { SupabaseClient } from "../shared/db";
import { initRbac } from "../shared/rbac";
import { initCallbackSigning } from "../shared/callback-signing";
import { initSessionStore } from "./state";
import { initSubjectCache, invalidateSubjectCache, ensureSubjectCacheLoaded } from "../shared/data/subjects";
import { initTextResolver, ensureTextCacheLoaded, invalidateTextCache } from "../shared/text-resolver";
import { BOT_VERSION } from "../shared/version";

// Handler registrations
import { registerDashboardHandlers } from "./handlers/dashboard";
import { registerContributionHandlers } from "./handlers/contributions";
import { registerContentHandlers } from "./handlers/content";
import { registerContentBrowseHierarchyHandlers } from "./handlers/content_browse_hierarchy";
import { registerContentEditMoveCopyHandlers } from "./handlers/content_edit_move_copy";
import { registerContentImportHandlers } from "./handlers/content_import";
import { registerContentAuditLogHandlers } from "./handlers/content_audit_log";
import { registerContentSearchStatsHandlers } from "./handlers/content_search_stats";
import { registerSubjectHandlers } from "./handlers/subjects";
import { registerBroadcastHandlers } from "./handlers/broadcast";
import { registerStatisticsHandlers } from "./handlers/statistics";
import { registerTextHandlers } from "./handlers/texts";
import { registerPositionHandlers } from "./handlers/positions";
import { registerChannelHandlers } from "./handlers/channels";
import { registerHonorHandlers } from "./handlers/honors";
import { registerMessageHandlers } from "./handlers/messages";
import { runEscalationCheck, getAdminPerformanceReport, registerEscalationHandlers } from "./handlers/escalation";
import { registerIhsanManagementHandlers } from "./handlers/ihsan_management";
import { registerSystemSettingsHandlers } from "./handlers/system_settings";

// ============================================
// إنشاء البوت
// ============================================
export function createAdminBot(
  token: string,
  supabase: SupabaseClient,
  sessionsKv: KVNamespace,
  cacheKv: KVNamespace,
  callbackSecret: string
): Bot {
  // تهيئة الـ stores
  initSessionStore(sessionsKv);
  initRbac(supabase, cacheKv);
  initSubjectCache(supabase);
  initTextResolver(supabase);
  if (callbackSecret) {
    initCallbackSigning(callbackSecret);
  }
  (globalThis as any).__supabase = supabase;

  const bot = new Bot(token);

  // تسجيل كل مجموعات الـ handlers
  registerDashboardHandlers(bot, supabase);
  registerContributionHandlers(bot, supabase);
  registerContentHandlers(bot, supabase);
  registerContentBrowseHierarchyHandlers(bot, supabase);
  registerContentEditMoveCopyHandlers(bot, supabase);
  registerContentImportHandlers(bot, supabase);
  registerContentAuditLogHandlers(bot, supabase);
  registerContentSearchStatsHandlers(bot, supabase);
  registerSubjectHandlers(bot, supabase);
  registerBroadcastHandlers(bot, supabase);
  registerStatisticsHandlers(bot, supabase);
  registerTextHandlers(bot, supabase);
  registerPositionHandlers(bot, supabase);
  registerChannelHandlers(bot, supabase);
  registerHonorHandlers(bot, supabase);
  registerMessageHandlers(bot, supabase);
  registerEscalationHandlers(bot, supabase);
  registerIhsanManagementHandlers(bot, supabase);
  registerSystemSettingsHandlers(bot, supabase);

  // ============================================
  // التقاط دعوات المسؤولين عبر deep linking
  // /start invite_TOKEN → يعرض شاشة قبول الدعوة
  // ============================================
  bot.command("start", async (ctx) => {
    const args = ctx.match as string || "";
    if (args.startsWith("invite_")) {
      const token = args.substring(7); // إزالة "invite_"
      const { getInvitationByToken, acceptInvitation } = await import("../shared/db");
      const { ensureLevelRepPosition } = await import("./helpers");
      const { getCollegeById, getSpecialtyById } = await import("../shared/data/colleges");
      const { invalidateUserPermissions } = await import("../shared/rbac");

      let invitation: any = null;
      try {
        invitation = await getInvitationByToken(supabase, token);
      } catch (e) {
        console.error("Failed to fetch invitation:", e);
      }

      if (!invitation) {
        await ctx.reply("⚠️ *الدعوة غير موجودة* أو تم استخدامها بالفعل.", { parse_mode: "Markdown" });
        return;
      }

      if (invitation.status !== "pending") {
        const statusLabel = invitation.status === "accepted" ? "مقبولة" :
                            invitation.status === "revoked" ? "ملغاة" : "منتهية";
        await ctx.reply(`⚠️ هذه الدعوة *${statusLabel}* ولا يمكن استخدامها.`, { parse_mode: "Markdown" });
        return;
      }

      // تحقق من انتهاء الصلاحية
      if (new Date(invitation.expires_at) < new Date()) {
        await ctx.reply("⚠️ انتهت صلاحية هذه الدعوة (أكثر من 7 أيام).", { parse_mode: "Markdown" });
        return;
      }

      // عرض تفاصيل الدعوة + زر القبول/الرفض
      const roleLabel = invitation.role === "central" ? "🛡 مسؤول مركزي" :
                        invitation.role === "college" ? "🏛 مسؤول كلية" :
                        "📊 مندوب مستوى";

      let scopeLabel = "";
      if (invitation.role === "college" && invitation.college_id) {
        scopeLabel = `\n🏛 الكلية: ${getCollegeById(invitation.college_id)?.name || ""}`;
      } else if (invitation.role === "level" && invitation.specialty_id) {
        const spec = getSpecialtyById(invitation.specialty_id);
        scopeLabel = `\n📚 التخصص: ${spec?.name || ""}\n📊 المستوى: ${invitation.level_num}`;
      }

      const inviteName = invitation.custom_name ? `\n👤 الاسم: ${invitation.custom_name}` : "";

      await ctx.reply(
        `🎉 *لديك دعوة لتصبح مسؤولاً!*\n\n` +
        `🎭 الدور: ${roleLabel}${inviteName}${scopeLabel}\n\n` +
        `هل تقبل الدعوة؟`,
        {
          reply_markup: new InlineKeyboard()
            .text("✅ قبول", `accept_invite_${invitation.id}`)
            .text("❌ رفض", `reject_invite_${invitation.id}`),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // /start عادي → عرض لوحة الإدارة
    const { getUserPermissions } = await import("../shared/rbac");
    const { buildDynamicDashboard, getPendingCount, getRoleLabel } = await import("./helpers");
    const { getOrCreateSession } = await import("./state");

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.positions.length && !perms.is_central) {
      await ctx.reply(
        "⚠️ *ليست لديك صلاحية الوصول لبوت الإدارة.*\n\n" +
        "لو تمت دعوتك كمسؤول، اضغط رابط الدعوة الذي وصلك.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const pendingCount = await getPendingCount(supabase);
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const roleLabel = getRoleLabel(perms);

    await ctx.reply(
      `🛡 *لوحة الإدارة*\n\n👤 *${ctx.from.first_name || "مسؤول"}*\n🎭 ${roleLabel}\n\n📥 الإحسانات المعلقة: *${pendingCount}*\n\nاختر الإجراء المطلوب:`,
      {
        reply_markup: buildDynamicDashboard(perms, pendingCount),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // قبول الدعوة
  // ============================================
  bot.callbackQuery(/^accept_invite_(\d+)$/, async (ctx) => {
    const invitationId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "✅ جارٍ القبول..." });

    const { getInvitationByToken, acceptInvitation } = await import("../shared/db");
    const { ensureLevelRepPosition, writePositionAuditLog, notifyNewAdmin } = await import("./helpers");
    const { getCollegeById, getSpecialtyById } = await import("../shared/data/colleges");
    const { invalidateUserPermissions } = await import("../shared/rbac");

    // اقرأ الدعوة
    let invitation: any = null;
    try {
      const result = await supabase.select("admin_invitations", {
        filter: `id=eq.${invitationId}`,
        single: true,
      });
      invitation = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Failed to fetch invitation:", e);
    }

    if (!invitation || invitation.status !== "pending") {
      await ctx.editMessageText("⚠️ الدعوة غير صالحة أو تم استخدامها.");
      return;
    }

    // تحقق من انتهاء الصلاحية
    if (new Date(invitation.expires_at) < new Date()) {
      await ctx.editMessageText("⚠️ انتهت صلاحية هذه الدعوة.");
      return;
    }

    // سجّل المستخدم في admin_users
    try {
      await supabase.insert("admin_users", {
        telegram_id: ctx.from.id,
        first_name: ctx.from.first_name || invitation.custom_name || "مسؤول",
        username: ctx.from.username || null,
        display_name: invitation.custom_name || ctx.from.first_name || "مسؤول",
      });
    } catch (e: any) {
      // قد يكون موجوداً مسبقاً — تجاهل خطأ duplicate
      const msg = String(e?.message || "");
      if (!msg.includes("duplicate") && !msg.includes("23505")) {
        console.warn("Failed to register admin_user:", msg.substring(0, 100));
      }
    }

    // حدّد position_id
    let positionId = invitation.position_id;

    if (invitation.role === "central") {
      positionId = "central_chair";
    } else if (invitation.role === "college" && invitation.college_id) {
      positionId = `college_admin_${invitation.college_id}`;
      // تأكد من وجود المنصب
      try {
        await supabase.insert("positions", {
          id: positionId,
          level: "college",
          title: `🏛 مسؤول ${getCollegeById(invitation.college_id)?.short_name || ""}`,
          description: `مسؤول كلية ${getCollegeById(invitation.college_id)?.name || ""}`,
          college_id: invitation.college_id,
          is_central: false,
        });
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (!msg.includes("duplicate") && !msg.includes("23505")) {
          console.warn("Failed to create college position:", msg.substring(0, 100));
        }
      }
    } else if (invitation.role === "level" && invitation.specialty_id && invitation.level_num) {
      positionId = await ensureLevelRepPosition(
        supabase,
        invitation.college_id || 0,
        invitation.specialty_id,
        invitation.level_num
      );
    }

    if (!positionId) {
      await ctx.editMessageText("⚠️ فشل تحديد المنصب. تواصل مع المسؤول المركزي.");
      return;
    }

    // عيّن المستخدم في position_holders
    try {
      await supabase.insert("position_holders", {
        position_id: positionId,
        user_telegram_id: ctx.from.id,
        assigned_by: invitation.invited_by_telegram_id,
        is_active: true,
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("duplicate") || msg.includes("23505")) {
        // المستخدم مسجّل في هذا المنصب مسبقاً — فعّله
        await supabase.update("position_holders", {
          is_active: true,
        }, `position_id=eq.${positionId}&user_telegram_id=eq.${ctx.from.id}`);
      } else {
        console.error("Failed to assign position:", msg.substring(0, 200));
        await ctx.editMessageText("⚠️ فشل تعيين المنصب. حاول مرة أخرى.");
        return;
      }
    }

    // قبول الدعوة في DB
    await acceptInvitation(supabase, invitationId, ctx.from.id);

    // سجل العملية
    const positionTitle = invitation.role === "central" ? "🛡 مسؤول مركزي" :
      invitation.role === "college" ? `🏛 مسؤول ${getCollegeById(invitation.college_id)?.short_name || ""}` :
      `📊 مندوب ${getSpecialtyById(invitation.specialty_id)?.short_name || ""} - مستوى ${invitation.level_num}`;

    await writePositionAuditLog(supabase, {
      position_id: positionId,
      action: "assign",
      old_holder_id: null,
      new_holder_id: ctx.from.id,
      performed_by: invitation.invited_by_telegram_id,
    });

    // إبطال cache الصلاحيات
    await invalidateUserPermissions(ctx.from.id);

    // رسالة نجاح
    await ctx.editMessageText(
      `✅ *تم قبول الدعوة بنجاح!*\n\n` +
      `🎭 المنصب: ${positionTitle}\n` +
      `👤 الاسم: ${invitation.custom_name || ctx.from.first_name}\n\n` +
      `يمكنك الآن استخدام بوت الإدارة. أرسل /start لفتح اللوحة.`,
      { parse_mode: "Markdown" }
    );

    // أرسل /start تلقائياً
    await ctx.reply("👆 اضغط /start لفتح لوحة الإدارة.");
  });

  // ============================================
  // رفض الدعوة
  // ============================================
  bot.callbackQuery(/^reject_invite_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "❌ تم رفض الدعوة.\n\nلو غيّرت رأيك، يمكنك استخدام رابط الدعوة مرة أخرى.",
      { parse_mode: "Markdown" }
    );
  });

  // معالجة الأخطاء الشاملة
  bot.catch(async (err) => {
    const e = err.error as any;
    const ctx = err.ctx;
    console.error("Admin bot error:", e?.message || e);

    const ignorableMessages = [
      "query is too old",
      "message is not modified",
      "chat not found",
      "message to edit not found",
      "message to delete not found",
      "QUERY_ID_INVALID",
      "MESSAGE_ID_INVALID",
    ];
    const errMsg = (e?.message || "").toLowerCase();
    const isIgnorable = ignorableMessages.some((m) => errMsg.includes(m.toLowerCase()));
    if (isIgnorable) return;

    try {
      if (ctx?.chat?.id) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى بكتابة /start"
        );
      }
    } catch {
      // تجاهل
    }
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
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  CALLBACK_SECRET: string;
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
        botInstance = createAdminBot(env.BOT_TOKEN, supabaseClient!, env.SESSIONS, env.CACHE, env.CALLBACK_SECRET || "");
      }
      const url = new URL(request.url);

      // ====== Health endpoint ======
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            version: BOT_VERSION,
            supabase: supabaseClient ? "connected" : "missing",
            kv_sessions: env.SESSIONS ? "bound" : "missing",
            kv_cache: env.CACHE ? "bound" : "missing",
            callback_signing: env.CALLBACK_SECRET ? "enabled" : "disabled",
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // ====== Debug endpoint (للتشخيص) ======
      if (url.pathname.startsWith("/debug/rbac/")) {
        const telegramIdStr = url.pathname.split("/")[3];
        const telegramId = parseInt(telegramIdStr);
        if (!telegramId) {
          return new Response(JSON.stringify({ error: "Invalid telegram_id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const debug: any = {
          telegram_id: telegramId,
          timestamp: new Date().toISOString(),
          tests: {},
        };

        const tests = [
          { name: "admin_users", path: `/rest/v1/admin_users?telegram_id=eq.${telegramId}&select=telegram_id,first_name,username` },
          { name: "position_holders", path: `/rest/v1/position_holders?user_telegram_id=eq.${telegramId}&select=position_id,is_active,assigned_at` },
          { name: "user_permissions_view", path: `/rest/v1/user_permissions?user_telegram_id=eq.${telegramId}&select=*` },
          { name: "positions_table", path: `/rest/v1/positions?select=id,level,title&limit=5` },
          { name: "position_level_permissions", path: `/rest/v1/position_level_permissions?select=position_level,permission_id&limit=5` },
        ];

        for (const test of tests) {
          try {
            const resp = await fetch(`${env.SUPABASE_URL}${test.path}`, {
              headers: {
                apikey: env.SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              },
            });
            debug.tests[test.name] = {
              http_status: resp.status,
              ok: resp.ok,
              body: (await resp.text()).substring(0, 500),
            };
          } catch (e: any) {
            debug.tests[test.name] = { error: e.message };
          }
        }

        return new Response(JSON.stringify(debug, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // ====== Webhook endpoint ======
      if (url.pathname === "/webhook") {
        try {
          // Pre-load subject cache + text cache before processing
          await ensureSubjectCacheLoaded();
          await ensureTextCacheLoaded();
          const callback = webhookCallback(botInstance, "cloudflare-mod");
          return await callback(request);
        } catch (err) {
          console.error("Webhook handler error:", err);
          return new Response("", { status: 200 });
        }
      }

      return new Response(
        "🛡 UST Admin Bot v3.3 (Production)\n\nWebhook: /webhook\nHealth: /health\nDebug: /debug/rbac/:telegramId\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  // ====== Scheduled handler (Cron Trigger — يُستدعى كل ساعة) ======
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("⏰ [Scheduled] Cron trigger fired at", new Date().toISOString());

    try {
      // تهيئة Supabase إن لم يكن مهيّأً
      if (!supabaseClient && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
        supabaseClient = new SupabaseClient({
          SUPABASE_URL: env.SUPABASE_URL,
          SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
        });
      }
      if (!botInstance) {
        botInstance = createAdminBot(env.BOT_TOKEN, supabaseClient!, env.SESSIONS, env.CACHE, env.CALLBACK_SECRET || "");
      }

      // شغّل فحص التنبيه المتدرّج في الخلفية
      ctx.waitUntil(runEscalationCheck(botInstance!, supabaseClient!));
    } catch (error) {
      console.error("❌ [Scheduled] Error:", error);
    }
  },
};
