// ============================================
// بيانات الإدارة - Mockup
// ============================================
// ملاحظة: نظام تسجيل الدخول والـ MOCK_ADMINS تم حذفه.
// في الإنتاج، سيتم تطبيق نظام RBAC كامل يعتمد على المناصب.
// ============================================

// ============================================
// المساهمات المعلقة - Mockup
// ============================================
export interface MockContribution {
  id: number;
  file_name: string;
  subject_id: number;
  subject_name: string;
  user_name: string;
  user_telegram_id: number;
  uploaded_at: string;
  file_size_mb: number;
  description?: string;
}

export const MOCK_PENDING_CONTRIBUTIONS: MockContribution[] = [
  {
    id: 1001,
    file_name: "ملخص Python شامل.pdf",
    subject_id: 102,
    subject_name: "برمجة حاسوب (1) - Python",
    user_name: "أحمد العولقي",
    user_telegram_id: 555111222,
    uploaded_at: "قبل ساعة",
    file_size_mb: 0.9,
    description: "ملخص يغطي كل موضوعات Python في الفصل الأول",
  },
  {
    id: 1002,
    file_name: "نموذج اختبار قواعد بيانات.pdf",
    subject_id: 108,
    subject_name: "قواعد البيانات (1)",
    user_name: "سارة الحداد",
    user_telegram_id: 555333444,
    uploaded_at: "قبل 3 ساعات",
    file_size_mb: 0.6,
    description: "نموذج اختبار من العام الماضي مع الحلول",
  },
  {
    id: 1003,
    file_name: "حلول تمارين الخوارزميات.pdf",
    subject_id: 208,
    subject_name: "الخوارزميات",
    user_name: "خالد الشريف",
    user_telegram_id: 555555666,
    uploaded_at: "قبل يوم",
    file_size_mb: 1.2,
    description: "حلول لكل تمارين الكتاب من الفصل 1 إلى 5",
  },
  {
    id: 1004,
    file_name: "ملخص هياكل البيانات.pdf",
    subject_id: 107,
    subject_name: "تراكيب البيانات",
    user_name: "نورة الكثيري",
    user_telegram_id: 555777888,
    uploaded_at: "قبل يومين",
    file_size_mb: 1.5,
    description: "ملخص مرتب ومنظم لكل أنواع هياكل البيانات",
  },
  {
    id: 1005,
    file_name: "شيت مراجعة OOP.pdf",
    subject_id: 201,
    subject_name: "البرمجة الكائنية (OOP)",
    user_name: "محمد باوزير",
    user_telegram_id: 555999000,
    uploaded_at: "قبل 3 أيام",
    file_size_mb: 0.4,
  },
];

// ============================================
// الإحصائيات - Mockup
// ============================================
export const MOCK_STATISTICS = {
  total_users: 1247,
  total_files: 89,
  total_contributions: 142,
  pending_contributions: MOCK_PENDING_CONTRIBUTIONS.length,
  total_downloads: 5432,
  total_broadcasts: 23,
  active_today: 312,
  new_this_week: 47,
};

// ============================================
// التعميمات السابقة - Mockup
// ============================================
export interface MockBroadcast {
  id: number;
  admin_name: string;
  scope: string;
  text: string;
  sent_count: number;
  sent_at: string;
}

export const MOCK_BROADCASTS: MockBroadcast[] = [
  {
    id: 1,
    admin_name: "د. أحمد المركزي",
    scope: "🌍 للجميع",
    text: "مرحباً طلابنا الأعزاء، نعلن عن إطلاق البوت العلمي المركزي...",
    sent_count: 1247,
    sent_at: "قبل يومين",
  },
  {
    id: 2,
    admin_name: "أ. سارة - كلية الحاسبات",
    scope: "🏛 لكلية الحاسبات",
    text: "تنبيه: موعد اختبارات منتصف الفصل القادم...",
    sent_count: 312,
    sent_at: "قبل 4 أيام",
  },
];

// ============================================
// تعريف المنازل الهرمية (للمرحلة 2 - RBAC)
// ============================================
// في الإنتاج، ستُخزّن المناصب في قاعدة البيانات
// وكل منصب يرث صلاحيات المنازل الأدنى منه
export type PositionLevel = "central" | "college" | "level";

export interface Position {
  id: string;
  level: PositionLevel;
  title: string;
  description: string;
  permissions: string[]; // قائمة الصلاحيات الموروثة
  current_holder_telegram_id?: number; // شاغل المنصب الحالي
}

// هيكل المناصب الهرمي (للمرجعية - سيُخزّن في DB في الإنتاج)
export const POSITIONS_HIERARCHY: Omit<Position, "current_holder_telegram_id">[] = [
  {
    id: "central_chair",
    level: "central",
    title: "🛡 رئيس اللجنة العلمية",
    description: "المسؤول الأعلى في النظام — يملك كل الصلاحيات",
    permissions: [
      // يرث كل الصلاحيات
      "manage_admins",
      "manage_colleges",
      "manage_specialties",
      "manage_levels",
      "manage_broadcasts",
      "manage_messages",
      "manage_committee_links",
      "view_reports",
      "system_settings",
      // + صلاحيات مسؤول الكلية
      "manage_subjects",
      "add_subject",
      "edit_subject",
      "delete_subject",
      "move_subject",
      "college_broadcast",
      "manage_level_reps",
      "view_college_stats",
      // + صلاحيات مندوب المستوى
      "level_broadcast",
      "approve_level_contributions",
      "manage_level_files",
      "view_level_stats",
    ],
  },
  {
    id: "college_admin",
    level: "college",
    title: "🏛 مسؤول الكلية",
    description: "يرث صلاحيات مندوب المستوى + صلاحيات الكلية",
    permissions: [
      "manage_subjects",
      "add_subject",
      "edit_subject",
      "delete_subject",
      "move_subject",
      "college_broadcast",
      "manage_level_reps",
      "view_college_stats",
      // + يرث صلاحيات مندوب المستوى
      "level_broadcast",
      "approve_level_contributions",
      "manage_level_files",
      "view_level_stats",
    ],
  },
  {
    id: "level_rep",
    level: "level",
    title: "📊 مندوب المستوى",
    description: "أقل مستوى صلاحيات — نطاق مستوى محدد",
    permissions: [
      "level_broadcast",
      "approve_level_contributions",
      "manage_level_files",
      "view_level_stats",
    ],
  },
];
