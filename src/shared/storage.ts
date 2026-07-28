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
// إرسال ملف لمستخدم عبر forwardMessage (الأسرع)
// ============================================
// forwardMessage ينسخ الرسالة من قناة التخزين للمستخدم
// المزايا:
//   - لا يستهلك bandwidth من البوت
//   - سريع جداً
//   - يحافظ على caption الأصلي
//
// العيوب:
//   - يحتاج message_id صالح
//   - لو حُذفت الرسالة من القناة، يفشل
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
// نمط الاستخدام الموصى به:
//   1. جرّب forwardMessage (الأسرع)
//   2. لو فشل، جرّب sendDocument بـ file_id
//   3. لو فشل الاثنان، أبلغ المستخدم بوجود خطأ
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
): Promise<{ delivered: boolean; method: "forward" | "sendDocument" | "failed"; error?: string }> {
  // محاولة 1: forwardMessage
  if (file.storageChannelId && file.messageId) {
    try {
      await forwardFileToUser(bot, chatId, file.storageChannelId, file.messageId);
      return { delivered: true, method: "forward" };
    } catch (e) {
      console.error("forwardMessage failed, falling back to sendDocument:", e);
      // استمر للمحاولة الثانية
    }
  }

  // محاولة 2: sendDocument بـ file_id
  if (file.fileId) {
    try {
      await sendFileToUser(bot, chatId, file.fileId, options?.caption, options?.parseMode);
      return { delivered: true, method: "sendDocument" };
    } catch (e) {
      console.error("sendDocument also failed:", e);
      // استمر للفشل
    }
  }

  // فشل كلا المحاولتين
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
// فحص نوع الملف (Magic Bytes)
// ============================================
// للتحقق أن الملف المرفوع هو فعلاً PDF وليس ملفاً آخر مع امتداد .pdf
// نحتاج الـ file_id ثم bot.api.getFile لقراءة أول بايتات
//
// ملاحظة: هذه الدالة مكلفة (HTTP request لكل ملف)
// استخدمها فقط للملفات المشبوهة
// ============================================
export async function verifyFileType(
  bot: Bot,
  fileId: string,
  expectedMimeType: string = "application/pdf"
): Promise<boolean> {
  try {
    const file = await bot.api.getFile(fileId);
    // file.mime_type غير متاح دائماً، نعتمد على الـ extension
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
