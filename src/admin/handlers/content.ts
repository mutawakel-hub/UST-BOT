// ============================================
// 📁 Content Handlers — browse, detail, star, delete, upload
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
import { getSpecialtyById, getCollegeById } from "../../shared/data/colleges";
import { uploadFileToStorageChannel, formatFileSize, bytesToMb } from "../../shared/storage";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminUser } from "../helpers";

export function registerContentHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A5: إدارة المحتوى ======
  bot.callbackQuery("content_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    let kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_mgmt.btn_browse, "browse_content")
      .text(ADMIN_TEXTS.content_mgmt.btn_upload, "upload_content")
      .row();

    if (perms.is_central) {
      kb.text(ADMIN_TEXTS.content_mgmt.btn_filter, "filter_content").row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.content_mgmt.title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("browse_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const manageableContent = await getManageableContent(
      ctx.from.id,
      session.content_filter
    );

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
      const icon = c.is_starred ? "⭐" : getContentTypeEmoji(c.content_type);
      kb.text(`${icon} ${c.title.substring(0, 30)} (${c.download_count}⬇️)`, `content_detail_${c.id}`).row();
    });
    if (manageableContent.length > 8) {
      msg += `\n\n📋 عرض أول 8 من ${manageableContent.length} عنصر.`;
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // ====== A5c: تفاصيل المحتوى ======
  bot.callbackQuery(/content_detail_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    let content: any = null;
    try {
      const result = await supabase.select("content", { filter: `id=eq.${contentId}`, single: true });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) { console.error("Content fetch error:", e); }
    await ctx.answerCallbackQuery();
    if (!content) {
      await ctx.reply("⚠️ المحتوى غير موجود.");
      return;
    }

    const subject = getSubjectById(content.subject_id);
    const specialty = getSpecialtyById(content.specialty_id);
    const college = getCollegeById(content.college_id);
    const adderUser = await getAdminUser(supabase, content.added_by_telegram_id);

    const msg = ADMIN_TEXTS.content_detail.title +
      ADMIN_TEXTS.content_detail.details({
        title: content.title,
        type_label: getContentTypeLabel(content.content_type),
        subject_name: subject?.name || "غير معروف",
        specialty_name: specialty?.short_name || "غير معروف",
        college_name: college?.short_name || "غير معروف",
        level: content.level,
        semester: content.semester,
        file_size: content.file_size_mb,
        download_count: content.download_count,
        is_starred: content.is_starred,
        added_by: adderUser?.first_name || "غير معروف",
        added_at: content.added_at,
        academic_year: content.academic_year,
      });

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_detail.btn_edit, `edit_content_${contentId}`)
      .text(ADMIN_TEXTS.content_detail.btn_move, `move_content_${contentId}`)
      .row()
      .text(ADMIN_TEXTS.content_detail.btn_delete, `delete_content_${contentId}`)
      .text(content.is_starred ? ADMIN_TEXTS.content_detail.btn_unstar : ADMIN_TEXTS.content_detail.btn_star,
            content.is_starred ? `unstar_content_${contentId}` : `star_content_${contentId}`)
      .row()
      .text("🔙 استعراض المحتوى", "browse_content")
      .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });

  // تمييز/إلغاء تمييز المحتوى
  bot.callbackQuery(/(star|unstar)_content_(\d+)/, async (ctx) => {
    const action = ctx.match[1];
    const contentId = parseInt(ctx.match[2]);
    let content: any = null;
    try {
      const result = await supabase.select("content", { filter: `id=eq.${contentId}`, single: true });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) { console.error("Content fetch error:", e); }
    if (!content) return;
    content.is_starred = action === "star";
    content.last_modified_at = new Date().toISOString();
    content.last_modified_by = ctx.from.id;
    await ctx.answerCallbackQuery({ text: action === "star" ? "⭐ تم التمييز" : "☆ تم إلغاء التمييز" });
    // إعادة عرض التفاصيل
    await ctx.callbackQuery?.data && (await bot.api.answerCallbackQuery(ctx.update.callback_query.id));
    // نعيد بناء الشاشة بنفس المنطق
    const subject = getSubjectById(content.subject_id);
    const specialty = getSpecialtyById(content.specialty_id);
    const college = getCollegeById(content.college_id);
    const adderUser = await getAdminUser(supabase, content.added_by_telegram_id);
    const msg = ADMIN_TEXTS.content_detail.title +
      ADMIN_TEXTS.content_detail.details({
        title: content.title,
        type_label: getContentTypeLabel(content.content_type),
        subject_name: subject?.name || "غير معروف",
        specialty_name: specialty?.short_name || "غير معروف",
        college_name: college?.short_name || "غير معروف",
        level: content.level,
        semester: content.semester,
        file_size: content.file_size_mb,
        download_count: content.download_count,
        is_starred: content.is_starred,
        added_by: adderUser?.first_name || "غير معروف",
        added_at: content.added_at,
        academic_year: content.academic_year,
      });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.content_detail.btn_edit, `edit_content_${contentId}`)
        .text(ADMIN_TEXTS.content_detail.btn_move, `move_content_${contentId}`)
        .row()
        .text(ADMIN_TEXTS.content_detail.btn_delete, `delete_content_${contentId}`)
        .text(content.is_starred ? ADMIN_TEXTS.content_detail.btn_unstar : ADMIN_TEXTS.content_detail.btn_star,
              content.is_starred ? `unstar_content_${contentId}` : `star_content_${contentId}`)
        .row()
        .text("🔙 استعراض المحتوى", "browse_content")
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // حذف المحتوى (تأكيد)
  bot.callbackQuery(/delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    let content: any = null;
    try {
      const result = await supabase.select("content", { filter: `id=eq.${contentId}`, single: true });
      content = Array.isArray(result) ? result[0] : result;
    } catch (e) { console.error("Content fetch error:", e); }
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

  // تأكيد الحذف
  bot.callbackQuery(/confirm_delete_content_(\d+)/, async (ctx) => {
    const contentId = parseInt(ctx.match[1]);
    await supabase.update("content", { is_active: false }, `id=eq.${contentId}`);
    await ctx.answerCallbackQuery({ text: "🗑 تم الحذف" });
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

  // ====== A5a: رفع محتوى جديد (محاكاة مبسّطة) ======
  bot.callbackQuery("upload_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    CONTENT_TYPES.forEach((t) => {
      kb.text(`${t.emoji} ${t.name}`, `upload_type_${t.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      "📤 *رفع محتوى جديد*\n\nاختر نوع المحتوى:\n\n_في الإنتاج: سيُطلب منك اختيار المادة ثم رفع الملف._",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/upload_type_(.+)/, async (ctx) => {
    const typeId = ctx.match[1];
    const type = CONTENT_TYPES.find((t) => t.id === typeId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `✅ *تم اختيار النوع:* ${type?.emoji} ${type?.name}\n\n_في الإنتاج: سيُطلب منك اختيار المادة ثم رفع الملف._`,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
