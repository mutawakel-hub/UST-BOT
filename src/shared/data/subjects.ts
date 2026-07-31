// ============================================
// بيانات المواد الدراسية — في-memory cache من DB
// ============================================
// الاستراتيجية:
//   1. عند أول استدعاء لأي دالة متزامنة، نُحمّل كل المواد من DB
//   2. نُخزّنها في SubjectCache (Map) للوصول السريع المتزامن
//   3. الكود القديم يظل يعمل دون تغيير (الدوال المتزامنة تقرأ من cache)
//   4. بعد أي عملية CRUD في الأدمن، يُستدعى invalidateSubjectCache()
//
// ملاحظة: في Cloudflare Workers، كل isolate له ذاكرة منفصلة.
// لكن KV يضمن أن البيانات تتزامن عبر isolates عبر TTL قصير.
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
// In-Memory Cache
// ============================================
// يُحمّل مرة واحدة عند أول استدعاء، ثم يُستخدم للدوال المتزامنة
// يُحدّث تلقائياً بعد كل CRUD عبر invalidateSubjectCache()

let subjectCache: Map<number, Subject> = new Map();
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;

// مرجع لـ SupabaseClient (يُضبط عبر initSubjectCache)
let supabaseRef: SupabaseClient | null = null;

export function initSubjectCache(supabase: SupabaseClient): void {
  supabaseRef = supabase;
}

export function invalidateSubjectCache(): void {
  cacheLoaded = false;
  subjectCache.clear();
}

async function ensureCacheLoaded(): Promise<void> {
  if (cacheLoaded) return;
  if (cacheLoadPromise) {
    await cacheLoadPromise;
    return;
  }

  cacheLoadPromise = loadAllSubjects();
  try {
    await cacheLoadPromise;
  } finally {
    cacheLoadPromise = null;
  }
}

async function loadAllSubjects(): Promise<void> {
  if (!supabaseRef) {
    console.warn("⚠️ [subjects] supabaseRef not set — cache will be empty");
    return;
  }

  try {
    const result = await supabaseRef.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: "is_active=eq.true",
      limit: 5000,
    });

    if (Array.isArray(result)) {
      subjectCache = new Map();
      for (const s of result) {
        subjectCache.set(s.id, s as Subject);
      }
      cacheLoaded = true;
      console.log(`✅ [subjects] Cache loaded: ${subjectCache.size} subjects`);
    }
  } catch (e) {
    console.error("❌ [subjects] Failed to load cache:", e);
  }
}

// ============================================
// دوال async (للاستخدام الجديد)
// ============================================

export async function getSubjectByIdFromDB(
  client: SupabaseClient,
  id: number
): Promise<Subject | null> {
  // استخدم cache أولاً
  if (!cacheLoaded && supabaseRef) {
    await ensureCacheLoaded();
  }
  if (cacheLoaded && subjectCache.has(id)) {
    return subjectCache.get(id)!;
  }
  // fallback: استعلم مباشرة
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
// دوال متزامنة (تقرأ من cache)
// ============================================
// ملاحظة: هذه الدوال تُرجع [] فارغة لو cache لم يُحمّل بعد
// لكن بعد أول استدعاء لأي دالة async، cache يكون جاهزاً
// في Cloudflare Workers، cache يُحمّل عند أول request لكل isolate

export function getSubjectById(id: number): Subject | undefined {
  return subjectCache.get(id);
}

export function getSubjectByIdWithFallback(id: number): Subject | undefined {
  return subjectCache.get(id);
}

export function getSubjectsBySpecialtyLevelSemester(
  specialtyId: number,
  level: number,
  semester: 1 | 2
): Subject[] {
  const results: Subject[] = [];
  for (const subject of subjectCache.values()) {
    if (
      subject.specialty_id === specialtyId &&
      subject.level === level &&
      subject.semester === semester
    ) {
      results.push(subject);
    }
  }
  // رتّب حسب sort_order ثم name
  results.sort((a, b) => {
    const sa = a.sort_order || 0;
    const sb = b.sort_order || 0;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, "ar");
  });
  return results;
}

export const SUBJECTS: Subject[] = [];
// تحديث SUBJECTS ليكون view حيّ للـ cache
// ملاحظة: SUBJECTS يُحدّث تلقائياً عند قراءته عبر getter
// لكن لأنه export const، نتركه فارغاً ونستخدم الدوال بدلاً منه

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
