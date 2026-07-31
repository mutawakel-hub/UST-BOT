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
  BROADCAST_INTERNAL_TOKEN: string;
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

      // ====== Debug: Test contribution insert ======
      if (url.pathname === "/debug/contribution") {
        const debug: any = { timestamp: new Date().toISOString(), tests: {} };

        // 1. Check admin_users
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/admin_users?select=telegram_id,first_name&limit=5`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          debug.tests.admin_users = { status: resp.status, body: (await resp.text()).substring(0, 300) };
        } catch (e: any) { debug.tests.admin_users = { error: e.message }; }

        // 2. Check content_types
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/content_types?select=id,name&limit=10`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          debug.tests.content_types = { status: resp.status, body: (await resp.text()).substring(0, 500) };
        } catch (e: any) { debug.tests.content_types = { error: e.message }; }

        // 3. Check subjects
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/subjects?select=id,name&limit=5`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          debug.tests.subjects = { status: resp.status, body: (await resp.text()).substring(0, 300) };
        } catch (e: any) { debug.tests.subjects = { error: e.message }; }

        // 4. Check contributions columns (try select)
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/contributions?select=id,title,points_awarded,escalated_at&limit=1`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          const body = await resp.text();
          debug.tests.contributions_new_columns = {
            status: resp.status,
            ok: resp.ok,
            body: body.substring(0, 400),
            note: resp.status === 400 ? "NEW COLUMNS MISSING — apply schema.sql" : "OK"
          };
        } catch (e: any) { debug.tests.contributions_new_columns = { error: e.message }; }

        // 5. Try actual insert (test)
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/contributions`,
            {
              method: "POST",
              headers: {
                apikey: env.SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({
                user_telegram_id: 1330666633,
                subject_id: 101,
                content_type_id: "summary",
                file_name: "test_debug.pdf",
                file_size_mb: 0.1,
                telegram_file_id: "test_debug_id",
                title: "Test Debug",
                status: "pending",
              }),
            }
          );
          const body = await resp.text();
          debug.tests.insert_test = {
            status: resp.status,
            ok: resp.ok,
            body: body.substring(0, 500),
          };

          // Clean up: delete test record
          if (resp.ok) {
            const inserted = JSON.parse(body);
            if (inserted[0]?.id) {
              await fetch(
                `${env.SUPABASE_URL}/rest/v1/contributions?id=eq.${inserted[0].id}`,
                {
                  method: "DELETE",
                  headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
                }
              );
              debug.tests.insert_test.cleanup = "deleted test record";
            }
          }
        } catch (e: any) { debug.tests.insert_test = { error: e.message }; }

        return new Response(JSON.stringify(debug, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // ====== Debug: Check content table ======
      if (url.pathname.startsWith("/debug/content/")) {
        const subjectId = url.pathname.split("/")[3];
        const debug: any = { subject_id: subjectId, tests: {} };

        // 1. Check content table for this subject
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/content?subject_id=eq.${subjectId}&select=id,title,content_type_id,is_active,telegram_file_id&order=id.desc&limit=10`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          const body = await resp.text();
          debug.tests.content = {
            status: resp.status,
            ok: resp.ok,
            body: body.substring(0, 800),
          };
        } catch (e: any) { debug.tests.content = { error: e.message }; }

        // 2. Check contributions for this subject
        try {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/contributions?subject_id=eq.${subjectId}&select=id,title,status,content_type_id,telegram_file_id&order=id.desc&limit=10`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
          );
          const body = await resp.text();
          debug.tests.contributions = {
            status: resp.status,
            ok: resp.ok,
            body: body.substring(0, 800),
          };
        } catch (e: any) { debug.tests.contributions = { error: e.message }; }

        return new Response(JSON.stringify(debug, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // ====== Broadcast Push endpoint (يستقبل من بوت الإدارة) ======
      // يستقبل طلب POST لإرسال رسالة تعميم لطالب واحد عبر بوت الطالب
      // الأمان: header مخصص x-internal-token (قيمة ثابتة في wrangler.toml لكلا البوتين)
      // Body: { telegram_id, text, parse_mode? }
      if (url.pathname === "/broadcast-push" && request.method === "POST") {
        try {
          // تحقق من الـ token الداخلي عبر header
          const internalToken = request.headers.get("x-internal-token");
          if (internalToken !== env.BROADCAST_INTERNAL_TOKEN) {
            return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const body = await request.json() as any;
          if (!body.telegram_id || !body.text) {
            return new Response(JSON.stringify({ ok: false, error: "missing telegram_id or text" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          // أرسل الرسالة عبر بوت الطالب
          // لو parse_mode فارغ، لا نمرره (نص عادي)
          const sendOptions: any = {};
          if (body.parse_mode && body.parse_mode !== "") {
            sendOptions.parse_mode = body.parse_mode;
          }
          if (body.disable_notification) {
            sendOptions.disable_notification = true;
          }
          await botInstance!.api.sendMessage(body.telegram_id, body.text, sendOptions);
          return new Response(JSON.stringify({ ok: true, delivered: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          // أرجع الخطأ الفعلي دائماً — لا نخفيه
          const errMsg = String(e?.message || "");
          // صنّف الخطأ بدقة:
          // - blocked_or_not_started: الطالب حظر البوت أو لم يبدأ المحادثة
          // - parse_error: فشل في parsing الرسالة (Markdown/HTML غير صالح)
          // - telegram_error: أي خطأ آخر من Telegram
          const isBlocked = errMsg.includes("bot was blocked") || errMsg.includes("chat not found");
          const isParseError = errMsg.includes("can't parse entities") || errMsg.includes("can't parse");
          const errorType = isBlocked ? "blocked_or_not_started" : isParseError ? "parse_error" : "telegram_error";
          return new Response(
            JSON.stringify({
              ok: false,
              error: errorType,
              telegram_error: errMsg.substring(0, 300),
              error_code: (e as any)?.error_code || null,
            }),
            { status: isBlocked ? 404 : 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // ====== Debug: Broadcast Test endpoint ======
      // لاختبار إرسال رسالة لطالب محدد + عرض الخطأ الفعلي
      // GET /debug/broadcast-test?telegram_id=XXX&token=YYY
      if (url.pathname === "/debug/broadcast-test") {
        const debugToken = url.searchParams.get("token");
        if (debugToken !== env.BROADCAST_INTERNAL_TOKEN) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const targetId = parseInt(url.searchParams.get("telegram_id") || "0");
        const debug: any = { timestamp: new Date().toISOString(), target_id: targetId };

        // 1. تحقق من هوية البوت (getMe)
        try {
          const me = await botInstance!.api.getMe();
          debug.bot_identity = {
            id: me.id,
            username: me.username,
            first_name: me.first_name,
          };
          debug.expected_username = env.BOT_USERNAME;
          debug.token_matches = me.username === env.BOT_USERNAME;
        } catch (e: any) {
          debug.bot_identity_error = e?.message?.substring(0, 200);
        }

        // 2. اعرض الطلاب في DB
        try {
          const students = await supabaseClient!.select("students", {
            columns: "telegram_id,first_name,username,current_college_id,current_specialty_id,current_level",
            limit: 10,
          });
          debug.students_in_db = Array.isArray(students) ? students : [];
        } catch (e: any) {
          debug.students_db_error = e?.message?.substring(0, 200);
        }

        // 3. حاول إرسال رسالة اختبار (نفس تنسيق التعميم الفعلي)
        if (targetId > 0) {
          // رسالة بنفس تنسيق التعميم (HTML + رموز خاصة)
          const testMessageHtml =
            `📢 <b>تعميم جديد</b>\n\n` +
            `📍 📊 تقنية معلومات (IT) - مستوى 4\n` +
            `👤 من: Mutawakel\n` +
            `📅 ${new Date().toLocaleString("ar")}\n\n` +
            `━━━━━━━━━━━━━━━\n\n` +
            `مرحبا\n\n` +
            `━━━━━━━━━━━━━━━`;

          // محاولة 1: HTML
          try {
            await botInstance!.api.sendMessage(targetId, testMessageHtml, { parse_mode: "HTML" });
            debug.test_send_html = { ok: true, delivered: true };
          } catch (e: any) {
            debug.test_send_html = {
              ok: false,
              error: String(e?.message || "").substring(0, 400),
              error_code: (e as any)?.error_code || null,
            };
          }

          // محاولة 2: نص عادي (fallback)
          const testMessagePlain =
            `📢 تعميم جديد\n\n` +
            `📍 📊 تقنية معلومات (IT) - مستوى 4\n` +
            `👤 من: Mutawakel\n` +
            `📅 ${new Date().toLocaleString("ar")}\n\n` +
            `━━━━━━━━━━━━━━━\n\n` +
            `مرحبا\n\n` +
            `━━━━━━━━━━━━━━━`;
          try {
            await botInstance!.api.sendMessage(targetId, testMessagePlain);
            debug.test_send_plain = { ok: true, delivered: true };
          } catch (e: any) {
            debug.test_send_plain = {
              ok: false,
              error: String(e?.message || "").substring(0, 400),
              error_code: (e as any)?.error_code || null,
            };
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
