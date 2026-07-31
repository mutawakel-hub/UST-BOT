// ============================================
// بيانات المواد الدراسية — استبدال الهاردكود بقراءات DB
// ============================================
// الواجهة Subject محفوظة للتوافق مع الكود القائم
// الدوال الآن async تقرأ من DB عبر SupabaseClient
// ============================================

import { SupabaseClient } from "../db";

export interface Subject {
  id: number;
  specialty_id: number;
  level: number;
  semester: 1 | 2;
  name: string;
  has_theory: boolean;
  has_practical: boolean;
  // حقول إضافية من DB (اختيارية للتوافق مع الكود القديم)
  sort_order?: number;
  code?: string | null;
  credits?: number | null;
  is_active?: boolean;
}

// ============================================
// قراءة مادة بالمعرف من DB
// ============================================
// تُستخدم بدل getSubjectById و getSubjectByIdWithFallback
// لا حاجة لـ fallback تجريبي — كل المواد في DB موجودة فعلاً
export async function getSubjectByIdFromDB(
  client: SupabaseClient,
  id: number
): Promise<Subject | null> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: `id=eq.${id}`,
      single: true,
    });
    const subject = Array.isArray(result) ? result[0] : result;
    return subject || null;
  } catch {
    return null;
  }
}

// ============================================
// قراءة مواد تخصص/مستوى/فصل من DB
// ============================================
// تُستخدم بدل getSubjectsBySpecialtyLevelSemester
// لا حاجة لمواد تجريبية — DB يحتوي كل المواد
export async function getSubjectsBySpecialtyLevelSemesterFromDB(
  client: SupabaseClient,
  specialtyId: number,
  level: number,
  semester: number
): Promise<Subject[]> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: `specialty_id=eq.${specialtyId}&level=eq.${level}&semester=eq.${semester}&is_active=eq.true`,
      order: "sort_order.asc,name.asc",
    });
    return Array.isArray(result) ? (result as Subject[]) : [];
  } catch {
    return [];
  }
}

// ============================================
// قراءة كل مواد تخصص من DB (كل المستويات والفصول)
// ============================================
export async function getSubjectsBySpecialtyFromDB(
  client: SupabaseClient,
  specialtyId: number
): Promise<Subject[]> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: `specialty_id=eq.${specialtyId}&is_active=eq.true`,
      order: "level.asc,semester.asc,sort_order.asc,name.asc",
    });
    return Array.isArray(result) ? (result as Subject[]) : [];
  } catch {
    return [];
  }
}

// ============================================
// دوال متزامنة للتوافق مع الكود القديم (deprecated)
// ============================================
// ملاحظة: هذه الدوال تُرجع قيماً فارغة
// يجب تحويل الاستدعاءات لـ async تدريجياً

export const SUBJECTS: Subject[] = [];

export function getSubjectById(id: number): Subject | undefined {
  return undefined;
}

export function getSubjectByIdWithFallback(id: number): Subject | undefined {
  return undefined;
}

export function getSubjectsBySpecialtyLevelSemester(
  specialtyId: number,
  level: number,
  semester: 1 | 2
): Subject[] {
  return [];
}

export function getFileCountForCategory(subjectId: number, category: string): number {
  return 0;
}

export interface MockFile {
  id: string;
  subject_id: number;
  category: string;
  file_name: string;
  file_size_mb: number;
  is_starred: boolean;
  uploaded_at: string;
  download_count: number;
  uploaded_by: string;
}

export function getMockFilesForSubject(subjectId: number, category: string): MockFile[] {
  return [];
}

export function searchFiles(query: string): Array<{ file: MockFile; subject_name: string }> {
  return [];
}

export const MOCKUP_NOTICE_STUDENT = "";
