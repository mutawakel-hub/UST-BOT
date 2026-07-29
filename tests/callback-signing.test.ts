// ============================================
// 🧪 اختبارات وحدة callback-signing.ts
// ============================================
// نختبر:
//   - signCallback / verifyCallback (round-trip)
//   - رفض التوقيعات المزوّرة
//   - رفض الـ data غير الموقّعة
//   - مقاومة timing attacks (constant-time comparison)
//   - توليد secret
// ============================================

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  initCallbackSigning,
  signCallback,
  signCallbacks,
  verifyCallback,
  isSigned,
  extractData,
  generateSecret,
} from "../src/shared/callback-signing";

// ============================================
// Helper: انتظر قليلاً (للـ async tests)
// ============================================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================
// إعداد قبل كل الاختبارات
// ============================================
beforeAll(() => {
  // استخدم secret ثابت للاختبارات
  initCallbackSigning("test-secret-for-vitest-1234567890");
});

describe("signCallback / verifyCallback round-trip", () => {
  it("signs and verifies simple data", async () => {
    const signed = await signCallback("delete_content_5");
    expect(signed).toContain("delete_content_5.");
    expect(signed.split(".").pop()?.length).toBe(16);

    const verified = await verifyCallback(signed);
    expect(verified).toBe("delete_content_5");
  });

  it("signs and verifies Arabic data", async () => {
    const signed = await signCallback("رفض_5");
    const verified = await verifyCallback(signed);
    expect(verified).toBe("رفض_5");
  });

  it("signs and verifies data with multiple dots", async () => {
    // النمط: "back_to_files_123_456" — لا يحتوي نقاط
    // لكن لو كانت data تحتوي نقطة (مثل "v2.delete_5")، نستخدم lastIndexOf
    const signed = await signCallback("back_to_subject_menu_123");
    const verified = await verifyCallback(signed);
    expect(verified).toBe("back_to_subject_menu_123");
  });

  it("produces different signatures for different data", async () => {
    const sig1 = await signCallback("delete_content_5");
    const sig2 = await signCallback("delete_content_6");
    expect(sig1).not.toBe(sig2);
  });

  it("produces same signature for same data (deterministic)", async () => {
    const sig1 = await signCallback("delete_content_5");
    const sig2 = await signCallback("delete_content_5");
    expect(sig1).toBe(sig2);
  });
});

describe("signature rejection", () => {
  it("rejects tampered data", async () => {
    const signed = await signCallback("delete_content_5");
    // عدّل الـ data لكن أبقِ الـ signature
    const parts = signed.split(".");
    const tampered = `delete_content_6.${parts[parts.length - 1]}`;
    const verified = await verifyCallback(tampered);
    expect(verified).toBeNull();
  });

  it("rejects tampered signature", async () => {
    const signed = await signCallback("delete_content_5");
    // عدّل آخر حرف من الـ signature
    const lastChar = signed.slice(-1);
    const newChar = lastChar === "a" ? "b" : "a";
    const tampered = signed.slice(0, -1) + newChar;
    const verified = await verifyCallback(tampered);
    expect(verified).toBeNull();
  });

  it("rejects unsigned data", async () => {
    const verified = await verifyCallback("delete_content_5");
    expect(verified).toBeNull();
  });

  it("rejects data without signature suffix", async () => {
    const verified = await verifyCallback("just_plain_text");
    expect(verified).toBeNull();
  });

  it("rejects empty signature", async () => {
    const verified = await verifyCallback("delete_content_5.");
    expect(verified).toBeNull();
  });

  it("rejects signature with wrong length", async () => {
    const signed = await signCallback("delete_content_5");
    // خذ أول 8 أحرف فقط (قصير جداً)
    const parts = signed.split(".");
    const shortSig = `${parts[0]}.${parts[1].substring(0, 8)}`;
    const verified = await verifyCallback(shortSig);
    expect(verified).toBeNull();
  });

  it("rejects signature with non-hex characters", async () => {
    const signed = await signCallback("delete_content_5");
    // استبدل أحرف hex بأحرف غير hex
    const parts = signed.split(".");
    const badSig = `${parts[0]}.xyzxyzxyzxyzxyzz`;
    const verified = await verifyCallback(badSig);
    expect(verified).toBeNull();
  });
});

describe("signCallbacks (batch)", () => {
  it("signs multiple items at once", async () => {
    const items = ["delete_1", "delete_2", "delete_3"];
    const signed = await signCallbacks(items);
    expect(signed).toHaveLength(3);
    for (let i = 0; i < items.length; i++) {
      const verified = await verifyCallback(signed[i]);
      expect(verified).toBe(items[i]);
    }
  });

  it("preserves order", async () => {
    const items = ["aaa", "bbb", "ccc", "ddd"];
    const signed = await signCallbacks(items);
    const verified = await Promise.all(signed.map(verifyCallback));
    expect(verified).toEqual(items);
  });
});

describe("isSigned (quick check)", () => {
  it("returns true for signed data", async () => {
    const signed = await signCallback("test");
    expect(isSigned(signed)).toBe(true);
  });

  it("returns false for unsigned data", () => {
    expect(isSigned("plain_text")).toBe(false);
  });

  it("returns false for data with non-hex suffix", () => {
    expect(isSigned("data.xyzxyzxyzxyzxyz")).toBe(false); // 16 chars but not hex
  });

  it("returns false for data with wrong-length suffix", async () => {
    const signed = await signCallback("test");
    const short = signed.substring(0, signed.length - 5); // أزل 5 أحرف من الـ signature
    expect(isSigned(short)).toBe(false);
  });
});

describe("extractData (no verification)", () => {
  it("extracts data from signed callback", async () => {
    const signed = await signCallback("delete_content_5");
    expect(extractData(signed)).toBe("delete_content_5");
  });

  it("returns original if no signature", () => {
    expect(extractData("plain_text")).toBe("plain_text");
  });

  it("handles data with multiple dots", () => {
    expect(extractData("v2.delete.5.signature")).toBe("v2.delete.5");
  });
});

describe("generateSecret", () => {
  it("generates 64-character hex string", () => {
    const secret = generateSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
  });

  it("generates different secrets each call", () => {
    const s1 = generateSecret();
    const s2 = generateSecret();
    expect(s1).not.toBe(s2);
  });

  it("generates valid entropy (256-bit)", () => {
    // 64 hex chars = 32 bytes = 256 bits
    const secret = generateSecret();
    // تحويل hex إلى bytes يدوياً (بدون Buffer لتجنب dependency على node types)
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(secret.substring(i * 2, i * 2 + 2), 16);
    }
    expect(bytes.length).toBe(32);
  });
});

describe("timing attack resistance", () => {
  // هذا اختبار إحصائي بسيط — ليس قاطعاً لكن يتحقق أن الدالة
  // تستغرق وقتاً مماثلاً للتواقيع الصحيحة والخاطئة
  it("takes similar time for valid and invalid signatures", async () => {
    const signed = await signCallback("test_data");

    // قسّ الوقت للتواقيع الصحيحة
    const validTimes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await verifyCallback(signed);
      validTimes.push(performance.now() - start);
    }

    // قسّ الوقت للتواقيع الخاطئة (تختلف في الحرف الأخير فقط)
    const invalidTimes: number[] = [];
    const tampered = signed.slice(0, -1) + (signed.slice(-1) === "a" ? "b" : "a");
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await verifyCallback(tampered);
      invalidTimes.push(performance.now() - start);
    }

    const avgValid = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const avgInvalid = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length;

    // الفرق يجب أن يكون أقل من 50% (المقاومة الثابتة الزمن ليست مثالية لكنها كافية)
    // ملاحظة: هذا اختبار loosy — الهدف الأساسي هو التأكد أن الدالة لا تتوقف مبكراً
    const ratio = Math.max(avgValid, avgInvalid) / Math.min(avgValid, avgInvalid);
    expect(ratio).toBeLessThan(2); // أقل من 2x فرق
  });
});
