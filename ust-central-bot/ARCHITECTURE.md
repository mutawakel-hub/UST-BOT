# 🏗 ARCHITECTURE — UST Central Bot

## 📐 نظرة عامة على البنية

```
                        ┌──────────────────────────────┐
                        │     Telegram Messenger       │
                        │   (Students + Admins)        │
                        └────────────┬─────────────────┘
                                     │
                                     │ HTTPS Webhooks
                                     ▼
        ┌────────────────────────────────────────────────────┐
        │              Cloudflare Workers (Free)              │
        │                                                      │
        │  ┌─────────────────┐    ┌─────────────────┐         │
        │  │ ust-student-bot │    │  ust-admin-bot  │         │
        │  │   (12 screens)  │    │  (15 screens)   │         │
        │  └────────┬────────┘    └────────┬────────┘         │
        │           │                       │                  │
        │           └───────────┬───────────┘                  │
        │                       │                              │
        │                       ▼                              │
        │              ┌─────────────────┐                     │
        │              │ ust-pdf-server  │ (Mockup PDFs)       │
        │              └─────────────────┘                     │
        │                                                      │
        └────────────────────────────────────────────────────┘
                                     │
                                     │ (Future: Supabase + KV)
                                     ▼
                        ┌──────────────────────────────┐
                        │   Supabase (PostgreSQL)       │
                        │   14 Tables (Phase 2)         │
                        └──────────────────────────────┘
```

## 🎯 المبادئ التصميمية

### 1. Stateless Workers
- كل Worker لا يحتفظ بحالة بين الطلبات
- حالة المستخدم تُخزّن في `Map` مؤقتاً (في الإنتاج: KV)
- كل طلب webhook مستقل

### 2. Webhook-First (لا Long Polling)
- Telegram يُرسل التحديثات إلى Worker عبر HTTPS POST
- الاستجابة بـ 200 دائماً (حتى عند الأخطاء) لمنع إعادة المحاولة
- `drop_pending_updates: true` عند التسجيل

### 3. Error Resilience
- `bot.catch` شامل يلتقط كل الأخطاء
- الأخطاء "القابلة للتجاهل" (query too old, message not modified) → تجاهل صامت
- الأخطاء الأخرى → محاولة إرسال رسالة للمستخدم + سجل

### 4. Shared Code
- `src/shared/data/` — بيانات مشتركة (colleges, subjects, leaderboard, admins)
- `src/shared/keyboards.ts` — كل الـ keyboards
- `src/shared/texts.ts` — كل النصوص (عربي)

## 📦 التقنيات

| الطبقة | التقنية | السبب |
|---|---|---|
| Runtime | **Cloudflare Workers** | 100k طلب/يوم مجاناً |
| اللغة | **TypeScript** | أمان الأنواع |
| مكتبة TG | **grammY** | مصممة لـ Serverless |
| النشر | **Wrangler 4** | CLI رسمي من CF |

## 🔄 دورة حياة الطلب

```
1. المستخدم يضغط زراً في تلغرام
2. Telegram يُرسل POST إلى Worker /webhook
3. Worker يستلم الـ Update
4. grammY يوزّعه على الـ handler المناسب
5. الـ handler يحدّث الحالة + يُرسل استجابة عبر Telegram API
6. Worker يُرجع 200 OK
7. Telegram يُسجّل الـ update كمعالَج
```

## 🔐 الأمان

- ✅ Bot Tokens في Cloudflare Secrets (مشفّرة)
- ✅ لا credentials في الكود
- ✅ معالجة أخطاء شاملة
- ⏳ Rate Limiting (المرحلة القادمة)
- ⏳ HMAC signing على callback_data (المرحلة القادمة)
