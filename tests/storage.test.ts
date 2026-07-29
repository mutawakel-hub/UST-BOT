// ============================================
// 🧪 اختبارات وحدة storage.ts
// ============================================
// نختبر الدوال البحتة (بدون Bot dependency):
//   - formatFileSize
//   - mbToBytes / bytesToMb
//   - تحويلات صحيحة في الاتجاهين
// ============================================

import { describe, it, expect } from "vitest";
import { formatFileSize, mbToBytes, bytesToMb } from "../src/shared/storage";

describe("formatFileSize", () => {
  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(5242880)).toBe("5.0 MB");
    expect(formatFileSize(15728640)).toBe("15.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB");
  });

  it("handles large PDF sizes (typical for textbooks)", () => {
    // كتاب 4.2 MB
    expect(formatFileSize(mbToBytes(4.2))).toBe("4.2 MB");
    // كتاب 12.5 MB
    expect(formatFileSize(mbToBytes(12.5))).toBe("12.5 MB");
  });
});

describe("mbToBytes", () => {
  it("converts 1 MB to bytes", () => {
    expect(mbToBytes(1)).toBe(1048576);
  });

  it("converts decimal MB to bytes", () => {
    expect(mbToBytes(4.2)).toBe(4404019);
  });

  it("handles zero", () => {
    expect(mbToBytes(0)).toBe(0);
  });

  it("handles large values", () => {
    expect(mbToBytes(100)).toBe(104857600);
  });
});

describe("bytesToMb", () => {
  it("converts bytes to MB", () => {
    expect(bytesToMb(1048576)).toBe(1);
  });

  it("converts with 2 decimal precision", () => {
    expect(bytesToMb(4404019)).toBe(4.2);
  });

  it("handles zero", () => {
    expect(bytesToMb(0)).toBe(0);
  });

  it("handles small values (less than 1 MB)", () => {
    expect(bytesToMb(524288)).toBe(0.5);
  });
});

describe("round-trip conversion", () => {
  it("mbToBytes → bytesToMb preserves value (approx)", () => {
    const originalMb = 4.2;
    const bytes = mbToBytes(originalMb);
    const backToMb = bytesToMb(bytes);
    // قد يفقد بعض الدقة بسبب التقريب، لكن يجب أن يكون قريباً
    expect(Math.abs(backToMb - originalMb)).toBeLessThan(0.01);
  });

  it("mbToBytes → bytesToMb exact for integers", () => {
    for (const mb of [1, 5, 10, 50, 100]) {
      expect(bytesToMb(mbToBytes(mb))).toBe(mb);
    }
  });
});
