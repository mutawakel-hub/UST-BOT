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
  getChannelById,
} from "../helpers";
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

    // استقبال اسم مادة جديدة
    if (session.awaiting_subject_add) {
      session.awaiting_subject_add = false;
      await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_done(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال نص مخصص جديد
    if (session.awaiting_text_value) {
      const screenKey = session.awaiting_text_edit!;
      session.awaiting_text_value = false;
      session.awaiting_text_edit = undefined;
      customTexts.set(screenKey, ctx.message.text);
      await ctx.reply(ADMIN_TEXTS.customize.saved(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال تعديل عنوان محتوى
    if (session.awaiting_content_edit) {
      const contentId = session.awaiting_content_edit;
      let content: any = null;
    try {
      const result = await supabase.select("content", { filter: `id=eq.${contentId}`, single: true });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) { console.error("Content fetch error:", e); }
      if (content) {
        content.title = ctx.message.text;
        content.last_modified_at = new Date().toISOString();
        content.last_modified_by = ctx.from.id;
      }
      session.awaiting_content_edit = undefined;
      await ctx.reply(ADMIN_TEXTS.content_detail.edit_success, {
        reply_markup: new InlineKeyboard()
          .text("📄 تفاصيل المحتوى", `content_detail_${contentId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال تعيين شاغل منصب
    if (session.awaiting_position_assign) {
      const assign = session.awaiting_position_assign;
      if (assign.step === "name") {
        assign.name = ctx.message.text;
        assign.step = "telegram_id";
        await ctx.reply(
          ADMIN_TEXTS.positions.assign_prompt_id(assign.name),
          {
            reply_markup: new InlineKeyboard().text("❌ إلغاء", `position_detail_${assign.position_id}`),
            parse_mode: "Markdown",
          }
        );
        return;
      }
      if (assign.step === "telegram_id") {
        const tid = parseInt(ctx.message.text);
        if (isNaN(tid)) {
          await ctx.reply("⚠️ المعرّف يجب أن يكون رقماً. أعد المحاولة:");
          return;
        }
        // تعطيل أي شاغل سابق نشط لهذا المنصب
        try {
          await supabase.update("position_holders",
            { is_active: false },
            `position_id=eq.${assign.position_id}&is_active=eq.true`
          );
        } catch (e) {
          console.error("Failed to deactivate previous holder:", e);
        }
        // إدراج شاغل جديد
        try {
          await supabase.insert("position_holders", {
            position_id: assign.position_id,
            user_telegram_id: tid,
            assigned_by: ctx.from.id,
            is_active: true,
          });
        } catch (e) {
          console.error("Failed to assign new holder:", e);
          await ctx.reply("⚠️ فشل تعيين المنصب. حاول مرة أخرى.");
          return;
        }
        // قراءة بيانات المنصب
        const position = await getPositionById(supabase, assign.position_id);
        const successMsg = ADMIN_TEXTS.positions.assign_success(assign.name || "المستخدم", position?.title || "المنصب");
        session.awaiting_position_assign = undefined;
        await ctx.reply(successMsg, {
          reply_markup: new InlineKeyboard()
            .text("📋 قائمة المناصب", "list_positions")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        });
        return;
      }
    }

    // استقبال رابط قناة جديد
    if (session.awaiting_channel_edit) {
      const channelId = session.awaiting_channel_edit;
      const channel = await getChannelById(supabase, channelId);
      if (channel) {
        channel.channel_url = ctx.message.text;
        channel.updated_at = new Date().toISOString().substring(0, 10);
      }
      session.awaiting_channel_edit = undefined;
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
    const fileSizeMb = bytesToMb(doc.file_size || 0);

    // لو المسؤول في وضع رفع محتوى، نرفع الملف لقناة التخزين
    if (session?.awaiting_upload_step === "file" && session.upload_context) {
      const ctx2 = session.upload_context;
      session.awaiting_upload_step = undefined;
      session.upload_context = undefined;
      await saveSession(session);

      // ابحث عن قناة التخزين للكلية
      let storageChannelId: string | null = null;
      try {
        const collegeResult = await supabase.select("colleges", {
          columns: "storage_channel_id",
          filter: `id=eq.${ctx2.college_id}`,
          single: true,
        });
        const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;
        storageChannelId = college?.storage_channel_id || null;
      } catch (e) {
        console.error("Failed to fetch storage channel:", e);
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

      // رفع الملف لقناة التخزين
      let uploaded: any = null;
      try {
        uploaded = await uploadFileToStorageChannel(
          bot,
          storageChannelId,
          { fileId: doc.file_id, fileName: doc.file_name },
          {
            caption: `📄 ${doc.file_name}\n📚 مادة: ${ctx2.subject_id}\n📂 نوع: ${ctx2.content_type}`,
            parseMode: "Markdown",
          }
        );
      } catch (e) {
        console.error("File upload failed:", e);
        await ctx.reply(
          "❌ فشل رفع الملف لقناة التخزين. تأكد من أن البوت مشرف في القناة.",
          {
            reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
            parse_mode: "Markdown",
          }
        );
        return;
      }

      // إنشاء سجل content في DB
      try {
        await supabase.insert("content", {
          subject_id: ctx2.subject_id,
          specialty_id: ctx2.specialty_id || 0,
          college_id: ctx2.college_id,
          level: ctx2.level || 1,
          semester: ctx2.semester || 1,
          content_type_id: ctx2.content_type,
          title: ctx2.title || doc.file_name,
          file_name: doc.file_name,
          file_size_mb: fileSizeMb,
          telegram_message_id: uploaded.message_id,
          telegram_file_id: uploaded.file_id,
          added_by_position_id: "central_chair",
          added_by_telegram_id: ctx.from.id,
          is_starred: false,
          is_active: true,
          academic_year: new Date().getFullYear().toString(),
        });

        await ctx.reply(
          `✅ *تم رفع المحتوى بنجاح!*\n\n` +
          `📄 *الاسم:* ${doc.file_name}\n` +
          `📊 *الحجم:* ${formatFileSize(doc.file_size || 0)}\n` +
          `📨 *message_id:* ${uploaded.message_id}\n` +
          `🗂 *النوع:* ${ctx2.content_type}\n\n` +
          `✅ تم تسجيل المحتوى في قاعدة البيانات وهو متاح للطلاب الآن.`,
          {
            reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
            parse_mode: "Markdown",
          }
        );
      } catch (e) {
        console.error("Content insert failed:", e);
        await ctx.reply(
          `⚠️ تم رفع الملف لقناة التخزين (message_id: ${uploaded.message_id})\n` +
          `لكن فشل تسجيله في قاعدة البيانات. تواصل مع المسؤول.`,
          {
            reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
            parse_mode: "Markdown",
          }
        );
      }
      return;
    }

    // رد افتراضي: الملف غير متوقع
    await ctx.reply(
      `✅ *تم استلام الملف!*\n\n📄 *الاسم:* ${doc.file_name}\n📊 *الحجم:* ${formatFileSize(doc.file_size || 0)}\n\n` +
      `ℹ️ لرفع محتوى رسمي، استخدم زر "📁 إدارة المحتوى" → "📤 رفع محتوى" من لوحة الإدارة.`,
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
