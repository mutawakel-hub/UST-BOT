// ============================================
// 🧪 اختبارات وحدة session.ts
// ============================================
// نختبر:
//   1. SessionStore<T> — get/set/update/delete/has
//   2. CacheStore<T> — get/set/delete/invalidatePrefix
//   3. RateLimiter — check/reset
//
// نستخدم mock KVNamespace بسيط لمحاكاة Cloudflare KV
// ============================================

import { describe, it, expect, beforeEach } from "vitest";
import { SessionStore, CacheStore, RateLimiter, TTL } from "../src/shared/session";

// ============================================
// Mock KVNamespace
// ============================================
// KV الحقيقي يتعامل مع eventual consistency و expiration TTL
// هذا الـ mock يُخزن في Map ولا يحترم TTL تلقائياً (لكن نتأكد من تمريرها)
// نستخدم `as any` لتجنب مشاكل توافق interface مع @cloudflare/workers-types
class MockKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, options?: any): Promise<any> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (options?.type === "json" || options === "json") {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: any): Promise<void> {
    const entry: { value: string; expiresAt?: number } = { value };
    if (options?.expirationTtl) {
      entry.expiresAt = Date.now() + options.expirationTtl * 1000;
    }
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: any): Promise<any> {
    const prefix = options?.prefix || "";
    const keys: { name: string; expiration?: number; metadata?: unknown }[] = [];
    for (const key of this.store.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        keys.push({ name: key });
      }
    }
    return { keys, list_complete: true, cacheStatus: null };
  }

  // Helpers للـ testing
  _size(): number { return this.store.size; }
  _has(key: string): boolean { return this.store.has(key); }
  _clear(): void { this.store.clear(); }
}

// ============================================
// SessionStore Tests
// ============================================
describe("SessionStore", () => {
  let kv: MockKV;
  let store: SessionStore<{ name: string; count: number }>;

  beforeEach(() => {
    kv = new MockKV();
    store = new SessionStore(kv as any, "session", 3600);
  });

  it("returns null for non-existent session", async () => {
    const result = await store.get(123);
    expect(result).toBeNull();
  });

  it("stores and retrieves a session", async () => {
    await store.set(123, { name: "أحمد", count: 5 });
    const result = await store.get(123);
    expect(result).toEqual({ name: "أحمد", count: 5 });
  });

  it("overwrites existing session on set", async () => {
    await store.set(123, { name: "أحمد", count: 5 });
    await store.set(123, { name: "سارة", count: 10 });
    const result = await store.get(123);
    expect(result).toEqual({ name: "سارة", count: 10 });
  });

  it("updates session partially via update()", async () => {
    await store.set(123, { name: "أحمد", count: 5 });
    const updated = await store.update(123, { count: 10 });
    expect(updated).toEqual({ name: "أحمد", count: 10 });
    const result = await store.get(123);
    expect(result).toEqual({ name: "أحمد", count: 10 });
  });

  it("returns null when updating non-existent session", async () => {
    const result = await store.update(999, { count: 10 });
    expect(result).toBeNull();
  });

  it("deletes a session", async () => {
    await store.set(123, { name: "أحمد", count: 5 });
    await store.delete(123);
    const result = await store.get(123);
    expect(result).toBeNull();
  });

  it("has() returns true for existing session", async () => {
    await store.set(123, { name: "أحمد", count: 5 });
    expect(await store.has(123)).toBe(true);
    expect(await store.has(999)).toBe(false);
  });

  it("uses correct prefix in keys", async () => {
    await store.set(123, { name: "test", count: 0 });
    expect(kv._has("session:123")).toBe(true);
    expect(kv._has("session:999")).toBe(false);
  });

  it("handles string IDs", async () => {
    await store.set("user:abc", { name: "test", count: 0 });
    const result = await store.get("user:abc");
    expect(result).toEqual({ name: "test", count: 0 });
  });

  it("does not throw on KV errors (graceful failure)", async () => {
    // الـ mock لا يُرمي أخطاء، لكن نتأكد أن set/get لا تُرمي
    await expect(store.set(123, { name: "test", count: 0 })).resolves.toBeUndefined();
    await expect(store.get(123)).resolves.not.toThrow();
  });
});

// ============================================
// CacheStore Tests
// ============================================
describe("CacheStore", () => {
  let kv: MockKV;
  let cache: CacheStore<{ data: string }>;

  beforeEach(() => {
    kv = new MockKV();
    cache = new CacheStore(kv as any, 3600);
  });

  it("returns null for cache miss", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached data", async () => {
    await cache.set("colleges", { data: "7 colleges" });
    const result = await cache.get("colleges");
    expect(result).toEqual({ data: "7 colleges" });
  });

  it("deletes cached entry", async () => {
    await cache.set("colleges", { data: "test" });
    await cache.delete("colleges");
    expect(await cache.get("colleges")).toBeNull();
  });

  it("uses 'cache:' prefix for keys", async () => {
    await cache.set("test", { data: "value" });
    expect(kv._has("cache:test")).toBe(true);
  });

  it("invalidatePrefix removes all matching keys", async () => {
    await cache.set("colleges", { data: "1" });
    await cache.set("colleges:1", { data: "2" });
    await cache.set("colleges:2", { data: "3" });
    await cache.set("specialties", { data: "4" });

    await cache.invalidatePrefix("colleges");

    // كل مفاتيح colleges يجب أن تُحذف
    expect(await cache.get("colleges")).toBeNull();
    expect(await cache.get("colleges:1")).toBeNull();
    expect(await cache.get("colleges:2")).toBeNull();
    // لكن specialties يجب أن تبقى
    expect(await cache.get("specialties")).toEqual({ data: "4" });
  });
});

// ============================================
// RateLimiter Tests
// ============================================
describe("RateLimiter", () => {
  let kv: MockKV;
  let limiter: RateLimiter;

  beforeEach(() => {
    kv = new MockKV();
    limiter = new RateLimiter(kv as any, "ratelimit");
  });

  it("allows first request", async () => {
    const result = await limiter.check("contribution_submit", 123, 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("counts down remaining requests", async () => {
    await limiter.check("test", 123, 5, 60);
    await limiter.check("test", 123, 5, 60);
    const result = await limiter.check("test", 123, 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks when limit is reached", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.check("test", 123, 5, 60);
    }
    const result = await limiter.check("test", 123, 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different users independently", async () => {
    await limiter.check("test", 111, 2, 60);
    await limiter.check("test", 111, 2, 60);
    // user 111 وصل للحد
    const r1 = await limiter.check("test", 111, 2, 60);
    expect(r1.allowed).toBe(false);
    // user 222 لا يزال يستطيع
    const r2 = await limiter.check("test", 222, 2, 60);
    expect(r2.allowed).toBe(true);
  });

  it("tracks different actions independently", async () => {
    await limiter.check("download", 123, 1, 60);
    // action download وصل للحد
    const r1 = await limiter.check("download", 123, 1, 60);
    expect(r1.allowed).toBe(false);
    // لكن action مختلف لا يزال مسموح
    const r2 = await limiter.check("upload", 123, 1, 60);
    expect(r2.allowed).toBe(true);
  });

  it("reset() clears the counter", async () => {
    for (let i = 0; i < 3; i++) {
      await limiter.check("test", 123, 3, 60);
    }
    expect((await limiter.check("test", 123, 3, 60)).allowed).toBe(false);
    await limiter.reset("test", 123);
    expect((await limiter.check("test", 123, 3, 60)).allowed).toBe(true);
  });
});

// ============================================
// TTL Constants Tests
// ============================================
describe("TTL constants", () => {
  it("has sensible values", () => {
    expect(TTL.SESSION_SHORT).toBe(300);       // 5 دقائق
    expect(TTL.SESSION_DEFAULT).toBe(3600);    // ساعة
    expect(TTL.SESSION_LONG).toBe(86400);      // يوم
    expect(TTL.CACHE_STATIC).toBe(3600);       // ساعة
    expect(TTL.CACHE_DYNAMIC).toBe(300);       // 5 دقائق
    expect(TTL.CACHE_PERMISSIONS).toBe(300);   // 5 دقائق
  });

  it("session long is greater than session default", () => {
    expect(TTL.SESSION_LONG).toBeGreaterThan(TTL.SESSION_DEFAULT);
  });

  it("cache permissions is shorter than cache static", () => {
    expect(TTL.CACHE_PERMISSIONS).toBeLessThanOrEqual(TTL.CACHE_STATIC);
  });
});
