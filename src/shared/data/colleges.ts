// ============================================
// بيانات الكليات السبع والتخصصات الـ 34
// جامعة العلوم والتكنولوجيا - اليمن
// ============================================
// ملاحظة: levels_count يُستخدم داخلياً فقط لتوليد أزرار المستويات
//          ولا يُعرض للمستخدم في أي شاشة
// ============================================

export interface Specialty {
  id: number;
  college_id: number;
  name: string;
  short_name: string;
  levels_count: number; // داخلي فقط - لتوليد أزرار المستويات
}

export interface College {
  id: number;
  name: string;
  short_name: string;
  emoji: string;
  committee_channel_url: string;
  storage_channel_id: string | null; // معرّف قناة التخزين (Telegram) - null لو لم تُنشأ
  display_order: number;
  is_active?: boolean;
  created_at?: string;
}

// ============================================
// الكليات السبع
// ============================================
export const COLLEGES: College[] = [
  {
    id: 1,
    name: "كلية الطب والعلوم الصحية",
    short_name: "الطب والعلوم الصحية",
    emoji: "🏥",
    committee_channel_url: "https://t.me/+med_committee",
    storage_channel_id: "-1004405014472", // ✅ قناة تخزين فعلية
    display_order: 1,
  },
  {
    id: 2,
    name: "كلية طب الأسنان",
    short_name: "طب الأسنان",
    emoji: "🦷",
    committee_channel_url: "https://t.me/+dent_committee",
    storage_channel_id: null, // لم تُنشأ بعد
    display_order: 2,
  },
  {
    id: 3,
    name: "كلية الصيدلة",
    short_name: "الصيدلة",
    emoji: "💊",
    committee_channel_url: "https://t.me/+pharm_committee",
    storage_channel_id: null,
    display_order: 3,
  },
  {
    id: 4,
    name: "كلية الهندسة",
    short_name: "الهندسة",
    emoji: "⚙️",
    committee_channel_url: "https://t.me/+eng_committee",
    storage_channel_id: null,
    display_order: 4,
  },
  {
    id: 5,
    name: "كلية الحاسبات وتكنولوجيا المعلومات",
    short_name: "الحاسبات وتكنولوجيا المعلومات",
    emoji: "💻",
    committee_channel_url: "https://t.me/+it_committee",
    storage_channel_id: "-1003727164402", // ✅ قناة تخزين فعلية
    display_order: 5,
  },
  {
    id: 6,
    name: "كلية العلوم الإدارية",
    short_name: "العلوم الإدارية",
    emoji: "📊",
    committee_channel_url: "https://t.me/+admin_committee",
    storage_channel_id: null,
    display_order: 6,
  },
  {
    id: 7,
    name: "كلية العلوم الإنسانية والاجتماعية",
    short_name: "العلوم الإنسانية والاجتماعية",
    emoji: "📚",
    committee_channel_url: "https://t.me/+human_committee",
    storage_channel_id: null,
    display_order: 7,
  },
];

// ============================================
// التخصصات الـ 34
// ============================================
export const SPECIALTIES: Specialty[] = [
  // ====== كلية الطب والعلوم الصحية (4 تخصصات) ======
  { id: 1, college_id: 1, name: "طب وجراحة", short_name: "طب وجراحة", levels_count: 6 },
  { id: 2, college_id: 1, name: "تكنولوجيا الأشعة التشخيصية", short_name: "الأشعة التشخيصية", levels_count: 4 },
  { id: 3, college_id: 1, name: "تغذية علاجية وحميات", short_name: "التغذية العلاجية", levels_count: 4 },
  { id: 4, college_id: 1, name: "الطب المخبري", short_name: "الطب المخبري", levels_count: 4 },

  // ====== كلية طب الأسنان (1 تخصص) ======
  { id: 5, college_id: 2, name: "طب وجراحة الفم والأسنان", short_name: "طب الفم والأسنان", levels_count: 5 },

  // ====== كلية الصيدلة (2 تخصص) ======
  { id: 6, college_id: 3, name: "دكتور صيدلة", short_name: "دكتور صيدلة", levels_count: 6 },
  { id: 7, college_id: 3, name: "صيدلة", short_name: "صيدلة", levels_count: 5 },

  // ====== كلية الهندسة (7 تخصصات) ======
  { id: 8, college_id: 4, name: "هندسة الميكاترونكس", short_name: "الميكاترونكس", levels_count: 5 },
  { id: 9, college_id: 4, name: "هندسة طبية حيوية", short_name: "الهندسة الطبية الحيوية", levels_count: 5 },
  { id: 10, college_id: 4, name: "هندسة مدنية", short_name: "الهندسة المدنية", levels_count: 5 },
  { id: 11, college_id: 4, name: "هندسة معمارية - هندسة التصميم الداخلي", short_name: "الهندسة المعمارية", levels_count: 5 },
  { id: 12, college_id: 4, name: "هندسة الحاسوب والأنظمة الذكية", short_name: "هندسة الحاسوب والأنظمة الذكية", levels_count: 5 },
  { id: 13, college_id: 4, name: "هندسة الاتصالات والمعلوماتية", short_name: "هندسة الاتصالات والمعلوماتية", levels_count: 5 },
  { id: 14, college_id: 4, name: "هندسة الطاقة المتجددة والتحكم الآلي", short_name: "هندسة الطاقة المتجددة", levels_count: 5 },

  // ====== كلية الحاسبات وتكنولوجيا المعلومات (8 تخصصات) ======
  { id: 15, college_id: 5, name: "تقنية معلومات باللغة الإنجليزية (BIT)", short_name: "تقنية معلومات (BIT)", levels_count: 4 },
  { id: 16, college_id: 5, name: "تقنية معلومات (IT)", short_name: "تقنية معلومات (IT)", levels_count: 4 },
  { id: 17, college_id: 5, name: "جرافكس وإعلام رقمي", short_name: "الجرافكس والإعلام الرقمي", levels_count: 4 },
  { id: 18, college_id: 5, name: "الذكاء الاصطناعي", short_name: "الذكاء الاصطناعي", levels_count: 4 },
  { id: 19, college_id: 5, name: "الأمن السيبراني والشبكات", short_name: "الأمن السيبراني والشبكات", levels_count: 4 },
  { id: 20, college_id: 5, name: "هندسة البرمجيات", short_name: "هندسة البرمجيات", levels_count: 4 },
  { id: 21, college_id: 5, name: "أعمال إلكترونية", short_name: "الأعمال الإلكترونية", levels_count: 4 },
  { id: 22, college_id: 5, name: "ذكاء الأعمال - نظم المعلومات الإدارية", short_name: "ذكاء الأعمال (MIS)", levels_count: 4 },

  // ====== كلية العلوم الإدارية (5 تخصصات) ======
  { id: 23, college_id: 6, name: "إدارة أعمال باللغة الإنجليزية", short_name: "إدارة أعمال (EN)", levels_count: 4 },
  { id: 24, college_id: 6, name: "إدارة أعمال دولية - إدارة أعمال", short_name: "إدارة الأعمال الدولية", levels_count: 4 },
  { id: 25, college_id: 6, name: "التسويق الرقمي", short_name: "التسويق الرقمي", levels_count: 4 },
  { id: 26, college_id: 6, name: "محاسبة - علوم مالية ومصرفية", short_name: "المحاسبة والعلوم المالية", levels_count: 4 },
  { id: 27, college_id: 6, name: "إدارة أعمال دولية باللغة الإنجليزية", short_name: "إدارة أعمال دولية (EN)", levels_count: 4 },

  // ====== كلية العلوم الإنسانية والاجتماعية (7 تخصصات) ======
  { id: 28, college_id: 7, name: "لغة إنجليزية - ترجمة", short_name: "اللغة الإنجليزية - ترجمة", levels_count: 4 },
  { id: 29, college_id: 7, name: "لغة إنجليزية - لغويات تطبيقية", short_name: "اللغة الإنجليزية - لغويات تطبيقية", levels_count: 4 },
  { id: 30, college_id: 7, name: "العلاقات العامة والإعلان", short_name: "العلاقات العامة والإعلان", levels_count: 4 },
  { id: 31, college_id: 7, name: "إذاعة وتلفزيون", short_name: "الإذاعة والتلفزيون", levels_count: 4 },
  { id: 32, college_id: 7, name: "علم النفس", short_name: "علم النفس", levels_count: 4 },
  { id: 33, college_id: 7, name: "شريعة وقانون", short_name: "الشريعة والقانون", levels_count: 4 },
  { id: 34, college_id: 7, name: "دراسات إسلامية - لغة عربية - علوم قرآن", short_name: "الدراسات الإسلامية واللغة العربية", levels_count: 4 },
];

// ============================================
// دوال مساعدة للاستعلام
// ============================================
export function getCollegeById(id: number): College | undefined {
  return COLLEGES.find((c) => c.id === id);
}

export function getSpecialtiesByCollege(collegeId: number): Specialty[] {
  return SPECIALTIES.filter((s) => s.college_id === collegeId);
}

export function getSpecialtyById(id: number): Specialty | undefined {
  return SPECIALTIES.find((s) => s.id === id);
}

export function getLevelsForSpecialty(specialtyId: number): number[] {
  const spec = getSpecialtyById(specialtyId);
  if (!spec) return [];
  return Array.from({ length: spec.levels_count }, (_, i) => i + 1);
}

// ============================================
// توليد مسار التنقّل (Breadcrumb)
// ============================================
export function buildBreadcrumb(parts: string[]): string {
  return parts.join(" › ");
}
