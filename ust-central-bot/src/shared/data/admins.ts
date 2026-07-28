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
  // مسؤول دفعة (للتجربة): IT مستوى 1
  {
    id: "level_rep_16_1",
    level: "level",
    title: "📊 مسؤول دفعة - تقنية معلومات (IT) - مستوى 1",
    description: "مسؤول دفعة محددة",
    college_id: 5,
    specialty_id: 16,
    level_num: 1,
  },
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
  // م. خالد = مسؤول كلية الهندسة
  {
    position_id: "college_admin_4",
    user_telegram_id: 1000003,
    assigned_at: "2026-02-01",
    assigned_by: 1000001,
    is_active: true,
  },
  // أ. فاطمة = مسؤولة دفعة IT مستوى 1
  {
    position_id: "level_rep_16_1",
    user_telegram_id: 1000004,
    assigned_at: "2026-02-15",
    assigned_by: 1000002,
    is_active: true,
  },
];

// ============================================
// الصلاحيات (19 صلاحية)
// ============================================
export const MOCK_PERMISSIONS: Permission[] = [
  // مسؤول الدفعة (القاعدة)
  { id: "level_broadcast", name: "نشر إعلانات الدفعة", description: "السماح بنشر تعميمات على دفعة محددة", min_level: "level" },
  { id: "approve_level_contributions", name: "الموافقة/رفض مساهمات الدفعة", description: "مراجعة مساهمات الطلاب", min_level: "level" },
  { id: "manage_level_content", name: "إدارة محتوى الدفعة", description: "رفع/تعديل/نقل/حذف محتوى", min_level: "level" },
  { id: "view_level_stats", name: "عرض إحصائيات الدفعة", description: "الاطلاع على إحصائيات", min_level: "level" },
  // مسؤول الكلية
  { id: "manage_subjects", name: "إدارة المواد", description: "إضافة/تعديل/حذف/نقل المواد", min_level: "college" },
  { id: "college_broadcast", name: "نشر إعلانات الكلية", description: "تعميم على مستوى كلية", min_level: "college" },
  { id: "manage_level_reps", name: "إدارة مسؤولي الدفع", description: "تعيين/إزالة مسؤولي الدفع", min_level: "college" },
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
  // صلاحيات جديدة (للمركزي فقط)
  { id: "manage_honors", name: "إدارة تكريم المساهمين", description: "اعتماد/رفض ترشيحات التكريم + منح تكريم يدوي", min_level: "central" },
  { id: "reset_points", name: "إعادة ضبط النقاط", description: "تصفير نقاط الطلاب (شهري/فصلي/سنوي)", min_level: "central" },
  { id: "view_honors_log", name: "عرض سجل التكريم", description: "الاطلاع على التكريمات السابقة", min_level: "central" },
];

// ============================================
// ربط الصلاحيات بالمستويات (مع الوراثة)
// ============================================
export const MOCK_POSITION_LEVEL_PERMISSIONS: PositionLevelPermission[] = [
  // مسؤول الدفعة
  { position_level: "level", permission_id: "level_broadcast" },
  { position_level: "level", permission_id: "approve_level_contributions" },
  { position_level: "level", permission_id: "manage_level_content" },
  { position_level: "level", permission_id: "view_level_stats" },
  // مسؤول الكلية (يرث الدفعة + صلاحياته)
  { position_level: "college", permission_id: "level_broadcast" },
  { position_level: "college", permission_id: "approve_level_contributions" },
  { position_level: "college", permission_id: "manage_level_content" },
  { position_level: "college", permission_id: "view_level_stats" },
  { position_level: "college", permission_id: "manage_subjects" },
  { position_level: "college", permission_id: "college_broadcast" },
  { position_level: "college", permission_id: "manage_level_reps" },
  { position_level: "college", permission_id: "view_college_stats" },
  // مركزي (يرث الكلية + الدفعة + صلاحياته)
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
  { position_level: "central", permission_id: "manage_honors" },
  { position_level: "central", permission_id: "reset_points" },
  { position_level: "central", permission_id: "view_honors_log" },
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

// ============================================
// بيانات التكريم (Mock)
// ============================================
export interface MockHonor {
  id: number;
  student_telegram_id: number;
  student_name: string;
  honor_type: "top_contributor_specialty" | "top_contributor_college" | "top_contributor_global" | "manual";
  scope_college_id?: number;
  scope_specialty_id?: number;
  honor_title: string;
  honor_period: string;
  points_at_honor: number;
  bonus_points: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  nominated_by_telegram_id?: number;
  approved_by_telegram_id?: number;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export const MOCK_HONORS: MockHonor[] = [
  {
    id: 1,
    student_telegram_id: 555111222,
    student_name: "أحمد العولقي",
    honor_type: "top_contributor_specialty",
    scope_college_id: 5,
    scope_specialty_id: 16,
    honor_title: "🏆 أبرز مساهم في تخصص IT - الفصل الأول 2025-2026",
    honor_period: "الفصل الأول 2025-2026",
    points_at_honor: 145,
    bonus_points: 50,
    status: "pending",
    nominated_by_telegram_id: 1000004, // أ. فاطمة (مسؤولة الدفعة)
    created_at: "2026-07-01",
  },
  {
    id: 2,
    student_telegram_id: 555333444,
    student_name: "سارة الحداد",
    honor_type: "top_contributor_specialty",
    scope_college_id: 5,
    scope_specialty_id: 16,
    honor_title: "🏆 أبرز مساهم في تخصص IT - الفصل الأول 2025-2026",
    honor_period: "الفصل الأول 2025-2026",
    points_at_honor: 132,
    bonus_points: 50,
    status: "pending",
    nominated_by_telegram_id: 1000004,
    created_at: "2026-07-01",
  },
  {
    id: 3,
    student_telegram_id: 555555666,
    student_name: "خالد الشريف",
    honor_type: "top_contributor_college",
    scope_college_id: 4,
    honor_title: "🏆 أبرز مساهم في كلية الهندسة - الفصل الأول 2025-2026",
    honor_period: "الفصل الأول 2025-2026",
    points_at_honor: 110,
    bonus_points: 30,
    status: "approved",
    approved_by_telegram_id: 1000001,
    approved_at: "2026-07-10",
    created_at: "2026-07-05",
  },
];

// ============================================
// بيانات إشعارات الطلاب (Mock)
// ============================================
export interface MockStudentNotification {
  id: number;
  student_telegram_id: number;
  notification_type: "contribution_approved" | "contribution_rejected" | "contribution_starred" | "honor_awarded" | "points_reset" | "broadcast" | "general";
  title: string;
  body: string;
  related_entity_type?: string;
  related_entity_id?: number;
  is_read: boolean;
  created_at: string;
}

export const MOCK_STUDENT_NOTIFICATIONS: MockStudentNotification[] = [
  {
    id: 1,
    student_telegram_id: 555111222,
    notification_type: "contribution_approved",
    title: "✅ تم اعتماد مساهمتك!",
    body: "تمت الموافقة على مساهمتك 'ملخص Python شامل.pdf' ومنحك 10 نقاط. شكراً لإثرائك المحتوى!",
    related_entity_type: "contribution",
    related_entity_id: 9901,
    is_read: false,
    created_at: "قبل يوم",
  },
  {
    id: 2,
    student_telegram_id: 555111222,
    notification_type: "broadcast",
    title: "📢 تعميم من مسؤول الدفعة",
    body: "نذكّر الطلاب بموعد اختبار منتصف الفصل يوم الأحد القادم.",
    is_read: false,
    created_at: "قبل 3 ساعات",
  },
];

// ============================================
// طلاب Mock (للإحصائيات والتكريم)
// ============================================
export interface MockStudent {
  telegram_id: number;
  first_name: string;
  total_points: number;
  accepted_contributions: number;
  specialty_id?: number;
  college_id?: number;
}

export const MOCK_STUDENTS: MockStudent[] = [
  { telegram_id: 555111222, first_name: "أحمد العولقي", total_points: 145, accepted_contributions: 12, specialty_id: 16, college_id: 5 },
  { telegram_id: 555333444, first_name: "سارة الحداد", total_points: 132, accepted_contributions: 11, specialty_id: 16, college_id: 5 },
  { telegram_id: 555555666, first_name: "خالد الشريف", total_points: 110, accepted_contributions: 9, college_id: 4 },
  { telegram_id: 555777888, first_name: "نورة الكثيري", total_points: 85, accepted_contributions: 7, specialty_id: 16, college_id: 5 },
  { telegram_id: 555999000, first_name: "محمد باوزير", total_points: 72, accepted_contributions: 6, specialty_id: 16, college_id: 5 },
];

// ============================================
// 100 طالب وهمي (للاختبار الواقعي للتعاميم)
// ============================================
const FIRST_NAMES = [
  "أحمد", "محمد", "عبدالله", "يوسف", "خالد", "عمر", "سعد", "فهد", "إبراهيم", "ناصر",
  "سارة", "فاطمة", "نورة", "ريم", "هند", "العنود", "مها", "لمى", "دلال", "أمل",
  "عبدالرحمن", "ماجد", "تركي", "بدر", "نايف", "سلطان", "فaisal", "غانم", "زياد", "هاني",
  "ابتسام", "أسماء", "جواهر", "روان", "شهد", "عالية", "لميس", "مريم", "نوف", "وفاء",
  "أنس", "بلال", "ثامر", "حمد", "خالد", "روان", "سلمان", "طاهر", "عادل", "غسان",
  "ليلى", "مونية", "نادية", "هبة", "إيمان", "بشرى", "جنان", "خديجة", "رنا", "سمية",
  "وليد", "ياسر", "زاهر", "ناصر", "هشام", "كريم", "لؤي", "مازن", "نزار", "وسيم",
  "آلاء", "بسمة", "تالا", "جنى", "حلا", "ربى", "سجا", "ضحى", "عفراء", "قمر",
  "إياد", "بسام", "تامر", "جمال", "حاتم", "ربيع", "سامي", "صابر", "عاصم", "غيث",
  "ميس", "نور", "هارون", "وسن", "يارا", "آية", "بشير", "حسام", "ربيع", "سحاب"
];

const LAST_NAMES = [
  "العولقي", "الحداد", "الشريف", "الكثيري", "باوزير", "الجندي", "السقاف", "العزي",
  "الحبشي", "الأهدل", "المخلافي", "الزرقة", "بامحمود", "الصبري", "الحيمد", "الشعبي",
  "البطاطي", "العمراني", "الصالح", "الحمادي"
];

// توليد 100 طالب وهمي بشكل ثابت (لا Math.random)
function generateMockStudents(): MockStudent[] {
  const students: MockStudent[] = [];
  // توزيع الطلاب على الكليات والتخصصات والمستويات
  const distribution = [
    { college_id: 5, specialty_id: 16, count: 25 }, // IT (الأكثر)
    { college_id: 5, specialty_id: 18, count: 12 }, // AI
    { college_id: 5, specialty_id: 19, count: 10 }, // الأمن السيبراني
    { college_id: 4, specialty_id: 10, count: 8 },  // مدنية
    { college_id: 4, specialty_id: 12, count: 7 },  // حاسوب وأنظمة
    { college_id: 1, specialty_id: 1, count: 8 },   // طب
    { college_id: 2, specialty_id: 5, count: 6 },   // أسنان
    { college_id: 3, specialty_id: 6, count: 8 },   // صيدلة
    { college_id: 6, specialty_id: 23, count: 9 },  // إدارة أعمال
    { college_id: 7, specialty_id: 28, count: 7 },  // ترجمة
  ];

  let id = 600000000;
  let nameIdx = 0;
  for (const dist of distribution) {
    for (let i = 0; i < dist.count; i++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(nameIdx * 3) % LAST_NAMES.length];
      const level = (i % 4) + 1; // مستويات 1-4
      students.push({
        telegram_id: id++,
        first_name: `${firstName} ${lastName}`,
        total_points: (i * 7) % 50,
        accepted_contributions: (i * 3) % 8,
        specialty_id: dist.specialty_id,
        college_id: dist.college_id,
      });
      nameIdx++;
    }
  }
  return students;
}

// إضافة الـ 100 طالب للقائمة الموجودة (5 طلاب أساسيين + 100 = 105)
export const ALL_MOCK_STUDENTS: MockStudent[] = [
  ...MOCK_STUDENTS,
  ...generateMockStudents(),
];

// ============================================
// الاشتراكات (مشتقة من بيانات الطلاب)
// ============================================
export interface MockSubscription {
  student_telegram_id: number;
  scope_type: "level";
  scope_college_id: number;
  scope_specialty_id: number;
  scope_level: number;
  is_active: boolean;
}

export const MOCK_SUBSCRIPTIONS: MockSubscription[] = ALL_MOCK_STUDENTS.map((s) => ({
  student_telegram_id: s.telegram_id,
  scope_type: "level" as const,
  scope_college_id: s.college_id!,
  scope_specialty_id: s.specialty_id!,
  scope_level: ((s.telegram_id % 4) + 1), // مستوى 1-4
  is_active: true,
}));

// ============================================
// Function: الحصول على مستلمي التعميم
// ============================================
export function getBroadcastRecipients(scope: {
  scope_type: "all" | "college" | "specialty" | "level";
  scope_college_id?: number;
  scope_specialty_id?: number;
  scope_level?: number;
}): number[] {
  if (scope.scope_type === "all") {
    return ALL_MOCK_STUDENTS.map((s) => s.telegram_id);
  }
  return MOCK_SUBSCRIPTIONS
    .filter((sub) => {
      if (!sub.is_active) return false;
      if (scope.scope_type === "college") {
        return sub.scope_college_id === scope.scope_college_id;
      }
      if (scope.scope_type === "specialty") {
        return (
          sub.scope_college_id === scope.scope_college_id &&
          sub.scope_specialty_id === scope.scope_specialty_id
        );
      }
      if (scope.scope_type === "level") {
        return (
          sub.scope_college_id === scope.scope_college_id &&
          sub.scope_specialty_id === scope.scope_specialty_id &&
          sub.scope_level === scope.scope_level
        );
      }
      return false;
    })
    .map((sub) => sub.student_telegram_id);
}

// ============================================
// Function: عدد المسجلين حسب النطاق
// ============================================
export function getStudentCountByScope(scope: {
  scope_type: "all" | "college" | "specialty" | "level";
  scope_college_id?: number;
  scope_specialty_id?: number;
  scope_level?: number;
}): number {
  return getBroadcastRecipients(scope).length;
}

export function getTopContributors(specialtyId?: number, collegeId?: number, limit = 5): MockStudent[] {
  let students = [...MOCK_STUDENTS];
  if (specialtyId) {
    students = students.filter((s) => s.specialty_id === specialtyId);
  } else if (collegeId) {
    students = students.filter((s) => s.college_id === collegeId);
  }
  return students.sort((a, b) => b.total_points - a.total_points).slice(0, limit);
}
