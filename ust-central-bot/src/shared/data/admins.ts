// ============================================
// بيانات الإدارة - Mockup (RBAC System)
// ============================================
// محاكاة كاملة لنظام RBAC قبل ربط Supabase.
// كل البيانات هنا تتطابق مع db/schema.sql.
// ============================================

import { COLLEGES, SPECIALTIES } from "./colleges";

// ============================================
// الأنواع
// ============================================
export type PositionLevel = "central" | "college" | "level";

export interface MockPosition {
  id: string;
  level: PositionLevel;
  title: string;
  description: string;
  college_id?: number;
  specialty_id?: number;
  level_num?: number;
  is_central?: boolean;
}

export interface MockPositionHolder {
  position_id: string;
  user_telegram_id: number;
  assigned_at: string;
  assigned_by?: number;
  is_active: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  min_level: PositionLevel;
}

export interface PositionLevelPermission {
  position_level: PositionLevel;
  permission_id: string;
}

export interface MockContent {
  id: number;
  subject_id: number;
  specialty_id: number;
  college_id: number;
  level: number;
  semester: 1 | 2;
  content_type: string;
  title: string;
  file_name: string;
  file_size_mb: number;
  telegram_message_id?: number;
  telegram_file_id?: string;
  added_by_position_id: string;
  added_by_telegram_id: number;
  added_at: string;
  last_modified_at?: string;
  last_modified_by?: number;
  is_starred: boolean;
  download_count: number;
  is_active: boolean;
  academic_year: string;
}

export interface MockContribution {
  id: number;
  file_name: string;
  subject_id: number;
  subject_name: string;
  specialty_id: number;
  college_id: number;
  level: number;
  user_name: string;
  user_telegram_id: number;
  uploaded_at: string;
  file_size_mb: number;
  description?: string;
  content_type: string;
}

export interface MockCommitteeChannel {
  id: number;
  scope_type: "central" | "college" | "specialty_level";
  college_id?: number;
  specialty_id?: number;
  level_num?: number;
  channel_url: string;
  channel_id?: string;
  display_name: string;
  is_active: boolean;
  updated_at?: string;
  updated_by_position_id?: string;
}

// ============================================
// المناصب (8 مناصب)
// ============================================
export const MOCK_POSITIONS: MockPosition[] = [
  {
    id: "central_chair",
    level: "central",
    title: "🛡 رئيس اللجنة العلمية المركزية",
    description: "المسؤول الأعلى في النظام — يملك كل الصلاحيات",
    is_central: true,
  },
  // مسؤولو الكليات السبع
  ...COLLEGES.map((c) => ({
    id: `college_admin_${c.id}`,
    level: "college" as PositionLevel,
    title: `🏛 مسؤول ${c.name}`,
    description: `مسؤول كلية ${c.short_name}`,
    college_id: c.id,
  })),
];

// ============================================
// المستخدمون (المسؤولون)
// ============================================
export interface MockAdminUser {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export const MOCK_ADMIN_USERS: MockAdminUser[] = [
  { telegram_id: 1000001, first_name: "د. أحمد", username: "ahmed_central" },
  { telegram_id: 1000002, first_name: "أ. سارة", username: "sara_cs" },
  { telegram_id: 1000003, first_name: "م. خالد", username: "khaled_it" },
  { telegram_id: 1000004, first_name: "أ. فاطمة", username: "fatima_l1" },
  { telegram_id: 1000005, first_name: "د. محمد", username: "mohammed_med" },
];

// ============================================
// ربط المناصب بالمستخدمين (شاغلو المناصب)
// ============================================
export const MOCK_POSITION_HOLDERS: MockPositionHolder[] = [
  // د. أحمد = رئيس اللجنة المركزية
  {
    position_id: "central_chair",
    user_telegram_id: 1000001,
    assigned_at: "2026-01-01",
    is_active: true,
  },
  // أ. سارة = مسؤولة كلية الحاسبات
  {
    position_id: "college_admin_5",
    user_telegram_id: 1000002,
    assigned_at: "2026-01-05",
    assigned_by: 1000001,
    is_active: true,
  },
  // د. محمد = مسؤول كلية الطب
  {
    position_id: "college_admin_1",
    user_telegram_id: 1000005,
    assigned_at: "2026-01-06",
    assigned_by: 1000001,
    is_active: true,
  },
  // (لتجربة المناصب المتعددة: م. خالد = مسؤول كلية الهندسة أيضاً)
  {
    position_id: "college_admin_4",
    user_telegram_id: 1000003,
    assigned_at: "2026-02-01",
    assigned_by: 1000001,
    is_active: true,
  },
];

// ============================================
// الصلاحيات (16 صلاحية)
// ============================================
export const MOCK_PERMISSIONS: Permission[] = [
  // مندوب المستوى
  { id: "level_broadcast", name: "نشر إعلانات المستوى", description: "السماح بنشر تعميمات على مستوى محدد", min_level: "level" },
  { id: "approve_level_contributions", name: "الموافقة/رفض مساهمات المستوى", description: "مراجعة مساهمات الطلاب", min_level: "level" },
  { id: "manage_level_content", name: "إدارة محتوى المستوى", description: "رفع/تعديل/نقل/حذف محتوى", min_level: "level" },
  { id: "view_level_stats", name: "عرض إحصائيات المستوى", description: "الاطلاع على إحصائيات", min_level: "level" },
  // مسؤول الكلية
  { id: "manage_subjects", name: "إدارة المواد", description: "إضافة/تعديل/حذف/نقل المواد", min_level: "college" },
  { id: "college_broadcast", name: "نشر إعلانات الكلية", description: "تعميم على مستوى كلية", min_level: "college" },
  { id: "manage_level_reps", name: "إدارة مندوبي المستويات", description: "تعيين/إزالة مندوبي المستويات", min_level: "college" },
  { id: "view_college_stats", name: "عرض إحصائيات الكلية", description: "الاطلاع على إحصائيات كلية", min_level: "college" },
  // مركزي
  { id: "manage_admins", name: "إدارة المناصب", description: "تعيين/إزالة شاغلي المناصب", min_level: "central" },
  { id: "manage_colleges", name: "إدارة الكليات", description: "إضافة/تعديل الكليات", min_level: "central" },
  { id: "manage_specialties", name: "إدارة التخصصات", description: "إضافة/تعديل التخصصات", min_level: "central" },
  { id: "manage_committee_channels", name: "إدارة روابط اللجان العلمية", description: "تحديث روابط القنوات", min_level: "central" },
  { id: "view_central_stats", name: "عرض الإحصائيات الشاملة", description: "الاطلاع على كل الإحصائيات", min_level: "central" },
  { id: "view_reports", name: "عرض التقارير", description: "تقارير الأداء والنشاط", min_level: "central" },
  { id: "system_settings", name: "إعدادات النظام", description: "تخصيص النصوص والإعدادات", min_level: "central" },
  { id: "central_broadcast", name: "نشر تعميمات شاملة", description: "تعميم على كل الطلاب", min_level: "central" },
];

// ============================================
// ربط الصلاحيات بالمستويات (مع الوراثة)
// ============================================
export const MOCK_POSITION_LEVEL_PERMISSIONS: PositionLevelPermission[] = [
  // مندوب المستوى
  { position_level: "level", permission_id: "level_broadcast" },
  { position_level: "level", permission_id: "approve_level_contributions" },
  { position_level: "level", permission_id: "manage_level_content" },
  { position_level: "level", permission_id: "view_level_stats" },
  // مسؤول الكلية (يرث المستوى + صلاحياته)
  { position_level: "college", permission_id: "level_broadcast" },
  { position_level: "college", permission_id: "approve_level_contributions" },
  { position_level: "college", permission_id: "manage_level_content" },
  { position_level: "college", permission_id: "view_level_stats" },
  { position_level: "college", permission_id: "manage_subjects" },
  { position_level: "college", permission_id: "college_broadcast" },
  { position_level: "college", permission_id: "manage_level_reps" },
  { position_level: "college", permission_id: "view_college_stats" },
  // مركزي (يرث الكلية + المستوى + صلاحياته)
  { position_level: "central", permission_id: "level_broadcast" },
  { position_level: "central", permission_id: "approve_level_contributions" },
  { position_level: "central", permission_id: "manage_level_content" },
  { position_level: "central", permission_id: "view_level_stats" },
  { position_level: "central", permission_id: "manage_subjects" },
  { position_level: "central", permission_id: "college_broadcast" },
  { position_level: "central", permission_id: "manage_level_reps" },
  { position_level: "central", permission_id: "view_college_stats" },
  { position_level: "central", permission_id: "manage_admins" },
  { position_level: "central", permission_id: "manage_colleges" },
  { position_level: "central", permission_id: "manage_specialties" },
  { position_level: "central", permission_id: "manage_committee_channels" },
  { position_level: "central", permission_id: "view_central_stats" },
  { position_level: "central", permission_id: "view_reports" },
  { position_level: "central", permission_id: "system_settings" },
  { position_level: "central", permission_id: "central_broadcast" },
];

// ============================================
// أنواع المحتوى (6 أنواع)
// ============================================
export const CONTENT_TYPES = [
  { id: "book_theory",    name: "المقرر النظري",   emoji: "📘", sort_order: 1 },
  { id: "book_practical", name: "المقرر العملي",   emoji: "📗", sort_order: 2 },
  { id: "exam",           name: "نماذج اختبارات",  emoji: "📑", sort_order: 3 },
  { id: "summary",        name: "ملخصات",          emoji: "📝", sort_order: 4 },
  { id: "video",          name: "مرئيات",          emoji: "🎥", sort_order: 5 },
  { id: "reference",      name: "مراجع",           emoji: "📚", sort_order: 6 },
];

export function getContentTypeLabel(typeId: string): string {
  const t = CONTENT_TYPES.find((c) => c.id === typeId);
  return t ? `${t.emoji} ${t.name}` : typeId;
}

export function getContentTypeEmoji(typeId: string): string {
  return CONTENT_TYPES.find((c) => c.id === typeId)?.emoji || "📄";
}

// ============================================
// المحتوى الوهمي (Mock Content)
// ============================================
export const MOCK_CONTENT: MockContent[] = [
  // مقدمة في تقنية المعلومات
  {
    id: 1, subject_id: 101, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "book_theory", title: "مقدمة في تقنية المعلومات - المقرر النظري",
    file_name: "intro_it_theory.pdf", file_size_mb: 4.2,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-15", is_starred: true, download_count: 142,
    is_active: true, academic_year: "2025-2026",
  },
  {
    id: 2, subject_id: 101, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "book_practical", title: "مقدمة في تقنية المعلومات - دليل العملي",
    file_name: "intro_it_practical.pdf", file_size_mb: 1.8,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-16", is_starred: false, download_count: 67,
    is_active: true, academic_year: "2025-2026",
  },
  {
    id: 3, subject_id: 101, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "exam", title: "اختبار منتصف الفصل 1445",
    file_name: "intro_it_midterm.pdf", file_size_mb: 0.5,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-20", is_starred: false, download_count: 234,
    is_active: true, academic_year: "2025-2026",
  },
  // برمجة Python
  {
    id: 4, subject_id: 102, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "book_theory", title: "برمجة Python - المقرر النظري",
    file_name: "python_theory.pdf", file_size_mb: 5.1,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-15", is_starred: true, download_count: 312,
    is_active: true, academic_year: "2025-2026",
  },
  {
    id: 5, subject_id: 102, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "summary", title: "ملخص Python شامل",
    file_name: "python_summary.pdf", file_size_mb: 0.9,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-18", is_starred: false, download_count: 156,
    is_active: true, academic_year: "2025-2026",
  },
  {
    id: 6, subject_id: 102, specialty_id: 16, college_id: 5, level: 1, semester: 1,
    content_type: "video", title: "شرح أساسيات Python",
    file_name: "python_video_intro.mp4", file_size_mb: 45.2,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-01-22", is_starred: false, download_count: 89,
    is_active: true, academic_year: "2025-2026",
  },
  // قواعد البيانات
  {
    id: 7, subject_id: 108, specialty_id: 16, college_id: 5, level: 1, semester: 2,
    content_type: "book_theory", title: "قواعد البيانات (1) - المقرر",
    file_name: "db_theory.pdf", file_size_mb: 3.8,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-02-10", is_starred: true, download_count: 198,
    is_active: true, academic_year: "2025-2026",
  },
  {
    id: 8, subject_id: 108, specialty_id: 16, college_id: 5, level: 1, semester: 2,
    content_type: "exam", title: "اختبار نهائي قواعد بيانات 1444",
    file_name: "db_final.pdf", file_size_mb: 0.6,
    added_by_position_id: "college_admin_5", added_by_telegram_id: 1000002,
    added_at: "2026-02-15", is_starred: false, download_count: 287,
    is_active: true, academic_year: "2025-2026",
  },
];

// ============================================
// المساهمات المعلقة
// ============================================
export const MOCK_PENDING_CONTRIBUTIONS: MockContribution[] = [
  {
    id: 1001,
    file_name: "ملخص Python شامل.pdf",
    subject_id: 102,
    subject_name: "برمجة حاسوب (1) - Python",
    specialty_id: 16,
    college_id: 5,
    level: 1,
    user_name: "أحمد العولقي",
    user_telegram_id: 555111222,
    uploaded_at: "قبل ساعة",
    file_size_mb: 0.9,
    description: "ملخص يغطي كل موضوعات Python في الفصل الأول",
    content_type: "summary",
  },
  {
    id: 1002,
    file_name: "نموذج اختبار قواعد بيانات.pdf",
    subject_id: 108,
    subject_name: "قواعد البيانات (1)",
    specialty_id: 16,
    college_id: 5,
    level: 1,
    user_name: "سارة الحداد",
    user_telegram_id: 555333444,
    uploaded_at: "قبل 3 ساعات",
    file_size_mb: 0.6,
    description: "نموذج اختبار من العام الماضي مع الحلول",
    content_type: "exam",
  },
  {
    id: 1003,
    file_name: "حلول تمارين الخوارزميات.pdf",
    subject_id: 208,
    subject_name: "الخوارزميات",
    specialty_id: 16,
    college_id: 5,
    level: 2,
    user_name: "خالد الشريف",
    user_telegram_id: 555555666,
    uploaded_at: "قبل يوم",
    file_size_mb: 1.2,
    description: "حلول لكل تمارين الكتاب من الفصل 1 إلى 5",
    content_type: "summary",
  },
];

// ============================================
// روابط قنوات اللجان العلمية (Mock)
// ============================================
export const MOCK_COMMITTEE_CHANNELS: MockCommitteeChannel[] = [
  // المركزية
  {
    id: 1,
    scope_type: "central",
    channel_url: "https://t.me/+ust_central_committee",
    display_name: "📢 اللجنة العلمية المركزية",
    is_active: true,
  },
  // كليات (7 قنوات)
  ...COLLEGES.map((c, i) => ({
    id: i + 2,
    scope_type: "college" as const,
    college_id: c.id,
    channel_url: `https://t.me/+ust_${c.id}_committee`,
    display_name: `🏛 قناة اللجنة العلمية - ${c.short_name}`,
    is_active: true,
  })),
  // مثال: مستوى محدد (IT مستوى 1)
  {
    id: 10,
    scope_type: "specialty_level",
    college_id: 5,
    specialty_id: 16,
    level_num: 1,
    channel_url: "https://t.me/+ust_it_level1",
    display_name: "📊 قناة اللجنة العلمية - تقنية معلومات (IT) - مستوى 1",
    is_active: true,
  },
];

// ============================================
// الإحصائيات (Mock)
// ============================================
export const MOCK_STATISTICS = {
  total_users: 1247,
  total_files: MOCK_CONTENT.length,
  total_contributions: 142,
  pending_contributions: MOCK_PENDING_CONTRIBUTIONS.length,
  total_downloads: 5432,
  total_broadcasts: 23,
  active_today: 312,
  new_this_week: 47,
};

// ============================================
// دوال مساعدة
// ============================================
export function getMockContentById(id: number): MockContent | undefined {
  return MOCK_CONTENT.find((c) => c.id === id);
}

export function getMockContributionById(id: number): MockContribution | undefined {
  return MOCK_PENDING_CONTRIBUTIONS.find((c) => c.id === id);
}

export function getMockPositionById(id: string): MockPosition | undefined {
  return MOCK_POSITIONS.find((p) => p.id === id);
}

export function getMockAdminUser(telegramId: number): MockAdminUser | undefined {
  return MOCK_ADMIN_USERS.find((u) => u.telegram_id === telegramId);
}

// مساعد: الحصول على اسم المادة من subject_id
export function getSubjectNameById(subjectId: number): string {
  // سيُستبدل لاحقاً باستعلام من SUBJECTS
  const names: Record<number, string> = {
    101: "مقدمة في تقنية المعلومات",
    102: "برمجة حاسوب (1) - Python",
    108: "قواعد البيانات (1)",
    208: "الخوارزميات",
  };
  return names[subjectId] || "مادة غير معروفة";
}
