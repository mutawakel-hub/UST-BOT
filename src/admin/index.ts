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

import { Bot, webhookCallback } from "grammy";
import { SupabaseClient } from "../shared/db";
import { initRbac } from "../shared/rbac";
import { initCallbackSigning } from "../shared/callback-signing";
import { initSessionStore } from "./state";

// Handler registrations
import { registerDashboardHandlers } from "./handlers/dashboard";
import { registerContributionHandlers } from "./handlers/contributions";
import { registerContentHandlers } from "./handlers/content";
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
  if (callbackSecret) {
    initCallbackSigning(callbackSecret);
  }
  (globalThis as any).__supabase = supabase;

  const bot = new Bot(token);

  // تسجيل كل مجموعات الـ handlers
  registerDashboardHandlers(bot, supabase);
  registerContributionHandlers(bot, supabase);
  registerContentHandlers(bot, supabase);
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
            version: "3.3",
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
