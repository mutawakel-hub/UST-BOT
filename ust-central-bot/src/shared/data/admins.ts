// ============================================
// المسؤولون التجريبيون - Mockup
// 4 IDs تجريبية بأدوار مختلفة لاختبار هرمية الصلاحيات
// ============================================

export type AdminRole = "central" | "college" | "specialty" | "level";

export interface MockAdmin {
  id: string; // معرّف تسجيل الدخول التجريبي
  telegram_id: number;
  name: string;
  role: AdminRole;
  college_id?: number;
  specialty_id?: number;
  level?: number;
}

// 4 مسؤولين تجريبيين - كل واحد بدور مختلف لاختبار الهرمية
export const MOCK_ADMINS: MockAdmin[] = [
  {
    id: "DEMO001",
    telegram_id: 100000001,
    name: "د. أحمد المركزي",
    role: "central",
  },
  {
    id: "DEMO002",
    telegram_id: 100000002,
    name: "أ. سارة - كلية الحاسبات",
    role: "college",
    college_id: 5,
  },
  {
    id: "DEMO003",
    telegram_id: 100000003,
    name: "م. محمد - IT",
    role: "specialty",
    college_id: 5,
    specialty_id: 16,
  },
  {
    id: "DEMO004",
    telegram_id: 100000004,
    name: "أ. فاطمة - IT مستوى 1",
    role: "level",
    college_id: 5,
    specialty_id: 16,
    level: 1,
  },
];

// مساعدات
export function getAdminByLoginId(loginId: string): MockAdmin | undefined {
  return MOCK_ADMINS.find((a) => a.id.toLowerCase() === loginId.toLowerCase());
}

export function getRoleLabel(role: AdminRole): string {
  const labels: Record<AdminRole, string> = {
    central: "🛡 مسؤول مركزي",
    college: "🏛 مسؤول كلية",
    specialty: "📚 مسؤول تخصص",
    level: "📊 مسؤول مستوى",
  };
  return labels[role];
}

export function getRoleScope(admin: MockAdmin): string {
  switch (admin.role) {
    case "central":
      return "🌍 جميع الكليات والتخصصات";
    case "college":
      return `🏛 كلية محددة`;
    case "specialty":
      return `📚 تخصص محدد`;
    case "level":
      return `📊 مستوى محدد`;
  }
}

// المساهمات المعلقة - Mockup
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

// الإحصائيات - Mockup (قيم ثابتة بدل Math.random)
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

// التعميمات السابقة - Mockup
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
