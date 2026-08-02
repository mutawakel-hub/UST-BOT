// ============================================
// 📝 Text Resolver — طبقة وسيطة للنصوص المخصصة
// ============================================
// يقرأ النص المخصص من DB (جدول custom_texts) أولاً
// لو لم يجده، يستخدم fallback من TEXTS/ADMIN_TEXTS
//
// الاستخدام:
//   const text = await resolveText("main_menu", "btn_colleges", "🏛 الكليات");
//   // → يقرأ من custom_texts لو موجود، أو يرجع "🏛 الكليات"
//
// التخزين المؤقت:
//   - في الذاكرة (Map) لكل isolate
//   - يُبطّل عبر invalidateTextCache() بعد كل تعديل
// ============================================

import { SupabaseClient } from "./db";

// مرجع لـ SupabaseClient
let supabaseRef: SupabaseClient | null = null;

// in-memory cache للنصوص المخصصة
// key = `${screenKey}:${textKey}` → value
let textCache: Map<string, string> = new Map();
let textCacheLoaded = false;

export function initTextResolver(supabase: SupabaseClient): void {
  supabaseRef = supabase;
}

export function invalidateTextCache(): void {
  textCacheLoaded = false;
  textCache.clear();
}

export async function ensureTextCacheLoaded(): Promise<void> {
  await ensureTextCacheLoadedInternal();
}

async function ensureTextCacheLoadedInternal(): Promise<void> {
  if (textCacheLoaded) return;
  if (!supabaseRef) return;

  try {
    const result = await supabaseRef.select("custom_texts", {
      columns: "screen_key,text_key,custom_value,scope_type,scope_college_id",
      filter: "custom_value=not.is.null",
      limit: 500,
    });

    if (Array.isArray(result)) {
      textCache = new Map();
      for (const row of result) {
        // نستخدم فقط التخصيصات العامة (scope_type='global')
        // تخصيصات الكليات تُعالج لاحقاً
        if (row.scope_type === "global") {
          textCache.set(`${row.screen_key}:${row.text_key}`, row.custom_value);
        }
      }
      textCacheLoaded = true;
      console.log(`✅ [text-resolver] Cache loaded: ${textCache.size} custom texts`);
    }
  } catch (e) {
    console.warn("⚠️ [text-resolver] Failed to load cache:", e);
  }
}

// ============================================
// قراءة نص مخصص (الاستخدام الأساسي)
// ============================================
// screenKey: القسم في TEXTS (مثل "main_menu", "registration")
// textKey: المفتاح داخل القسم (مثل "btn_colleges", "welcome")
// fallback: القيمة الافتراضية من TEXTS
// ============================================
export async function resolveText(
  screenKey: string,
  textKey: string,
  fallback: string
): Promise<string> {
  await ensureTextCacheLoaded();
  const cached = textCache.get(`${screenKey}:${textKey}`);
  return cached || fallback;
}

// ============================================
// قراءة نص مخصص متزامن (من cache المحمّل)
// ============================================
// ملاحظة: يجب استدعاء ensureTextCacheLoaded() أولاً (يتم تلقائياً في webhook)
export function resolveTextSync(
  screenKey: string,
  textKey: string,
  fallback: string
): string {
  return textCache.get(`${screenKey}:${textKey}`) || fallback;
}

// ============================================
// حفظ نص مخصص في DB
// ============================================
export async function saveCustomText(
  supabase: SupabaseClient,
  data: {
    screen_key: string;
    text_key: string;
    default_value: string;
    custom_value: string;
    updated_by_position_id?: string;
  }
): Promise<boolean> {
  try {
    // محاولة 1: UPDATE لو الصف موجود
    const filter = `screen_key=eq.${data.screen_key}&text_key=eq.${data.text_key}&scope_type=eq.global`;
    const existing = await supabase.select("custom_texts", {
      columns: "id",
      filter,
      limit: 1,
    });

    if (Array.isArray(existing) && existing.length > 0) {
      // صف موجود → UPDATE
      await supabase.update("custom_texts", {
        custom_value: data.custom_value,
        default_value: data.default_value,
        updated_by_position_id: data.updated_by_position_id || null,
        updated_at: new Date().toISOString(),
      }, filter);
    } else {
      // صف غير موجود → INSERT
      await supabase.insert("custom_texts", {
        screen_key: data.screen_key,
        text_key: data.text_key,
        default_value: data.default_value,
        custom_value: data.custom_value,
        scope_type: "global",
        scope_college_id: null,
        updated_by_position_id: data.updated_by_position_id || null,
      });
    }

    // إبطال cache
    invalidateTextCache();
    return true;
  } catch (e) {
    console.error("saveCustomText error:", e);
    return false;
  }
}

// ============================================
// استعادة النص الافتراضي (حذف التخصيص)
// ============================================
export async function resetCustomText(
  supabase: SupabaseClient,
  screenKey: string,
  textKey: string
): Promise<boolean> {
  try {
    // اضبط custom_value = NULL (يُرجع النص الافتراضي)
    await supabase.update("custom_texts", {
      custom_value: null,
      updated_at: new Date().toISOString(),
    }, `screen_key=eq.${screenKey}&text_key=eq.${textKey}&scope_type=eq.global`);

    invalidateTextCache();
    return true;
  } catch (e) {
    console.error("resetCustomText error:", e);
    return false;
  }
}

// ============================================
// قراءة كل النصوص المخصصة لشاشة معينة
// ============================================
export async function getCustomTextsForScreen(
  supabase: SupabaseClient,
  screenKey: string
): Promise<any[]> {
  try {
    const result = await supabase.select("custom_texts", {
      columns: "screen_key,text_key,default_value,custom_value,updated_at",
      filter: `screen_key=eq.${screenKey}&scope_type=eq.global`,
      order: "text_key.asc",
    });
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("getCustomTextsForScreen error:", e);
    return [];
  }
}
