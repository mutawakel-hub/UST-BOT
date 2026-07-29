// ============================================
// 🎓 بوت الطالب - جامعة العلوم والتكنولوجيا
// Production: Cloudflare Workers + grammY + Supabase + KV
// 12 شاشة + شاشة معاينة ملف + breadcrumb
// ============================================
//
// هذا الملف هو orchestrator رفيع فقط:
//   1. يهيّئ البوت والـ stores
//   2. يسجّل كل مجموعات الـ handlers من مجلد handlers/
//   3. يصدّر entry point لـ Cloudflare Worker
//
// الـ handlers الفعلية موزّعة على:
//   handlers/start.ts        — /start, registration flow
//   handlers/navigation.ts   — colleges, majors, levels, semesters, subjects, back_to_*
//   handlers/files.ts        — file types, preview, download, search preview
//   handlers/contribution.ts — contribution flow (short + long paths)
//   handlers/search.ts       — search
//   handlers/leaderboard.ts  — leaderboard
//   handlers/profile.ts      — profile, contributions, downloads, notifications
//   handlers/committee.ts    — committee channels, contact
//   handlers/messages.ts     — :text, :document
// ============================================

import { Bot, webhookCallback } from "grammy";
import { SupabaseClient } from "../shared/db";
import { initCallbackSigning } from "../shared/callback-signing";
import { initSessionStore } from "./state";

// Handler registrations
import { registerStartHandlers } from "./handlers/start";
import { registerNavigationHandlers } from "./handlers/navigation";
import { registerFileHandlers } from "./handlers/files";
import { registerContributionHandlers } from "./handlers/contribution";
import { registerSearchHandlers } from "./handlers/search";
import { registerLeaderboardHandlers } from "./handlers/leaderboard";
import { registerProfileHandlers } from "./handlers/profile";
import { registerCommitteeHandlers } from "./handlers/committee";
import { registerMessageHandlers } from "./handlers/messages";

// ============================================
// إنشاء البوت
// ============================================
export function createStudentBot(
  token: string,
  supabase: SupabaseClient,
  sessionsKv: KVNamespace,
  cacheKv: KVNamespace,
  callbackSecret: string
): Bot {
  // تهيئة SessionStore و callback signing
  initSessionStore(sessionsKv);
  if (callbackSecret) {
    initCallbackSigning(callbackSecret);
  }

  const bot = new Bot(token);

  // تسجيل كل مجموعات الـ handlers
  registerStartHandlers(bot, supabase);
  registerNavigationHandlers(bot, supabase);
  registerFileHandlers(bot, supabase);
  registerContributionHandlers(bot, supabase);
  registerSearchHandlers(bot, supabase);
  registerLeaderboardHandlers(bot, supabase);
  registerProfileHandlers(bot, supabase);
  registerCommitteeHandlers(bot, supabase);
  registerMessageHandlers(bot, supabase);

  // معالجة الأخطاء الشاملة
  bot.catch(async (err) => {
    const e = err.error as any;
    const ctx = err.ctx;
    console.error("Student bot error:", e?.message || e);

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
      // تهيئة Supabase (إلزامي في الإنتاج)
      if (!supabaseClient) {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
          return new Response(
            JSON.stringify({
              status: "error",
              error: "SUPABASE_URL or SUPABASE_SERVICE_KEY not set",
              hint: "Run: wrangler secret put SUPABASE_URL --config wrangler.student.toml",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        supabaseClient = new SupabaseClient({
          SUPABASE_URL: env.SUPABASE_URL,
          SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
        });
      }

      if (!botInstance) {
        botInstance = createStudentBot(env.BOT_TOKEN, supabaseClient!, env.SESSIONS, env.CACHE, env.CALLBACK_SECRET || "");
      }

      const url = new URL(request.url);

      // ====== Health endpoint ======
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            version: "3.0",
            supabase: "connected",
            kv_sessions: env.SESSIONS ? "bound" : "missing",
            kv_cache: env.CACHE ? "bound" : "missing",
            callback_signing: env.CALLBACK_SECRET ? "enabled" : "disabled",
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // ====== Webhook endpoint ======
      if (url.pathname === "/webhook") {
        try {
          const callback = webhookCallback(botInstance, "cloudflare-mod");
          return await callback(request);
        } catch (err) {
          console.error("Webhook handler error (returning 200 to stop retries):", (err as Error)?.message || err);
          return new Response("", { status: 200 });
        }
      }

      return new Response(
        "🎓 UST Student Bot v3.0 (Production)\n\nWebhook: /webhook\nHealth: /health\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
