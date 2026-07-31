// ============================================
// 📖 Subjects Handlers — إدارة المواد + النظام الأكاديمي
// ============================================
// هذا الملف يحتوي على:
//   - academic_mgmt (القائمة الرئيسية للنظام الأكاديمي)
//   - academic_coming_soon (للأقسام قيد التطوير)
//   - subjects_mgmt (قائمة إدارة المواد)
//   - Add flow (إضافة مادة: type→college→specialty→level→semester→name→code→credits→has_theory→has_practical→confirm)
//   - Browse flow (استعراض: college→specialty→level→semester→قائمة مواد→تفاصيل)
//   - Edit (تعديل الاسم/الكود/الساعات)
//   - Move (نقل لفصل/مستوى آخر)
//   - Reorder (ترتيب أعلى/أسفل)
//   - Delete (حذف ناعم)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions, UserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminPrimaryPositionId } from "../helpers";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
} from "../../shared/data/colleges";
import {
  getSubjectByIdFromDB,
  getSubjectsBySpecLevelSemesterFromDB,
  createSubject,
  updateSubject,
  deleteSubject,
  swapSubjectSortOrder,
  getContentCountForSubject,
  writeSubjectAuditLog,
  normalizeSubjectName,
} from "../../shared/db";
import { invalidateSubjectCache } from "../../shared/data/subjects";

// ============================================
// Helpers داخلية
// ============================================

/**
 * يرجع مصفوفة college_ids التي يديرها المسؤول.
 *  - مركزي: كل الكليات
 *  - مسؤول كلية/مستوى: الكليات في effective_scope
 */
function getAdminCollegeIds(perms: UserPermissions): number[] {
  if (perms.is_central) {
    return COLLEGES.map((c) => c.id);
  }
  return Array.from(perms.effective_scope.colleges);
}

/**
 * يبني keyboard للكليات (يحترم نطاق المسؤول).
 * الـ prefix يحدد المسار: "subj_add" للإضافة، "subj_list" للاستعراض.
 */
function collegesKeyboard(prefix: string, perms: UserPermissions): InlineKeyboard {
  const kb = new InlineKeyboard();
  const allowedIds = new Set(getAdminCollegeIds(perms));
  for (const c of COLLEGES) {
    if (allowedIds.has(c.id)) {
      kb.text(`${c.emoji} ${c.short_name}`, `${prefix}_col_${c.id}`).row();
    }
  }
  kb.text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt");
  return kb;
}

/**
 * يبني keyboard للتخصصات داخل كلية (يحترم نطاق المسؤول).
 *  - مركزي/مسؤول كلية: كل تخصصات الكلية
 *  - مسؤول مستوى: تخصصاته فقط ضمن هذه الكلية
 */
function specialtiesKeyboard(
  collegeId: number,
  prefix: string,
  perms: UserPermissions
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const allSpecs = getSpecialtiesByCollege(collegeId);

  // حدد المعرّفات المسموح بها
  let allowedIds: Set<number>;
  if (perms.is_central) {
    allowedIds = new Set(allSpecs.map((s) => s.id));
  } else if (perms.effective_scope.specialties.size > 0) {
    // مسؤول مستوى — فلتر بتخصصاته
    const scopeSpecs = new Set<number>();
    for (const id of perms.effective_scope.specialties) {
      const spec = getSpecialtyById(id);
      if (spec && spec.college_id === collegeId) scopeSpecs.add(id);
    }
    allowedIds = scopeSpecs;
  } else {
    // مسؤول كلية — كل تخصصات الكلية
    allowedIds = new Set(allSpecs.map((s) => s.id));
  }

  for (const s of allSpecs) {
    if (allowedIds.has(s.id)) {
      kb.text(`📚 ${s.short_name || s.name}`, `${prefix}_spec_${s.id}`).row();
    }
  }
  kb.text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt");
  return kb;
}

/**
 * يبني keyboard للمستويات ضمن تخصص.
 * يستخدم spec?.levels_count كحد أقصى (افتراضي 6).
 */
function levelsKeyboard(specId: number, prefix: string): InlineKeyboard {
  const spec = getSpecialtyById(specId);
  const maxLevel = spec?.levels_count || 6;
  const kb = new InlineKeyboard();
  for (let i = 1; i <= maxLevel; i++) {
    kb.text(`📊 المستوى ${i}`, `${prefix}_lvl_${specId}_${i}`);
    if (i % 2 === 0) kb.row();
  }
  kb.row().text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt");
  return kb;
}

/**
 * يبني keyboard للفصلين (1 و 2) ضمن تخصص/مستوى.
 * الـ callback يشمل specId/level/sem ليكون عديم الحالة.
 */
function semestersKeyboard(specId: number, level: number, prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📅 الفصل الأول", `${prefix}_sem_${specId}_${level}_1`)
    .text("📅 الفصل الثاني", `${prefix}_sem_${specId}_${level}_2`)
    .row()
    .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt");
  return kb;
}

/**
 * يعرض تفاصيل المادة مع كل أزرار الإجراءات (تعديل/نقل/ترتيب/حذف).
 */
async function showSubjectDetail(
  bot: Bot,
  supabase: SupabaseClient,
  ctx: any,
  subjectId: number
): Promise<void> {
  // اقرأ المادة من DB
  let subject: any = null;
  try {
    subject = await getSubjectByIdFromDB(supabase, subjectId);
  } catch (e) {
    console.error("showSubjectDetail: getSubjectByIdFromDB error:", e);
  }

  if (!subject) {
    await ctx.editMessageText("⚠️ المادة غير موجودة.", {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
        "subjects_mgmt"
      ),
      parse_mode: "Markdown",
    });
    return;
  }

  // اقرأ عدد المحتوى المرتبط
  let contentCount = 0;
  try {
    contentCount = await getContentCountForSubject(supabase, subjectId);
  } catch (e) {
    console.error("showSubjectDetail: getContentCountForSubject error:", e);
  }

  const text =
    ADMIN_TEXTS.subjects_mgmt.detail_title +
    ADMIN_TEXTS.subjects_mgmt.detail_fields({
      name: subject.name,
      code: subject.code || undefined,
      credits: subject.credits ?? undefined,
      has_theory: !!subject.has_theory,
      has_practical: !!subject.has_practical,
      level: subject.level,
      semester: subject.semester,
      sort_order: subject.sort_order ?? 0,
      content_count: contentCount,
    });

  const kb = new InlineKeyboard()
    .text(ADMIN_TEXTS.subjects_mgmt.btn_edit_name, `subj_edit_name_${subjectId}`)
    .text(ADMIN_TEXTS.subjects_mgmt.btn_edit_code, `subj_edit_code_${subjectId}`)
    .text(ADMIN_TEXTS.subjects_mgmt.btn_edit_credits, `subj_edit_credits_${subjectId}`)
    .row()
    .text(ADMIN_TEXTS.subjects_mgmt.btn_move_semester, `subj_move_sem_${subjectId}`)
    .text(ADMIN_TEXTS.subjects_mgmt.btn_move_level, `subj_move_lvl_${subjectId}`)
    .row()
    .text(ADMIN_TEXTS.subjects_mgmt.btn_reorder_up, `subj_up_${subjectId}`)
    .text(ADMIN_TEXTS.subjects_mgmt.btn_reorder_down, `subj_down_${subjectId}`)
    .row()
    .text(ADMIN_TEXTS.subjects_mgmt.btn_delete, `subj_delete_${subjectId}`)
    .row()
    .text(
      "🔙 قائمة المواد",
      `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
    );

  await ctx.editMessageText(text, {
    reply_markup: kb,
    parse_mode: "Markdown",
  });
}

/**
 * فحص صلاحية manage_subjects.
 * يرجع perms عند النجاح، أو null ويُظهر رسالة خطأ عند الفشل.
 */
async function requireManageSubjects(ctx: any): Promise<UserPermissions | null> {
  const perms = await getUserPermissions(ctx.from.id);
  if (!perms.permissions.has("manage_subjects")) {
    await ctx.editMessageText("❌ *ليست لديك صلاحية إدارة المواد.*", {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_academic,
        "academic_mgmt"
      ),
      parse_mode: "Markdown",
    });
    return null;
  }
  return perms;
}

/**
 * يعرض تأكيد الإضافة النهائي قبل INSERT.
 */
async function showAddConfirmation(ctx: any, session: any): Promise<void> {
  const data = session.awaiting_subject_add_context;
  if (!data) return;
  const spec = getSpecialtyById(data.specialty_id);
  await ctx.editMessageText(
    ADMIN_TEXTS.subjects_mgmt.add_confirm({
      name: data.name,
      code: data.code || undefined,
      credits: data.credits ?? undefined,
      has_theory: !!data.has_theory,
      has_practical: !!data.has_practical,
      specName: spec?.name || `تخصص ${data.specialty_id}`,
      level: data.level,
      semester: data.semester,
    }),
    {
      reply_markup: new InlineKeyboard()
        .text("✅ تأكيد", "confirm_add_subject")
        .text("❌ إلغاء", "cancel_add_subject")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt"),
      parse_mode: "Markdown",
    }
  );
}

/**
 * يعيد عرض قائمة المواد ضمن (specId, level, semester) — يُستخدم بعد الترتيب.
 */
async function refreshSubjectsList(
  ctx: any,
  supabase: SupabaseClient,
  specId: number,
  level: number,
  semester: number
): Promise<void> {
  let subjects: any[] = [];
  try {
    subjects = await getSubjectsBySpecLevelSemesterFromDB(supabase, specId, level, semester);
  } catch (e) {
    console.error("refreshSubjectsList: getSubjectsBySpecLevelSemesterFromDB error:", e);
  }

  if (!subjects || subjects.length === 0) {
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.list_empty, {
      reply_markup: new InlineKeyboard()
        .text("➕ إضافة مادة", `subj_add_sem_${specId}_${level}_${semester}`)
        .row()
        .text("🔙 الفصل السابق", `subj_list_lvl_${specId}_${level}`)
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt"),
      parse_mode: "Markdown",
    });
    return;
  }

  const kb = new InlineKeyboard();
  for (const s of subjects) {
    kb
      .text(`📖 ${s.name}`, `subj_detail_${s.id}`)
      .text("🔺", `subj_up_${s.id}`)
      .text("🔻", `subj_down_${s.id}`)
      .row();
  }
  kb.text("🔙 الفصل السابق", `subj_list_lvl_${specId}_${level}`).row();
  kb.text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt");

  await ctx.editMessageText(
    ADMIN_TEXTS.subjects_mgmt.list_subjects_header(subjects.length),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

// ============================================
// التسجيل الرئيسي
// ============================================
export function registerSubjectHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== القائمة الرئيسية للنظام الأكاديمي ======
  bot.callbackQuery("academic_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    const p = perms.permissions;

    const kb = new InlineKeyboard();

    // 📚 إدارة المواد — لمن يملك manage_subjects
    if (p.has("manage_subjects")) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_subjects, "subjects_mgmt").row();
    }

    // 🔗 روابط اللجان — لمن يملك manage_committee_channels
    if (p.has("manage_committee_channels")) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_channels, "manage_channels").row();
    }

    // الأقسام التالية قيد التطوير (للمركزي فقط حالياً)
    if (perms.is_central) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_colleges, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_specialties, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_study_systems, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_academic_plans, "academic_coming_soon").row();
    }

    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.academic_mgmt.title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== أقسام قيد التطوير ======
  bot.callbackQuery("academic_coming_soon", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.academic_mgmt.coming_soon,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_academic,
          "academic_mgmt"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== قائمة إدارة المواد ======
  bot.callbackQuery("subjects_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.title, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.subjects_mgmt.btn_add, "add_subject")
        .text(ADMIN_TEXTS.subjects_mgmt.btn_list, "list_subjects")
        .row()
        .text(ADMIN_TEXTS.subjects_mgmt.btn_edit, "list_subjects")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_academic, "academic_mgmt"),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 🟢 ADD FLOW — إضافة مادة
  // ============================================

  // نقطة الدخول: عرض الكليات (أو تخطّيها حسب نطاق المسؤول)
  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    const collegeIds = getAdminCollegeIds(perms);
    if (collegeIds.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد كليات في نطاق صلاحياتك.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // مسؤول مستوى (تخصص واحد) — تخطّي الكلية والتخصص
    if (!perms.is_central && perms.effective_scope.specialties.size === 1) {
      const specId = Array.from(perms.effective_scope.specialties)[0];
      const spec = getSpecialtyById(specId);
      await ctx.editMessageText(
        ADMIN_TEXTS.subjects_mgmt.add_select_level(spec?.name || `تخصص ${specId}`),
        { reply_markup: levelsKeyboard(specId, "subj_add"), parse_mode: "Markdown" }
      );
      return;
    }

    // مسؤول كلية واحدة — تخطّي الكلية
    if (collegeIds.length === 1) {
      const collegeId = collegeIds[0];
      const college = getCollegeById(collegeId);
      await ctx.editMessageText(
        ADMIN_TEXTS.subjects_mgmt.add_select_specialty(college?.name || `كلية ${collegeId}`),
        {
          reply_markup: specialtiesKeyboard(collegeId, "subj_add", perms),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // مركزي أو متعدد الكليات — اعرض الكليات
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_select_college, {
      reply_markup: collegesKeyboard("subj_add", perms),
      parse_mode: "Markdown",
    });
  });

  // اختيار الكلية → عرض التخصصات
  bot.callbackQuery(/^subj_add_col_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const college = getCollegeById(collegeId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.add_select_specialty(college?.name || ""),
      {
        reply_markup: specialtiesKeyboard(collegeId, "subj_add", perms),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار التخصص → عرض المستويات
  bot.callbackQuery(/^subj_add_spec_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const spec = getSpecialtyById(specId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.add_select_level(spec?.name || ""),
      { reply_markup: levelsKeyboard(specId, "subj_add"), parse_mode: "Markdown" }
    );
  });

  // اختيار المستوى → عرض الفصلين
  bot.callbackQuery(/^subj_add_lvl_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const spec = getSpecialtyById(specId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.add_select_semester(spec?.name || "", level),
      {
        reply_markup: semestersKeyboard(specId, level, "subj_add"),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار الفصل → طلب الاسم (ضبط session)
  bot.callbackQuery(/^subj_add_sem_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const semester = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_add = true;
    session.awaiting_subject_add_step = "name";
    session.awaiting_subject_add_context = {
      specialty_id: specId,
      level,
      semester,
    };
    await saveSession(session);

    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt_name, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_add_subject"),
      parse_mode: "Markdown",
    });
  });

  // has_theory: ✅ نعم → اضبط true وانتقل لـ has_practical
  bot.callbackQuery("subj_add_theory_yes", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_subject_add_context) {
      session.awaiting_subject_add_context.has_theory = true;
    }
    session.awaiting_subject_add_step = "has_practical";
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt_practical, {
      reply_markup: new InlineKeyboard()
        .text("✅ نعم", "subj_add_practical_yes")
        .text("❌ لا", "subj_add_practical_no")
        .row()
        .text("❌ إلغاء", "cancel_add_subject"),
      parse_mode: "Markdown",
    });
  });

  // has_theory: ❌ لا → اضبط false وانتقل لـ has_practical
  bot.callbackQuery("subj_add_theory_no", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_subject_add_context) {
      session.awaiting_subject_add_context.has_theory = false;
    }
    session.awaiting_subject_add_step = "has_practical";
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt_practical, {
      reply_markup: new InlineKeyboard()
        .text("✅ نعم", "subj_add_practical_yes")
        .text("❌ لا", "subj_add_practical_no")
        .row()
        .text("❌ إلغاء", "cancel_add_subject"),
      parse_mode: "Markdown",
    });
  });

  // has_practical: ✅ نعم → اضبط true وانتقل للتأكيد
  bot.callbackQuery("subj_add_practical_yes", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_subject_add_context) {
      session.awaiting_subject_add_context.has_practical = true;
    }
    session.awaiting_subject_add_step = "confirm";
    await saveSession(session);
    await showAddConfirmation(ctx, session);
  });

  // has_practical: ❌ لا → اضبط false وانتقل للتأكيد
  bot.callbackQuery("subj_add_practical_no", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session.awaiting_subject_add_context) {
      session.awaiting_subject_add_context.has_practical = false;
    }
    session.awaiting_subject_add_step = "confirm";
    await saveSession(session);
    await showAddConfirmation(ctx, session);
  });

  // confirm_add_subject → INSERT في DB + audit log + إعادة ضبط الجلسة
  bot.callbackQuery("confirm_add_subject", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "💾 جارٍ الإضافة..." });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const data = session.awaiting_subject_add_context;

    if (!data || !data.name || !data.specialty_id) {
      session.awaiting_subject_add = undefined;
      session.awaiting_subject_add_step = undefined;
      session.awaiting_subject_add_context = undefined;
      await saveSession(session);
      await ctx.editMessageText("⚠️ انتهت الجلسة. ابدأ الإضافة من جديد.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // احسب sort_order التالي ضمن نفس القسم
    let nextSort = 1;
    try {
      const existing = await getSubjectsBySpecLevelSemesterFromDB(
        supabase,
        data.specialty_id,
        data.level,
        data.semester
      );
      if (existing && existing.length > 0) {
        nextSort =
          Math.max(...existing.map((s: any) => Number(s.sort_order) || 0)) + 1;
      }
    } catch (e) {
      console.error("Failed to fetch existing subjects for sort_order:", e);
    }

    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    const newName = (data.name || "").trim();
    const newNameNormalized = normalizeSubjectName(newName);

    // INSERT
    let newSubjectId: number | null = null;
    try {
      newSubjectId = await createSubject(supabase, {
        specialty_id: data.specialty_id,
        level: data.level,
        semester: data.semester,
        name: newName,
        name_normalized: newNameNormalized,
        has_theory: !!data.has_theory,
        has_practical: !!data.has_practical,
        code: data.code || null,
        credits: data.credits ?? null,
        sort_order: nextSort,
        is_active: true,
      });
    } catch (e: any) {
      console.error("createSubject error:", e);
      await ctx.editMessageText(
        `⚠️ فشل إضافة المادة.\n\nالسبب: ${(e?.message || "غير معروف").substring(0, 150)}`,
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
            "subjects_mgmt"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    if (newSubjectId === null) {
      await ctx.editMessageText("⚠️ فشل إضافة المادة (لم يُرجع DB معرّفاً).", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // audit log
    try {
      await writeSubjectAuditLog(supabase, {
        subject_id: newSubjectId,
        action: "create",
        old_data: null,
        new_data: {
          name: newName,
          code: data.code || null,
          credits: data.credits ?? null,
          has_theory: !!data.has_theory,
          has_practical: !!data.has_practical,
          specialty_id: data.specialty_id,
          level: data.level,
          semester: data.semester,
          sort_order: nextSort,
        },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (create) error:", e);
    }

    // إبطال cache ليعكس البيانات الجديدة
    invalidateSubjectCache();

    // إعادة ضبط الجلسة
    session.awaiting_subject_add = undefined;
    session.awaiting_subject_add_step = undefined;
    session.awaiting_subject_add_context = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.add_success(newName),
      {
        reply_markup: new InlineKeyboard()
          .text("📖 عرض المادة", `subj_detail_${newSubjectId}`)
          .row()
          .text("➕ إضافة مادة أخرى", "add_subject")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // cancel_add_subject → إعادة ضبط الجلسة
  bot.callbackQuery("cancel_add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_add = undefined;
    session.awaiting_subject_add_step = undefined;
    session.awaiting_subject_add_context = undefined;
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_canceled, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
        "subjects_mgmt"
      ),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 📋 BROWSE FLOW — استعراض المواد
  // ============================================

  // نقطة الدخول: عرض الكليات (أو تخطّيها حسب نطاق المسؤول)
  bot.callbackQuery("list_subjects", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    const collegeIds = getAdminCollegeIds(perms);
    if (collegeIds.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد كليات في نطاق صلاحياتك.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // مسؤول مستوى (تخصص واحد) — تخطّي الكلية والتخصص
    if (!perms.is_central && perms.effective_scope.specialties.size === 1) {
      const specId = Array.from(perms.effective_scope.specialties)[0];
      const spec = getSpecialtyById(specId);
      await ctx.editMessageText(
        ADMIN_TEXTS.subjects_mgmt.list_select_level(spec?.name || `تخصص ${specId}`),
        { reply_markup: levelsKeyboard(specId, "subj_list"), parse_mode: "Markdown" }
      );
      return;
    }

    // مسؤول كلية واحدة — تخطّي الكلية
    if (collegeIds.length === 1) {
      const collegeId = collegeIds[0];
      const college = getCollegeById(collegeId);
      await ctx.editMessageText(
        ADMIN_TEXTS.subjects_mgmt.list_select_specialty(college?.name || ""),
        {
          reply_markup: specialtiesKeyboard(collegeId, "subj_list", perms),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // مركزي أو متعدد الكليات — اعرض الكليات
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.list_select_college, {
      reply_markup: collegesKeyboard("subj_list", perms),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^subj_list_col_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const college = getCollegeById(collegeId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.list_select_specialty(college?.name || ""),
      {
        reply_markup: specialtiesKeyboard(collegeId, "subj_list", perms),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/^subj_list_spec_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const spec = getSpecialtyById(specId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.list_select_level(spec?.name || ""),
      { reply_markup: levelsKeyboard(specId, "subj_list"), parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/^subj_list_lvl_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const spec = getSpecialtyById(specId);
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.list_select_semester(spec?.name || "", level),
      {
        reply_markup: semestersKeyboard(specId, level, "subj_list"),
        parse_mode: "Markdown",
      }
    );
  });

  // عرض قائمة المواد مع أزرار الترتيب ↑↓ لكل مادة
  bot.callbackQuery(/^subj_list_sem_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    const semester = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    await refreshSubjectsList(ctx, supabase, specId, level, semester);
  });

  // عرض تفاصيل المادة
  bot.callbackQuery(/^subj_detail_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    await showSubjectDetail(bot, supabase, ctx, subjectId);
  });

  // ============================================
  // ✏️ EDIT — تعديل الاسم/الكود/الساعات
  // (استقبال النص يحدث في messages.ts عبر session.awaiting_subject_edit_*)
  // ============================================

  bot.callbackQuery(/^subj_edit_name_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_edit_id = subjectId;
    session.awaiting_subject_edit_field = "name";
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.edit_prompt_name, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", `subj_detail_${subjectId}`),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^subj_edit_code_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_edit_id = subjectId;
    session.awaiting_subject_edit_field = "code";
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.edit_prompt_code, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", `subj_detail_${subjectId}`),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^subj_edit_credits_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_edit_id = subjectId;
    session.awaiting_subject_edit_field = "credits";
    await saveSession(session);
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.edit_prompt_credits, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", `subj_detail_${subjectId}`),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 🔄 MOVE — نقل لفصل/مستوى آخر
  // ============================================

  // نقل لفصل آخر — عرض الفصلين
  bot.callbackQuery(/^subj_move_sem_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("subj_move_sem: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const currentSem = subject.semester;
    const kb = new InlineKeyboard();
    for (let s = 1; s <= 2; s++) {
      const label = s === currentSem ? `📅 الفصل ${s} (الحالي)` : `📅 الفصل ${s}`;
      kb.text(label, `confirm_move_sem_${subjectId}_${s}`);
      if (s === 1) kb.row();
    }
    kb.row().text("❌ إلغاء", `subj_detail_${subjectId}`);

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.move_sem_select(currentSem),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // تأكيد نقل الفصل → UPDATE + audit
  bot.callbackQuery(/^confirm_move_sem_(\d+)_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const newSem = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery({ text: "🔄 جارٍ النقل..." });

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("confirm_move_sem: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const oldSem = subject.semester;
    if (oldSem === newSem) {
      await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_no_change, {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    let ok = false;
    try {
      ok = await updateSubject(supabase, subjectId, {
        semester: newSem,
        updated_by_position_id: positionId,
        updated_by_telegram_id: ctx.from.id,
      });
      if (ok) invalidateSubjectCache();
    } catch (e) {
      console.error("confirm_move_sem: updateSubject error:", e);
    }

    if (!ok) {
      await ctx.editMessageText("⚠️ فشل نقل المادة.", {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // audit log
    try {
      await writeSubjectAuditLog(supabase, {
        subject_id: subjectId,
        action: "move_semester",
        old_data: { semester: oldSem },
        new_data: { semester: newSem },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (move_semester) error:", e);
    }

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.move_success(`الفصل ${newSem}`),
      {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // نقل لمستوى آخر — عرض مستويات التخصص
  bot.callbackQuery(/^subj_move_lvl_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("subj_move_lvl: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const spec = getSpecialtyById(subject.specialty_id);
    const maxLevel = spec?.levels_count || 6;
    const currentLevel = subject.level;

    const kb = new InlineKeyboard();
    for (let i = 1; i <= maxLevel; i++) {
      const label = i === currentLevel ? `📊 المستوى ${i} (الحالي)` : `📊 المستوى ${i}`;
      kb.text(label, `confirm_move_lvl_${subjectId}_${i}`);
      if (i % 2 === 0) kb.row();
    }
    kb.row().text("❌ إلغاء", `subj_detail_${subjectId}`);

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.move_lvl_select(currentLevel, maxLevel),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // تأكيد نقل المستوى → UPDATE + audit
  bot.callbackQuery(/^confirm_move_lvl_(\d+)_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const newLevel = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery({ text: "🔄 جارٍ النقل..." });

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("confirm_move_lvl: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const oldLevel = subject.level;
    if (oldLevel === newLevel) {
      await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_no_change, {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    let ok = false;
    try {
      ok = await updateSubject(supabase, subjectId, {
        level: newLevel,
        updated_by_position_id: positionId,
        updated_by_telegram_id: ctx.from.id,
      });
      if (ok) invalidateSubjectCache();
    } catch (e) {
      console.error("confirm_move_lvl: updateSubject error:", e);
    }

    if (!ok) {
      await ctx.editMessageText("⚠️ فشل نقل المادة.", {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // audit log
    try {
      await writeSubjectAuditLog(supabase, {
        subject_id: subjectId,
        action: "move_level",
        old_data: { level: oldLevel },
        new_data: { level: newLevel },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (move_level) error:", e);
    }

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.move_success(`المستوى ${newLevel}`),
      {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 🔺🔻 REORDER — ترتيب المادة (RPC swap_subject_sort_order)
  // ============================================

  bot.callbackQuery(/^subj_up_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🔺 جارٍ التحريك..." });
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("subj_up: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let ok = false;
    try {
      ok = await swapSubjectSortOrder(supabase, subjectId, "up");
      if (ok) invalidateSubjectCache();
    } catch (e) {
      console.error("subj_up: swapSubjectSortOrder error:", e);
    }

    // audit log (سواء نجح أم لم يتغير الترتيب)
    try {
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      await writeSubjectAuditLog(supabase, {
        subject_id: subjectId,
        action: "reorder",
        old_data: { sort_order: subject.sort_order },
        new_data: { direction: "up" },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (reorder up) error:", e);
    }

    if (!ok) {
      // تعذّر التحريك — اعرض رسالة
      await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_no_change, {
        reply_markup: new InlineKeyboard().text(
          "🔙 قائمة المواد",
          `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // اعرض رسالة النجاح ثم حدّث القائمة
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_success_up, {
      reply_markup: new InlineKeyboard().text(
        "🔙 قائمة المواد",
        `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^subj_down_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🔻 جارٍ التحريك..." });
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("subj_down: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let ok = false;
    try {
      ok = await swapSubjectSortOrder(supabase, subjectId, "down");
      if (ok) invalidateSubjectCache();
    } catch (e) {
      console.error("subj_down: swapSubjectSortOrder error:", e);
    }

    // audit log
    try {
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      await writeSubjectAuditLog(supabase, {
        subject_id: subjectId,
        action: "reorder",
        old_data: { sort_order: subject.sort_order },
        new_data: { direction: "down" },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (reorder down) error:", e);
    }

    if (!ok) {
      await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_no_change, {
        reply_markup: new InlineKeyboard().text(
          "🔙 قائمة المواد",
          `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.reorder_success_down, {
      reply_markup: new InlineKeyboard().text(
        "🔙 قائمة المواد",
        `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
      ),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 🗑 DELETE — حذف مادة (ناعم)
  // ============================================

  // عرض تأكيد الحذف مع عدد المحتوى المرتبط
  bot.callbackQuery(/^subj_delete_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageSubjects(ctx);
    if (!perms) return;

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("subj_delete: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let contentCount = 0;
    try {
      contentCount = await getContentCountForSubject(supabase, subjectId);
    } catch (e) {
      console.error("subj_delete: getContentCountForSubject error:", e);
    }

    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.delete_confirm(subject.name, contentCount),
      {
        reply_markup: new InlineKeyboard()
          .text("✅ نعم، احذف", `confirm_delete_subject_${subjectId}`)
          .text("❌ إلغاء", `subj_detail_${subjectId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // تنفيذ الحذف الناعم + audit
  bot.callbackQuery(/^confirm_delete_subject_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🗑 جارٍ الحذف..." });

    let subject: any = null;
    try {
      subject = await getSubjectByIdFromDB(supabase, subjectId);
    } catch (e) {
      console.error("confirm_delete_subject: getSubjectByIdFromDB error:", e);
    }
    if (!subject) {
      await ctx.editMessageText("⚠️ المادة غير موجودة.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_subjects_mgmt,
          "subjects_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let ok = false;
    try {
      ok = await deleteSubject(supabase, subjectId);
      if (ok) invalidateSubjectCache();
    } catch (e) {
      console.error("confirm_delete_subject: deleteSubject error:", e);
    }

    if (!ok) {
      await ctx.editMessageText("⚠️ فشل حذف المادة.", {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل المادة",
          `subj_detail_${subjectId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // audit log
    try {
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      await writeSubjectAuditLog(supabase, {
        subject_id: subjectId,
        action: "delete",
        old_data: {
          name: subject.name,
          specialty_id: subject.specialty_id,
          level: subject.level,
          semester: subject.semester,
          is_active: true,
        },
        new_data: { is_active: false },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });
    } catch (e) {
      console.error("writeSubjectAuditLog (delete) error:", e);
    }

    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.delete_success, {
      reply_markup: new InlineKeyboard()
        .text(
          "📋 قائمة المواد",
          `subj_list_sem_${subject.specialty_id}_${subject.level}_${subject.semester}`
        )
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "subjects_mgmt"),
      parse_mode: "Markdown",
    });
  });
}
