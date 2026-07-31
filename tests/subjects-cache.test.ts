// ============================================
// 🧪 اختبارات وحدة subjects cache
// ============================================
// نختبر:
//   - getSubjectById (من cache بعد init)
//   - getSubjectByIdWithFallback (من cache)
//   - getSubjectsBySpecialtyLevelSemester (فلترة + ترتيب)
//   - invalidateSubjectCache (إعادة التحميل)
//   - السلوك قبل initSubjectCache (يرجع undefined)
// ============================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock SupabaseClient
const mockSubjects = [
  { id: 101, specialty_id: 16, level: 1, semester: 1, name: "مقدمة في تقنية المعلومات", has_theory: true, has_practical: true, is_active: true, sort_order: 1, code: "CS101", credits: 3 },
  { id: 102, specialty_id: 16, level: 1, semester: 1, name: "برمجة حاسوب (1)", has_theory: true, has_practical: true, is_active: true, sort_order: 2, code: "CS102", credits: 4 },
  { id: 201, specialty_id: 16, level: 2, semester: 1, name: "البرمجة الكائنية", has_theory: true, has_practical: true, is_active: true, sort_order: 1, code: "CS201", credits: 3 },
  { id: 301, specialty_id: 1, level: 1, semester: 1, name: "مقدمة في الطب", has_theory: true, has_practical: true, is_active: true, sort_order: 1, code: null, credits: null },
];

const mockSupabase = {
  select: vi.fn().mockResolvedValue(mockSubjects),
};

// استيراد بعد إعداد الـ mock
import {
  initSubjectCache,
  invalidateSubjectCache,
  getSubjectById,
  getSubjectByIdWithFallback,
  getSubjectsBySpecialtyLevelSemester,
} from "../src/shared/data/subjects";

describe("Subject Cache — قبل init", () => {
  it("getSubjectById يرجع undefined قبل init", () => {
    expect(getSubjectById(101)).toBeUndefined();
  });

  it("getSubjectByIdWithFallback يرجع undefined قبل init", () => {
    expect(getSubjectByIdWithFallback(101)).toBeUndefined();
  });

  it("getSubjectsBySpecialtyLevelSemester يرجع [] قبل init", () => {
    const result = getSubjectsBySpecialtyLevelSemester(16, 1, 1);
    expect(result).toEqual([]);
  });
});

describe("Subject Cache — بعد init + تحميل", () => {
  beforeEach(async () => {
    invalidateSubjectCache();
    mockSupabase.select.mockClear();
    mockSupabase.select.mockResolvedValue(mockSubjects);
    initSubjectCache(mockSupabase as any);
  });

  it("getSubjectById يرجع المادة الصحيحة بعد تحميل cache", async () => {
    // trigger cache load
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    const subject = getSubjectById(101);
    expect(subject).toBeDefined();
    expect(subject?.name).toBe("مقدمة في تقنية المعلومات");
    expect(subject?.code).toBe("CS101");
    expect(subject?.credits).toBe(3);
  });

  it("getSubjectById يرجع undefined لمادة غير موجودة", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 999);

    expect(getSubjectById(999)).toBeUndefined();
  });

  it("getSubjectByIdWithFallback يرجع نفس نتيجة getSubjectById", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 201);

    const subject = getSubjectByIdWithFallback(201);
    expect(subject).toBeDefined();
    expect(subject?.name).toBe("البرمجة الكائنية");
  });

  it("getSubjectsBySpecialtyLevelSemester يفلتر ويرتّب بشكل صحيح", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // IT مستوى 1 فصل 1 = مادتان
    const subjects = getSubjectsBySpecialtyLevelSemester(16, 1, 1);
    expect(subjects).toHaveLength(2);
    // الترتيب حسب sort_order
    expect(subjects[0].sort_order).toBe(1);
    expect(subjects[1].sort_order).toBe(2);
    expect(subjects[0].name).toBe("مقدمة في تقنية المعلومات");
    expect(subjects[1].name).toBe("برمجة حاسوب (1)");
  });

  it("getSubjectsBySpecialtyLevelSemester يرجع [] لتخصص بدون مواد", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // تخصص 99 لا توجد له مواد
    const subjects = getSubjectsBySpecialtyLevelSemester(99, 1, 1);
    expect(subjects).toEqual([]);
  });

  it("getSubjectsBySpecialtyLevelSemester يفلتر حسب المستوى", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // IT مستوى 2 فصل 1 = مادة واحدة
    const subjects = getSubjectsBySpecialtyLevelSemester(16, 2, 1);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("البرمجة الكائنية");
  });

  it("getSubjectsBySpecialtyLevelSemester يفلتر حسب الفصل", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // IT مستوى 1 فصل 2 = لا مواد
    const subjects = getSubjectsBySpecialtyLevelSemester(16, 1, 2);
    expect(subjects).toEqual([]);
  });

  it("getSubjectsBySpecialtyLevelSemester يفلتر حسب التخصص", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // طب مستوى 1 فصل 1 = مادة واحدة
    const subjects = getSubjectsBySpecialtyLevelSemester(1, 1, 1);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("مقدمة في الطب");
  });
});

describe("Subject Cache — invalidateSubjectCache", () => {
  it("invalidateSubjectCache يمسح cache", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    initSubjectCache(mockSupabase as any);
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // تحقق أن cache محمّل
    expect(getSubjectById(101)).toBeDefined();

    // إبطال
    invalidateSubjectCache();

    // بعد الإبطال، cache فارغ (حتى يُحمّل من جديد)
    expect(getSubjectById(101)).toBeUndefined();
  });

  it("invalidateSubjectCache ثم إعادة تحميل يعمل", async () => {
    const { getSubjectByIdFromDB } = await import("../src/shared/data/subjects");
    initSubjectCache(mockSupabase as any);

    // حمّل أول مرة
    await getSubjectByIdFromDB(mockSupabase as any, 101);
    expect(getSubjectById(101)).toBeDefined();

    // إبطال
    invalidateSubjectCache();
    expect(getSubjectById(101)).toBeUndefined();

    // حمّل مرة ثانية ببيانات جديدة
    const newSubjects = [
      ...mockSubjects,
      { id: 999, specialty_id: 16, level: 1, semester: 1, name: "مادة جديدة", has_theory: true, has_practical: false, is_active: true, sort_order: 99, code: "NEW999", credits: 2 },
    ];
    mockSupabase.select.mockResolvedValue(newSubjects);
    await getSubjectByIdFromDB(mockSupabase as any, 101);

    // المادة الجديدة موجودة الآن
    expect(getSubjectById(999)).toBeDefined();
    expect(getSubjectById(999)?.name).toBe("مادة جديدة");
  });
});
