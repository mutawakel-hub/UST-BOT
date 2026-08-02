// ============================================
// 💬 Message Handlers — استقبال الرسائل والملفات
// ============================================
// هذا الملف يحتوي على:
//   - bot.on(":text") — استقبال النصوص (تعميم/مادة/نص/محتوى/منصب/قناة/تكريم)
//   - bot.on(":document") — استقبال الملفات (تعميمات + رفع محتوى)
//   - bot.on(":photo") — استقبال الصور (للتعميمات)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient, logBroadcast } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import {
  customTexts,
  getAdminUser,
  getHonors,
  getPositionById,
  getPositionHolder,
  getChannelById,
  getAdminPrimaryPositionId,
  writeContentAuditLog,
} from "../helpers";
import {
  getSubjectByIdFromDB,
  updateSubject,
  writeSubjectAuditLog,
  normalizeSubjectName,
  updateCommitteeChannel,
  generateInviteToken,
  createInvitation,
} from "../../shared/db";
import { getCollegeById, getSpecialtyById } from "../../shared/data/colleges";
import {
  uploadFileToStorageChannel,
  formatFileSize,
  bytesToMb,
} from "../../shared/storage";
import {
  CONTENT_TYPES,
  getContentTypeLabel,
  getContentTypeEmoji,
} from "../../shared/data/admins";
import { getSubjectById } from "../../shared/data/subjects";
import { invalidateSubjectCache } from "../../shared/data/subjects";
import { saveCustomText, resetCustomText } from "../../shared/text-resolver";
import { formatContentCard } from "../../shared/texts";
import { validateUploadedFile } from "../../shared/storage";
import { importSingleFile, importLoopKeyboard } from "./content_import";
import { executeContentSearch } from "./content_search_stats";

// ============================================
// Helper: تنفيذ الرفع الفعلي للمحتوى بعد استلام العنوان والوصف
// ============================================
// يقوم بـ:
//   1. الحصول على position_id الفعلي للمسؤول
//   2. جلب بيانات المادة (specialty_id, college_id, level, semester)
//   3. رفع الملف لقناة التخزين مع caption منسق (formatContentCard)
//   4. إنشاء سجل content في DB (بدون أعمدة غير موجودة)
//   5. كتابة audit log
//   6. إعلام المسؤول بالنجاح
// ============================================
async function executeContentUpload(bot: Bot, supabase: SupabaseClient, ctx: any, session: any): Promise<void> {
  const ctx2 = session.upload_context;

  // إعادة ضبط حالة الرفع قبل أي شيء (حتى لو فشل كل شيء، الجلسة نظيفة)
  session.awaiting_upload_step = undefined;
  session.upload_context = undefined;
  await saveSession(session);

  if (!ctx2 || !ctx2.subject_id || !ctx2.content_type || !ctx2.file_id) {
    await ctx.reply("⚠️ انتهت الجلسة أو ناقصة. ابدأ من جديد من ➕ إضافة محتوى.");
    return;
  }

  // 1. position_id الفعلي
  const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);

  // 2. جلب بيانات المادة من DB
  let subjectDb: any = null;
  let collegeName: string | null = null;
  let specialtyName: string | null = null;
  let storageChannelId: string | null = null;
  let level: number | null = null;
  let semester: number | null = null;

  try {
    const subjResult = await supabase.select("subjects", {
      columns: "id,specialty_id,level,semester",
      filter: `id=eq.${ctx2.subject_id}`,
      single: true,
    });
    subjectDb = Array.isArray(subjResult) ? subjResult[0] : subjResult;
    if (subjectDb) {
      level = subjectDb.level;
      semester = subjectDb.semester;
    }
  } catch (e) {
    console.error("Failed to fetch subject:", e);
  }

  if (subjectDb?.specialty_id) {
    try {
      const specResult = await supabase.select("specialties", {
        columns: "college_id,name",
        filter: `id=eq.${subjectDb.specialty_id}`,
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
    } catch (e) {
      console.error("Failed to fetch specialty/college:", e);
    }
  }

  if (!storageChannelId) {
    // fallback: جرّب من البيانات الثابتة
    const subjectStatic = getSubjectById(ctx2.subject_id);
    if (subjectStatic) {
      const spec = getSpecialtyById(subjectStatic.specialty_id);
      if (spec) {
        specialtyName = specialtyName || spec.name;
        const college = getCollegeById(spec.college_id);
        if (college) {
          collegeName = collegeName || college.name;
          storageChannelId = college.storage_channel_id;
        }
      }
    }
  }

  if (!storageChannelId) {
    await ctx.reply(
      "⚠️ لا توجد قناة تخزين لهذه الكلية. تأكد من إعداد القناة.",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // 3. بناء caption منسق
  const subjectName = getSubjectById(ctx2.subject_id)?.name || "غير معروف";
  const caption = formatContentCard({
    title: ctx2.title || ctx2.file_name || "إحسان إداري",
    contentType: ctx2.content_type,
    subjectName,
    collegeName: collegeName || undefined,
    specialtyName: specialtyName || undefined,
    level,
    semester,
    fileSizeBytes: ctx2.file_size_bytes || null,
    fileSizeMb: ctx2.file_size_mb || null,
    contributorName: ctx.from.first_name || "مسؤول",
    uploadedAt: new Date().toISOString(),
    description: ctx2.description,
    ihsanId: null,
  }, "channel_archive");

  // 4. رفع الملف لقناة التخزين
  let uploaded: any = null;
  try {
    uploaded = await uploadFileToStorageChannel(
      bot,
      storageChannelId,
      { fileId: ctx2.file_id, fileName: ctx2.file_name },
      {
        caption,
        parseMode: "Markdown",
      }
    );
  } catch (e: any) {
    console.error("File upload failed:", e);
    await ctx.reply(
      "❌ فشل رفع الملف لقناة التخزين. تأكد من أن البوت مشرف في القناة.\n\n" +
      `السبب: ${(e?.message || "غير معروف").substring(0, 100)}`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // 5. إنشاء سجل content في DB (بدون specialty_id/college_id/level/semester — غير موجودة في الجدول)
  let contentId: number | null = null;
  try {
    const result = await supabase.insert("content", {
      subject_id: ctx2.subject_id,
      content_type_id: ctx2.content_type,
      title: ctx2.title || ctx2.file_name || "إحسان إداري",
      file_name: ctx2.file_name,
      file_size_mb: ctx2.file_size_mb || 0,
      file_size_bytes: ctx2.file_size_bytes || null,
      mime_type: ctx2.file_mime || null,
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
    console.error("Content insert failed:", e);
    await ctx.reply(
      `⚠️ تم رفع الملف لقناة التخزين (message_id: ${uploaded.message_id})\n` +
      `لكن فشل تسجيله في قاعدة البيانات.\n\n` +
      `السبب: ${(e?.message || "غير معروف").substring(0, 150)}`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // 6. كتابة audit log
  await writeContentAuditLog(supabase, {
    content_id: contentId,
    action: "create",
    old_data: null,
    new_data: {
      title: ctx2.title,
      subject_id: ctx2.subject_id,
      content_type_id: ctx2.content_type,
      file_name: ctx2.file_name,
    },
    performed_by_position_id: positionId,
    performed_by_telegram_id: ctx.from.id,
  });

  // 7. إعلام المسؤول بالنجاح
  await ctx.reply(
    ADMIN_TEXTS.upload_wizard.success(ctx2.title || ctx2.file_name, subjectName),
    {
      reply_markup: new InlineKeyboard()
        .text("📂 استعراض المحتوى", "browse_content")
        .row()
        .text("➕ رفع محتوى آخر", "upload_content")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    }
  );
}

export function registerMessageHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== استقبال الرسائل النصية ======
  bot.on(":text", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (!session) {
      await ctx.reply("👋 أرسل /start للبدء.");
      return;
    }

    // استقبال نص التعميم (مع عرض المعاينة)
    if (session.awaiting_broadcast_text && session.broadcast_context) {
      session.awaiting_broadcast_text = false;
      session.pending_broadcast_text = ctx.message.text;
      const ctxData = session.broadcast_context;
      await ctx.reply(
        ADMIN_TEXTS.broadcast.preview(ctx.message.text, ctxData.scope_label, ctxData.count),
        {
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TEXTS.broadcast.btn_send, "confirm_broadcast")
            .text(ADMIN_TEXTS.broadcast.btn_cancel, "broadcast"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // =====================================================
    // استقبال استعلام البحث عن محتوى (المرحلة 4)
    // =====================================================
    if (session.awaiting_content_search) {
      session.awaiting_content_search = false;
      await saveSession(session);
      await executeContentSearch(supabase, ctx, ctx.message.text);
      return;
    }

    // استقبال اسم مادة جديدة
    // =====================================================
    // استقبال بيانات إضافة مادة (subjects CRUD)
    // =====================================================
    if (session.awaiting_subject_add_step && session.awaiting_subject_add_context) {
      const step = session.awaiting_subject_add_step;
      const ctx2 = session.awaiting_subject_add_context;
      const text = ctx.message.text.trim();

      if (step === "name") {
        if (!text) {
          await ctx.reply("⚠️ الاسم لا يمكن أن يكون فارغاً.");
          return;
        }
        ctx2.name = text;
        session.awaiting_subject_add_step = "code";
        await saveSession(session);
        await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_prompt_code, {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_add_subject"),
          parse_mode: "Markdown",
        });
        return;
      }

      if (step === "code") {
        ctx2.code = (text && text !== "-") ? text : null;
        session.awaiting_subject_add_step = "credits";
        await saveSession(session);
        await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_prompt_credits, {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_add_subject"),
          parse_mode: "Markdown",
        });
        return;
      }

      if (step === "credits") {
        if (text && text !== "-") {
          const credits = parseInt(text);
          if (isNaN(credits) || credits < 0) {
            await ctx.reply("⚠️ الساعات يجب أن تكون رقماً صحيحاً.");
            return;
          }
          ctx2.credits = credits;
        } else {
          ctx2.credits = null;
        }
        session.awaiting_subject_add_step = "has_theory";
        await saveSession(session);
        await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_prompt_theory, {
          reply_markup: new InlineKeyboard()
            .text("✅ نعم", "subj_add_theory_yes")
            .text("❌ لا", "subj_add_theory_no")
            .row()
            .text("❌ إلغاء", "cancel_add_subject"),
          parse_mode: "Markdown",
        });
        return;
      }
    }

    // =====================================================
    // استقبال تعديل حقل مادة (name/code/credits)
    // =====================================================
    if (session.awaiting_subject_edit_id && session.awaiting_subject_edit_field) {
      const subjectId = session.awaiting_subject_edit_id;
      const field = session.awaiting_subject_edit_field;
      const text = ctx.message.text.trim();

      session.awaiting_subject_edit_id = undefined;
      session.awaiting_subject_edit_field = undefined;
      await saveSession(session);

      let patch: any = {};
      let fieldLabel = "";

      if (field === "name") {
        if (!text) {
          await ctx.reply("⚠️ الاسم لا يمكن أن يكون فارغاً.");
          return;
        }
        patch.name = text;
        patch.name_normalized = normalizeSubjectName(text);
        fieldLabel = "الاسم";
      } else if (field === "code") {
        patch.code = (text && text !== "-") ? text : null;
        fieldLabel = "الكود";
      } else if (field === "credits") {
        if (text && text !== "-") {
          const credits = parseInt(text);
          if (isNaN(credits) || credits < 0) {
            await ctx.reply("⚠️ الساعات يجب أن تكون رقماً صحيحاً.");
            return;
          }
          patch.credits = credits;
        } else {
          patch.credits = null;
        }
        fieldLabel = "الساعات";
      }

      // اقرأ القديم للتدقيق
      let oldData: any = null;
      try {
        oldData = await getSubjectByIdFromDB(supabase, subjectId);
      } catch {}

      // حدّث
      const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
      const success = await updateSubject(supabase, subjectId, {
        ...patch,
        updated_by_position_id: positionId,
        updated_by_telegram_id: ctx.from.id,
      });

      if (success) {
        invalidateSubjectCache();
      }

      if (success) {
        await writeSubjectAuditLog(supabase, {
          subject_id: subjectId,
          action: "update",
          old_data: oldData ? { [field]: oldData[field] } : null,
          new_data: patch,
          performed_by_position_id: positionId,
          performed_by_telegram_id: ctx.from.id,
        });

        await ctx.reply(ADMIN_TEXTS.subjects_mgmt.edit_success(fieldLabel), {
          reply_markup: new InlineKeyboard()
            .text("📖 تفاصيل المادة", `subj_detail_${subjectId}`)
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_academic, "academic_mgmt"),
          parse_mode: "Markdown",
        });
      } else {
        await ctx.reply("⚠️ فشل تحديث المادة. حاول مرة أخرى.");
      }
      return;
    }

    // استقبال اسم مادة جديدة (قديم — محذوف)
    if (session.awaiting_subject_add) {
      session.awaiting_subject_add = false;
      await saveSession(session);
      await ctx.reply(
        "⚠️ تم إلغاء الإضافة القديمة. استخدم زر ➕ إضافة مادة من جديد.",
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_academic,
            "academic_mgmt"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال نص مخصص جديد
    // =====================================================
    // استقبال نص مخصص (أزرار + رسائل) — إعدادات النظام
    // =====================================================
    if (session.awaiting_text_value && session.awaiting_text_edit) {
      const editKey = session.awaiting_text_edit;
      const newText = ctx.message.text.trim();

      session.awaiting_text_value = false;
      session.awaiting_text_edit = undefined;
      await saveSession(session);

      // حدد نوع التعديل: item:IDX (موحّد) أو btn:IDX/msg:IDX (قديم)
      if (editKey.startsWith("item:") || editKey.startsWith("btn:") || editKey.startsWith("msg:")) {
        const [type, idxStr] = editKey.split(":");
        const idx = parseInt(idxStr);

        // استورد القوائم من system_settings
        const { ALL_EDITABLE_ITEMS } = await import("./system_settings");
        const item = ALL_EDITABLE_ITEMS[idx];

        if (!item) {
          await ctx.reply("⚠️ عنصر غير موجود.");
          return;
        }

        // استعادة الافتراضي
        if (newText === "-") {
          const ok = await resetCustomText(supabase, item.screen_key, item.text_key);
          if (ok) {
            await ctx.reply(
              `✅ *تم استعادة النص الافتراضي.*\n\n📝 ${item.label}\n📄 \`${item.default.substring(0, 50)}\``,
              {
                reply_markup: new InlineKeyboard().text("🔙 إدارة الواجهة", "settings_interface"),
                parse_mode: "Markdown",
              }
            );
          } else {
            await ctx.reply("⚠️ فشل استعادة الافتراضي.");
          }
          return;
        }

        // حفظ التخصيص الجديد
        const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
        const ok = await saveCustomText(supabase, {
          screen_key: item.screen_key,
          text_key: item.text_key,
          default_value: item.default,
          custom_value: newText,
          updated_by_position_id: positionId,
        });

        if (ok) {
          await ctx.reply(
            `✅ *تم حفظ التخصيص بنجاح!*\n\n📝 ${item.label}\n📄 \`${newText.substring(0, 50)}\`\n\n` +
            `_سيظهر للطلاب في الطلبات القادمة._`,
            {
              reply_markup: new InlineKeyboard().text("🔙 إدارة الواجهة", "settings_interface"),
              parse_mode: "Markdown",
            }
          );
        } else {
          await ctx.reply("⚠️ فشل حفظ التخصيص.");
        }
        return;
      }

      // النمط القديم (customTexts Map — deprecated)
      customTexts.set(editKey, ctx.message.text);
      await ctx.reply(ADMIN_TEXTS.customize.saved(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال تعديل عنوان محتوى (تم تعطيله مؤقتاً — سيُنفّذ في المرحلة 2)
    if (session.awaiting_content_edit) {
      const contentId = session.awaiting_content_edit;
      session.awaiting_content_edit = undefined;
      await saveSession(session);
      await ctx.reply(
        "⚠️ تعديل بيانات المحتوى قيد التطوير (المرحلة 2).",
        {
          reply_markup: new InlineKeyboard()
            .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // =====================================================
    // استقبال تعديل العنوان أو الوصف (المرحلة 2)
    // =====================================================
    if (session.awaiting_content_edit_id && session.awaiting_content_edit_field) {
      const contentId = session.awaiting_content_edit_id;
      const field = session.awaiting_content_edit_field;
      const newValue = ctx.message.text.trim();

      // إعادة ضبط الحالة
      session.awaiting_content_edit_id = undefined;
      session.awaiting_content_edit_field = undefined;
      await saveSession(session);

      if (!newValue) {
        await ctx.reply("⚠️ القيمة لا يمكن أن تكون فارغة.");
        return;
      }

      // اقرأ القديم للتدقيق
      let oldData: any = null;
      try {
        const result = await supabase.select("content", {
          columns: `id,title,description`,
          filter: `id=eq.${contentId}`,
          single: true,
        });
        oldData = Array.isArray(result) ? result[0] : result;
      } catch (e) {
        console.error("Content fetch error:", e);
      }

      // حدّث الحقل المناسب
      const updateData: any = {
        last_modified_at: new Date().toISOString(),
        last_modified_by: ctx.from.id,
      };
      if (field === "title") {
        updateData.title = newValue;
      } else if (field === "description") {
        updateData.description = (newValue === "-") ? null : newValue;
      }

      try {
        await supabase.update("content", updateData, `id=eq.${contentId}`);

        // audit log
        const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
        await writeContentAuditLog(supabase, {
          content_id: contentId,
          action: "update",
          old_data: oldData ? { [field]: oldData[field] } : null,
          new_data: { [field]: updateData[field] ?? null },
          performed_by_position_id: positionId,
          performed_by_telegram_id: ctx.from.id,
        });

        const fieldLabel = field === "title" ? "العنوان" : "الوصف";
        await ctx.reply(
          ADMIN_TEXTS.content_edit.success(fieldLabel),
          {
            reply_markup: new InlineKeyboard()
              .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
              .row()
              .text("🔙 إدارة المحتوى", "content_mgmt"),
            parse_mode: "Markdown",
          }
        );
      } catch (e: any) {
        console.error("Content edit error:", e);
        await ctx.reply(
          `⚠️ فشل تحديث ${field}.\n\nالسبب: ${(e?.message || "غير معروف").substring(0, 150)}`,
          {
            reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
            parse_mode: "Markdown",
          }
        );
      }
      return;
    }

    // =====================================================
    // استقبال عنوان/وصف المحتوى المرفوع (Upload Wizard)
    // =====================================================
    // التدفق بعد الملف:
    //   step="title" → استقبال العنوان → step="description"
    //   step="description" → استقبال الوصف → تنفيذ الرفع الفعلي
    if (session.awaiting_upload_step === "title" && session.upload_context) {
      const title = ctx.message.text.trim() || "بدون عنوان";
      session.upload_context.title = title;
      session.awaiting_upload_step = "description";
      await saveSession(session);
      await ctx.reply(
        ADMIN_TEXTS.upload_wizard.awaiting_description,
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_upload"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    if (session.awaiting_upload_step === "description" && session.upload_context) {
      const desc = ctx.message.text.trim();
      session.upload_context.description = (desc && desc !== "-") ? desc : null;
      // تنفيذ الرفع الفعلي
      await executeContentUpload(bot, supabase, ctx, session);
      return;
    }

    // =====================================================
    // استقبال عنوان ملف في الاستيراد المتتابع (المرحلة 3)
    // =====================================================
    if (session.awaiting_import_step === "title" && session.import_context) {
      const title = ctx.message.text.trim() || session.import_context.current_file_name || "بدون عنوان";

      // بيانات الملف المخزّنة في import_context
      const fileData = {
        file_id: session.import_context.current_file_id,
        file_name: session.import_context.current_file_name || "ملف",
        file_size: session.import_context.current_file_size || 0,
        mime_type: session.import_context.current_file_mime,
      };

      // تنفيذ رفع ملف واحد
      const result = await importSingleFile(bot, supabase, ctx, session, fileData, title);

      if (result.success) {
        // زيادة العداد
        session.import_context.import_count = (session.import_context.import_count || 0) + 1;
        // مسح بيانات الملف الحالي
        session.import_context.current_file_id = undefined;
        session.import_context.current_file_name = undefined;
        session.import_context.current_file_size = undefined;
        session.import_context.current_file_mime = undefined;
        session.awaiting_import_step = "file"; // نطلب الملف التالي
        await saveSession(session);

        await ctx.reply(
          ADMIN_TEXTS.content_import.file_uploaded(title, session.import_context.import_count) +
          "\n\n" + ADMIN_TEXTS.content_import.prompt_next_file(session.import_context.import_count),
          {
            reply_markup: importLoopKeyboard(),
            parse_mode: "Markdown",
          }
        );
      } else {
        // فشل الرفع — اعرض الخطأ واطلب ملفاً آخر
        await ctx.reply(
          `⚠️ فشل استيراد الملف: ${result.error || "خطأ غير معروف"}\n\n` +
          ADMIN_TEXTS.content_import.prompt_next_file(session.import_context?.import_count || 0),
          {
            reply_markup: importLoopKeyboard(),
            parse_mode: "Markdown",
          }
        );
      }
      return;
    }

    // =====================================================
    // تعيين شاغل منصب — تدفق الـ 5 خطوات
    // =====================================================
    // الخطوات: telegram_id → verify → custom_name → confirm (button)
    // - telegram_id: استقبال معرّف تلجرام من المستخدم
    // - verify: التحقق من وجود المستخدم في admin_users (انتقال داخلي)
    // - custom_name: استقبال الاسم المخصص
    // - confirm: (يعالَج بـ confirm_assign_ callback في positions.ts)
    if (session.awaiting_position_assign) {
      const assign = session.awaiting_position_assign;

      // ---- الخطوة 1: استقبال معرّف تلجرام ----
      if (assign.step === "telegram_id") {
        const tid = parseInt(ctx.message.text.trim());
        if (isNaN(tid) || tid <= 0) {
          await ctx.reply(ADMIN_TEXTS.positions.assign_step1_invalid, {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
            parse_mode: "Markdown",
          });
          return;
        }

        // منع التعيين الذاتي
        if (tid === ctx.from.id) {
          await ctx.reply(ADMIN_TEXTS.positions.assign_self_error, {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
            parse_mode: "Markdown",
          });
          return;
        }

        // اعرض رسالة "جارٍ التحقق..." وانتقل لخطوة verify
        await ctx.reply(ADMIN_TEXTS.positions.assign_step2_checking);
        assign.telegram_id = tid;
        assign.step = "verify";

        // التحقق من وجود المستخدم — نتحقق من students أولاً ثم admin_users
        let existingUser: any = null;
        let isStudent = false;

        // 1. تحقق من جدول students
        try {
          const studentResult = await supabase.select("students", {
            columns: "telegram_id,first_name,username",
            filter: `telegram_id=eq.${tid}`,
            single: true,
          });
          existingUser = Array.isArray(studentResult) ? studentResult[0] : studentResult;
          if (existingUser) isStudent = true;
        } catch {}

        // 2. تحقق من admin_users (مهم لـ FK constraint في position_holders)
        let adminUser = await getAdminUser(supabase, tid);

        // 3. لو غير موجود في admin_users — سجّله تلقائياً (حتى لو كان طالباً)
        if (!adminUser) {
          const nameToUse = existingUser?.first_name || `مسؤول ${tid}`;
          try {
            await supabase.insert("admin_users", {
              telegram_id: tid,
              first_name: nameToUse,
              username: existingUser?.username || null,
              is_active: true,
            });
            console.log(`✅ Auto-registered user ${tid} in admin_users (was ${isStudent ? "student" : "not found"})`);
          } catch (e: any) {
            // لو الخطأ "duplicate key" — يعني أنه موجود بالفعل (safe to ignore)
            if (!String(e?.message || "").includes("duplicate")) {
              console.error("Failed to auto-register admin:", e);
              await ctx.reply(
                `⚠️ تعذّر تسجيل المستخدم \`${tid}\`. تأكد من صحة المعرّف.`,
                {
                  reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
                  parse_mode: "Markdown",
                }
              );
              return;
            }
          }
        }

        // 4. اعرض المعلومات وانتقل لخطوة custom_name
        assign.step = "custom_name";
        await saveSession(session);

        const currentName = existingUser?.first_name || adminUser?.first_name || `مسؤول ${tid}`;
        const userStatus = isStudent ? "طالب مسجّل" : adminUser ? "مسؤول حالي" : "مسجّل جديد";
        await ctx.reply(
          `✅ *تم العثور على المستخدم*\n\n` +
          `👤 *الاسم:* ${currentName}\n` +
          `📊 *الحالة:* ${userStatus}\n` +
          `🆔 *المعرّف:* \`${tid}\`\n\n` +
          `أرسل الاسم الذي سيظهر داخل النظام (أو أرسل "-" لاستخدام الاسم الحالي):`,
          {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
            parse_mode: "Markdown",
          }
        );
        return;
      }

      // ---- الخطوة 3: استقبال الاسم المخصص ----
      if (assign.step === "custom_name") {
        let customName = ctx.message.text.trim();
        // لو أرسل "-" استخدم الاسم الحالي للمستخدم
        if (customName === "-") {
          // اقرأ الاسم الحالي من students أو admin_users
          let currentName = `مسؤول ${assign.telegram_id}`;
          try {
            const studentResult = await supabase.select("students", {
              columns: "first_name",
              filter: `telegram_id=eq.${assign.telegram_id}`,
              single: true,
            });
            const student = Array.isArray(studentResult) ? studentResult[0] : studentResult;
            if (student?.first_name) {
              currentName = student.first_name;
            } else {
              const adminUser = await getAdminUser(supabase, assign.telegram_id!);
              if (adminUser?.first_name) currentName = adminUser.first_name;
            }
          } catch {}
          customName = currentName;
        }

        if (!customName || customName.length > 100) {
          await ctx.reply("⚠️ الاسم غير صالح (1-100 حرف). أعد المحاولة:", {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
            parse_mode: "Markdown",
          });
          return;
        }

        assign.custom_name = customName;
        assign.step = "confirm";
        await saveSession(session);

        // اقرأ عنوان المنصب (لو لم يكن مخزّناً)
        let positionTitle = assign.position_title || "المنصب";
        if (!assign.position_title) {
          const position = await getPositionById(supabase, assign.position_id);
          if (position?.title) {
            positionTitle = position.title;
            assign.position_title = positionTitle;
            await saveSession(session);
          }
        }

        // اقرأ الشاغل الحالي (لو موجود) لعرضه في التأكيد
        let currentHolderName: string | undefined;
        const currentHolder = await getPositionHolder(supabase, assign.position_id);
        if (currentHolder) {
          const holderUser = await getAdminUser(supabase, currentHolder.user_telegram_id);
          if (holderUser?.first_name) currentHolderName = holderUser.first_name;
        }

        const msg = ADMIN_TEXTS.positions.assign_step4_confirm(
          assign.telegram_id!,
          customName,
          positionTitle,
          currentHolderName
        );

        await ctx.reply(msg, {
          reply_markup: new InlineKeyboard()
            .text(
              ADMIN_TEXTS.positions.btn_confirm_assign,
              `confirm_assign_${assign.position_id}`
            )
            .text(ADMIN_TEXTS.positions.btn_cancel_assign, "cancel_assign"),
          parse_mode: "Markdown",
        });
        return;
      }

      // ---- الخطوة 4: التأكيد ----
      // (يعالَج عبر callback confirm_assign_{positionId} في positions.ts)
      if (assign.step === "confirm") {
        await ctx.reply(
          "⏳ يرجى استخدام أزرار التأكيد أو الإلغاء بالأسفل.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // ---- الخطوة 2: verify (داخلية) ----
      // لو وصلنا هنا بـ step=verify فالمستخدم أرسل نصاً أثناء التحقق — تجاهل
      if (assign.step === "verify") {
        return;
      }
    }

    // =====================================================
    // إنشاء دعوة مسؤول — استقبال الاسم (Invite Flow)
    // =====================================================
    // يُضبط عبر callbacks في positions.ts:
    //   invite_role_central / invite_role_college_{id} / invite_role_level_lvl_{spec}_{level}
    // هنا نستقبل الاسم، نُنشئ token، نُسجّل الدعوة في admin_invitations،
    // ثم نعرض الرابط للمسؤول ليُشاركه مع المدعو.
    if (session.awaiting_invite_name && session.awaiting_invite_context) {
      const inviteCtx = session.awaiting_invite_context;
      const name = (ctx.message?.text || "").trim();

      if (!name || name.length < 2 || name.length > 100) {
        await ctx.reply("⚠️ الاسم غير صالح (2-100 حرف). أعد المحاولة:", {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_invite"),
          parse_mode: "Markdown",
        });
        return;
      }

      // امسح الجلسة مبكراً (حتى لو فشل الإنشاء، الجلسة نظيفة)
      session.awaiting_invite_name = undefined;
      session.awaiting_invite_context = undefined;
      await saveSession(session);

      // حدّد position_id المرتبط بالدور
      let positionId: string | null = null;
      if (inviteCtx.role === "central") {
        positionId = "central_chair";
      } else if (inviteCtx.role === "college" && inviteCtx.college_id) {
        positionId = `college_admin_${inviteCtx.college_id}`;
      } else if (
        inviteCtx.role === "level" &&
        inviteCtx.specialty_id &&
        inviteCtx.level_num
      ) {
        positionId = `level_rep_${inviteCtx.specialty_id}_${inviteCtx.level_num}`;
      }

      // اقرأ position_id الفعلي للداعي (للتدقيق)
      const inviterPositionId = await getAdminPrimaryPositionId(
        supabase,
        ctx.from.id
      );

      // توليد token آمن
      const token = generateInviteToken();

      // إنشاء الدعوة في DB
      let inviteId: number | null = null;
      try {
        inviteId = await createInvitation(supabase, {
          token,
          role: inviteCtx.role,
          custom_name: name,
          college_id: inviteCtx.college_id || null,
          specialty_id: inviteCtx.specialty_id || null,
          level_num: inviteCtx.level_num || null,
          position_id: positionId,
          invited_by_telegram_id: ctx.from.id,
          invited_by_position_id: inviterPositionId,
        });
      } catch (e) {
        console.error("createInvitation failed:", e);
      }

      if (!inviteId) {
        await ctx.reply("⚠️ فشل إنشاء الدعوة في قاعدة البيانات. حاول مرة أخرى.", {
          reply_markup: new InlineKeyboard()
            .text("🔙 إدارة المسؤولين", "manage_admins"),
        });
        return;
      }

      // بناء الرسالة النهائية مع الرابط
      const link = `https://t.me/usttesteradminbot?start=invite_${token}`;
      let roleLabel = "";
      let scopeLine = "";
      if (inviteCtx.role === "central") {
        roleLabel = "🛡 مسؤول مركزي";
      } else if (inviteCtx.role === "college" && inviteCtx.college_id) {
        roleLabel = "🏛 مسؤول كلية";
        const c = getCollegeById(inviteCtx.college_id);
        scopeLine = c ? `\n📍 ${c.name}` : "";
      } else if (
        inviteCtx.role === "level" &&
        inviteCtx.specialty_id &&
        inviteCtx.level_num
      ) {
        roleLabel = "📊 مندوب مستوى";
        const s = getSpecialtyById(inviteCtx.specialty_id);
        const c = s ? getCollegeById(s.college_id) : null;
        const parts: string[] = [];
        if (c) parts.push(c.short_name);
        if (s) parts.push(s.short_name);
        parts.push(`المستوى ${inviteCtx.level_num}`);
        scopeLine = `\n📍 ${parts.join(" / ")}`;
      }

      const msg =
        `✅ *تم إنشاء الدعوة بنجاح!*\n\n` +
        `🎟️ ${roleLabel}${scopeLine}\n` +
        `👤 ${name}\n\n` +
        `🔗 *رابط الدعوة:*\n\`${link}\`\n\n` +
        `⏳ الدعوة صالحة لمدة 7 أيام.\n` +
        `📤 شارك الرابط مع المدعو عبر تلجرام.`;

      await ctx.reply(msg, {
        reply_markup: new InlineKeyboard()
          .url("🔗 فتح الرابط", link)
          .row()
          .text("📋 الدعوات المعلّقة", "invite_list")
          .row()
          .text("➕ دعوة أخرى", "invite_admin")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins"),
        parse_mode: "Markdown",
      });
      return;
    }

    // =====================================================
    // استقبال بيانات إضافة/تعديل قناة لجنة (channels CRUD)
    // =====================================================

    // إضافة قناة — استقبال URL
    if (session.awaiting_channel_add_step === "url" && session.awaiting_channel_add_context) {
      const url = ctx.message.text.trim();
      if (!url || !url.match(/^https?:\/\//)) {
        await ctx.reply("⚠️ الرابط غير صالح. يجب أن يبدأ بـ http:// أو https://");
        return;
      }
      session.awaiting_channel_add_context.url = url;
      session.awaiting_channel_add_step = "display_name";
      await saveSession(session);
      await ctx.reply(
        "📝 أرسل *اسم العرض* للقناة (مثلاً: لجنة كلية الحاسبات):",
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_add_channel"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // إضافة قناة — استقبال display_name → تأكيد
    if (session.awaiting_channel_add_step === "display_name" && session.awaiting_channel_add_context) {
      const displayName = ctx.message.text.trim();
      if (!displayName) {
        await ctx.reply("⚠️ اسم العرض لا يمكن أن يكون فارغاً.");
        return;
      }
      session.awaiting_channel_add_context.display_name = displayName as any;
      session.awaiting_channel_add_step = "confirm";
      await saveSession(session);

      // اعرض تأكيد
      const ctx2 = session.awaiting_channel_add_context;
      const scopeLabel = ctx2.scope_type === "central" ? "مركزية"
        : ctx2.scope_type === "college" ? `كلية: ${getCollegeById(ctx2.college_id || 0)?.name || ""}`
        : `مستوى: ${getSpecialtyById(ctx2.specialty_id || 0)?.name || ""} - مستوى ${ctx2.level_num}`;

      await ctx.reply(
        `✅ *تأكيد إضافة القناة*\n\n` +
        `📍 *النطاق:* ${scopeLabel}\n` +
        `🔗 *الرابط:* ${ctx2.url}\n` +
        `📝 *الاسم:* ${displayName}\n\n` +
        `هل تريد الإضافة؟`,
        {
          reply_markup: new InlineKeyboard()
            .text("✅ تأكيد", "confirm_add_channel")
            .text("❌ إلغاء", "cancel_add_channel"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // تعديل اسم عرض القناة
    if (session.awaiting_channel_edit && session.awaiting_channel_edit_field === "display_name") {
      const channelId = session.awaiting_channel_edit;
      const newName = ctx.message.text.trim();
      session.awaiting_channel_edit = undefined;
      session.awaiting_channel_edit_field = undefined;
      await saveSession(session);

      if (!newName) {
        await ctx.reply("⚠️ الاسم لا يمكن أن يكون فارغاً.");
        return;
      }

      try {
        const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
        await updateCommitteeChannel(supabase, channelId, {
          display_name: newName,
          updated_by_position_id: positionId,
          updated_at: new Date().toISOString(),
        });
        console.log(`✅ [channels] Updated channel #${channelId} display_name`);
      } catch (e: any) {
        console.error(`❌ [channels] Failed to update channel #${channelId}:`, e?.message?.substring(0, 150));
        await ctx.reply("⚠️ فشل تحديث الاسم.", {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
          parse_mode: "Markdown",
        });
        return;
      }

      await ctx.reply(ADMIN_TEXTS.channels.edit_success, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال رابط قناة جديد (URL edit — محسّن)
    if (session.awaiting_channel_edit && (session.awaiting_channel_edit_field === "url" || !session.awaiting_channel_edit_field)) {
      const channelId = session.awaiting_channel_edit;
      const newUrl = ctx.message.text.trim();
      session.awaiting_channel_edit = undefined;
      session.awaiting_channel_edit_field = undefined;
      await saveSession(session);

      if (!newUrl || !newUrl.match(/^https?:\/\//)) {
        await ctx.reply("⚠️ الرابط غير صالح. يجب أن يبدأ بـ http:// أو https://");
        return;
      }

      try {
        const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
        await updateCommitteeChannel(supabase, channelId, {
          channel_url: newUrl,
          updated_by_position_id: positionId,
          updated_at: new Date().toISOString(),
        });
        console.log(`✅ [channels] Updated channel #${channelId} URL`);
      } catch (e: any) {
        console.error(`❌ [channels] Failed to update channel #${channelId}:`, e?.message?.substring(0, 150));
        await ctx.reply("⚠️ *فشل تحديث الرابط.*", {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
          parse_mode: "Markdown",
        });
        return;
      }

      await ctx.reply(ADMIN_TEXTS.channels.edit_success, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال سبب رفض التكريم
    if (session.awaiting_honor_reject) {
      const honorId = session.awaiting_honor_reject;
      const honor = (await getHonors(supabase)).find((h: any) => h.id === honorId);
      if (honor) {
        honor.status = "rejected";
        honor.rejection_reason = ctx.message.text;
      }
      session.awaiting_honor_reject = undefined;
      await ctx.reply(
        ADMIN_TEXTS.honors.reject_success,
        {
          reply_markup: new InlineKeyboard()
            .text("🔙 التكريمات المعلّقة", "honors_pending")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال بيانات التكريم اليدوي الجديد
    if (session.awaiting_honor_new_step === "student_id") {
      const tid = parseInt(ctx.message.text);
      if (isNaN(tid)) {
        await ctx.reply("⚠️ المعرّف يجب أن يكون رقماً. أعد المحاولة:");
        return;
      }
      session.awaiting_honor_new_data = { student_id: tid };
      session.awaiting_honor_new_step = "title";
      await ctx.reply(ADMIN_TEXTS.honors.new_honor_prompt_title, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      });
      return;
    }
    if (session.awaiting_honor_new_step === "title") {
      session.awaiting_honor_new_data!.title = ctx.message.text;
      session.awaiting_honor_new_step = "bonus";
      await ctx.reply(ADMIN_TEXTS.honors.new_honor_prompt_bonus, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_honors"),
        parse_mode: "Markdown",
      });
      return;
    }
    if (session.awaiting_honor_new_step === "bonus") {
      const bonus = parseInt(ctx.message.text);
      if (isNaN(bonus)) {
        await ctx.reply("⚠️ المكافأة يجب أن تكون رقماً. أعد المحاولة:");
        return;
      }
      const data = session.awaiting_honor_new_data!;
      // قراءة اسم الطالب من DB
      let studentName = `طالب ${data.student_id}`;
      try {
        const studentResult = await supabase.select("students", {
          columns: "first_name",
          filter: `telegram_id=eq.${data.student_id}`,
          single: true,
        });
        const student = Array.isArray(studentResult) ? studentResult[0] : studentResult;
        if (student?.first_name) studentName = student.first_name;
      } catch {}

      // إدراج تكريم جديد في DB
      try {
        await supabase.insert("contribution_honors", {
          student_telegram_id: data.student_id!,
          honor_type: "manual",
          honor_title: data.title!,
          honor_period: "يدوي",
          bonus_points: bonus,
          status: "approved",
          approved_by_telegram_id: ctx.from.id,
          approved_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to insert honor:", e);
        await ctx.reply("⚠️ فشل إنشاء التكريم. حاول مرة أخرى.");
        return;
      }

      session.awaiting_honor_new_step = undefined;
      session.awaiting_honor_new_data = undefined;
      await saveSession(session);
      await ctx.reply(
        ADMIN_TEXTS.honors.new_honor_success(studentName, data.title!),
        {
          reply_markup: new InlineKeyboard()
            .text("🏆 إدارة التكريم", "manage_honors")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // رسالة افتراضية
    await ctx.reply("👋 استخدم الأزرار للتنقل، أو /start للعودة للوحة الإدارة.");
  });

  // ====== استقبال ملفات (للتعميمات + رفع محتوى) ======
  bot.on(":document", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    // استقبال ملف للتعميم
    if (session?.awaiting_broadcast_text && session.broadcast_context) {
      const ctxData = session.broadcast_context;
      session.awaiting_broadcast_text = false;
      session.broadcast_context = undefined;
      const doc = ctx.message.document;
      await ctx.reply(
        ADMIN_TEXTS.broadcast.sent_file(doc.file_name, ctxData.count, ctxData.scope_label),
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال ملف لرفع محتوى (لو المسؤول اختار نوع المحتوى مسبقاً)
    const doc = ctx.message.document;
    const fileSizeBytes = doc.file_size || 0;
    const fileSizeMb = bytesToMb(fileSizeBytes);

    // =====================================================
    // استقبال ملف خطة استرشادية
    // =====================================================
    if (session?.awaiting_plan_upload) {
      const specId = session.awaiting_plan_upload;
      session.awaiting_plan_upload = undefined;
      await saveSession(session);

      try {
        // اقرأ college_id + storage_channel_id لتخزين الملف
        let storageChannelId: string | null = null;
        let specName = "التخصص";
        let collegeId = 0;
        try {
          const specResult = await supabase.select("specialties", {
            columns: "name,college_id",
            filter: `id=eq.${specId}`,
            single: true,
          });
          const spec = Array.isArray(specResult) ? specResult[0] : specResult;
          if (spec?.name) specName = spec.name;
          collegeId = spec?.college_id || 0;

          if (collegeId) {
            const collegeResult = await supabase.select("colleges", {
              columns: "storage_channel_id,name",
              filter: `id=eq.${collegeId}`,
              single: true,
            });
            const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;
            storageChannelId = college?.storage_channel_id || null;
          }
        } catch (e) {
          console.warn("Failed to fetch spec/college for plan:", e);
        }

        // أعد إرسال الملف لقناة تخزين الكلية للحصول على file_id يعمل من أي بوت
        let planFileId = doc.file_id; // fallback: استخدم file_id الأصلي
        if (storageChannelId) {
          try {
            const channelMsg = await bot.api.sendDocument(storageChannelId, doc.file_id, {
              caption: `🗺 الخطة الاسترشادية — ${specName}`,
            });
            if ((channelMsg as any).document?.file_id) {
              planFileId = (channelMsg as any).document.file_id;
            }
          } catch (e: any) {
            console.warn("Failed to forward plan to storage channel, using original file_id:", e?.message?.substring(0, 100));
          }
        }

        // خزّن file_id في جدول specialties
        await supabase.update("specialties", {
          plan_url: planFileId,
          plan_updated_at: new Date().toISOString(),
          plan_updated_by: ctx.from.id,
        }, `id=eq.${specId}`);

        await ctx.reply(
          `✅ *تم رفع الخطة الاسترشادية بنجاح!*\n\n🗺 التخصص: ${specName}\n📎 الملف: ${doc.file_name}\n\nالطلاب سيرون الخطة الآن عند الضغط على "🗺 الخطة الاسترشادية".`,
          {
            reply_markup: new InlineKeyboard()
              .text("🔙 التخصصات", `plan_col_${collegeId}`)
              .row()
              .text(ADMIN_TEXTS.navigation.back_to_academic, "academic_mgmt"),
            parse_mode: "Markdown",
          }
        );
      } catch (e: any) {
        console.error("Failed to save plan:", e);
        await ctx.reply("⚠️ فشل حفظ الخطة. حاول مرة أخرى.");
      }
      return;
    }

    // =====================================================
    // استقبال ملف في الاستيراد المتتابع (المرحلة 3)
    // =====================================================
    if (session?.awaiting_import_step === "file" && session.import_context) {
      const contentType = session.import_context.content_type || "summary";

      // فحص نوع الملف
      const validation = validateUploadedFile(contentType, {
        file_name: doc.file_name,
        mime_type: (doc as any).mime_type,
      });

      if (!validation.valid) {
        await ctx.reply(
          validation.reason || ADMIN_TEXTS.content_import.invalid_file,
          {
            parse_mode: "Markdown",
            reply_markup: importLoopKeyboard(),
          }
        );
        return;
      }

      // انتقل لخطوة العنوان — نخزّن بيانات الملف في import_context
      session.import_context = {
        ...session.import_context,
        current_file_id: doc.file_id,
        current_file_name: doc.file_name,
        current_file_size: fileSizeBytes,
        current_file_mime: (doc as any).mime_type,
      };
      session.awaiting_import_step = "title";
      await saveSession(session);

      const count = session.import_context.import_count || 0;
      await ctx.reply(
        ADMIN_TEXTS.content_import.prompt_title(doc.file_name || "ملف", count),
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_import"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // لو المسؤول في وضع رفع محتوى، نطلب العنوان بعد الملف
    if (session?.awaiting_upload_step === "file" && session.upload_context) {
      // نحتفظ بالسياق وننتقل لخطوة العنوان
      session.awaiting_upload_step = "title";
      session.upload_context = {
        ...session.upload_context,
        file_id: doc.file_id,
        file_name: doc.file_name,
        file_size_bytes: fileSizeBytes,
        file_size_mb: fileSizeMb,
        file_mime: (doc as any).mime_type,
      };
      await saveSession(session);

      await ctx.reply(
        ADMIN_TEXTS.upload_wizard.awaiting_title,
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_upload"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // رد افتراضي: الملف غير متوقع
    await ctx.reply(
      `✅ *تم استلام الملف!*\n\n📄 *الاسم:* ${doc.file_name}\n📊 *الحجم:* ${formatFileSize(fileSizeBytes)}\n\n` +
      `ℹ️ لرفع محتوى رسمي، استخدم زر "📁 إدارة المحتوى" → "➕ إضافة محتوى" من لوحة الإدارة.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== استقبال صور (للتعميمات بصورة) ======
  bot.on(":photo", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    if (session?.awaiting_broadcast_text && session.broadcast_context) {
      const ctxData = session.broadcast_context;
      session.awaiting_broadcast_text = false;
      session.broadcast_context = undefined;
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = ctx.message.caption || "(بدون تعليق)";
      await ctx.reply(
        ADMIN_TEXTS.broadcast.sent_photo(caption, ctxData.count, ctxData.scope_label),
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    await ctx.reply("ℹ️ استخدم الأزرار للتنقل. الصور تُستخدم للتعميمات فقط.");
  });
}
