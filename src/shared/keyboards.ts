// ============================================
// دوال الـ Keyboards المشتركة (محسّنة)
// دعم: breadcrumb + عدّاد ملفات + pagination + تأكيدات
// ============================================

import { InlineKeyboard } from "grammy";
import {
  COLLEGES,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "./data/colleges";
import {
  getSubjectsBySpecialtyLevelSemester,
  getMockFilesForSubject,
  getFileCountForCategory,
  getSubjectById,
  type Subject,
} from "./data/subjects";
import { TEXTS, ADMIN_TEXTS } from "./texts";

// الحد الأقصى للأزرار في الصفحة الواحدة
const PAGE_SIZE = 6;

// ============================================
// مساعد: breadcrumb string
// ============================================
export function breadcrumb(...parts: string[]): string {
  return parts.join(" › ");
}

// ============================================
// S1: قائمة الطالب الرئيسية (مع زر المساهمة)
// ============================================
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(TEXTS.main_menu.btn_colleges, "menu_colleges")
    .text(TEXTS.main_menu.btn_search, "menu_search")
    .row()
    .text(TEXTS.main_menu.btn_leaderboard, "menu_leaderboard")
    .text(TEXTS.main_menu.btn_profile, "menu_profile")
    .row()
    .text(TEXTS.main_menu.btn_contribute, "menu_contribute_main")
    .row()
    .text(TEXTS.main_menu.btn_committee, "menu_committee")
    .text(TEXTS.main_menu.btn_contact, "menu_contact");
}

// ============================================
// S2: قائمة الكليات (مع Pagination + prefix اختياري للتسجيل)
// ============================================
export function collegesKeyboard(page = 0, prefix = "col"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, COLLEGES.length);

  for (let i = start; i < end; i += 2) {
    const c1 = COLLEGES[i];
    const c2 = COLLEGES[i + 1];
    kb.text(`${c1.emoji} ${c1.short_name}`, `${prefix}_${c1.id}`);
    if (c2) {
      kb.text(`${c2.emoji} ${c2.short_name}`, `${prefix}_${c2.id}`);
    }
    kb.row();
  }

  // أزرار التنقل بين الصفحات
  const totalPages = Math.ceil(COLLEGES.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `${prefix === "col" ? "colleges" : prefix}_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `${prefix === "col" ? "colleges" : prefix}_page_${page + 1}`);
    }
    kb.row();
  }

  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// S3: قائمة التخصصات لكلية معينة (مع زر قناة لجنة الكلية + prefix اختياري)
// ============================================
export function majorsKeyboard(collegeId: number, page = 0, prefix = "major"): InlineKeyboard {
  const specialties = getSpecialtiesByCollege(collegeId);
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, specialties.length);

  for (let i = start; i < end; i++) {
    const s = specialties[i];
    kb.text(s.name, `${prefix}_${s.id}`).row();
  }

  const totalPages = Math.ceil(specialties.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(TEXTS.navigation.prev_page, `${prefix === "major" ? "majors" : prefix}_${collegeId}_page_${page - 1}`);
    }
    if (page < totalPages - 1) {
      kb.text(TEXTS.navigation.next_page, `${prefix === "major" ? "majors" : prefix}_${collegeId}_page_${page + 1}`);
    }
    kb.row();
  }

  // زر قناة اللجنة العلمية للكلية (فقط في الوضع العادي، ليس في التسجيل)
  if (prefix === "major") {
    kb.text("📢 قناة اللجنة العلمية - الكلية", `committee_college_${collegeId}`).row();
  }

  kb.text(prefix === "major" ? TEXTS.navigation.back_to_colleges : TEXTS.navigation.back_to_main, prefix === "major" ? "back_to_colleges" : "back_to_main");
  return kb;
}

// ============================================
// S4: قائمة المستويات (مع زر قناة اللجنة للتخصص + prefix اختياري)
// ============================================
export function levelsKeyboard(specialtyId: number, prefix = "level"): InlineKeyboard {
  const levels = getLevelsForSpecialty(specialtyId);
  const kb = new InlineKeyboard();

  // عرض المستويات في صفوف من 3
  for (let i = 0; i < levels.length; i += 3) {
    for (let j = 0; j < 3 && i + j < levels.length; j++) {
      kb.text(`المستوى ${levels[i + j]}`, `${prefix}_${levels[i + j]}_spec_${specialtyId}`);
    }
    kb.row();
  }

  // زر قناة اللجنة العلمية للتخصص (فقط في الوضع العادي)
  if (prefix === "level") {
    kb.text("📢 قناة اللجنة العلمية", `committee_specialty_${specialtyId}`).row();
    // زر الخطة الاسترشادية
    kb.text("🗺 الخطة الاسترشادية", `plan_${specialtyId}`).row();
    kb.text(TEXTS.navigation.back_to_majors, `back_to_majors_${specialtyId}`);
  } else {
    kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  }
  return kb;
}

// ============================================
// S5: قائمة الفصول
// ============================================
export function semestersKeyboard(specialtyId: number, level: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.choose_semester.sem1_label, `sem_1_spec_${specialtyId}_lvl_${level}`).row();
  kb.text(TEXTS.choose_semester.sem2_label, `sem_2_spec_${specialtyId}_lvl_${level}`).row();
  kb.text(TEXTS.navigation.back_to_levels, `back_to_levels_${specialtyId}`);
  return kb;
}

// ============================================
// S6: قائمة المواد
// ============================================
export function subjectsKeyboard(
  specialtyId: number,
  level: number,
  semester: 1 | 2,
  page = 0
): InlineKeyboard {
  const subjects = getSubjectsBySpecialtyLevelSemester(specialtyId, level, semester);
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, subjects.length);

  for (let i = start; i < end; i++) {
    const s = subjects[i];
    kb.text(`📖 ${s.name}`, `subj_${s.id}`).row();
  }

  const totalPages = Math.ceil(subjects.length / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      kb.text(
        TEXTS.navigation.prev_page,
        `subjects_${specialtyId}_${level}_${semester}_page_${page - 1}`
      );
    }
    if (page < totalPages - 1) {
      kb.text(
        TEXTS.navigation.next_page,
        `subjects_${specialtyId}_${level}_${semester}_page_${page + 1}`
      );
    }
    kb.row();
  }

  kb.text(TEXTS.navigation.back_to_semesters, `back_to_semesters_${specialtyId}_${level}`);
  return kb;
}

// ============================================
// S7: قائمة المادة (SubjectMenu) - مع عدّاد ملفات
// ============================================
export function subjectMenuKeyboard(
  subjectId: number,
  hasPractical: boolean
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // عدّاد الملفات لكل تصنيف
  const theoryCount = getFileCountForCategory(subjectId, "book_theory");
  const practicalCount = getFileCountForCategory(subjectId, "book_practical");
  const summariesCount = getFileCountForCategory(subjectId, "summary");
  const examsCount = getFileCountForCategory(subjectId, "exam");
  const videoCount = getFileCountForCategory(subjectId, "video");
  const referenceCount = getFileCountForCategory(subjectId, "reference");
  const scheduleCount = getFileCountForCategory(subjectId, "schedule");

  // صف 1: نظري + عملي
  kb.text(`📘 المقرر (نظري) — ${theoryCount}`, `type_book_theory_${subjectId}`);
  if (hasPractical) {
    kb.text(`📗 المقرر (عملي) — ${practicalCount}`, `type_book_practical_${subjectId}`);
  }
  kb.row();
  // صف 2: ملخصات + اختبارات
  kb.text(`📄 ملخصات — ${summariesCount}`, `type_summaries_${subjectId}`);
  kb.text(`📝 نماذج اختبارات — ${examsCount}`, `type_exams_${subjectId}`);
  kb.row();
  // صف 3: مرئيات + مراجع
  kb.text(`🎥 مرئيات وصوتيات — ${videoCount}`, `type_video_${subjectId}`);
  kb.text(`📖 مراجع — ${referenceCount}`, `type_reference_${subjectId}`);
  kb.row();
  // صف 4: جداول + إحسان
  kb.text(`📅 جداول دراسية — ${scheduleCount}`, `type_schedule_${subjectId}`);
  kb.text(TEXTS.subject_menu.btn_contribute, `contribute_${subjectId}`);
  kb.row();
  kb.text(TEXTS.navigation.back_to_subjects, `back_to_subjects_from_${subjectId}`);
  return kb;
}

// ============================================
// S8: قائمة الملفات
// ============================================
export function filesListKeyboard(
  files: Array<{ id: string; file_name: string; is_starred: boolean; download_count: number }>,
  subjectId: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const f of files) {
    const icon = f.is_starred ? "⭐ " : "📄 ";
    kb.text(`${icon}${f.file_name} (${f.download_count}⬇️)`, `preview_${f.id}`).row();
  }
  kb.text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`);
  return kb;
}

// ============================================
// S8b: شاشة معاينة الملف (جديدة)
// ============================================
export function filePreviewKeyboard(fileId: string, subjectId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.file_preview.btn_download, `download_${fileId}`).row();
  kb.text(TEXTS.file_preview.btn_back, `back_to_files_${subjectId}_${fileId.split("_")[2]}`);
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

export function searchResultsKeyboard(
  results: Array<{ id: string; file_name: string; subject_name: string }>,
  page = 0
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, results.length);

  for (let i = start; i < end; i++) {
    kb.text(`📄 ${results[i].file_name}`, `preview_search_${results[i].id}`).row();
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
// S11: لوحة الشرف — روّاد الإحسان
// ============================================
export function leaderboardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(TEXTS.leaderboard.btn_current, "leader_current")
    .row()
    .text(TEXTS.leaderboard.btn_archive, "leader_archive")
    .row()
    .text(TEXTS.navigation.back_to_main, "back_to_main");
}

// ============================================
// S12: شاشة الحساب (مع زر الإشعارات)
// ============================================
export function profileKeyboard(unreadNotifications = 0): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(TEXTS.profile.btn_my_contributions, "my_contributions");
  kb.row();
  if (unreadNotifications > 0) {
    kb.text(`🔔 الإشعارات (${unreadNotifications})`, "my_notifications").row();
  } else {
    kb.text("🔔 الإشعارات", "my_notifications").row();
  }
  kb.text(TEXTS.profile.btn_change_major, "change_major").row();
  kb.text(TEXTS.navigation.back_to_main, "back_to_main");
  return kb;
}

// ============================================
// شاشة "رجوع" بسيطة
// ============================================
export function backOnlyKeyboard(callbackData: string, label?: string): InlineKeyboard {
  return new InlineKeyboard().text(label || TEXTS.navigation.back_to_main, callbackData);
}

// ============================================
// شاشة تأكيد الإجراءات
// ============================================
export function confirmActionKeyboard(
  confirmAction: string,
  cancelAction: string,
  confirmLabel = "✅ نعم",
  cancelLabel = "❌ إلغاء"
): InlineKeyboard {
  return new InlineKeyboard()
    .text(confirmLabel, confirmAction)
    .text(cancelLabel, cancelAction);
}

// ============================================
// ===== Admin Keyboards =====
// ============================================

// A2: لوحة الإدارة
export function adminDashboardKeyboard(
  role: "central" | "college" | "specialty" | "level",
  pendingCount: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.dashboard.btn_pending(pendingCount), "pending");
  kb.text(ADMIN_TEXTS.dashboard.btn_files_mgmt, "files_mgmt");
  kb.row();
  kb.text(ADMIN_TEXTS.dashboard.btn_subjects_mgmt, "subjects_mgmt");
  kb.text(ADMIN_TEXTS.dashboard.btn_broadcast, "broadcast");
  kb.row();
  kb.text(ADMIN_TEXTS.dashboard.btn_statistics, "statistics");
  kb.text(ADMIN_TEXTS.dashboard.btn_customize, "customize_texts");
  kb.row();
  if (role === "central") {
    kb.text(ADMIN_TEXTS.dashboard.btn_manage_admins, "manage_admins").row();
    kb.text(ADMIN_TEXTS.dashboard.btn_leaderboard, "leaderboard_update").row();
  }
  return kb;
}

// A3: قائمة المساهمات المعلقة
export function pendingListKeyboard(
  pendingList: Array<{ id: number; file_name: string; subject_name: string; uploaded_at: string }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of pendingList) {
    kb.text(`#${p.id} • ${p.file_name.substring(0, 25)}`, `review_${p.id}`).row();
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

// A4b-confirm: تأكيد الرفض
export function rejectConfirmKeyboard(contributionId: number, reason: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(ADMIN_TEXTS.reject_reason.btn_confirm, `confirm_reject_${contributionId}_${reason}`)
    .text(ADMIN_TEXTS.reject_reason.btn_cancel, `back_to_review_${contributionId}`);
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

// A5b: استعراض الملفات
export function browseFilesKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.browse_files.btn_all, "browse_all");
  kb.text(ADMIN_TEXTS.browse_files.btn_by_college, "browse_by_college");
  kb.row();
  kb.text(ADMIN_TEXTS.browse_files.btn_by_specialty, "browse_by_specialty");
  kb.text(ADMIN_TEXTS.browse_files.btn_search, "browse_search");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_files_mgmt, "back_to_files_mgmt");
  return kb;
}

// A6: إدارة المواد
export function subjectsMgmtKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(ADMIN_TEXTS.subjects_mgmt.btn_add, "add_subject");
  kb.text(ADMIN_TEXTS.subjects_mgmt.btn_list, "list_subjects");
  kb.row();
  kb.text(ADMIN_TEXTS.subjects_mgmt.btn_edit, "edit_subject");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A7: التعميم (لم يعد يُستخدم - التعميمات أصبحت ديناميكية في admin/index.ts)
// تركنا الدالة للتوافق مع أي استدعاءات قديمة
export function broadcastKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text("📢 للتعميم", "broadcast");
  kb.row();
  kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
  return kb;
}

// A7-confirm: معاينة التعميم
export function broadcastConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(ADMIN_TEXTS.broadcast.btn_send, "confirm_broadcast")
    .text(ADMIN_TEXTS.broadcast.btn_cancel, "broadcast");
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
  kb.text(ADMIN_TEXTS.customize.btn_subject_menu, "custom_screen_subject_menu");
  kb.text(ADMIN_TEXTS.customize.btn_search, "custom_screen_search");
  kb.row();
  kb.text("↩️ استعادة الافتراضي", "reset_default").row();
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

// مساعد: استخراج subjectId من callback pattern
export function extractSubjectId(callbackData: string, prefix: string): number | null {
  const m = callbackData.match(new RegExp(`${prefix}_(\\d+)`));
  return m ? parseInt(m[1]) : null;
}
