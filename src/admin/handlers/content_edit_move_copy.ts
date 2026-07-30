// ============================================
// ✏️ Content Edit/Move/Copy Handlers (المرحلة 2)
// ============================================
// هذا الملف يحتوي على:
//   - edit_content_<id>: عرض خيارات التعديل (عنوان/وصف/نوع)
//   - edit_field_title_<id>: تعديل العنوان
//   - edit_field_description_<id>: تعديل الوصف
//   - edit_field_type_<id>: تغيير النوع
//   - edit_type_<newType>_<id>: تطبيق النوع الجديد
//   - cancel_edit: إلغاء التعديل
//
//   - move_content_<id>: بدء النقل (اختيار الكلية)
//   - move_col_<collegeId>_<contentId>: اختيار التخصص
//   - move_spec_<specId>_<contentId>: اختيار المستوى
//   - move_lvl_<level>_<contentId>: اختيار المادة
//   - move_subj_<subjectId>_<contentId>: تأكيد النقل
//   - confirm_move_<subjectId>_<contentId>: تنفيذ النقل
//   - cancel_move: إلغاء النقل
//
//   - copy_content_<id>: بدء النسخ (اختيار الكلية)
//   - copy_col_<collegeId>_<contentId>: اختيار التخصص
//   - copy_spec_<specId>_<contentId>: اختيار المستوى
//   - copy_lvl_<level>_<contentId>: اختيار المادة
//   - copy_subj_<subjectId>_<contentId>: تأكيد النسخ
//   - confirm_copy_<subjectId>_<contentId>: تنفيذ النسخ
//   - cancel_copy: إلغاء النسخ
//
// ملاحظات:
//   - جميع العمليات تكتب audit log
//   - النقل لا يحرك الملف من قناة التخزين (نفس college_id غالباً)
//   - النسخ يُنشئ سجل content جديد بنفس file_id
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import {
  CONTENT_TYPES,
  getContentTypeLabel,
} from "../../shared/data/admins";
import { getSubjectById } from "../../shared/data/subjects";
import { getSpecialtyById, getCollegeById, getSpecialtiesByCollege, COLLEGES } from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminPrimaryPositionId, writeContentAuditLog } from "../helpers";

// ============================================
// Helper: بناء keyboard لاختيار الكلية (للنقل/النسخ)
// ============================================
function collegesKeyboard(prefix: string, contentId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  COLLEGES.forEach((c) => {
    kb.text(`${c.emoji} ${c.short_name}`, `${prefix}_col_${c.id}_${contentId}`).row();
  });
  kb.text("❌ إلغاء", `cancel_${prefix}`);
  return kb;
}

// ============================================
// Helper: بناء keyboard لاختيار التخصص
// ============================================
function specialtiesKeyboard(collegeId: number, prefix: string, contentId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const specialties = getSpecialtiesByCollege(collegeId);
  specialties.forEach((s) => {
    kb.text(`📚 ${s.short_name || s.name}`, `${prefix}_spec_${s.id}_${contentId}`).row();
  });
  kb.text("❌ إلغاء", `cancel_${prefix}`);
  return kb;
}

// ============================================
// Helper: بناء keyboard لاختيار المستوى
// ============================================
function levelsKeyboard(specId: number, prefix: string, contentId: number): InlineKeyboard {
  const spec = getSpecialtyById(specId);
  const maxLevel = spec?.levels_count || 6;
  const kb = new InlineKeyboard();
  for (let i = 1; i <= maxLevel; i++) {
    kb.text(`📊 المستوى ${i}`, `${prefix}_lvl_${i}_${contentId}`);
    if (i % 2 === 0) kb.row();
  }
  kb.row().text("❌ إلغاء", `cancel_${prefix}`);
  return kb;
}

// ============================================
// Helper: بناء keyboard لاختيار المادة (من DB)
// ============================================
async function subjectsKeyboard(
  supabase: SupabaseClient,
  specId: number,
  level: number,
  prefix: string,
  contentId: number
): Promise<InlineKeyboard> {
  const kb = new InlineKeyboard();
  try {
    const subjects = await supabase.select("subjects", {
      columns: "id,name,semester",
      filter: `specialty_id=eq.${specId}&level=eq.${level}`,
      order: "semester.asc,name.asc",
    });
    if (Array.isArray(subjects)) {
      subjects.forEach((s: any) => {
        kb.text(`📖 ${s.name} (ف${s.semester})`, `${prefix}_subj_${s.id}_${contentId}`).row();
      });
    }
  } catch (e) {
    console.error("Subjects fetch error:", e);
  }
  kb.text("❌ إلغاء", `cancel_${prefix}`);
  return kb;
}

// ============================================
// Helper: الحصول على scope college_ids للمسؤول
// ============================================
function getAdminCollegeIds(perms: any): number[] {
  if (perms.is_central) {
    return COLLEGES.map((c) => c.id);
  }
  const colleges = perms.effective_scope?.colleges;
  if (!colleges) return [];
  return Array.isArray(colleges) ? colleges : Array.from(colleges);
}

export function registerContentEditMoveCopyHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // ✏️ تعديل المحتوى
  // ============================================

  // عرض خيارات التعديل
  bot.callbackQuery(/edit_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    let content: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,title,subject_id,content_type_id,description",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    if (!content) {
      await ctx.reply("⚠️ المحتوى غير موجود.");
      return;
    }

    const subject = getSubjectById(content.subject_id);
    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_edit.btn_title, `edit_field_title_${contentId}`)
      .text(ADMIN_TEXTS.content_edit.btn_description, `edit_field_description_${contentId}`)
      .row()
      .text(ADMIN_TEXTS.content_edit.btn_type, `edit_field_type_${contentId}`)
      .row()
      .text(ADMIN_TEXTS.content_edit.btn_back, `content_detail_${contentId}`);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_edit.title({
        title: content.title,
        subject_name: subject?.name || "غير معروف",
      }),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // تعديل العنوان — طلب الإدخال
  bot.callbackQuery(/edit_field_title_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_edit_id = contentId;
    session.awaiting_content_edit_field = "title";
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_edit.prompt_title,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_edit"),
        parse_mode: "Markdown",
      }
    );
  });

  // تعديل الوصف — طلب الإدخال
  bot.callbackQuery(/edit_field_description_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    let currentDesc: string | null = null;
    try {
      const result = await supabase.select("content", {
        columns: "description",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      const content = Array.isArray(result) ? result[0] : result;
      currentDesc = content?.description || null;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_edit_id = contentId;
    session.awaiting_content_edit_field = "description";
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_edit.prompt_description(currentDesc || undefined),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_edit"),
        parse_mode: "Markdown",
      }
    );
  });

  // تغيير النوع — عرض قائمة الأنواع
  bot.callbackQuery(/edit_field_type_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_edit_id = contentId;
    session.awaiting_content_edit_field = "type";
    await saveSession(session);

    const kb = new InlineKeyboard();
    for (let i = 0; i < CONTENT_TYPES.length; i += 2) {
      kb.text(
        `${CONTENT_TYPES[i].emoji} ${CONTENT_TYPES[i].name}`,
        `edit_type_${CONTENT_TYPES[i].id}_${contentId}`
      );
      if (CONTENT_TYPES[i + 1]) {
        kb.text(
          `${CONTENT_TYPES[i + 1].emoji} ${CONTENT_TYPES[i + 1].name}`,
          `edit_type_${CONTENT_TYPES[i + 1].id}_${contentId}`
        );
      }
      kb.row();
    }
    kb.text("❌ إلغاء", "cancel_edit");

    await ctx.editMessageText(
      ADMIN_TEXTS.content_edit.select_type,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // تطبيق النوع الجديد
  bot.callbackQuery(/edit_type_(\w+)_(\d+)/, async (ctx) => {
    const newType = ctx.match[1];
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery({ text: "✅ جارٍ التحديث..." });

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_edit_field = undefined;
    session.awaiting_content_edit_id = undefined;
    await saveSession(session);

    // اقرأ القديم للتدقيق
    let oldData: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,content_type_id,title",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      oldData = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    // حدّث
    try {
      await supabase.update("content", {
        content_type_id: newType,
        last_modified_at: new Date().toISOString(),
        last_modified_by: ctx.from.id,
      }, `id=eq.${contentId}`);

      // audit log
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      await writeContentAuditLog(supabase, {
        content_id: contentId,
        action: "update",
        old_data: oldData ? { content_type_id: oldData.content_type_id } : null,
        new_data: { content_type_id: newType },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });

      await ctx.editMessageText(
        ADMIN_TEXTS.content_edit.success("النوع"),
        {
          reply_markup: new InlineKeyboard()
            .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
            .row()
            .text("🔙 إدارة المحتوى", "content_mgmt"),
          parse_mode: "Markdown",
        }
      );
    } catch (e) {
      console.error("Content type update error:", e);
      await ctx.reply("⚠️ فشل تحديث النوع. حاول مرة أخرى.");
    }
  });

  // إلغاء التعديل
  bot.callbackQuery("cancel_edit", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const contentId = session.awaiting_content_edit_id;
    session.awaiting_content_edit_id = undefined;
    session.awaiting_content_edit_field = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_edit.canceled,
      {
        reply_markup: new InlineKeyboard()
          .text(contentId ? "📄 تفاصيل المحتوى" : "🔙 إدارة المحتوى", contentId ? `content_detail_${contentId}` : "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 📂 نقل المحتوى
  // ============================================

  // بدء النقل — اختيار الكلية
  bot.callbackQuery(/move_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_move_id = contentId;
    session.awaiting_content_move_step = "college";
    await saveSession(session);

    // اقرأ المادة الحالية
    let currentSubjectName = "غير معروف";
    try {
      const result = await supabase.select("content", {
        columns: "subject_id",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      const content = Array.isArray(result) ? result[0] : result;
      if (content?.subject_id) {
        currentSubjectName = getSubjectById(content.subject_id)?.name || "غير معروف";
      }
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    const kb = collegesKeyboard("move", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.title(currentSubjectName),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار الكلية → التخصص
  bot.callbackQuery(/move_col_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const college = getCollegeById(collegeId);
    const kb = specialtiesKeyboard(collegeId, "move", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.select_specialty(college?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار التخصص → المستوى (+ تخزين specId في session)
  bot.callbackQuery(/move_spec_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    // خزّن specId في session ليُستخدم لاحقاً في move_lvl_
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    (session as any).awaiting_content_move_spec = specId;
    await saveSession(session);

    const spec = getSpecialtyById(specId);
    const kb = levelsKeyboard(specId, "move", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.select_level(spec?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المستوى → المادة
  bot.callbackQuery(/move_lvl_(\d+)_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const specId = (session as any).awaiting_content_move_spec;
    if (!specId) {
      await ctx.reply("⚠️ انتهت الجلسة. ابدأ النقل من جديد.");
      return;
    }

    const spec = getSpecialtyById(specId);
    const kb = await subjectsKeyboard(supabase, specId, level, "move", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.select_subject(spec?.name || "", level),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المادة → تأكيد النقل
  bot.callbackQuery(/move_subj_(\d+)_(\d+)/, async (ctx) => {
    const newSubjectId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    // اقرأ المادة الحالية
    let oldSubjectName = "غير معروف";
    try {
      const result = await supabase.select("content", {
        columns: "subject_id,title",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      const content = Array.isArray(result) ? result[0] : result;
      if (content?.subject_id) {
        oldSubjectName = getSubjectById(content.subject_id)?.name || "غير معروف";
      }
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    const newSubjectName = getSubjectById(newSubjectId)?.name || "غير معروف";

    // خزّن newSubjectId في session للتأكيد
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    (session as any).awaiting_content_move_target = newSubjectId;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.confirm(oldSubjectName, newSubjectName),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.content_move.btn_confirm, `confirm_move_${newSubjectId}_${contentId}`)
          .text(ADMIN_TEXTS.content_move.btn_cancel, `cancel_move`)
          .row()
          .text("🔙 تفاصيل المحتوى", `content_detail_${contentId}`),
        parse_mode: "Markdown",
      }
    );
  });

  // تأكيد النقل — تنفيذ
  bot.callbackQuery(/confirm_move_(\d+)_(\d+)/, async (ctx) => {
    const newSubjectId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery({ text: "📂 جارٍ النقل..." });

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_move_id = undefined;
    session.awaiting_content_move_step = undefined;
    (session as any).awaiting_content_move_spec = undefined;
    (session as any).awaiting_content_move_target = undefined;
    await saveSession(session);

    // اقرأ القديم
    let oldData: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,subject_id,title",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      oldData = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    // نفّذ النقل
    try {
      await supabase.update("content", {
        subject_id: newSubjectId,
        last_modified_at: new Date().toISOString(),
        last_modified_by: ctx.from.id,
      }, `id=eq.${contentId}`);

      // audit log
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      await writeContentAuditLog(supabase, {
        content_id: contentId,
        action: "move",
        old_data: oldData ? { subject_id: oldData.subject_id } : null,
        new_data: { subject_id: newSubjectId },
        performed_by_position_id: positionId,
        performed_by_telegram_id: ctx.from.id,
      });

      const newSubjectName = getSubjectById(newSubjectId)?.name || "غير معروف";
      await ctx.editMessageText(
        ADMIN_TEXTS.content_move.success(newSubjectName),
        {
          reply_markup: new InlineKeyboard()
            .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
            .row()
            .text("🔙 إدارة المحتوى", "content_mgmt"),
          parse_mode: "Markdown",
        }
      );
    } catch (e) {
      console.error("Content move error:", e);
      await ctx.reply("⚠️ فشل النقل. حاول مرة أخرى.");
    }
  });

  // إلغاء النقل
  bot.callbackQuery("cancel_move", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const contentId = session.awaiting_content_move_id;
    session.awaiting_content_move_id = undefined;
    session.awaiting_content_move_step = undefined;
    (session as any).awaiting_content_move_spec = undefined;
    (session as any).awaiting_content_move_target = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_move.canceled,
      {
        reply_markup: new InlineKeyboard()
          .text(contentId ? "📄 تفاصيل المحتوى" : "🔙 إدارة المحتوى", contentId ? `content_detail_${contentId}` : "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 📋 نسخ المحتوى
  // ============================================

  // بدء النسخ — اختيار الكلية
  bot.callbackQuery(/copy_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_copy_id = contentId;
    session.awaiting_content_copy_step = "college";
    await saveSession(session);

    // اقرأ المادة المصدر
    let sourceSubjectName = "غير معروف";
    try {
      const result = await supabase.select("content", {
        columns: "subject_id,title",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      const content = Array.isArray(result) ? result[0] : result;
      if (content?.subject_id) {
        sourceSubjectName = getSubjectById(content.subject_id)?.name || "غير معروف";
      }
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    const kb = collegesKeyboard("copy", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.title(sourceSubjectName),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار الكلية → التخصص
  bot.callbackQuery(/copy_col_(\d+)_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const kb = specialtiesKeyboard(collegeId, "copy", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.select_specialty(college?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار التخصص → المستوى + تخزين specId
  bot.callbackQuery(/copy_spec_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    (session as any).awaiting_content_copy_spec = specId;
    await saveSession(session);

    const spec = getSpecialtyById(specId);
    const kb = levelsKeyboard(specId, "copy", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.select_level(spec?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المستوى → المادة
  bot.callbackQuery(/copy_lvl_(\d+)_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const specId = (session as any).awaiting_content_copy_spec;
    if (!specId) {
      await ctx.reply("⚠️ انتهت الجلسة. ابدأ النسخ من جديد.");
      return;
    }

    const spec = getSpecialtyById(specId);
    const kb = await subjectsKeyboard(supabase, specId, level, "copy", contentId);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.select_subject(spec?.name || "", level),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المادة → تأكيد النسخ
  bot.callbackQuery(/copy_subj_(\d+)_(\d+)/, async (ctx) => {
    const targetSubjectId = parseInt(ctx.match[1]);
    const contentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    // اقرأ المصدر
    let sourceContent: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,subject_id,title,content_type_id,file_name,file_size_mb,telegram_message_id,telegram_file_id,is_starred",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      sourceContent = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    if (!sourceContent) {
      await ctx.reply("⚠️ المحتوى المصدر غير موجود.");
      return;
    }

    const sourceSubjectName = getSubjectById(sourceContent.subject_id)?.name || "غير معروف";
    const targetSubjectName = getSubjectById(targetSubjectId)?.name || "غير معروف";

    // خزّن targetSubjectId
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    (session as any).awaiting_content_copy_target = targetSubjectId;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.confirm(sourceSubjectName, targetSubjectName),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.content_copy.btn_confirm, `confirm_copy_${targetSubjectId}_${contentId}`)
          .text(ADMIN_TEXTS.content_copy.btn_cancel, `cancel_copy`)
          .row()
          .text("🔙 تفاصيل المحتوى", `content_detail_${contentId}`),
        parse_mode: "Markdown",
      }
    );
  });

  // تأكيد النسخ — تنفيذ (إنشاء سجل جديد بنفس file_id)
  bot.callbackQuery(/confirm_copy_(\d+)_(\d+)/, async (ctx) => {
    const targetSubjectId = parseInt(ctx.match[1]);
    const sourceContentId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery({ text: "📋 جارٍ النسخ..." });

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_copy_id = undefined;
    session.awaiting_content_copy_step = undefined;
    (session as any).awaiting_content_copy_spec = undefined;
    (session as any).awaiting_content_copy_target = undefined;
    await saveSession(session);

    // اقرأ المصدر
    let sourceContent: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,subject_id,content_type_id,title,file_name,file_size_mb,file_size_bytes,mime_type,telegram_message_id,telegram_file_id,is_starred,academic_year",
        filter: `id=eq.${sourceContentId}`,
        single: true,
      });
      sourceContent = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Source content fetch error:", e);
    }

    if (!sourceContent) {
      await ctx.reply("⚠️ المحتوى المصدر غير موجود.");
      return;
    }

    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    let newContentId: number | null = null;

    try {
      const result = await supabase.insert("content", {
        subject_id: targetSubjectId,
        content_type_id: sourceContent.content_type_id,
        title: sourceContent.title,
        file_name: sourceContent.file_name,
        file_size_mb: sourceContent.file_size_mb || 0,
        file_size_bytes: sourceContent.file_size_bytes || null,
        mime_type: sourceContent.mime_type || null,
        telegram_message_id: sourceContent.telegram_message_id || null,
        telegram_file_id: sourceContent.telegram_file_id,
        added_by_position_id: positionId,
        added_by_telegram_id: ctx.from.id,
        is_starred: false, // النسخة الجديدة ليست مميزة
        is_active: true,
        academic_year: sourceContent.academic_year || new Date().getFullYear().toString(),
      }) as any;
      newContentId = result?.id || null;
    } catch (e: any) {
      console.error("Content copy insert error:", e);
      await ctx.reply(
        `⚠️ فشل نسخ المحتوى.\n\nالسبب: ${(e?.message || "غير معروف").substring(0, 150)}`,
        {
          reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // audit log
    await writeContentAuditLog(supabase, {
      content_id: newContentId,
      action: "copy",
      old_data: { source_content_id: sourceContentId, source_subject_id: sourceContent.subject_id },
      new_data: { target_subject_id: targetSubjectId, title: sourceContent.title },
      performed_by_position_id: positionId,
      performed_by_telegram_id: ctx.from.id,
    });

    const targetSubjectName = getSubjectById(targetSubjectId)?.name || "غير معروف";
    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.success(targetSubjectName),
      {
        reply_markup: new InlineKeyboard()
          .text("📄 عرض النسخة الجديدة", `content_detail_${newContentId}`)
          .row()
          .text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // إلغاء النسخ
  bot.callbackQuery("cancel_copy", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const contentId = session.awaiting_content_copy_id;
    session.awaiting_content_copy_id = undefined;
    session.awaiting_content_copy_step = undefined;
    (session as any).awaiting_content_copy_spec = undefined;
    (session as any).awaiting_content_copy_target = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_copy.canceled,
      {
        reply_markup: new InlineKeyboard()
          .text(contentId ? "📄 تفاصيل المحتوى" : "🔙 إدارة المحتوى", contentId ? `content_detail_${contentId}` : "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });
}
