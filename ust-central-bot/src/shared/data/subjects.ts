// ============================================
// بيانات المواد الدراسية - Mockup
// تخصص: تقنية معلومات (IT) - id=16
// المستويان الأول والثاني (فصلان لكل مستوى)
// ============================================

export interface Subject {
  id: number;
  specialty_id: number;
  level: number;
  semester: 1 | 2;
  name: string;
  has_theory: boolean;
  has_practical: boolean;
}

// مواد تخصص تقنية المعلومات (IT) - المستوى الأول
export const SUBJECTS: Subject[] = [
  // ====== المستوى الأول - الفصل الأول ======
  { id: 101, specialty_id: 16, level: 1, semester: 1, name: "مقدمة في تقنية المعلومات", has_theory: true, has_practical: true },
  { id: 102, specialty_id: 16, level: 1, semester: 1, name: "برمجة حاسوب (1) - Python", has_theory: true, has_practical: true },
  { id: 103, specialty_id: 16, level: 1, semester: 1, name: "الرياضيات المتقطعة", has_theory: true, has_practical: false },
  { id: 104, specialty_id: 16, level: 1, semester: 1, name: "مهارات التعلم والاتصال", has_theory: true, has_practical: false },
  { id: 105, specialty_id: 16, level: 1, semester: 1, name: "اللغة الإنجليزية (1)", has_theory: true, has_practical: false },

  // ====== المستوى الأول - الفصل الثاني ======
  { id: 106, specialty_id: 16, level: 1, semester: 2, name: "برمجة حاسوب (2) - Java", has_theory: true, has_practical: true },
  { id: 107, specialty_id: 16, level: 1, semester: 2, name: "تراكيب البيانات", has_theory: true, has_practical: true },
  { id: 108, specialty_id: 16, level: 1, semester: 2, name: "قواعد البيانات (1)", has_theory: true, has_practical: true },
  { id: 109, specialty_id: 16, level: 1, semester: 2, name: "نظم التشغيل (1)", has_theory: true, has_practical: false },
  { id: 110, specialty_id: 16, level: 1, semester: 2, name: "اللغة الإنجليزية (2)", has_theory: true, has_practical: false },

  // ====== المستوى الثاني - الفصل الأول ======
  { id: 201, specialty_id: 16, level: 2, semester: 1, name: "البرمجة الكائنية (OOP)", has_theory: true, has_practical: true },
  { id: 202, specialty_id: 16, level: 2, semester: 1, name: "هياكل البيانات المتقدمة", has_theory: true, has_practical: true },
  { id: 203, specialty_id: 16, level: 2, semester: 1, name: "قواعد البيانات (2)", has_theory: true, has_practical: true },
  { id: 204, specialty_id: 16, level: 2, semester: 1, name: "شبكات الحاسوب (1)", has_theory: true, has_practical: true },
  { id: 205, specialty_id: 16, level: 2, semester: 1, name: "اللغة الإنجليزية (3)", has_theory: true, has_practical: false },

  // ====== المستوى الثاني - الفصل الثاني ======
  { id: 206, specialty_id: 16, level: 2, semester: 2, name: "هندسة البرمجيات", has_theory: true, has_practical: false },
  { id: 207, specialty_id: 16, level: 2, semester: 2, name: "تطوير الويب (Frontend)", has_theory: true, has_practical: true },
  { id: 208, specialty_id: 16, level: 2, semester: 2, name: "الخوارزميات", has_theory: true, has_practical: true },
  { id: 209, specialty_id: 16, level: 2, semester: 2, name: "أمن المعلومات", has_theory: true, has_practical: false },
  { id: 210, specialty_id: 16, level: 2, semester: 2, name: "اللغة الإنجليزية (4)", has_theory: true, has_practical: false },
];

// ============================================
// ملفات وهمية لكل مادة وتصنيف
// ============================================
export interface MockFile {
  id: string;
  subject_id: number;
  category: "book_theory" | "book_practical" | "exam" | "summary";
  file_name: string;
  file_size_mb: number;
  is_starred: boolean;
}

// ملفات وهمية لكل مادة - سيتم توليدها بشكل ثابت
export function getMockFilesForSubject(subjectId: number, category: string): MockFile[] {
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  if (!subject) return [];

  const files: MockFile[] = [];

  // المقرر النظري
  if (category === "book_theory") {
    files.push({
      id: `f_${subjectId}_book_theory_1`,
      subject_id: subjectId,
      category: "book_theory",
      file_name: `${subject.name} - المقرر النظري.pdf`,
      file_size_mb: 4.2,
      is_starred: true,
    });
    files.push({
      id: `f_${subjectId}_book_theory_2`,
      subject_id: subjectId,
      category: "book_theory",
      file_name: `${subject.name} - الفصل الأول.pdf`,
      file_size_mb: 2.1,
      is_starred: false,
    });
  }

  // المقرر العملي
  if (category === "book_practical" && subject.has_practical) {
    files.push({
      id: `f_${subjectId}_book_practical_1`,
      subject_id: subjectId,
      category: "book_practical",
      file_name: `${subject.name} - دليل العملي.pdf`,
      file_size_mb: 1.8,
      is_starred: false,
    });
  }

  // نماذج الاختبارات
  if (category === "exam") {
    files.push({
      id: `f_${subjectId}_exam_1`,
      subject_id: subjectId,
      category: "exam",
      file_name: `${subject.name} - اختبار منتصف الفصل 1444.pdf`,
      file_size_mb: 0.5,
      is_starred: false,
    });
    files.push({
      id: `f_${subjectId}_exam_2`,
      subject_id: subjectId,
      category: "exam",
      file_name: `${subject.name} - اختبار نهائي 1444.pdf`,
      file_size_mb: 0.6,
      is_starred: true,
    });
  }

  // الملخصات
  if (category === "summary") {
    files.push({
      id: `f_${subjectId}_summary_1`,
      subject_id: subjectId,
      category: "summary",
      file_name: `${subject.name} - ملخص شامل.pdf`,
      file_size_mb: 0.9,
      is_starred: false,
    });
  }

  return files;
}

// ============================================
// دوال مساعدة
// ============================================
export function getSubjectsBySpecialtyLevelSemester(
  specialtyId: number,
  level: number,
  semester: 1 | 2
): Subject[] {
  return SUBJECTS.filter(
    (s) => s.specialty_id === specialtyId && s.level === level && s.semester === semester
  );
}

export function getSubjectById(id: number): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

// رسالة افتراضية للمواد غير الموجودة في الـ Mockup
export const NO_SUBJECTS_MESSAGE =
  "📚 هذا التخصص في وضع التجربة — المواد متوفرة حالياً فقط لتخصص **تقنية معلومات (IT)** في المستويين الأول والثاني.\n\n" +
  "سيتم إضافة باقي المواد عند الانتقال لمرحلة الإنتاج.\n\n" +
  "للتجربة الكاملة، اختر: كلية الحاسبات → تقنية معلومات (IT) → المستوى الأول أو الثاني.";
