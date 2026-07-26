// ============================================
// دوال الـ Keyboards المشتركة
// دعم RTL + Pagination + التنقل
// ============================================

import { InlineKeyboard } from "grammy";
import { COLLEGES, SPECIALTIES, getSpecialtiesByCollege, getLevelsForSpecialty } from "./data/colleges";
import { SUBJECTS, getSubjectsBySpecialtyLevelSemester } from "./data/subjects";
import { TEXTS, ADMIN_TEXTS } from "./texts";

// ============================================
// الحد الأقصى للأزرار في الصفحة الواحدة
// ============================================
const PAGE_SIZE = 8;

// ============================================
// S1: قائمة الطالب الرئيسية
// ============================================
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(TEXTS.main_menu.btn_colleges, "menu_colleges")
    .text(TEXTS.main_menu.btn_search, "menu_search")
    .row()
    .text(TEXTS.main_menu.btn_leaderboard, "menu_leaderboard")
    .text(TEXTS.main_menu.btn_profile, "menu_profile")
    .row()
    .text(TEXTS.main_menu.btn_committee, "menu_committee")
    .text(TEXTS.main_menu.btn_contact, "menu_contact");
}

// ============================================
// S2: قائمة الكليات (مع Pagination)
// ============================================
export function collegesKeyboard(page = 0): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, COLLEGES.length);

  for (let i = start; i < end; i += 2) {
    const c1 = COLLEGES[i];
    const c2 = COLLEGES[i + 1];
    kb.text(`${c1.short_name}`, `col_${c1.id}`);
    if (c2) {
      kb.text(`${c2.short_name}`, `col_${c2.id}`);
    }
    kb.row();
  }

  // أزرار التنقل بين الصفحات
  const totalPages = Math.ceil(COLLEGES.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `colleges_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `colleges_page_${page + 1}`);
    }
    kb.row();
  }

  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// S3: قائمة التخصصات لكلية معينة
// ============================================
export function majorsKeyboard(collegeId: number, page = 0): InlineKeyboard {
  const specialties = getSpecialtiesByCollege(collegeId);
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, specialties.length);

  for (let i = start; i < end; i++) {
    const s = specialties[i];
    kb.text(`${s.name} (${s.levels_count} مستويات)`, `major_${s.id}`).row();
  }

  const totalPages = Math.ceil(specialties.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `majors_${collegeId}_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `majors_${collegeId}_page_${page + 1}`);
    }
    kb.row();
  }

  kb.text(TEXTS.navigation.back_to_colleges, "back_to_colleges");
  return kb;
}

// ============================================
// S4: قائمة المستويات
// ============================================
export function levelsKeyboard(specialtyId: number): InlineKeyboard {
  const levels = getLevelsForSpecialty(specialtyId);
  const kb = new InlineKeyboard();

  // عرض المستويات في صفوف من 2
  for (let i = 0; i < levels.length; i += 2) {
    kb.text(`المستوى ${levels[i]}`, `level_${levels[i]}_spec_${specialtyId}`);
    if (i + 1 < levels.length) {
      kb.text(`المستوى ${levels[i + 1]}`, `level_${levels[i + 1]}_spec_${specialtyId}`);
    }
    kb.row();
  }

  // زر الخطة الاسترشادية
  kb.text("🗺 الخطة الاسترشادية", `plan_${specialtyId}`).row();

  kb.text(TEXTS.navigation.back_to_majors, `back_to_majors_${specialtyId}`);
  return kb;
}

// ============================================
// S5: قائمة الفصول
// ============================================
export function semestersKeyboard(specialtyId: number, level: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text("الفصل الأول", `sem_1_spec_${specialtyId}_lvl_${level}`).row();
  kb.text("الفصل الثاني", `sem_2_spec_${specialtyId}_lvl_${level}`).row();
  kb.text(TEXTS.navigation.back_to_levels, `back_to_levels_${specialtyId}`);
  return kb;
}

// ============================================
// S6: قائمة المواد
// ============================================
export function subjectsKeyboard(specialtyId: number, level: number, semester: 1 | 2, page = 0): InlineKeyboard {
  const subjects = getSubjectsBySpecialtyLevelSemester(specialtyId, level, semester);
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, subjects.length);

  for (let i = start; i < end; i++) {
    const s = subjects[i];
    kb.text(s.name, `subj_${s.id}`).row();
  }

  const totalPages = Math.ceil(subjects.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `subjects_${specialtyId}_${level}_${semester}_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `subjects_${specialtyId}_${level}_${semester}_page_${page + 1}`);
    }
    kb.row();
  }

  kb.text(TEXTS.navigation.back_to_semesters, `back_to_semesters_${specialtyId}_${level}`);
  return kb;
}

// ============================================
// S7: قائمة المادة (SubjectMenu)
// ============================================
export function subjectMenuKeyboard(subjectId: number, hasPractical: boolean, isSubscribed = false): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.subject_menu.btn_book_theory, `type_book_theory_${subjectId}`);
  if (hasPractical) {
    kb.text(TEXTS.subject_menu.btn_book_practical, `type_book_practical_${subjectId}`);
  }
  kb.row();
  kb.text(TEXTS.subject_menu.btn_exams, `type_exams_${subjectId}`);
  kb.text(TEXTS.subject_menu.btn_summaries, `type_summaries_${subjectId}`);
  kb.row();
  kb.text(TEXTS.subject_menu.btn_contribute, `contribute_${subjectId}`);
  if (isSubscribed) {
    kb.text(TEXTS.subject_menu.btn_unsubscribe, `unsubscribe_${subjectId}`);
  } else {
    kb.text(TEXTS.subject_menu.btn_subscribe, `subscribe_${subjectId}`);
  }
  kb.row();
  kb.text(TEXTS.navigation.back_to_subjects, `back_to_subjects_from_${subjectId}`);
  return kb;
}

// ============================================
// S8: قائمة الملفات
// ============================================
export function filesListKeyboard(files: Array<{ id: string; file_name: string; is_starred: boolean }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const f of files) {
    const icon = f.is_starred ? "⭐ " : "📄 ";
    kb.text(`${icon}${f.file_name}`, `file_${f.id}`).row();
  }
  return kb;
}

// ============================================
// S9: شاشة المساهمة
// ============================================
export function contributionKeyboard(subjectId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text("❌ إلغاء", `cancel_contribute_${subjectId}`).row();
  kb.text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`);
  return kb;
}

// ============================================
// S10: شاشة البحث
// ============================================
export function searchKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

export function searchResultsKeyboard(results: Array<{ id: string; file_name: string }>, page = 0): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, results.length);

  for (let i = start; i < end; i++) {
    kb.text(`📄 ${results[i].file_name}`, `search_result_${results[i].id}`).row();
  }

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `search_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `search_page_${page + 1}`);
    }
    kb.row();
  }

  kb.text("🔍 بحث جديد", "menu_search").row();
  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// S11: لوحة الشرف
// ============================================
export function leaderboardKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.leaderboard.filter_college, "leader_colleges");
  kb.text(TEXTS.leaderboard.filter_specialty, "leader_majors");
  kb.row();
  kb.text(TEXTS.leaderboard.refresh, "leader_refresh").row();
  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// S12: شاشة الحساب
// ============================================
export function profileKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.profile.btn_my_contributions, "my_contributions");
  kb.text(TEXTS.profile.btn_my_downloads, "my_downloads");
  kb.row();
  kb.text(TEXTS.profile.btn_change_major, "change_major").row();
  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// شاشة "رجوع" بسيطة
// ============================================
export function backOnlyKeyboard(callbackData: string): InlineKeyboard {
  return new InlineKeyboard().text(TEXTS.navigation.back_to_main, callbackData);
}

// ============================================
// شاشة الملف بعد التحميل
// ============================================
export function fileDownloadedKeyboard(subjectId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`);
  return kb;
}

// ============================================
// Admin Keyboards
// ============================================

// A2: لوحة الإدارة
export function adminDashboardKeyboard(canManageAdmins = true, canUpdateLeaderboard = false): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.dashboard.btn_pending, "pending");
  kb.text(ADMIN_TEXTS.dashboard.btn_files_mgmt, "files_mgmt");
  kb.row();
  kb.text(ADMIN_TEXTS.dashboard.btn_subjects_mgmt, "subjects_mgmt");
  kb.text(ADMIN_TEXTS.dashboard.btn_broadcast, "broadcast");
  kb.row();
  kb.text(ADMIN_TEXTS.dashboard.btn_statistics, "statistics");
  kb.text(ADMIN_TEXTS.dashboard.btn_customize, "customize_texts");
  kb.row();
  if (canManageAdmins) {
    kb.text(ADMIN_TEXTS.dashboard.btn_manage_admins, "manage_admins").row();
  }
  if (canUpdateLeaderboard) {
    kb.text(ADMIN_TEXTS.dashboard.btn_leaderboard, "leaderboard_update").row();
  }
  return kb;
}

// A3: قائمة المساهمات المعلقة
export function pendingListKeyboard(pendingList: Array<{ id: number; file_name: string }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of pendingList) {
    kb.text(`#${p.id} - ${p.file_name.substring(0, 30)}`, `review_${p.id}`).row();
  }
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A4: مراجعة مساهمة
export function reviewContributionKeyboard(contributionId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.review.approve, `approve_${contributionId}`);
  kb.text(ADMIN_TEXTS.review.approve_starred, `approve_star_${contributionId}`);
  kb.row();
  kb.text(ADMIN_TEXTS.review.reject, `reject_${contributionId}`).row();
  kb.text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending");
  return kb;
}

// A4b: أسباب الرفض
export function rejectReasonKeyboard(contributionId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.reject_reason.dup, `reject_reason_dup_${contributionId}`);
  kb.text(ADMIN_TEXTS.reject_reason.bad, `reject_reason_bad_${contributionId}`);
  kb.row();
  kb.text(ADMIN_TEXTS.reject_reason.irrelevant, `reject_reason_irrelevant_${contributionId}`);
  kb.text(ADMIN_TEXTS.reject_reason.incomplete, `reject_reason_incomplete_${contributionId}`);
  kb.row();
  kb.text(ADMIN_TEXTS.reject_reason.skip, `reject_reason_skip_${contributionId}`).row();
  kb.text(ADMIN_TEXTS.navigation.back_to_review, `back_to_review_${contributionId}`);
  return kb;
}

// A5: إدارة الملفات
export function filesMgmtKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.files_mgmt.btn_upload, "upload_file");
  kb.text(ADMIN_TEXTS.files_mgmt.btn_browse, "browse_files");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A6: إدارة المواد
export function subjectsMgmtKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.subjects_mgmt.btn_add, "add_subject");
  kb.text(ADMIN_TEXTS.subjects_mgmt.btn_edit, "edit_subject");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A7: التعميم
export function broadcastKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.broadcast.btn_all, "broadcast_all");
  kb.text(ADMIN_TEXTS.broadcast.btn_college, "broadcast_college");
  kb.row();
  kb.text(ADMIN_TEXTS.broadcast.btn_major, "broadcast_major");
  kb.text(ADMIN_TEXTS.broadcast.btn_level, "broadcast_level");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A8: إدارة المسؤولين
export function manageAdminsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.manage_admins.btn_add, "add_admin");
  kb.text(ADMIN_TEXTS.manage_admins.btn_list, "list_admins");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A9: الإحصائيات
export function statisticsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.statistics.refresh, "stats_refresh").row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A10: تخصيص النصوص
export function customizeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.customize.btn_main_menu, "custom_screen_main_menu");
  kb.text(ADMIN_TEXTS.customize.btn_choose_college, "custom_screen_choose_college");
  kb.row();
  kb.text(ADMIN_TEXTS.customize.btn_subject_menu, "custom_screen_subject_menu").row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A11: لوحة الشرف
export function leaderboardUpdateKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.leaderboard_update.btn_global, "leader_global");
  kb.text(ADMIN_TEXTS.leaderboard_update.btn_college, "leader_college");
  kb.row();
  kb.text(ADMIN_TEXTS.leaderboard_update.btn_specialty, "leader_specialty").row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}
