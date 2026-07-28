// ============================================
// 🔐 Callback Data Signing (HMAC-SHA256)
// ============================================
// هذه الوحدة توقّع callback_data لمنع التزوير:
//
// المشكلة:
//   - Telegram callback_data نص عادي يمكن للمستخدم تعديله عبر أدوات
//   - مثلاً: مستخدم عادي يعدّل "delete_content_5" ليصبح "delete_content_1"
//     فيحذف محتوى لا يملك صلاحية حذفه
//
// الحل:
//   - نوقّع كل callback_data بـ HMAC-SHA256 باستخدام secret
//   - الـ signature يُضاف كـ suffix: "delete_content_5.a1b2c3d4"
//   - عند الاستقبال، نتحقق من الـ signature قبل المعالجة
//   - لو فشل التحقق، نتجاهل الـ callback
//
// الأمان:
//   - الـ secret يُخزّن كـ Cloudflare Secret (CALLBACK_SECRET)
//   - طول الـ signature: 16 حرف hex (64-bit) — كافٍ لمنع brute force
//   - كل تعديل على callback_data يُنتج signature مختلف
//
// الأداء:
//   - HMAC-SHA256 سريع جداً في Cloudflare Workers (~0.1ms)
//   - الـ signature قصير (16 حرف) لا يستهلك مساحة كبيرة من callback_data
//   - حد Telegram لـ callback_data هو 64 بايت — كافٍ لمعظم الحالات
// ============================================

// ============================================
// الأنواع
// ============================================
export interface SignedCallback {
  data: string;       // البيانات الأصلية بدون signature
  signature: string;  // الـ signature (16 حرف hex)
  raw: string;        // النص الكامل (data.signature)
}

// ============================================
// الـ secret (يُعرف عبر initCallbackSigning)
// ============================================
let callbackSecret: string = "";

/**
 * تهيئة نظام توقيع callbacks — يجب استدعاؤها مرة واحدة عند إقلاع البوت.
 * @param secret الـ secret من Cloudflare Secret CALLBACK_SECRET
 */
export function initCallbackSigning(secret: string): void {
  if (!secret || secret.length < 16) {
    console.warn("⚠️ CALLBACK_SECRET is too short (min 16 chars recommended)");
  }
  callbackSecret = secret;
}

// ============================================
// التحقق أن النظام مُهيّأ
// ============================================
function ensureInitialized(): void {
  if (!callbackSecret) {
    throw new Error("Callback signing not initialized. Call initCallbackSigning(secret) first.");
  }
}

// ============================================
// حساب HMAC-SHA256 باستخدام Web Crypto API
// ============================================
// Cloudflare Workers يدعم crypto.subtle بشكل كامل
// ============================================
async function computeHmac(data: string): Promise<string> {
  ensureInitialized();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(callbackSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  // تحويل ArrayBuffer إلى hex، ثم أخذ أول 16 حرف (64-bit)
  const hexBytes = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hexBytes.substring(0, 16);
}

// ============================================
// توقيع callback_data
// ============================================
/**
 * يوقّع callback_data بـ HMAC-SHA256.
 * @param data البيانات الأصلية (مثل "delete_content_5")
 * @returns النص الموقّع (مثل "delete_content_5.a1b2c3d4e5f6g7h8")
 *
 * مثال:
 *   const signed = await signCallback("delete_content_5");
 *   // signed = "delete_content_5.a1b2c3d4e5f6g7h8"
 *   kb.text("🗑 حذف", signed);
 */
export async function signCallback(data: string): Promise<string> {
  const signature = await computeHmac(data);
  return `${data}.${signature}`;
}

// ============================================
// توقيع عدة callbacks دفعة واحدة
// ============================================
/**
 * يوقّع عدة callback_data دفعة واحدة (أكفأ لـ bulk operations).
 * @param items قائمة البيانات
 * @returns قائمة النصوص الموقّعة بنفس الترتيب
 */
export async function signCallbacks(items: string[]): Promise<string[]> {
  return Promise.all(items.map(signCallback));
}

// ============================================
// التحقق من signature
// ============================================
/**
 * يتحقق من صحة signature في callback_data.
 * @param raw النص الموقّع (مثل "delete_content_5.a1b2c3d4e5f6g7h8")
 * @returns الـ data الأصلية لو صحيحة، أو null لو فاسدة
 *
 * مثال:
 *   const data = await verifyCallback(ctx.callbackQuery.data);
 *   if (!data) {
 *     return ctx.answerCallbackQuery({ text: "⚠️ توقيع غير صالح" });
 *   }
 *   // عالج data بأمان
 */
export async function verifyCallback(raw: string): Promise<string | null> {
  // فصل الـ data عن الـ signature
  const lastDotIndex = raw.lastIndexOf(".");
  if (lastDotIndex === -1) {
    // لا يوجد signature — لو الـ signing مُفعّل، ارفض
    // (لو أردنا السماح بـ unsigned callbacks مؤقتاً للـ migration، يمكن تخفيف هذا)
    return null;
  }

  const data = raw.substring(0, lastDotIndex);
  const providedSignature = raw.substring(lastDotIndex + 1);

  // حساب الـ signature المتوقّعة
  const expectedSignature = await computeHmac(data);

  // مقارنة ثابتة الزمن لمنع timing attacks
  if (constantTimeEquals(providedSignature, expectedSignature)) {
    return data;
  }

  return null;
}

// ============================================
// مقارنة ثابتة الزمن (لمنع timing attacks)
// ============================================
// المقايمة العادية (===) يمكن أن تتسرّب معلومات عبر time difference
// نقارن بايت-بالبايت مع استمرار الحلقة حتى النهاية
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// فحص سريع: هل النص موقّع؟
// ============================================
/**
 * فحص سريع بدون تحقق — يُستخدم للـ routing فقط.
 * @param raw النص المراد فحصه
 * @returns true لو يحتوي على signature (وليس بالضرورة صالحاً)
 */
export function isSigned(raw: string): boolean {
  const lastDotIndex = raw.lastIndexOf(".");
  if (lastDotIndex === -1) return false;
  // signature يجب أن يكون 16 حرف hex بعد النقطة
  const signature = raw.substring(lastDotIndex + 1);
  return signature.length === 16 && /^[0-9a-f]+$/.test(signature);
}

// ============================================
// استخراج الـ data الأصلية بدون تحقق
// ============================================
/**
 * يستخرج الـ data بدون التحقق من الـ signature.
 * ⚠️ خطير — استخدم فقط للـ logging أو بعد verifyCallback
 */
export function extractData(raw: string): string {
  const lastDotIndex = raw.lastIndexOf(".");
  if (lastDotIndex === -1) return raw;
  return raw.substring(0, lastDotIndex);
}

// ============================================
// توليد secret عشوائي (للإعداد الأولي)
// ============================================
/**
 * يولّد secret عشوائي مناسب لـ HMAC signing.
 * استخدمه مرة واحدة عند إعداد المشروع، ثم خزّنه كـ Cloudflare Secret.
 *
 * @returns secret بصيغة hex (64 حرف = 256-bit)
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
