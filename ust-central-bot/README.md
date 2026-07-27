# 🎓 UST Central Bot — Mockup v2.1

> **البوت العلمي المركزي لجامعة العلوم والتكنولوجيا - اليمن**
> منشور على Cloudflare Workers + Telegram Webhooks (مجاني 100%)

---

## 📱 البوتين المباشرين (للتجربة الفورية)

| البوت | الرابط | الـ Worker URL |
|---|---|---|
| 🎓 **بوت الطالب** | [@usttesterbot](https://t.me/usttesterbot) | https://ust-student-bot.atow73768.workers.dev |
| 🛡 **بوت الإدارة** | [@usttesteradminbot](https://t.me/usttesteradminbot) | https://ust-admin-bot.atow73768.workers.dev |

### 🔑 معرّفات الإدارة التجريبية (للدخول إلى بوت الإدارة)

| المعرّف | الدور | الصلاحية |
|---|---|---|
| `DEMO001` | 🛡 مسؤول مركزي | كل الكليات والتخصصات |
| `DEMO002` | 🏛 مسؤول كلية | كلية الحاسبات |
| `DEMO003` | 📚 مسؤول تخصص | IT فقط |
| `DEMO004` | 📊 مسؤول مستوى | IT - المستوى 1 |

---

## 📋 المميزات

### 🎓 بوت الطالب (12 شاشة + شاشة معاينة ملف)

- ✅ 7 كليات + 34 تخصص (تغطية كاملة لجامعة UST)
- ✅ 20 مادة فعلية في تخصص IT (المستويان 1 و 2)
- ✅ Breadcrumb في كل شاشة (مسار التنقّل)
- ✅ عدّاد ملفات لكل تصنيف
- ✅ **شاشة معاينة الملف** قبل التحميل (اسم، حجم، تاريخ، رافع، عدّاد)
- ✅ **إرسال ملف PDF فعلي** عند التحميل
- ✅ بحث شامل في المواد والملفات
- ✅ لوحة شرف بـ 10 طلاب وهميين + تصفية بالكلية/التخصص
- ✅ حسابي: إحصائيات + مساهماتي + تحميلاتي
- ✅ Pagination في القوائم الطويلة (8 عناصر/صفحة)
- ✅ مساهمة الطلاب برفع الملفات

### 🛡 بوت الإدارة (15 شاشة)

- ✅ نظام تسجيل دخول بأربعة أدوار هرمية
- ✅ لوحة إدارة ديناميكية (تتغير حسب الدور)
- ✅ مراجعة المساهمات (اعتماد / اعتماد مميز / رفض مع سبب)
- ✅ تأكيد قبل الرفض
- ✅ إزالة المساهمات المعتمدة/المرفوضة تلقائياً من القائمة
- ✅ معالج رفع ملفات كامل (6 خطوات + شريط تقدّم)
- ✅ استعراض الملفات مع فلاتر
- ✅ إدارة المواد (إضافة/تعديل/قائمة)
- ✅ تعميم بنطاقات (الكل/كلية/تخصص/مستوى) + معاينة قبل الإرسال
- ✅ إدارة المسؤولين (إضافة فعلي + قائمة)
- ✅ إحصائيات شاملة
- ✅ تخصيص النصوص (4 شاشات + حفظ فعلي)
- ✅ تحديث لوحة الشرف (3 نطاقات)
- ✅ تسجيل الخروج

---

## 🏗 بنية المشروع

```
ust-central-bot/
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
├── wrangler.student.toml         # إعداد بوت الطالب
├── wrangler.admin.toml           # إعداد بوت الإدارة
├── .env.example                  # مثال على متغيرات البيئة
├── .dev.vars.example             # مثال على متغيرات التطوير المحلي
├── .gitignore
├── README.md                     # هذا الملف
│
├── src/
│   ├── shared/                   # الكود المشترك
│   │   ├── data/
│   │   │   ├── colleges.ts       # 7 كليات + 34 تخصص
│   │   │   ├── subjects.ts       # مواد IT + بيانات الملفات
│   │   │   ├── leaderboard.ts    # 10 طلاب لوحة الشرف
│   │   │   └── admins.ts         # 4 مسؤولين + 5 مساهمات معلّقة
│   │   ├── keyboards.ts          # جميع الـ Keyboards
│   │   └── texts.ts              # كل النصوص (عربي فصحى مبسّطة)
│   │
│   ├── student/
│   │   └── index.ts              # بوت الطالب (12 شاشة + معاينة)
│   │
│   └── admin/
│       └── index.ts              # بوت الإدارة (15 شاشة)
│
└── scripts/
    ├── setup.js                  # سكريبت الإعداد الكامل
    ├── set-secrets.js            # تعيين Bot Tokens كأسرار
    ├── set-webhooks.js           # تسجيل Webhooks
    ├── webhook-manager.js        # فحص/تنظيف/إعادة تسجيل الـ webhooks
    ├── load-env.js               # تحميل .env
    ├── generate_mock_pdf.py      # توليد PDF تجريبي
    └── mockup_sample.pdf         # ملف PDF التجريبي
```

---

## 🚀 خطوات التثبيت والنشر (5 دقائق)

### المتطلبات المسبقة

1. **Node.js 18+** — [تحميل](https://nodejs.org/)
2. **حساب Cloudflare** مجاني — [التسجيل](https://dash.cloudflare.com/sign-up)
3. **Bot Tokens** من [@BotFather](https://t.me/BotFather) (بوتان)

### الطريقة السريعة (سكريبت واحد)

```bash
# 1. استنساخ المشروع
git clone <repo-url>
cd ust-central-bot

# 2. نسخ ملف المتغيرات
cp .env.example .env

# 3. تحرير .env وإضافة قيمك
nano .env
# (أو استخدم أي محرر: code .env)

# 4. تشغيل سكريبت الإعداد (يفعل كل شيء تلقائياً)
node scripts/setup.js
```

### الطريقة اليدوية (خطوة بخطوة)

```bash
# 1. تثبيت الـ dependencies
npm install

# 2. تعيين Bot Tokens كأسرار في Cloudflare
echo "STUDENT_TOKEN_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_TOKEN_HERE"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml

# 3. نشر الـ Workers
npx wrangler deploy --config wrangler.student.toml
npx wrangler deploy --config wrangler.admin.toml

# 4. تسجيل الـ Webhooks مع Telegram
curl -X POST "https://api.telegram.org/bot<STUDENT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ust-student-bot.<subdomain>.workers.dev/webhook", "max_connections": 40, "allowed_updates": ["message", "callback_query", "edited_message"], "drop_pending_updates": true}'

curl -X POST "https://api.telegram.org/bot<ADMIN_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ust-admin-bot.<subdomain>.workers.dev/webhook", "max_connections": 40, "allowed_updates": ["message", "callback_query", "edited_message"], "drop_pending_updates": true}'
```

---

## ⚙️ متغيرات البيئة (.env)

| المتغير | الوصف | مطلوب؟ |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token بصلاحيات Workers | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | معرّف الحساب | ✅ |
| `WORKERS_SUBDOMAIN` | Subdomain من workers.dev | ✅ |
| `STUDENT_BOT_TOKEN` | Token بوت الطالب | ✅ |
| `ADMIN_BOT_TOKEN` | Token بوت الإدارة | ✅ |
| `STUDENT_BOT_USERNAME` | username بوت الطالب (بدون @) | ✅ |
| `ADMIN_BOT_USERNAME` | username بوت الإدارة (بدون @) | ✅ |
| `PDF_SERVER_URL` | URL لـ PDF Server (اختياري) | ❌ |
| `ENVIRONMENT` | mockup / development / production | ❌ |

---

## 🛠 أوامر التشغيل

```bash
# الإعداد الكامل (مرة واحدة)
npm run setup

# النشر
npm run deploy:student         # نشر بوت الطالب فقط
npm run deploy:admin           # نشر بوت الإدارة فقط
npm run deploy:all             # نشر البوتين

# إدارة الـ Webhooks
npm run webhook:status         # فحص حالة الـ webhooks
npm run webhook:clear          # تنظيف التحديثات المعلّقة
npm run webhook:reset          # إعادة تسجيل الـ webhooks

# التطوير المحلي
npm run dev:student            # تشغيل بوت الطالب محلياً
npm run dev:admin              # تشغيل بوت الإدارة محلياً

# الفحص
npm run typecheck              # فحص TypeScript
```

---

## 🧪 سيناريوهات التجربة

### 🎓 بوت الطالب — التدفق الرئيسي

```
/start
↓ 🏛 الكليات
↓ 💻 الحاسبات وتكنولوجيا المعلومات
↓ تقنية معلومات (IT)
↓ المستوى 1
↓ الفصل الأول
↓ برمجة حاسوب (1) - Python
↓ 📘 المقرر (نظري) — 2
↓ اختر ملفاً ⭐
↓ 📄 معاينة الملف (اسم، حجم، تاريخ، رافع، عدّاد)
↓ ⬇️ تحميل الملف
✅ يصلك ملف PDF فعلي!
```

### 🛡 بوت الإدارة — مراجعة مساهمة

```
/start
↓ أرسل: DEMO001
↓ 📥 المساهمات المعلقة (5)
↓ اختر مساهمة
↓ ❌ رفض
↓ اختر سبب (مكرر/غير واضح/...)
↓ ✅ تأكيد
✅ المساهمة محذوفة من القائمة تلقائياً
```

---

## 📊 إحصائيات المشروع

| البند | القيمة |
|---|---|
| الإصدار | v2.1 |
| عدد الكليات | 7 |
| عدد التخصصات | 34 |
| مواد IT في الـ Mockup | 20 |
| شاشات بوت الطالب | 12 + معاينة ملف |
| شاشات بوت الإدارة | 15 |
| إجمالي سطور الكود | ~3,500 |
| حجم بوت الطالب (gzipped) | ~50 KB |
| حجم بوت الإدارة (gzipped) | ~52 KB |
| التكلفة الشهرية | $0 |

---

## 🔐 الأمان

- ✅ Bot Tokens مُخزّنة كـ **Cloudflare Secrets** (مشفّرة)
- ✅ لا توجد بيانات حساسة في الكود
- ✅ معالجة أخطاء شاملة (لا أخطاء 500 للـ Telegram)
- ✅ تجاهل أخطاء "query is too old" و "message not modified"
- ⚠️ الـ Mockup يخزّن الحالة في الذاكرة (تُفقد عند إعادة النشر) — في الإنتاج ستُستخدم KV

---

## 🐛 استكشاف الأخطاء

### البوت لا يستجيب

```bash
# 1. فحص حالة الـ Webhook
npm run webhook:status

# 2. إن وجدت أخطاء، نظّف التحديثات المعلّقة
npm run webhook:clear

# 3. أعد تسجيل الـ Webhook
npm run webhook:reset

# 4. أرسل /start من جديد في البوت
```

### فحص سجلات Cloudflare

```bash
# تتبع سجلات بوت الطالب
npx wrangler tail --config wrangler.student.toml

# تتبع سجلات بوت الإدارة
npx wrangler tail --config wrangler.admin.toml
```

### فحص صحة الـ Workers

```bash
curl https://ust-student-bot.<subdomain>.workers.dev/health
curl https://ust-admin-bot.<subdomain>.workers.dev/health
```

---

## 🌍 معلومات النشر الحالي

- **Cloudflare Account ID:** `821ba2812d9ca15396ea53dcb8ecd8d5`
- **Workers.dev Subdomain:** `atow73768`
- **بيئة التشغيل:** Cloudflare Workers (مجاني 100%)
- **عدد الطلبات اليومية المتاحة:** 100,000 (مجاني)
- **Workers منشورة:**
  - `ust-student-bot` — بوت الطالب
  - `ust-admin-bot` — بوت الإدارة
  - `ust-pdf-server` — خدمة ملف PDF التجريبي

---

## 🎯 خريطة الطريق للمراحل القادمة

### المرحلة 2: قاعدة البيانات (Supabase) — التالية
- [ ] إنشاء حساب Supabase مجاني
- [ ] تطبيق schema الـ 14 جدول
- [ ] ربط البوتين بقاعدة البيانات
- [ ] نقل البيانات الوهمية إلى البيانات الحقيقية

### المرحلة 3: الميزات المتقدمة
- [ ] Rate Limiting (KV + Durable Objects)
- [ ] Audit Log شامل
- [ ] توقيع callback_data بـ HMAC
- [ ] فحص الملفات (Magic Bytes)

### المرحلة 4: قنوات التخزين
- [ ] إنشاء 7 قنوات تلغرام (واحدة لكل كلية)
- [ ] رفع الملفات للقنوات
- [ ] استخدام file_id من القنوات

### المرحلة 5: النشر للإنتاج
- [ ] إنشاء بوتين رسميين عبر @BotFather (بحساب رسمي)
- [ ] نشر الـ Workers على الـ Tokens الرسمية
- [ ] ربط نطاق خاص (اختياري)
- [ ] CI/CD عبر GitHub Actions

---

## 📞 الدعم

- **المشرف:** UST Central Bot Team
- **البريد:** support@ust.edu.ye
- **تيليجرام:** @ust_support

---

## 📜 الترخيص

© 2026 University of Science and Technology - Yemen. All rights reserved.
