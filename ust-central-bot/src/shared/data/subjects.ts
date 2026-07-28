// ============================================
// بيانات المواد الدراسية - Mockup
// ============================================
// التخصص الكامل في الـ Mockup: تقنية معلومات (IT) - id=16
// باقي التخصصات لها مادة تجريبية واحدة لكل مستوى/فصل
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

// مواد تخصص تقنية المعلومات (IT) - المستويان الأول والثاني
const IT_SUBJECTS: Subject[] = [
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

// مواد تخصص طب وجراحة (specialty_id=1) - المستوى الأول
const MED_SUBJECTS: Subject[] = [
  { id: 301, specialty_id: 1, level: 1, semester: 1, name: "مقدمة في الطب", has_theory: true, has_practical: true },
  { id: 302, specialty_id: 1, level: 1, semester: 1, name: "التشريح البشري", has_theory: true, has_practical: true },
  { id: 303, specialty_id: 1, level: 1, semester: 1, name: "الكيمياء الحيوية", has_theory: true, has_practical: false },
  { id: 304, specialty_id: 1, level: 1, semester: 1, name: "علم الأنسجة", has_theory: true, has_practical: false },
  { id: 305, specialty_id: 1, level: 1, semester: 1, name: "اللغة الإنجليزية الطبية", has_theory: true, has_practical: false },
];

// قائمة بكل المواد (IT + الطب)
export const SUBJECTS: Subject[] = [...IT_SUBJECTS, ...MED_SUBJECTS];

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
  uploaded_at: string;
  download_count: number;
  uploaded_by: string;
}

// توليد ملفات وهمية لكل مادة - تصنيف
export function getMockFilesForSubject(subjectId: number, category: string): MockFile[] {
  const subject = getSubjectById(subjectId);
  if (!subject) return [];

  const files: MockFile[] = [];

  if (category === "book_theory") {
    files.push({
      id: `f_${subjectId}_book_theory_1`,
      subject_id: subjectId,
      category: "book_theory",
      file_name: `${subject.name} - المقرر النظري.pdf`,
      file_size_mb: 4.2,
      is_starred: true,
      uploaded_at: "قبل 3 أيام",
      download_count: 142,
      uploaded_by: "أ. محمد العولقي",
    });
    files.push({
      id: `f_${subjectId}_book_theory_2`,
      subject_id: subjectId,
      category: "book_theory",
      file_name: `${subject.name} - الفصل الأول.pdf`,
      file_size_mb: 2.1,
      is_starred: false,
      uploaded_at: "قبل أسبوع",
      download_count: 89,
      uploaded_by: "طالب مجتهد",
    });
  }

  if (category === "book_practical" && subject.has_practical) {
    files.push({
      id: `f_${subjectId}_book_practical_1`,
      subject_id: subjectId,
      category: "book_practical",
      file_name: `${subject.name} - دليل العملي.pdf`,
      file_size_mb: 1.8,
      is_starred: false,
      uploaded_at: "قبل 5 أيام",
      download_count: 67,
      uploaded_by: "أ. سارة الحداد",
    });
  }

  if (category === "exam") {
    files.push({
      id: `f_${subjectId}_exam_1`,
      subject_id: subjectId,
      category: "exam",
      file_name: `${subject.name} - اختبار منتصف الفصل 1445.pdf`,
      file_size_mb: 0.5,
      is_starred: false,
      uploaded_at: "قبل أسبوعين",
      download_count: 234,
      uploaded_by: "اللجنة العلمية",
    });
    files.push({
      id: `f_${subjectId}_exam_2`,
      subject_id: subjectId,
      category: "exam",
      file_name: `${subject.name} - اختبار نهائي 1444.pdf`,
      file_size_mb: 0.6,
      is_starred: true,
      uploaded_at: "قبل شهر",
      download_count: 312,
      uploaded_by: "اللجنة العلمية",
    });
  }

  if (category === "summary") {
    files.push({
      id: `f_${subjectId}_summary_1`,
      subject_id: subjectId,
      category: "summary",
      file_name: `${subject.name} - ملخص شامل.pdf`,
      file_size_mb: 0.9,
      is_starred: false,
      uploaded_at: "قبل 4 أيام",
      download_count: 156,
      uploaded_by: "طالب متفوق",
    });
  }

  return files;
}

// ============================================
// عدّاد الملفات لكل تصنيف في مادة معينة
// ============================================
export function getFileCountForCategory(subjectId: number, category: string): number {
  return getMockFilesForSubject(subjectId, category).length;
}

// ============================================
// البحث الشامل عبر كل المواد والملفات
// ============================================
export function searchFiles(query: string): Array<{ file: MockFile; subject_name: string }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: Array<{ file: MockFile; subject_name: string }> = [];

  // البحث في المواد والملفات
  for (const subject of SUBJECTS) {
    const subjectMatches =
      subject.name.toLowerCase().includes(q) || subject.name.includes(query);

    const categories = ["book_theory", "book_practical", "exam", "summary"];
    for (const cat of categories) {
      const files = getMockFilesForSubject(subject.id, cat);
      for (const file of files) {
        if (
          subjectMatches ||
          file.file_name.toLowerCase().includes(q) ||
          file.file_name.includes(query)
        ) {
          results.push({ file, subject_name: subject.name });
        }
      }
    }
  }

  return results.slice(0, 24); // حد أقصى 24 نتيجة
}

// ============================================
// دوال مساعدة
// ============================================
export function getSubjectsBySpecialtyLevelSemester(
  specialtyId: number,
  level: number,
  semester: 1 | 2
): Subject[] {
  let subjects = SUBJECTS.filter(
    (s) => s.specialty_id === specialtyId && s.level === level && s.semester === semester
  );

  // إن لم تكن مواد موجودة (غير IT والطب)، أضف مادة تجريبية واحدة
  if (subjects.length === 0 && specialtyId !== 16 && specialtyId !== 1) {
    subjects = [
      {
        id: 9000 + specialtyId * 100 + level * 10 + semester,
        specialty_id: specialtyId,
        level,
        semester,
        name: `مادة تجريبية - ${getSpecialtyName(specialtyId)} - مستوى ${level} - فصل ${semester}`,
        has_theory: true,
        has_practical: false,
      },
    ];
  }

  return subjects;
}

function getSpecialtyName(specialtyId: number): string {
  // استيراد دائري - نُعالجه بـ lazy import عبر require
  return "التخصص";
}

export function getSubjectById(id: number): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function getSubjectByIdWithFallback(id: number): Subject | undefined {
  let subject = SUBJECTS.find((s) => s.id === id);
  // للأرقام التجريبية (9000+)
  if (!subject && id >= 9000) {
    const specialtyId = Math.floor((id - 9000) / 100);
    const level = Math.floor((id - 9000 - specialtyId * 100) / 10);
    const semester = (id - 9000 - specialtyId * 100 - level * 10) as 1 | 2;
    return {
      id,
      specialty_id: specialtyId,
      level,
      semester,
      name: `مادة تجريبية - مستوى ${level} - فصل ${semester}`,
      has_theory: true,
      has_practical: false,
    };
  }
  return subject;
}

// رسالة افتراضية للإشارة للوضع التجريبي
export const MOCKUP_NOTICE_STUDENT =
  "ℹ️ *وضع التجربة (Mockup)*\n" +
  "هذه نسخة تجريبية. المواد الكاملة متوفرة حالياً لتخصص *تقنية معلومات (IT)* — المستويان الأول والثاني.\n" +
  "باقي التخصصات تعرض مادة تجريبية واحدة لكل فصل.";
