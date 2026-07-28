// ============================================
// 📦 Session & Cache Stores (Cloudflare KV)
// ============================================
// هذه الوحدة تُوفّر طبقة تجريد فوق KVNamespace لـ:
//   1. SessionStore<T> — حالة المستخدم لكل isolate
//      تحل مشكلة: const userStates = new Map<...>() بين isolates
//   2. CacheStore<T> — cache للبيانات شبه الثابتة (colleges, subjects, perms)
//
// الفوائد:
//   - KV يُشارك بين كل isolates في نفس الـ datacenter
//   - TTL تلقائي (لا حاجة لتنظيف يدوي)
//   - eventual consistency (مناسب للجلسات، ليس للبيانات الحرجة)
//
// ملاحظات:
//   - KV ليس transactional — لا تستخدمه لبيانات مالية أو حرجة
//   - حد الكتابة: 1 write/second per key (KV يُخفّف هذا تلقائياً)
//   - حد الحجم: 25 MiB per value
//   - TTL بالثواني
// ============================================

// ============================================
// SessionStore — حالة مستخدم واحدة لكل ID
// ============================================
export class SessionStore<T> {
  constructor(
    private kv: KVNamespace,
    private prefix: string,
    private ttl: number = 3600 // ساعة افتراضياً
  ) {}

  /**
   * قراءة حالة مستخدم
   * @returns الحالة أو null لو لا توجد
   */
  async get(id: number | string): Promise<T | null> {
    try {
      const raw = await this.kv.get(this.key(id), "json");
      return (raw as T) || null;
    } catch (e) {
      console.error(`SessionStore.get(${id}) error:`, e);
      return null;
    }
  }

  /**
   * كتابة حالة مستخدم (upsert)
   */
  async set(id: number | string, state: T, customTtl?: number): Promise<void> {
    try {
      await this.kv.put(this.key(id), JSON.stringify(state), {
        expirationTtl: customTtl ?? this.ttl,
      });
    } catch (e) {
      console.error(`SessionStore.set(${id}) error:`, e);
      // تجاهل — لا يجب أن يفشل الـ handler بسبب KV
    }
  }

  /**
   * تحديث جزئي (merge) للحالة
   * @returns الحالة بعد التحديث، أو null لو لم تكن موجودة
   */
  async update(
    id: number | string,
    patch: Partial<T>,
    customTtl?: number
  ): Promise<T | null> {
    const current = await this.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    await this.set(id, updated, customTtl);
    return updated;
  }

  /**
   * حذف حالة مستخدم (للـ logout مثلاً)
   */
  async delete(id: number | string): Promise<void> {
    try {
      await this.kv.delete(this.key(id));
    } catch (e) {
      console.error(`SessionStore.delete(${id}) error:`, e);
    }
  }

  /**
   * فحص وجود حالة (دون قراءة القيمة — أسرع)
   */
  async has(id: number | string): Promise<boolean> {
    try {
      const value = await this.kv.get(this.key(id));
      return value !== null;
    } catch {
      return false;
    }
  }

  private key(id: number | string): string {
    return `${this.prefix}:${id}`;
  }
}

// ============================================
// CacheStore — cache عام للبيانات شبه الثابتة
// ============================================
// مناسب لـ:
//   - colleges / specialties / subjects (تتغير نادراً)
//   - user_permissions (تتغير عند تعديل المنصب فقط)
//   - leaderboard (كل بضع دقائق)
//
// نمط الاستخدام:
//   const cached = await cache.get('colleges');
//   if (cached) return cached;
//   const fresh = await fetchFromSupabase();
//   await cache.set('colleges', fresh);
//   return fresh;
// ============================================
export class CacheStore<T> {
  constructor(
    private kv: KVNamespace,
    private defaultTtl: number = 3600 // ساعة افتراضياً
  ) {}

  /**
   * قراءة من cache
   * @param key مفتاح الـ cache (بدون prefix)
   */
  async get(key: string): Promise<T | null> {
    try {
      const raw = await this.kv.get(this.key(key), "json");
      return (raw as T) || null;
    } catch (e) {
      console.error(`CacheStore.get(${key}) error:`, e);
      return null;
    }
  }

  /**
   * كتابة في cache
   * @param key مفتاح الـ cache
   * @param value القيمة
   * @param customTtl TTL مخصص (اختياري، يستخدم defaultTtl لو undefined)
   */
  async set(key: string, value: T, customTtl?: number): Promise<void> {
    try {
      await this.kv.put(this.key(key), JSON.stringify(value), {
        expirationTtl: customTtl ?? this.defaultTtl,
      });
    } catch (e) {
      console.error(`CacheStore.set(${key}) error:`, e);
    }
  }

  /**
   * حذف مفتاح محدد
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(this.key(key));
    } catch (e) {
      console.error(`CacheStore.delete(${key}) error:`, e);
    }
  }

  /**
   * حذف كل المفاتيح بمُعطى prefix
   * ملاحظة: KV لا يدعم list بسرعة، لذا هذا مكلف ويستخدم فقط للـ cache busting
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: this.key(prefix) });
      await Promise.all(
        list.keys.map((k) => this.kv.delete(k.name))
      );
    } catch (e) {
      console.error(`CacheStore.invalidatePrefix(${prefix}) error:`, e);
    }
  }

  private key(key: string): string {
    return `cache:${key}`;
  }
}

// ============================================
// RateLimiter — بسيط عبر KV (للـ anti-spam)
// ============================================
// نمط: fixed window counter
// مناسب لحدود مثل "10 رسائل/دقيقة لكل مستخدم"
// ============================================
export class RateLimiter {
  constructor(
    private kv: KVNamespace,
    private prefix: string = "ratelimit"
  ) {}

  /**
   * فحص وتسجيل محاولة
   * @param action اسم الإجراء (مثل "contribution_submit")
   * @param id معرّف المستخدم/الجلسة
   * @param limit الحد الأقصى
   * @param windowSeconds طول النافذة بالثواني
   * @returns { allowed: boolean, remaining: number, resetIn: number }
   */
  async check(
    action: string,
    id: number | string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = `${this.prefix}:${action}:${id}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      const raw = await this.kv.get(key, "json") as {
        count: number;
        window_start: number;
      } | null;

      // لا يوجد سجل أو انتهت النافذة → ابدأ من جديد
      if (!raw || raw.window_start + windowSeconds <= now) {
        await this.kv.put(key, JSON.stringify({ count: 1, window_start: now }), {
          expirationTtl: windowSeconds,
        });
        return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
      }

      // تجاوز الحد
      if (raw.count >= limit) {
        const resetIn = raw.window_start + windowSeconds - now;
        return { allowed: false, remaining: 0, resetIn: Math.max(0, resetIn) };
      }

      // ضمن الحد — زيادة العداد
      await this.kv.put(
        key,
        JSON.stringify({ count: raw.count + 1, window_start: raw.window_start }),
        { expirationTtl: windowSeconds }
      );
      return {
        allowed: true,
        remaining: limit - raw.count - 1,
        resetIn: raw.window_start + windowSeconds - now,
      };
    } catch (e) {
      console.error(`RateLimiter.check(${action}:${id}) error:`, e);
      // في حالة فشل KV، اسمح بالعملية (fail-open)
      return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
    }
  }

  /**
   * إعادة ضبط العداد لإجراء/مستخدم محدد
   */
  async reset(action: string, id: number | string): Promise<void> {
    try {
      await this.kv.delete(`${this.prefix}:${action}:${id}`);
    } catch (e) {
      console.error(`RateLimiter.reset(${action}:${id}) error:`, e);
    }
  }
}

// ============================================
// TTL مقترحة لكل نوع بيانات
// ============================================
export const TTL = {
  // جلسات قصيرة (حالة await لرفع ملف، حالة انتظار رسالة)
  SESSION_SHORT: 300, // 5 دقائق
  // جلسات افتراضية (حالة مستخدم كاملة)
  SESSION_DEFAULT: 3600, // ساعة
  // جلسات طويلة (تذكر الخيارات)
  SESSION_LONG: 86400, // يوم
  // cache للبيانات شبه ثابتة (colleges, specialties, content_types)
  CACHE_STATIC: 3600, // ساعة
  // cache للبيانات المتغيرة (leaderboard, content lists)
  CACHE_DYNAMIC: 300, // 5 دقائق
  // cache للصلاحيات (نادراً ما تتغير)
  CACHE_PERMISSIONS: 300, // 5 دقائق
} as const;
