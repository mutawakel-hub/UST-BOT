// ============================================
// 📄 File Handlers — عرض وتحميل ومعاينة الملفات
// ============================================
// هذا الملف يحتوي على:
//   - showFilesList (دالة مساعدة)
//   - type_book_theory_(\d+), type_book_practical_(\d+)
//   - type_exams_(\d+), type_summaries_(\d+)
//   - preview_(.+), download_(.+), preview_search_(.+)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getSpecialtyById,
  getCollegeById,
} from "../../shared/data/colleges";
import {
  getSubjectByIdWithFallback,
} from "../../shared/data/subjects";
import { TEXTS, formatContentCard } from "../../shared/texts";
import {
  SupabaseClient,
  getContentForSubject,
  getContentById,
  incrementDownloadCount,
  logDownload,
} from "../../shared/db";
import { deliverFileToUser } from "../../shared/storage";
import {
  filesListKeyboard,
  filePreviewKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

// تصنيفات الملفات (8 أنواع — أضفنا audio)
const TYPE_LABELS: Record<string, string> = {
  book_theory: "📘 المقرر (نظري)",
  book_practical: "📗 المقرر (عملي)",
  summary: "📄 ملخصات",
  exam: "📝 نماذج اختبارات",
  video: "🎥 مرئيات",
  audio: "🎧 صوتيات",
  reference: "📖 مراجع",
  schedule: "📅 جداول دراسية واختبارات",
};

// ============================================
// showFilesList — دالة مساعدة تُعرض من type_* ومن back_to_files_*
// (مُصدّرة لاستخدامها من navigation.ts)
// ============================================
export async function showFilesList(
  supabase: SupabaseClient,
  ctx: any,
  subjectId: number,
  category: string
): Promise<void> {
  const subject = getSubjectByIdWithFallback(subjectId);
  if (!subject) {
    await ctx.answerCallbackQuery();
    await ctx.reply("⚠️ المادة غير موجودة.");
    return;
  }
  await ctx.answerCallbackQuery();

  // قراءة المحتوى من Supabase فقط
  // ملاحظة: نوع "video" يعرض المرئيات والصوتيات معاً (كلا النوعين)
  let files: any[] = [];
  try {
    files = await getContentForSubject(supabase, subjectId, category);
    // لو الفئة "video" — أضف ملفات "audio" أيضاً (لأن زر العرض موحّد)
    if (category === "video") {
      const audioFiles = await getContentForSubject(supabase, subjectId, "audio");
      files = [...files, ...audioFiles];
      // إعادة الترتيب: المميّز أولاً ثم الأكثر تحميلاً
      files.sort((a, b) => {
        if ((b.is_starred ? 1 : 0) !== (a.is_starred ? 1 : 0)) {
          return (b.is_starred ? 1 : 0) - (a.is_starred ? 1 : 0);
        }
        return (b.download_count || 0) - (a.download_count || 0);
      });
    }
  } catch (e) {
    console.error("Supabase content read error:", e);
  }

  if (files.length === 0) {
    const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
    await ctx.editMessageText(`${bc}\n\n📭 لا توجد ملفات في هذا التصنيف حالياً.\n💡 يمكنك الإحسان بأول ملف!`, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
      parse_mode: "Markdown",
    });
    return;
  }

  // تحويل البيانات من Supabase إلى صيغة موحدة
  const unifiedFiles = files.map((f: any) => ({
    id: f.id.toString(),
    file_name: f.title || f.file_name || "ملف",
    file_size_mb: parseFloat(f.file_size_mb) || 0,
    is_starred: f.is_starred || false,
    download_count: f.download_count || 0,
    telegram_message_id: f.telegram_message_id,
    telegram_file_id: f.telegram_file_id,
    uploaded_at: f.added_at || "غير معروف",
  }));

  const bc = `📄 *${subject.name} - ${TYPE_LABELS[category]}*`;
  await ctx.editMessageText(`${bc}\n\n${TEXTS.files_list.title(subject.name, TYPE_LABELS[category])}`, {
    reply_markup: filesListKeyboard(unifiedFiles, subjectId),
    parse_mode: "Markdown",
  });
}

export function registerFileHandlers(bot: Bot, supabase: SupabaseClient): void {
  // S8: عرض الملفات حسب النوع
  bot.callbackQuery(/^type_book_theory_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "book_theory");
  });

  bot.callbackQuery(/^type_book_practical_(\d+)$/, async (ctx) => {
    const subject = getSubjectByIdWithFallback(parseInt(ctx.match[1]));
    if (!subject?.has_practical) {
    await ctx.answerCallbackQuery({ text: "⚠️ هذه المادة لا تحتوي على مقرر عملي.", show_alert: true });
    return;
    }
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "book_practical");
  });

  bot.callbackQuery(/^type_exams_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "exam");
  });

  bot.callbackQuery(/^type_summaries_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "summary");
  });

  bot.callbackQuery(/^type_video_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "video");
  });

  bot.callbackQuery(/^type_reference_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "reference");
  });

  bot.callbackQuery(/^type_schedule_(\d+)$/, async (ctx) => {
    await showFilesList(supabase, ctx, parseInt(ctx.match[1]), "schedule");
  });

  // S8b: شاشة معاينة الملف
  bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();

    let fileData: any = null;
    let subjectId: number = 0;
    let category: string = "";

    // قراءة من Supabase فقط (fileId هو رقم المحتوى في DB)
    if (/^\d+$/.test(fileId)) {
      const contentId = parseInt(fileId);
      try {
        fileData = await getContentById(supabase, contentId);
      } catch (e) {
        console.error("Supabase content read error:", e);
      }
      if (fileData) {
        subjectId = fileData.subject_id;
        category = fileData.content_type_id;
      }
    }

    if (!fileData) {
      await ctx.reply("⚠️ الملف غير موجود.");
      return;
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    const spec = subject ? getSpecialtyById(subject.specialty_id) : null;
    const college = spec ? getCollegeById(spec.college_id) : null;
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    // استخدام بطاقة المحتوى الموحدة (سياق student_preview)
    const msg = formatContentCard({
      title: fileData.title || fileData.file_name || "ملف",
      contentType: category,
      subjectName: subject?.name || "غير معروف",
      collegeName: college?.name,
      specialtyName: spec?.name,
      level: subject?.level,
      semester: subject?.semester,
      fileSizeMb: parseFloat(fileData.file_size_mb) || null,
      uploadedAt: fileData.added_at,
      downloadCount: fileData.download_count || 0,
      isStarred: fileData.is_starred || false,
    }, "student_preview");

    await ctx.editMessageText(msg, {
      reply_markup: filePreviewKeyboard(fileId, subjectId),
      parse_mode: "Markdown",
    });
  });

  // تحميل الملف (إرسال PDF فعلي)
  bot.callbackQuery(/download_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery({ text: TEXTS.common.loading });

    let fileData: any = null;
    let subjectId: number = 0;
    let category: string = "";

    // قراءة من Supabase فقط
    if (/^\d+$/.test(fileId)) {
    const contentId = parseInt(fileId);
        try {
          fileData = await getContentById(supabase, contentId);
        } catch (e) {
          console.error("Supabase content read error:", e);
        }
    if (fileData) {
        subjectId = fileData.subject_id;
        category = fileData.content_type_id;
    }
    }

    const subject = getSubjectByIdWithFallback(subjectId);
    if (!fileData || !subject) {
    await ctx.reply("⚠️ الملف غير موجود.");
    return;
    }

    const fileName = fileData.title || fileData.file_name || "ملف";
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.total_downloads++;
    userState.recent_downloads.unshift({
      file_name: fileName,
      subject_name: subject.name,
      date: "الآن",
    });
    if (userState.recent_downloads.length > 5) userState.recent_downloads.pop();

    // تحديث عدّاد التحميلات في Supabase
    if (supabase && /^\d+$/.test(fileId)) {
    try {
        await incrementDownloadCount(supabase, parseInt(fileId));
        await logDownload(supabase, ctx.from.id, parseInt(fileId));
    } catch (e) {
        console.error("Supabase download log error:", e);
    }
    }

    // إرسال الملف من قناة التخزين (deliverFileToUser = forward + fallback)
    const spec = getSpecialtyById(subject.specialty_id);
    const college = getCollegeById(spec?.college_id || 0);
    const storageChannelId = college?.storage_channel_id;
    const telegramMessageId = fileData.telegram_message_id;
    const telegramFileId = fileData.telegram_file_id;

    const result = await deliverFileToUser(bot, ctx.chat.id, {
      storageChannelId: storageChannelId || null,
      messageId: telegramMessageId || null,
      fileId: telegramFileId || null,
      fileName,
    }, {
      caption: TEXTS.common.file_sent_with_caption
        .replace("{fileName}", fileName)
        .replace("{subjectName}", subject.name),
      parseMode: "Markdown",
      errorMessage: "⚠️ تعذّر إرسال الملف. تأكد من أن البوت مشرف في قناة التخزين.",
    });

    if (result.delivered) {
      console.log(`📥 File delivered via ${result.method} to user ${ctx.from.id}`);
    } else {
      console.error(`❌ File delivery failed: ${result.error}`);
      await ctx.reply(result.error || "⚠️ تعذّر إرسال الملف.", {
        parse_mode: "Markdown",
      });
    }

    // زر العودة
    await ctx.reply("اختر الإجراء التالي:", {
      reply_markup: new InlineKeyboard()
        .text("📥 تحميل ملف آخر", `back_to_files_${subjectId}_${category}`)
        .row()
        .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_main"),
    });
  });

  // معاينة ملف من نتائج البحث
  bot.callbackQuery(/preview_search_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];
    await ctx.answerCallbackQuery();

    // قراءة من Supabase
    let fileData: any = null;
    if (/^\d+$/.test(fileId) && supabase) {
      try {
        fileData = await getContentById(supabase, parseInt(fileId));
      } catch (e) {
        console.error("Supabase content read error:", e);
      }
    }

    if (!fileData) {
      await ctx.reply("⚠️ الملف غير موجود.");
      return;
    }

    const subject = getSubjectByIdWithFallback(fileData.subject_id);
    const spec = subject ? getSpecialtyById(subject.specialty_id) : null;
    const college = spec ? getCollegeById(spec.college_id) : null;
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.last_file_id = fileId;

    // استخدام بطاقة المحتوى الموحدة (سياق student_preview)
    const msg = formatContentCard({
      title: fileData.title || fileData.file_name || "ملف",
      contentType: fileData.content_type_id,
      subjectName: subject?.name || "غير معروف",
      collegeName: college?.name,
      specialtyName: spec?.name,
      level: subject?.level,
      semester: subject?.semester,
      fileSizeMb: parseFloat(fileData.file_size_mb) || null,
      uploadedAt: fileData.added_at,
      downloadCount: fileData.download_count || 0,
      isStarred: fileData.is_starred || false,
    }, "student_preview");

    await ctx.reply(msg, {
      reply_markup: filePreviewKeyboard(fileId, fileData.subject_id),
      parse_mode: "Markdown",
    });
  });
}
