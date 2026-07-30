// ============================================
// 🧪 اختبارات وحدة texts.ts — formatContentCard
// ============================================
// نختبر:
//   - formatContentCard() لكل سياق (channel_archive / student_preview / admin_review)
//   - التحقق من ظهور/إخفاء حقول معينة حسب السياق
//   - CONTENT_TYPE_LABELS_AR
// ============================================

import { describe, it, expect } from "vitest";
import {
  formatContentCard,
  CONTENT_TYPE_LABELS_AR,
  ContentCardContext,
  ContentCardData,
} from "../src/shared/texts";

// بيانات نموذجية للاختبار
const sampleData: ContentCardData = {
  title: "ملخص الوحدة الأولى",
  contentType: "summary",
  subjectName: "قواعد البيانات",
  collegeName: "الحاسبات وتكنولوجيا المعلومات",
  specialtyName: "تقنية معلومات (IT)",
  level: 2,
  semester: 1,
  fileSizeBytes: 2936012, // ~2.8 MB
  fileSizeMb: 2.8,
  contributorName: "أحمد محمد",
  uploadedAt: "2025-07-28T10:30:00Z",
  description: "ملخص شامل يغطي الوحدة الأولى مع أهم المفاهيم والأسئلة المتوقعة.",
  ihsanId: 1247,
  isStarred: false,
  downloadCount: 142,
};

describe("CONTENT_TYPE_LABELS_AR — completeness", () => {
  it("has labels for all 8 content types", () => {
    const expectedTypes = [
      "book_theory",
      "book_practical",
      "summary",
      "exam",
      "video",
      "audio",
      "reference",
      "schedule",
    ];
    for (const t of expectedTypes) {
      expect(CONTENT_TYPE_LABELS_AR[t]).toBeDefined();
      expect(CONTENT_TYPE_LABELS_AR[t].label).toBeTruthy();
      expect(CONTENT_TYPE_LABELS_AR[t].emoji).toBeTruthy();
    }
  });

  it("summary has correct label and emoji", () => {
    expect(CONTENT_TYPE_LABELS_AR.summary.label).toBe("ملخصات");
    expect(CONTENT_TYPE_LABELS_AR.summary.emoji).toBe("📄");
  });

  it("video has correct label and emoji", () => {
    expect(CONTENT_TYPE_LABELS_AR.video.label).toBe("مرئيات");
    expect(CONTENT_TYPE_LABELS_AR.video.emoji).toBe("🎥");
  });

  it("audio has correct label and emoji", () => {
    expect(CONTENT_TYPE_LABELS_AR.audio.label).toBe("صوتيات");
    expect(CONTENT_TYPE_LABELS_AR.audio.emoji).toBe("🎧");
  });
});

describe("formatContentCard — channel_archive context", () => {
  const context: ContentCardContext = "channel_archive";
  const output = formatContentCard(sampleData, context);

  it("contains the type emoji and label in header", () => {
    expect(output).toContain("📄 [ملخصات]");
    expect(output).toContain("ملخص الوحدة الأولى");
  });

  it("contains academic context block", () => {
    expect(output).toContain("🏛 الكلية:");
    expect(output).toContain("الحاسبات وتكنولوجيا المعلومات");
    expect(output).toContain("🎓 التخصص:");
    expect(output).toContain("تقنية معلومات (IT)");
    expect(output).toContain("📊 المستوى:");
    expect(output).toContain("2");
    expect(output).toContain("📖 المادة:");
    expect(output).toContain("قواعد البيانات");
  });

  it("contains file info block", () => {
    expect(output).toContain("📦 الحجم:");
    expect(output).toContain("📅 التاريخ:");
  });

  it("shows contributor name in channel context", () => {
    expect(output).toContain("👤 المُحسِن:");
    expect(output).toContain("أحمد محمد");
  });

  it("contains description", () => {
    expect(output).toContain("📝 الوصف:");
    expect(output).toContain("ملخص شامل يغطي الوحدة الأولى");
  });

  it("shows ihsan ID at the bottom", () => {
    expect(output).toContain("🆔 إحسان #1247");
  });

  it("does NOT show download count in channel context", () => {
    expect(output).not.toContain("⬇️ التحميلات");
  });

  it("uses separators", () => {
    // يجب أن يحتوي على 2 فواصل على الأقل (واحد قبل الكلية وواحد قبل المادة)
    const separatorCount = (output.match(/━━━━━━━━━━━━━━━/g) || []).length;
    expect(separatorCount).toBeGreaterThanOrEqual(2);
  });
});

describe("formatContentCard — student_preview context", () => {
  const context: ContentCardContext = "student_preview";
  const output = formatContentCard(sampleData, context);

  it("contains the type emoji and label in header", () => {
    expect(output).toContain("📄 [ملخصات]");
    expect(output).toContain("ملخص الوحدة الأولى");
  });

  it("contains academic context block", () => {
    expect(output).toContain("🏛 الكلية:");
    expect(output).toContain("🎓 التخصص:");
    expect(output).toContain("📖 المادة:");
  });

  it("does NOT show contributor name (privacy)", () => {
    expect(output).not.toContain("👤 المُحسِن");
    expect(output).not.toContain("أحمد محمد");
  });

  it("does NOT show ihsan ID (privacy)", () => {
    expect(output).not.toContain("🆔 إحسان");
  });

  it("shows download count for student", () => {
    expect(output).toContain("⬇️ التحميلات:");
    expect(output).toContain("142");
  });
});

describe("formatContentCard — admin_review context", () => {
  const context: ContentCardContext = "admin_review";
  const data: ContentCardData = {
    ...sampleData,
    statusLabel: "🟡 قيد المراجعة",
  };
  const output = formatContentCard(data, context);

  it("shows contributor name in admin context", () => {
    expect(output).toContain("👤 المُحسِن:");
    expect(output).toContain("أحمد محمد");
  });

  it("shows ihsan ID in admin context", () => {
    expect(output).toContain("🆔 إحسان #1247");
  });

  it("shows status label in admin context", () => {
    expect(output).toContain("🚦 الحالة:");
    expect(output).toContain("🟡 قيد المراجعة");
  });

  it("does NOT show download count in admin context", () => {
    expect(output).not.toContain("⬇️ التحميلات");
  });
});

describe("formatContentCard — edge cases", () => {
  it("handles missing description", () => {
    const data: ContentCardData = {
      ...sampleData,
      description: undefined,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).not.toContain("📝 الوصف:");
  });

  it("handles description = '-' (skip marker)", () => {
    const data: ContentCardData = {
      ...sampleData,
      description: "-",
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).not.toContain("📝 الوصف:");
  });

  it("handles missing file size (shows 'غير محدد')", () => {
    const data: ContentCardData = {
      ...sampleData,
      fileSizeBytes: null,
      fileSizeMb: null,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).toContain("📦 الحجم:     غير محدد");
  });

  it("handles missing level", () => {
    const data: ContentCardData = {
      ...sampleData,
      level: null,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).not.toContain("📊 المستوى");
  });

  it("handles missing ihsan ID", () => {
    const data: ContentCardData = {
      ...sampleData,
      ihsanId: null,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).not.toContain("🆔 إحسان");
  });

  it("handles unknown content type (uses fallback)", () => {
    const data: ContentCardData = {
      ...sampleData,
      contentType: "unknown_type",
    };
    const output = formatContentCard(data, "channel_archive");
    // لا يجب أن يتعطل — يستخدم emoji افتراضي
    expect(output).toContain("unknown_type");
    expect(output).toContain("ملخص الوحدة الأولى");
  });

  it("shows starred badge when isStarred=true", () => {
    const data: ContentCardData = {
      ...sampleData,
      isStarred: true,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).toContain("⭐ محتوى مميّز");
  });

  it("formats file size in bytes correctly (KB)", () => {
    const data: ContentCardData = {
      ...sampleData,
      fileSizeBytes: 500 * 1024, // 500 KB
      fileSizeMb: 0.5,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).toContain("KB");
  });

  it("formats file size in GB correctly", () => {
    const data: ContentCardData = {
      ...sampleData,
      fileSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      fileSizeMb: 2048,
    };
    const output = formatContentCard(data, "channel_archive");
    expect(output).toContain("GB");
  });
});
