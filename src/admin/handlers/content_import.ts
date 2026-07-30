// ============================================
// 📥 Content Import Handler (الاستيراد المتتابع)
// ============================================
// هذا الملف يحتوي على:
//   - import_content: بدء الاستيراد (اختيار الكلية)
//   - import_col_<collegeId>: اختيار التخصص
//   - import_spec_<specId>: اختيار المستوى
//   - import_lvl_<level>: اختيار المادة
//   - import_subj_<subjectId>: اختيار نوع المحتوى
//   - import_type_<typeId>: طلب الملف الأول
//   - import_skip: تخطي الملف الحالي
//   - import_finish: إنهاء الاستيراد
//   - cancel_import: إلغاء الاستيراد
//
// التدفق:
//   college → specialty → level → subject → type → file → title → file (loop)
//
// لكل ملف:
//   1. الطالب يرسل ملفاً (يُفحص نوعه)
//   2. البوت يطلب العنوان
//   3. الطالب يرسل العنوان
//   4. البوت يرفع الملف + يسجل في DB + audit log
//   5. يطلب الملف التالي (مع زر تخطي وإنهاء)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS, formatContentCard } from "../../shared/texts";
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
import { uploadFileToStorageChannel, validateUploadedFile, bytesToMb } from "../../shared/storage";

// ============================================
// Helper: بناء keyboard للاستيراد (تخطي + إنهاء + إلغاء)
// ============================================
function importLoopKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(ADMIN_TEXTS.content_import.btn_skip, "import_skip")
    .row()
    .text(ADMIN_TEXTS.content_import.btn_finish, "import_finish")
    .row()
    .text(ADMIN_TEXTS.content_import.btn_cancel, "cancel_import");
}

// ============================================
// Helper: رفع ملف واحد في الاستيراد المتتابع
// ============================================
async function importSingleFile(
  bot: Bot,
  supabase: SupabaseClient,
  ctx: any,
  session: any,
  file: { file_id: string; file_name: string; file_size: number; mime_type?: string },
  title: string
): Promise<{ success: boolean; contentId?: number; error?: string }> {
  const ctx2 = session.import_context;
  if (!ctx2?.subject_id || !ctx2?.content_type) {
    return { success: false, error: "سياق الاستيراد ناقص" };
  }

  // 1. position_id
  const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);

  // 2. جلب بيانات المادة + الكلية + قناة التخزين
  let storageChannelId: string | null = null;
  let collegeName: string | null = null;
  let specialtyName: string | null = null;
  let level: number | null = null;
  let semester: number | null = null;

  try {
    const subjResult = await supabase.select("subjects", {
      columns: "id,specialty_id,level,semester",
      filter: `id=eq.${ctx2.subject_id}`,
      single: true,
    }) as any;
    const subject = Array.isArray(subjResult) ? subjResult[0] : subjResult;
    if (subject) {
      level = subject.level;
      semester = subject.semester;
      if (subject.specialty_id) {
        const specResult = await supabase.select("specialties", {
          columns: "college_id,name",
          filter: `id=eq.${subject.specialty_id}`,
          single: true,
        }) as any;
        const spec = Array.isArray(specResult) ? specResult[0] : specResult;
        if (spec) {
          specialtyName = spec.name;
          if (spec.college_id) {
            const collegeResult = await supabase.select("colleges", {
              columns: "storage_channel_id,name",
              filter: `id=eq.${spec.college_id}`,
              single: true,
            }) as any;
            const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;
            if (college) {
              collegeName = college.name;
              storageChannelId = college.storage_channel_id;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Subject/specialty/college fetch error:", e);
  }

  if (!storageChannelId) {
    return { success: false, error: "لا توجد قناة تخزين لهذه الكلية" };
  }

  const fileSizeBytes = file.file_size || 0;
  const fileSizeMb = bytesToMb(fileSizeBytes);
  const subjectName = getSubjectById(ctx2.subject_id)?.name || "غير معروف";

  // 3. caption منسق
  const caption = formatContentCard({
    title,
    contentType: ctx2.content_type,
    subjectName,
    collegeName: collegeName || undefined,
    specialtyName: specialtyName || undefined,
    level,
    semester,
    fileSizeBytes: fileSizeBytes || null,
    fileSizeMb: fileSizeMb || null,
    contributorName: ctx.from.first_name || "مسؤول",
    uploadedAt: new Date().toISOString(),
    description: null,
    ihsanId: null,
  }, "channel_archive");

  // 4. رفع الملف لقناة التخزين
  let uploaded: any = null;
  try {
    uploaded = await uploadFileToStorageChannel(
      bot,
      storageChannelId,
      { fileId: file.file_id, fileName: file.file_name },
      { caption, parseMode: "Markdown" }
    );
  } catch (e: any) {
    return { success: false, error: `فشل رفع الملف: ${(e?.message || "").substring(0, 80)}` };
  }

  // 5. إدراج في DB
  let contentId: number | null = null;
  try {
    const result = await supabase.insert("content", {
      subject_id: ctx2.subject_id,
      content_type_id: ctx2.content_type,
      title,
      file_name: file.file_name,
      file_size_mb: fileSizeMb || 0,
      file_size_bytes: fileSizeBytes || null,
      mime_type: file.mime_type || null,
      telegram_message_id: uploaded.message_id,
      telegram_file_id: uploaded.file_id,
      added_by_position_id: positionId,
      added_by_telegram_id: ctx.from.id,
      is_starred: false,
      is_active: true,
      academic_year: new Date().getFullYear().toString(),
    }) as any;
    contentId = result?.id || null;
  } catch (e: any) {
    return { success: false, error: `فشل إدراج DB: ${(e?.message || "").substring(0, 80)}` };
  }

  // 6. audit log
  await writeContentAuditLog(supabase, {
    content_id: contentId,
    action: "import",
    old_data: null,
    new_data: {
      title,
      subject_id: ctx2.subject_id,
      content_type_id: ctx2.content_type,
      file_name: file.file_name,
      batch_import: true,
    },
    performed_by_position_id: positionId,
    performed_by_telegram_id: ctx.from.id,
  });

  return { success: true, contentId: contentId || undefined };
}

// ============================================
// Helper: الحصول على scope college_ids
// ============================================
function getAdminCollegeIds(perms: any): number[] {
  if (perms.is_central) {
    return COLLEGES.map((c) => c.id);
  }
  const colleges = perms.effective_scope?.colleges;
  if (!colleges) return [];
  return Array.isArray(colleges) ? colleges : Array.from(colleges);
}

export function registerContentImportHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // بدء الاستيراد — اختيار الكلية
  // ============================================
  bot.callbackQuery("import_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    session.awaiting_import_step = "college";
    session.import_context = { import_count: 0 };
    await saveSession(session);

    // لو مسؤول كلية → تخطَّ اختيار الكلية
    if (!perms.is_central) {
      const collegeIds = getAdminCollegeIds(perms);
      if (collegeIds.length === 0) {
        await ctx.reply("⚠️ لا توجد كلية ضمن نطاق صلاحياتك.");
        return;
      }
      const collegeId = collegeIds[0];
      session.import_context.college_id = collegeId;
      session.awaiting_import_step = "specialty";
      await saveSession(session);

      const college = getCollegeById(collegeId);
      const specialties = getSpecialtiesByCollege(collegeId);
      const kb = new InlineKeyboard();
      specialties.forEach((s) => {
        kb.text(`📚 ${s.short_name || s.name}`, `import_spec_${s.id}`).row();
      });
      kb.text("❌ إلغاء", "cancel_import");
      await ctx.editMessageText(
        ADMIN_TEXTS.content_import.select_specialty(college?.name || ""),
        { reply_markup: kb, parse_mode: "Markdown" }
      );
      return;
    }

    // مركزي → عرض الكليات
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `import_col_${c.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_import");
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.title,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار الكلية → التخصص
  bot.callbackQuery(/import_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.import_context = { ...session.import_context, college_id: collegeId };
    session.awaiting_import_step = "specialty";
    await saveSession(session);

    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(`📚 ${s.short_name || s.name}`, `import_spec_${s.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_import");
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.select_specialty(college?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار التخصص → المستوى
  bot.callbackQuery(/import_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.import_context = { ...session.import_context, specialty_id: specId };
    session.awaiting_import_step = "level";
    await saveSession(session);

    const spec = getSpecialtyById(specId);
    const maxLevel = spec?.levels_count || 6;
    const kb = new InlineKeyboard();
    for (let i = 1; i <= maxLevel; i++) {
      kb.text(`📊 المستوى ${i}`, `import_lvl_${i}`);
      if (i % 2 === 0) kb.row();
    }
    kb.row().text("❌ إلغاء", "cancel_import");
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.select_level(spec?.name || ""),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المستوى → المادة
  bot.callbackQuery(/import_lvl_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.import_context = { ...session.import_context, level };
    session.awaiting_import_step = "subject";
    await saveSession(session);

    let subjects: any[] = [];
    try {
      const result = await supabase.select("subjects", {
        columns: "id,name,semester",
        filter: `specialty_id=eq.${session.import_context?.specialty_id}&level=eq.${level}`,
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

    const kb = new InlineKeyboard();
    subjects.forEach((s) => {
      kb.text(`📖 ${s.name} (ف${s.semester})`, `import_subj_${s.id}`).row();
    });
    kb.text("❌ إلغاء", "cancel_import");

    const spec = getSpecialtyById(session.import_context?.specialty_id);
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.select_subject(spec?.name || "", level),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار المادة → نوع المحتوى
  bot.callbackQuery(/import_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.import_context = { ...session.import_context, subject_id: subjectId };
    session.awaiting_import_step = "type";
    await saveSession(session);

    const kb = new InlineKeyboard();
    for (let i = 0; i < CONTENT_TYPES.length; i += 2) {
      kb.text(
        `${CONTENT_TYPES[i].emoji} ${CONTENT_TYPES[i].name}`,
        `import_type_${CONTENT_TYPES[i].id}`
      );
      if (CONTENT_TYPES[i + 1]) {
        kb.text(
          `${CONTENT_TYPES[i + 1].emoji} ${CONTENT_TYPES[i + 1].name}`,
          `import_type_${CONTENT_TYPES[i + 1].id}`
        );
      }
      kb.row();
    }
    kb.text("❌ إلغاء", "cancel_import");
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.select_type,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // اختيار النوع → طلب الملف الأول
  bot.callbackQuery(/import_type_(\w+)/, async (ctx) => {
    const typeId = ctx.match[1];
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.import_context = { ...session.import_context, content_type: typeId };
    session.awaiting_import_step = "file";
    await saveSession(session);

    const typeName = getContentTypeLabel(typeId);
    const subjectName = getSubjectById(session.import_context?.subject_id)?.name || "غير معروف";

    const kb = new InlineKeyboard().text("❌ إلغاء", "cancel_import");
    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.prompt_first_file(typeName, subjectName),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // استقبال الملف (يُعالج في messages.ts عبر session.awaiting_import_step === "file")
  // استقبال العنوان (يُعالج في messages.ts عبر session.awaiting_import_step === "title")

  // تخطي الملف الحالي
  bot.callbackQuery("import_skip", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏭ تم التخطي" });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_import_step = "file";
    // لا نغير import_count
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.skipped + "\n\n" +
      ADMIN_TEXTS.content_import.prompt_next_file(session.import_context?.import_count || 0),
      { reply_markup: importLoopKeyboard(), parse_mode: "Markdown" }
    );
  });

  // إنهاء الاستيراد
  bot.callbackQuery("import_finish", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ إنهاء..." });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const count = session.import_context?.import_count || 0;
    const subjectId = session.import_context?.subject_id;
    const subjectName = subjectId ? (getSubjectById(subjectId)?.name || "غير معروف") : "غير معروف";

    session.awaiting_import_step = undefined;
    session.import_context = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.summary(count, subjectName),
      {
        reply_markup: new InlineKeyboard()
          .text("📂 استعراض المحتوى", "browse_content")
          .row()
          .text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // إلغاء الاستيراد
  bot.callbackQuery("cancel_import", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_import_step = undefined;
    session.import_context = undefined;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_import.canceled,
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });
}

// تصدير الدوال المساعدة للاستخدام في messages.ts
export { importSingleFile, importLoopKeyboard };
