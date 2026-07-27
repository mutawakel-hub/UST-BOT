# 🌐 معلومات النشر السحابي — UST Central Bot
# احتفظ بهذا الملف في مكان آمن (لا ترفعه على GitHub)

## ☁️ Cloudflare Account

```
Account ID:         821ba2812d9ca15396ea53dcb8ecd8d5
API Token:          cfut_rUSX7nGmRjGyoOX3SRybHg2YWkqB4RTMWTlarcsL3ffee7df
Workers Subdomain:  atow73768
```

## 🤖 Telegram Bots (Test)

```
Student Bot:
  Username:  @usttesterbot
  Token:     8122681112:AAHt4DV0Mg9pcdwaLhKW3AEvY7ZoKJ5OB60

Admin Bot:
  Username:  @usttesteradminbot
  Token:     8796334849:AAG-YSC4dS8e-TGQzAqr50JLdT5fmuVmjrA
```

## 🌐 Workers URLs

```
Student Bot Worker:  https://ust-student-bot.atow73768.workers.dev
Admin Bot Worker:    https://ust-admin-bot.atow73768.workers.dev
PDF Server Worker:   https://ust-pdf-server.atow73768.workers.dev
```

## 🔗 Webhook URLs

```
Student Webhook:  https://ust-student-bot.atow73768.workers.dev/webhook
Admin Webhook:    https://ust-admin-bot.atow73768.workers.dev/webhook
```

## 🧪 معرّفات الإدارة التجريبية

```
DEMO001  →  مسؤول مركزي (صلاحية كاملة)
DEMO002  →  مسؤول كلية الحاسبات
DEMO003  →  مسؤول تخصص IT
DEMO004  →  مسؤول مستوى (IT - المستوى 1)
```

## 📊 الحالة الحالية

```
Workers منشورة:        3 (student + admin + pdf-server)
Webhooks مسجّلة:       2 (student + admin)
التحديثات المعلّقة:    0
آخر خطأ:               لا يوجد ✅
النسخة الحالية:        v2.1
```

## 🚀 لإعادة النشر لاحقاً

```bash
# 1. فك ضغط المشروع
unzip ust-central-bot-v2.1.zip
cd ust-central-bot

# 2. تثبيت الـ dependencies
npm install

# 3. النشر (لن يحتاج لإعادة تعيين الأسرار)
CLOUDFLARE_API_TOKEN=cfut_rUSX7nGmRjGyoOX3SRybHg2YWkqB4RTMWTlarcsL3ffee7df \
CLOUDFLARE_ACCOUNT_ID=821ba2812d9ca15396ea53dcb8ecd8d5 \
npm run deploy:all

# 4. فحص الحالة
npm run webhook:status
```

## ⚠️ تنبيهات أمنية

- ✅ الـ Tokens أعلاه **تجريبية** للـ Mockup فقط
- ⚠️ عند الانتقال للإنتاج، أنشئ بوتين جديدين عبر @BotFather بحساب رسمي
- ⚠️ لفصل بيئة الإنتاج، أنشئ API Token جديد بصلاحيات محدودة
- 🔒 لا ترفع هذا الملف إلى GitHub أو أي مستودع عام

## 📅 تاريخ آخر تحديث

```
2026-07-26 23:56 UTC  —  v2.1 مع إصلاحات الأخطاء
```
