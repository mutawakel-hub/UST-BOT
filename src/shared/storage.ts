// ============================================
// 📦 Storage Service - إدارة الملفات في قنوات التخزين
// ============================================
// هذه الوحدة مسؤولة عن:
//   1. رفع الملفات إلى قنوات تخزين الكليات (Telegram channels)
//   2. استخراج message_id + file_id من الاستجابة
//   3. إرسال الملفات للطلاب (forwardMessage أو sendDocument)
//   4. البحث عن قناة التخزين المناسبة لكل كلية
//
// البنية:
//   - كل كلية لها storage_channel_id (مخزّن في DB + colleges.ts)
//   - الملفات تُرفع كـ documents في قناة الكلية
//   - يُخزّن message_id + file_id في جدول content للوصول السريع
//   - للتحميل: نستخدم forwardMessage (أسرع) أو sendDocument(file_id) (fallback)
//
// الأمان:
//   - البوت يجب أن يكون admin في كل قناة تخزين
//   - file_id قد تنتهي صلاحيته بعد وقت — نعتمد على message_id أولاً
// ============================================

import { Bot } from "grammy";

// ============================================
// الأنواع
// ============================================
export interface UploadedFile {
  message_id: number;
  file_id: string;
  file_unique_id?: string;
  file_size: number;
  file_name?: string;
  mime_type?: string;
}

export interface UploadOptions {
  fileName?: string;
  caption?: string;
  // captionEntities (لـ Markdown/HTML parsing)
  parseMode?: "Markdown" | "HTML";
}

export interface FileMetadata {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

// ============================================
// رفع ملف إلى قناة تخزين كلية
// ============================================
// يُستخدم عند:
//   - اعتماد مساهمة من طالب (نرفع الملف للقناة)
//   - رفع محتوى مباشر من المسؤول
//
// يُرجع:
//   - message_id (لـ forwardMessage لاحقاً)
//   - file_id (لـ sendDocument لاحقاً)
//   - file_size (للإحصائيات)
// ============================================
export async function uploadFileToStorageChannel(
  bot: Bot,
  storageChannelId: string,
  file: FileMetadata,
  options?: UploadOptions
): Promise<UploadedFile> {
  // محاولة 1: sendDocument (الأكثر مرونة — يدعم caption و parse_mode)
  const sendOptions: any = {};
  if (options?.caption) {
    sendOptions.caption = options.caption;
    if (options.parseMode) {
      sendOptions.parse_mode = options.parseMode;
    }
  }

  const msg = await bot.api.sendDocument(storageChannelId, file.fileId, sendOptions);

  // استخراج البيانات من الاستجابة
  const document = (msg as any).document;
  if (!document) {
    throw new Error("Failed to upload file: response does not contain document");
  }

  return {
    message_id: msg.message_id,
    file_id: document.file_id,
    file_unique_id: document.file_unique_id,
    file_size: document.file_size || 0,
    file_name: document.file_name || file.fileName,
    mime_type: document.mime_type,
  };
}

// ============================================
// نسخ ملف لمستخدم عبر copyMessage (بدون "Forwarded from")
// ============================================
// copyMessage ينسخ الرسالة من قناة التخزين للمستخدم
// المزايا:
//   - لا يُظهر "Forwarded from" (عكس forwardMessage)
//   - يسمح بتعيين caption جديد (نظيف بدون معلومات القناة)
//   - سريع (لا يستهلك bandwidth)
//
// العيوب:
//   - يحتاج message_id صالح
//   - لو حُذفت الرسالة من القناة، يفشل
// ============================================
export async function copyFileToUser(
  bot: Bot,
  chatId: number,
  fromChatId: string,
  messageId: number,
  caption?: string,
  parseMode?: "Markdown" | "HTML"
): Promise<void> {
  const options: any = {};
  if (caption) {
    options.caption = caption;
    if (parseMode) {
      options.parse_mode = parseMode;
    }
  }
  await bot.api.copyMessage(chatId, fromChatId, messageId, options);
}

// ============================================
// إرسال ملف لمستخدم عبر forwardMessage (الأقل تفضيلاً)
// ============================================
// forwardMessage ينسخ الرسالة من قناة التخزين للمستخدم
// ⚠️ يُظهر "Forwarded from" + يحافظ على caption الأصلي (غير مرغوب)
// يُستخدم فقط كـ fallback أخير
// ============================================
export async function forwardFileToUser(
  bot: Bot,
  chatId: number,
  fromChatId: string,
  messageId: number
): Promise<void> {
  await bot.api.forwardMessage(chatId, fromChatId, messageId);
}

// ============================================
// إرسال ملف لمستخدم عبر sendDocument (fallback)
// ============================================
// يستخدم file_id المخزّن في DB
// المزايا:
//   - لا يحتاج message_id
//   - يعمل حتى لو حُذفت الرسالة الأصلية
//
// العيوب:
//   - يستهلك bandwidth
//   - file_id قد تنتهي صلاحيته بعد فترة طويلة
// ============================================
export async function sendFileToUser(
  bot: Bot,
  chatId: number,
  fileId: string,
  caption?: string,
  parseMode?: "Markdown" | "HTML"
): Promise<void> {
  const options: any = {};
  if (caption) {
    options.caption = caption;
    if (parseMode) {
      options.parse_mode = parseMode;
    }
  }
  await bot.api.sendDocument(chatId, fileId, options);
}

// ============================================
// إرسال ملف للمستخدم مع fallback تلقائي
// ============================================
// نمط الاستخدام:
//   1. sendDocument بـ file_id (يرسل كملف جديد بدون إشارة للقناة)
//   2. copyMessage (ينسخ بدون "Forwarded from" + caption نظيف)
//   3. forwardMessage (fallback أخير — قد يظهر "Forwarded from")
//   4. لو فشل الكل، أبلغ المستخدم بوجود خطأ
//
// ملاحظة: نتجنب forwardMessage لأنه ينسخ caption القناة الأصلي
// (الذي يحوي المُحسِن + التاريخ + الحجم) ويظهر "Forwarded from" للطالب
// ============================================
export async function deliverFileToUser(
  bot: Bot,
  chatId: number,
  file: {
    storageChannelId?: string | null;
    messageId?: number | null;
    fileId?: string | null;
    fileName?: string;
  },
  options?: {
    caption?: string;
    parseMode?: "Markdown" | "HTML";
    errorMessage?: string;
  }
): Promise<{ delivered: boolean; method: "copy" | "sendDocument" | "forward" | "failed"; error?: string }> {
  // محاولة 1: sendDocument بـ file_id (يرسل كملف جديد بدون إشارة للقناة)
  if (file.fileId) {
    try {
      await sendFileToUser(bot, chatId, file.fileId, options?.caption, options?.parseMode);
      return { delivered: true, method: "sendDocument" };
    } catch (e) {
      console.error("sendDocument failed, trying copyMessage:", e);
      // استمر للمحاولة الثانية
    }
  }

  // محاولة 2: copyMessage (ينسخ بدون "Forwarded from" + caption نظيف)
  if (file.storageChannelId && file.messageId) {
    try {
      await copyFileToUser(
        bot, chatId, file.storageChannelId, file.messageId,
        options?.caption, options?.parseMode
      );
      return { delivered: true, method: "copy" };
    } catch (e) {
      console.error("copyMessage failed, trying forwardMessage:", e);
      // استمر للمحاولة الثالثة
    }
  }

  // محاولة 3: forwardMessage (fallback أخير — قد يظهر "Forwarded from")
  if (file.storageChannelId && file.messageId) {
    try {
      await forwardFileToUser(bot, chatId, file.storageChannelId, file.messageId);
      return { delivered: true, method: "forward" };
    } catch (e) {
      console.error("forwardMessage also failed:", e);
      // استمر للفشل
    }
  }

  // فشل كل المحاولات
  return {
    delivered: false,
    method: "failed",
    error: options?.errorMessage || "تعذّر إرسال الملف. حاول لاحقاً.",
  };
}

// ============================================
// حذف رسالة من قناة التخزين (لإزالة محتوى مخالف)
// ============================================
export async function deleteFileFromStorage(
  bot: Bot,
  storageChannelId: string,
  messageId: number
): Promise<void> {
  try {
    await bot.api.deleteMessage(storageChannelId, messageId);
  } catch (e) {
    // تجاهل — قد تكون الرسالة محذوفة مسبقاً
    console.error("deleteFileFromStorage (ignored):", e);
  }
}

// ============================================
// حساب حجم ملف بصيغة مقروءة
// ============================================
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ============================================
// تحويل MB إلى bytes (للتخزين في DB)
// ============================================
export function mbToBytes(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}

// ============================================
// تحويل bytes إلى MB (للعرض)
// ============================================
export function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

// ============================================
// قواعد فحص الملفات حسب نوع المحتوى
// ============================================
// الأنواع الـ 7 كما هي:
//   book_theory, book_practical, summary, exam, video, audio, reference, schedule
//
// القواعد:
//   - video:  يقبل فقط mp4, mov, mkv, webm (المرئيات)
//   - audio:  يقبل فقط mp3, m4a, ogg, wav (الصوتيات)
//   - باقي الأنواع (نظري/عملي/ملخص/اختبار/مرجع/جدول): تقبل كل الامتدادات
//   - book_practical يقبل أيضاً الفيديو (شرح عملي - فلاتر، تجارب، tutorial)
//
// حدود الحجم:
//   - نعتمد على حد تلغرام نفسه (2 GB للملفات)
//   - البوت يستخدم file_id فقط، لا يمر عبر Cloudflare Workers
//   - لذا لا حاجة لـ Local Bot API Server
// ============================================

export interface ContentTypeRule {
  allowedExtensions: string[]; // [] = يقبل كل شيء
  allowVideo: boolean;         // هل يقبل فيديو (mp4/mov/mkv/webm)?
  allowAudio: boolean;         // هل يقبل صوت (mp3/m4a/ogg/wav)?
  label: string;
  emoji: string;
}

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
  book_theory:    { allowedExtensions: [], allowVideo: false, allowAudio: false, label: "كتاب نظري",  emoji: "📘" },
  book_practical: { allowedExtensions: [], allowVideo: true,  allowAudio: false, label: "كتاب عملي",  emoji: "📗" },
  summary:        { allowedExtensions: [], allowVideo: false, allowAudio: false, label: "ملخص",        emoji: "📄" },
  exam:           { allowedExtensions: [], allowVideo: false, allowAudio: false, label: "اختبار",      emoji: "📝" },
  reference:      { allowedExtensions: [], allowVideo: false, allowAudio: false, label: "مرجع",        emoji: "📖" },
  schedule:       { allowedExtensions: [], allowVideo: false, allowAudio: false, label: "جدول",        emoji: "📅" },
  video:          {
    allowedExtensions: ["mp4", "mov", "mkv", "webm"],
    allowVideo: true,
    allowAudio: false,
    label: "مرئيات",
    emoji: "🎥",
  },
  audio:          {
    allowedExtensions: ["mp3", "m4a", "ogg", "wav"],
    allowVideo: false,
    allowAudio: true,
    label: "صوتيات",
    emoji: "🎧",
  },
};

// الامتدادات المعروفة للفيديو والصوت (للتحقق من النوع عند allowVideo/allowAudio)
export const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "webm", "avi", "flv"];
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "ogg", "wav", "aac", "flac"];

// استخراج الامتداد من اسم الملف
export function getFileExtension(fileName?: string): string | null {
  if (!fileName) return null;
  const parts = fileName.split(".");
  if (parts.length < 2) return null;
  return parts.pop()!.toLowerCase();
}

// ============================================
// فحص الملف المرفوع
// ============================================
// يتحقق من:
//   1. امتداد الملف مسموح به لنوع المحتوى المختار
//   2. نوع الملف (فيديو/صوت/وثيقة) متوافق مع القواعد
//
// يعيد:
//   { valid: true } لو الملف مقبول
//   { valid: false, reason: "..." } لو مرفوض مع سبب
//
// ملاحظة: لا يفحص الحجم لأن تلغرام نفسه يحد بحجمه (2 GB)
// ============================================
export function validateUploadedFile(
  contentType: string,
  file: { file_name?: string; mime_type?: string }
): { valid: boolean; reason?: string; receivedExt?: string | null } {
  const rule = CONTENT_TYPE_RULES[contentType];
  if (!rule) {
    // نوع غير معروف — اسمح بكل شيء (آمن افتراضياً)
    return { valid: true };
  }

  const ext = getFileExtension(file.file_name);

  // لو لا توجد قيود (allowedExtensions = [] و allowVideo=false و allowAudio=false)
  // → يقبل كل شيء
  if (
    rule.allowedExtensions.length === 0 &&
    !rule.allowVideo &&
    !rule.allowAudio
  ) {
    return { valid: true, receivedExt: ext };
  }

  // لو لا يوجد امتداد للملف
  if (!ext) {
    return {
      valid: false,
      reason: `⚠️ *نوع الملف غير محدد*\n\nالملف المُرسل لا يحتوي على امتداد واضح.\n\n💡 تأكد من أن اسم الملف ينتهي بامتداد صحيح (مثل .pdf, .mp4, .mp3).`,
      receivedExt: null,
    };
  }

  // التحقق من القائمة المسموح بها صراحةً
  if (rule.allowedExtensions.length > 0) {
    if (rule.allowedExtensions.includes(ext)) {
      return { valid: true, receivedExt: ext };
    }
    // لو غير مسموح، تحقق من allowVideo / allowAudio كحالة خاصة
    const isVideo = VIDEO_EXTENSIONS.includes(ext);
    const isAudio = AUDIO_EXTENSIONS.includes(ext);

    if (rule.allowVideo && isVideo) {
      return { valid: true, receivedExt: ext };
    }
    if (rule.allowAudio && isAudio) {
      return { valid: true, receivedExt: ext };
    }

    // مرفوض — اعرض رسالة توجيه واضحة
    const expectedList = rule.allowedExtensions.join(" / ").toUpperCase();
    return {
      valid: false,
      reason:
        `❌ *نوع الملف غير مقبول*\n\n` +
        `📎 *الملف المُرسل:* \`${file.file_name}\`\n` +
        `📦 *الامتداد:* .${ext}\n\n` +
        `📂 *المطلوب لقسم "${rule.label}":*\n` +
        `✅ ${expectedList}\n\n` +
        `💡 *كيف تتدارك:*\n` +
        `1. ارجع لاختيار نوع المحتوى الصحيح\n` +
        `2. أرسل ملفاً بالامتداد المطلوب`,
      receivedExt: ext,
    };
  }

  // لو allowedExtensions = [] لكن allowVideo/allowAudio = true (مثل book_practical)
  if (rule.allowVideo || rule.allowAudio) {
    // كل شيء مقبول بما فيه الفيديو والصوت
    return { valid: true, receivedExt: ext };
  }

  return { valid: true, receivedExt: ext };
}

// ============================================
// فحص نوع الملف (Magic Bytes) - قديمة، محفوظة للتوافق
// ============================================
// ملاحظة: لم تعد مستخدمة — استخدم validateUploadedFile() بدلاً منها
// ============================================
export async function verifyFileType(
  bot: Bot,
  fileId: string,
  expectedMimeType: string = "application/pdf"
): Promise<boolean> {
  try {
    const file = await bot.api.getFile(fileId);
    if (file.file_path) {
      const ext = file.file_path.split(".").pop()?.toLowerCase();
      if (expectedMimeType === "application/pdf" && ext !== "pdf") {
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("verifyFileType error:", e);
    return false;
  }
}
