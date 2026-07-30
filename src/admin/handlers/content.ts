// ============================================
// 📁 Content Handlers — browse, detail, upload wizard, delete
// ============================================
// هذا الملف يحتوي على:
//   - content_mgmt: القائمة الرئيسية لإدارة المحتوى
//   - browse_content: استعراض المحتوى مع pagination
//   - content_detail_<id>: تفاصيل المحتوى مع الإجراءات
//   - delete_content_<id> + confirm_delete_content_<id>: الحذف
//   - upload_content + upload_type_* + upload_col_* + upload_spec_* + upload_level_* + upload_subj_*: مسار الرفع الكامل
//
// ملاحظات:
//   - تمييز المحتوى (star/unstar) يُدار من قسم "إدارة الإحسان" عند الاعتماد
//   - هذا القسم لا يتعامل مع التمييز إطلاقاً
//   - audit logs تُكتب لكل عملية (create/delete)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions, getManageableContent } from "../../shared/rbac";
import {
  CONTENT_TYPES,
  getContentTypeLabel,
  getContentTypeEmoji,
} from "../../shared/data/admins";
import { getSubjectById } from "../../shared/data/subjects";
import { getSpecialtyById, getCollegeById, getSpecialtiesByCollege, COLLEGES } from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminUser, getAdminPrimaryPositionId, writeContentAuditLog } from "../helpers";

// ============================================
// Helper: بناء keyboard لأنواع المحتوى
// ============================================
function contentTypesKeyboard(prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < CONTENT_TYPES.length; i += 2) {
    kb.text(
      `${CONTENT_TYPES[i].emoji} ${CONTENT_TYPES[i].name}`,
      `${prefix}_${CONTENT_TYPES[i].id}`
    );
    if (CONTENT_TYPES[i + 1]) {
      kb.text(
        `${CONTENT_TYPES[i + 1].emoji} ${CONTENT_TYPES[i + 1].name}`,
        `${prefix}_${CONTENT_TYPES[i + 1].id}`
      );
    }
    kb.row();
  }
  return kb;
}

// ============================================
// Helper: عرض تفاصيل المحتوى مع الإجراءات
// ============================================
async function showContentDetail(bot: Bot, supabase: SupabaseClient, ctx: any, contentId: number): Promise<void> {
  let content: any = null;
  try {
    const result = await supabase.select("content", {
      columns: "id,title,file_name,file_size_mb,content_type_id,subject_id,is_starred,download_count,added_by_telegram_id,added_at,academic_year",
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
  const specialty = subject ? getSpecialtyById(subject.specialty_id) : null;
  const college = specialty ? getCollegeById(specialty.college_id) : null;
  const adderUser = await getAdminUser(supabase, content.added_by_telegram_id);

  const msg = ADMIN_TEXTS.content_detail.title +
    ADMIN_TEXTS.content_detail.details({
      title: content.title,
      type_label: getContentTypeLabel(content.content_type_id),
      subject_name: subject?.name || "غير معروف",
      specialty_name: specialty?.short_name || "غير معروف",
      college_name: college?.short_name || "غير معروف",
      level: subject?.level || 0,
      semester: subject?.semester || 0,
      file_size: parseFloat(content.file_size_mb) || 0,
      download_count: content.download_count || 0,
      is_starred: content.is_starred || false,
      added_by: adderUser?.first_name || "غير معروف",
      added_at: content.added_at || "غير معروف",
      academic_year: content.academic_year || "غير معروف",
    });

  const kb = new InlineKeyboard()
    .text(ADMIN_TEXTS.content_detail.btn_edit, `edit_content_${contentId}`)
    .text(ADMIN_TEXTS.content_detail.btn_move, `move_content_${contentId}`)
    .row()
    .text(ADMIN_TEXTS.content_detail.btn_copy, `copy_content_${contentId}`)
    .text(ADMIN_TEXTS.content_detail.btn_delete, `delete_content_${contentId}`)
    .row()
    .text("🔙 استعراض المحتوى", "browse_content")
    .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

  await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
}

// ============================================
// Helper: الحصول على scope label للمسؤول الحالي
// ============================================
async function getScopeLabel(perms: any): Promise<string> {
  if (perms.is_central) return "🌍 كل الكليات";
  const collegesSet: Set<number> | undefined = perms.effective_scope?.colleges;
  if (collegesSet && collegesSet.size > 0) {
    const collegeIds = Array.from(collegesSet);
    const colleges = collegeIds.map((id: number) => getCollegeById(id)?.short_name).filter(Boolean);
    if (colleges.length > 0) return `🏛 ${colleges.join("، ")}`;
  }
  return "📍 نطاقك";
}

export function registerContentHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A5: القائمة الرئيسية لإدارة المحتوى ======
  bot.callbackQuery("content_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    const scopeLabel = await getScopeLabel(perms);

    let kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_mgmt.btn_browse, "browse_content")
      .text(ADMIN_TEXTS.content_mgmt.btn_upload, "upload_content")
      .row()
      .text(ADMIN_TEXTS.content_mgmt.btn_search, "search_content")
      .text(ADMIN_TEXTS.content_mgmt.btn_stats, "content_stats")
      .row()
      .text(ADMIN_TEXTS.content_mgmt.btn_import, "import_content");

    if (perms.is_central) {
      kb.row().text(ADMIN_TEXTS.content_mgmt.btn_audit_log, "content_audit_log");
    }
    kb.row().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.content_mgmt.title(scopeLabel), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== A5b: استعراض المحتوى ======
  bot.callbackQuery("browse_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    let manageableContent: any[] = [];
    try {
      manageableContent = await getManageableContent(
        ctx.from.id,
        session.content_filter
      );
    } catch (e) {
      console.error("browse_content: getManageableContent error:", e);
      await ctx.editMessageText(
        "⚠️ *تعذّر تحميل المحتوى*\n\nحدث خطأ أثناء جلب المحتوى. حاول مرة أخرى لاحقاً.",
        {
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    if (manageableContent.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.content_mgmt.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.browse_content.title(manageableContent.length);
    const kb = new InlineKeyboard();
    manageableContent.slice(0, 8).forEach((c) => {
      const icon = c.is_starred ? "⭐" : getContentTypeEmoji(c.content_type_id);
      kb.text(`${icon} ${c.title.substring(0, 30)} (${c.download_count}⬇️)`, `content_detail_${c.id}`).row();
    });
    if (manageableContent.length > 8) {
      msg += `\n\n📋 عرض أول 8 من ${manageableContent.length} عنصر.\n💡 فلترة المحتوى قريباً في المرحلة 2.`;
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // ====== A5c: تفاصيل المحتوى ======
  bot.callbackQuery(/content_detail_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await showContentDetail(bot, supabase, ctx, contentId);
  });

  // ====== حذف المحتوى (تأكيد) ======
  bot.callbackQuery(/delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    let content: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,title,subject_id",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }
    await ctx.answerCallbackQuery();
    if (!content) return;
    await ctx.editMessageText(
      ADMIN_TEXTS.content_detail.delete_confirm(content.title),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.content_detail.btn_confirm_delete, `confirm_delete_content_${contentId}`)
          .text(ADMIN_TEXTS.content_detail.btn_cancel_delete, `content_detail_${contentId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== تأكيد الحذف + audit log ======
  bot.callbackQuery(/confirm_delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🗑 جارٍ الحذف..." });

    // اقرأ بيانات المحتوى قبل الحذف (للـ audit log + لحذف الملف من القناة)
    let content: any = null;
    try {
      const result = await supabase.select("content", {
        columns: "id,title,subject_id,telegram_message_id,telegram_file_id",
        filter: `id=eq.${contentId}`,
        single: true,
      });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Content fetch error:", e);
    }

    // احذف من DB (soft delete)
    try {
      await supabase.update("content", {
        is_active: false,
        last_modified_at: new Date().toISOString(),
        last_modified_by: ctx.from.id,
      }, `id=eq.${contentId}`);
    } catch (e) {
      console.error("Content delete error:", e);
    }

    // احذف الملف من قناة التخزين
    if (content?.telegram_message_id && content?.subject_id) {
      try {
        // subject → specialty → college → storage_channel_id
        const subjectResult = await supabase.select("subjects", {
          columns: "specialty_id",
          filter: `id=eq.${content.subject_id}`,
          single: true,
        }) as any;
        const subject = Array.isArray(subjectResult) ? subjectResult[0] : subjectResult;
        if (subject?.specialty_id) {
          const specResult = await supabase.select("specialties", {
            columns: "college_id",
            filter: `id=eq.${subject.specialty_id}`,
            single: true,
          }) as any;
          const spec = Array.isArray(specResult) ? specResult[0] : specResult;
          if (spec?.college_id) {
            const collegeResult = await supabase.select("colleges", {
              columns: "storage_channel_id",
              filter: `id=eq.${spec.college_id}`,
              single: true,
            }) as any;
            const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;
            if (college?.storage_channel_id) {
              try {
                await bot.api.deleteMessage(college.storage_channel_id, content.telegram_message_id);
                console.log(`🗑 [Content] Deleted file from storage channel for content #${contentId}`);
              } catch (e) {
                console.warn(`⚠️ [Content] Failed to delete file from storage (may be already deleted):`, e);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ [Content] Failed to find storage channel for cleanup:`, e);
      }
    }

    // اكتب audit log
    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    await writeContentAuditLog(supabase, {
      content_id: contentId,
      action: "delete",
      old_data: content ? { title: content.title, subject_id: content.subject_id } : null,
      new_data: null,
      performed_by_position_id: positionId,
      performed_by_telegram_id: ctx.from.id,
    });

    await ctx.editMessageText(
      ADMIN_TEXTS.content_detail.delete_success,
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 استعراض المحتوى", "browse_content")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // A5a: مسار الرفع الكامل (Upload Wizard)
  // ============================================
  // التدفق: type → college (مركزي فقط) → specialty → level → subject → file → title → description → done
  // ============================================

  // الخطوة 1: اختيار نوع المحتوى
  bot.callbackQuery("upload_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    // إعادة ضبط سياق الرفع
    session.awaiting_upload_step = "type";
    session.upload_context = {};
    await saveSession(session);

    const kb = contentTypesKeyboard("upload_type");
    kb.text("❌ إلغاء", "cancel_upload").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("1", "نوع المحتوى") + ADMIN_TEXTS.upload_wizard.select_type,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // الخطوة 2: بعد اختيار النوع → عرض الكليات (للمركزي) أو التخصصات (للكلية)
  bot.callbackQuery(/upload_type_(\w+)/, async (ctx) => {
    const typeId = ctx.match[1];
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    session.upload_context = { ...session.upload_context, content_type: typeId };
    await saveSession(session);

    // لو مركزي → يختار الكلية
    if (perms.is_central) {
      session.awaiting_upload_step = "college";
      await saveSession(session);

      const kb = new InlineKeyboard();
      COLLEGES.forEach((c) => {
        kb.text(`${c.emoji} ${c.short_name}`, `upload_col_${c.id}`).row();
      });
      kb.text("❌ إلغاء", "cancel_upload");

      await ctx.editMessageText(
        ADMIN_TEXTS.upload_wizard.progress("2", "الكلية") + ADMIN_TEXTS.upload_wizard.select_college,
        { reply_markup: kb, parse_mode: "Markdown" }
      );
      return;
    }

    // لو مسؤول كلية → ابحث عن كليته وانتقل مباشرة لاختيار التخصص
    const collegeIds: number[] = perms.effective_scope?.colleges
      ? (Array.isArray(perms.effective_scope.colleges)
          ? perms.effective_scope.colleges
          : Array.from(perms.effective_scope.colleges))
      : [];
    if (collegeIds.length === 0) {
      await ctx.reply("⚠️ لا توجد كلية ضمن نطاق صلاحياتك.");
      return;
    }
    const collegeId = collegeIds[0];
    session.upload_context.college_id = collegeId;
    session.awaiting_upload_step = "specialty";
    await saveSession(session);

    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(`📚 ${s.short_name || s.name}`, `upload_spec_${s.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_upload");

    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("2", "التخصص") + ADMIN_TEXTS.upload_wizard.select_specialty(college?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // الخطوة 3: اختيار الكلية → عرض التخصصات
  bot.callbackQuery(/upload_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.upload_context = { ...session.upload_context, college_id: collegeId };
    session.awaiting_upload_step = "specialty";
    await saveSession(session);

    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد تخصصات في هذه الكلية.");
      return;
    }

    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(`📚 ${s.short_name || s.name}`, `upload_spec_${s.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_upload");

    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("3", "التخصص") + ADMIN_TEXTS.upload_wizard.select_specialty(college?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // الخطوة 4: اختيار التخصص → عرض المستويات
  bot.callbackQuery(/upload_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.upload_context = { ...session.upload_context, specialty_id: specId };
    session.awaiting_upload_step = "level";
    await saveSession(session);

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // عرض مستويات 1-6 (أو حسب levels_count)
    const maxLevel = spec.levels_count || 6;
    const kb = new InlineKeyboard();
    for (let i = 1; i <= maxLevel; i++) {
      kb.text(`📊 المستوى ${i}`, `upload_lvl_${i}`);
      if (i % 2 === 0) kb.row();
    }
    kb.row().text("❌ إلغاء", "cancel_upload");

    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("4", "المستوى") + ADMIN_TEXTS.upload_wizard.select_level(spec.name),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // الخطوة 5: اختيار المستوى → عرض المواد
  bot.callbackQuery(/upload_lvl_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.upload_context = { ...session.upload_context, level };
    session.awaiting_upload_step = "subject";
    await saveSession(session);

    // ابحث عن المواد في DB
    let subjects: any[] = [];
    try {
      const result = await supabase.select("subjects", {
        columns: "id,name,semester",
        filter: `specialty_id=eq.${session.upload_context.specialty_id}&level=eq.${level}`,
        order: "semester.asc,name.asc",
      });
      subjects = Array.isArray(result) ? result : [];
    } catch (e) {
      console.error("Subjects fetch error:", e);
    }

    if (subjects.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد مواد في هذا المستوى.");
      return;
    }

    // اعرض المواد مع الفصل
    const kb = new InlineKeyboard();
    subjects.forEach((s) => {
      kb.text(`📖 ${s.name} (ف${s.semester})`, `upload_subj_${s.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_upload");

    const spec = getSpecialtyById(session.upload_context.specialty_id);
    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("5", "المادة") + ADMIN_TEXTS.upload_wizard.select_subject(spec?.name || "", level),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // الخطوة 6: اختيار المادة → طلب رفع الملف
  bot.callbackQuery(/upload_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.upload_context = { ...session.upload_context, subject_id: subjectId };
    session.awaiting_upload_step = "file";
    await saveSession(session);

    const subject = getSubjectById(subjectId);
    const typeId = session.upload_context.content_type;
    const typeLabel = getContentTypeLabel(typeId);

    const kb = new InlineKeyboard()
      .text("❌ إلغاء", "cancel_upload");

    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.progress("6", "الملف") +
      ADMIN_TEXTS.upload_wizard.prompt_file(typeLabel, subject?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // إلغاء عملية الرفع
  bot.callbackQuery("cancel_upload", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_upload_step = undefined;
    session.upload_context = undefined;
    await saveSession(session);
    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.canceled,
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 إدارة المحتوى", "content_mgmt")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // ملاحظة: المعالجات التالية مُسجّلة في ملفات منفصلة:
  //   - search_content        → content_search_stats.ts
  //   - content_stats         → content_search_stats.ts
  //   - import_content        → content_import.ts
  //   - content_audit_log     → content_audit_log.ts
  //   - edit_content_<id>     → content_edit_move_copy.ts
  //   - move_content_<id>     → content_edit_move_copy.ts
  //   - copy_content_<id>     → content_edit_move_copy.ts
  //
  // لا تُسجّلها هنا كـ stubs — grammy يُنفّذ أول middleware مطابق
  // فلو سُجّلت هنا، ستعترض المعالجات الحقيقية في الملفات الأخرى.
  // ============================================
}
