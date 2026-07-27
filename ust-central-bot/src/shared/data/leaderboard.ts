// ============================================
// بيانات لوحة الشرف - Mockup
// 10 طلاب وهميين بمراكز ونقاط واقعية
// ============================================

export interface LeaderboardEntry {
  rank: number;
  student_name: string;
  username?: string;
  points: number;
  contributions_count: number;
  college_name: string;
  specialty_name: string;
  badge?: "🥇" | "🥈" | "🥉";
}

const BADGES = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
} as const;

// لوحة الشرف العامة
export const GLOBAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    student_name: "أحمد محمد العولقي",
    username: "ahmed_oled",
    points: 1250,
    contributions_count: 87,
    college_name: "كلية الحاسبات وتكنولوجيا المعلومات",
    specialty_name: "تقنية معلومات (IT)",
    badge: "🥇",
  },
  {
    rank: 2,
    student_name: "سارة علي الحداد",
    username: "sara_haddad",
    points: 980,
    contributions_count: 72,
    college_name: "كلية الهندسة",
    specialty_name: "هندسة الحاسوب والأنظمة الذكية",
    badge: "🥈",
  },
  {
    rank: 3,
    student_name: "خالد عبدالله الشريف",
    username: "khaled_sharif",
    points: 845,
    contributions_count: 61,
    college_name: "كلية الصيدلة",
    specialty_name: "دكتور صيدلة",
    badge: "🥉",
  },
  {
    rank: 4,
    student_name: "فاطمة الزهراء منصور",
    points: 720,
    contributions_count: 54,
    college_name: "كلية طب الأسنان",
    specialty_name: "طب وجراحة الفم والأسنان",
  },
  {
    rank: 5,
    student_name: "محمد الشريف باوزير",
    points: 690,
    contributions_count: 51,
    college_name: "كلية العلوم الإدارية",
    specialty_name: "محاسبة - علوم مالية ومصرفية",
  },
  {
    rank: 6,
    student_name: "نورة سعيد الكثيري",
    points: 640,
    contributions_count: 48,
    college_name: "كلية الطب والعلوم الصحية",
    specialty_name: "طب وجراحة",
  },
  {
    rank: 7,
    student_name: "عبدالرحمن طاهر",
    points: 580,
    contributions_count: 43,
    college_name: "كلية الحاسبات وتكنولوجيا المعلومات",
    specialty_name: "هندسة البرمجيات",
  },
  {
    rank: 8,
    student_name: "ريم أحمد الKindi",
    points: 540,
    contributions_count: 40,
    college_name: "كلية العلوم الإنسانية والاجتماعية",
    specialty_name: "لغة إنجليزية - ترجمة",
  },
  {
    rank: 9,
    student_name: "يوسف ناصر باحاج",
    points: 510,
    contributions_count: 38,
    college_name: "كلية الهندسة",
    specialty_name: "هندسة مدنية",
  },
  {
    rank: 10,
    student_name: "ليلى محمد المخلافي",
    points: 480,
    contributions_count: 35,
    college_name: "كلية العلوم الإدارية",
    specialty_name: "التسويق الرقمي",
  },
];

// تصفية حسب الكلية
export function getLeaderboardByCollege(collegeId: number): LeaderboardEntry[] {
  return GLOBAL_LEADERBOARD.filter((e) =>
    e.college_name.includes(getCollegeNameById(collegeId) || "----")
  );
}

// تصفية حسب التخصص
export function getLeaderboardBySpecialty(specialtyId: number): LeaderboardEntry[] {
  return GLOBAL_LEADERBOARD.filter((e) =>
    e.specialty_name.includes(getSpecialtyNameById(specialtyId) || "----")
  );
}

// مساعدات بسيطة (لاستيراد دائري)
function getCollegeNameById(id: number): string | undefined {
  const names: Record<number, string> = {
    1: "الطب",
    2: "الأسنان",
    3: "الصيدلة",
    4: "الهندسة",
    5: "الحاسبات",
    6: "الإدارية",
    7: "الإنسانية",
  };
  return names[id];
}

function getSpecialtyNameById(id: number): string | undefined {
  const names: Record<number, string> = {
    16: "تقنية معلومات (IT)",
    20: "هندسة البرمجيات",
    12: "هندسة الحاسوب والأنظمة الذكية",
    10: "هندسة مدنية",
    5: "طب وجراحة الفم والأسنان",
    6: "دكتور صيدلة",
    26: "محاسبة",
    25: "التسويق الرقمي",
    28: "ترجمة",
  };
  return names[id];
}
