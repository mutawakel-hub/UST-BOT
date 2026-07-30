// ============================================
// 💬 Message Handlers — استقبال الرسائل والملفات
// ============================================
// هذا الملف يحتوي على:
//   - bot.on(":text")   — استقبال النصوص (عنوان/وصف الإحسان + البحث)
//   - bot.on(":document") — استقبال الملفات (للمسارين: القصير + الكامل)
//
// ترتيب الخطوات (بعد اختيار النوع في contribution.ts):
//   :document → حفظ file_id/name/size → step="title"
//   :text (title) → حفظ title → step="description"
//   :text (description) → حفظ description → step="confirm" (عرض المعاينة)
//   زر "✅ إرسال" → confirm_contribute_* (في contribution.ts)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { getSubjectByIdWithFallback } from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  mainMenuKeyboard,
  searchResultsKeyboard,
} from "../../shared/keyboards";
import { getUserState, saveUserState } from "../state";
import {
  CONTENT_TYPES,
} from "../../shared/data/admins";
import {
  validateUploadedFile,
  CONTENT_TYPE_RULES,
} from "../../shared/storage";

// ============================================
// Helper: الحصول على تسمية نوع المحتوى
// ============================================
function contentTypeLabel(typeId: string): string {
  const t = CONTENT_TYPES.find((c) => c.id === typeId);
  return t ? `${t.emoji} ${t.name}` : typeId;
}

// ============================================
// Helper: عرض معاينة الإحسان مع أزرار التأكيد (المسار القصير)
// ============================================
async function showShortPathPreview(
  ctx: any,
  userState: any,
  subjectId: number
): Promise<void> {
  const subject = getSubjectByIdWithFallback(subjectId);
  const contentType = userState.awaiting_contribution_type || "summary";
  const title = userState.awaiting_contribution_title || "بدون عنوان";
  const description =
    userState.awaiting_contribution_description &&
    userState.awaiting_contribution_description !== "-"
      ? userState.awaiting_contribution_description
      : undefined;

  await ctx.reply(
    TEXTS.contribution.preview({
      typeName: contentTypeLabel(contentType),
      subjectName: subject?.name || "غير معروف",
      title,
      description,
    }),
    {
      reply_markup: new InlineKeyboard()
        .text("✅ إرسال", `confirm_contribute_${subjectId}`)
        .text("❌ إلغاء", `cancel_contribute_${subjectId}`),
      parse_mode: "Markdown",
    }
  );
}

// ============================================
// Helper: عرض معاينة الإحسان مع أزرار التأكيد (المسار الكامل)
// ============================================
async function showMainPathPreview(ctx: any, userState: any): Promise<void> {
  const ctxData = userState.contribution_main_context || {};
  const subjectId = ctxData.subject_id;
  const subject = getSubjectByIdWithFallback(subjectId);
  const contentType = ctxData.content_type || "summary";
  const title = userState.contribution_main_title || "بدون عنوان";
  const description =
    userState.contribution_main_description &&
    userState.contribution_main_description !== "-"
      ? userState.contribution_main_description
      : undefined;

  await ctx.reply(
    TEXTS.contribution_main.preview({
      typeName: contentTypeLabel(contentType),
      subjectName: subject?.name || "غير معروف",
      title,
      description,
    }),
    {
      reply_markup: new InlineKeyboard()
        .text("✅ إرسال", "confirm_contribute_main")
        .text("❌ إلغاء", "cancel_contribute_main"),
      parse_mode: "Markdown",
    }
  );
}

export function registerMessageHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // استقبال ملف الإحسان (للمسارين: القصير + الكامل)
  // ============================================
  bot.on(":document", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const doc = ctx.message.document;

    // ----- المسار القصير: استلام الملف (step="file") -----
    if (
      userState.awaiting_contribution_for_subject &&
      userState.awaiting_contribution_step === "file"
    ) {
      const subjectId = userState.awaiting_contribution_for_subject;
      const contentType = userState.awaiting_contribution_type || "summary";

      // فحص نوع الملف قبل القبول
      const validation = validateUploadedFile(contentType, {
        file_name: doc.file_name,
        mime_type: (doc as any).mime_type,
      });

      if (!validation.valid) {
        // مرفوض — اعرض رسالة توجيه، ابقَ في نفس الخطوة
        await ctx.reply(validation.reason || "❌ نوع الملف غير مقبول.", {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text("❌ إلغاء", `cancel_contribute_${subjectId}`)
            .row()
            .text("🔙 اختيار نوع آخر", `contribute_${subjectId}`),
        });
        return;
      }

      const fileSizeMb =
        doc.file_size && doc.file_size > 0
          ? Number((doc.file_size / 1024 / 1024).toFixed(2))
          : 0;

      // حفظ بيانات الملف في الجلسة (بما فيها الحجم بالبايت للتخزين الدقيق)
      userState.awaiting_contribution_file_id = doc.file_id || "";
      userState.awaiting_contribution_file_name = doc.file_name || "ملف بدون اسم";
      userState.awaiting_contribution_file_size = fileSizeMb;
      userState.awaiting_contribution_file_size_bytes = doc.file_size || 0;
      userState.awaiting_contribution_file_mime = (doc as any).mime_type || "";
      // الانتقال لخطوة العنوان
      userState.awaiting_contribution_step = "title";
      await saveUserState(userState);

      await ctx.reply(TEXTS.contribution.prompt_title, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${subjectId}`),
        parse_mode: "Markdown",
      });
      return;
    }

    // ----- المسار الكامل: استلام الملف (step="file") -----
    if (
      userState.contribution_main_step === "file" &&
      userState.contribution_main_context?.subject_id
    ) {
      const contentType = userState.contribution_main_context?.content_type || "summary";

      // فحص نوع الملف قبل القبول
      const validation = validateUploadedFile(contentType, {
        file_name: doc.file_name,
        mime_type: (doc as any).mime_type,
      });

      if (!validation.valid) {
        // مرفوض — اعرض رسالة توجيه، ابقَ في نفس الخطوة
        await ctx.reply(validation.reason || "❌ نوع الملف غير مقبول.", {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text("❌ إلغاء", "cancel_contribute_main")
            .row()
            .text("🔙 اختيار نوع آخر", "contribute_main_start"),
        });
        return;
      }

      const fileSizeMb =
        doc.file_size && doc.file_size > 0
          ? Number((doc.file_size / 1024 / 1024).toFixed(2))
          : 0;

      // حفظ بيانات الملف في الجلسة
      userState.contribution_main_file_id = doc.file_id || "";
      userState.contribution_main_file_name = doc.file_name || "ملف بدون اسم";
      userState.contribution_main_file_size = fileSizeMb;
      userState.contribution_main_file_size_bytes = doc.file_size || 0;
      userState.contribution_main_file_mime = (doc as any).mime_type || "";
      // الانتقال لخطوة العنوان
      userState.contribution_main_step = "title";
      await saveUserState(userState);

      await ctx.reply(TEXTS.contribution_main.prompt_title, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
        parse_mode: "Markdown",
      });
      return;
    }

    // لو وصل ملف بدون طلب
    await ctx.reply(
      "ℹ️ لم تبدأ عملية إحسان بعد.\n\n" +
        "ابدأ من: 🌟 إحسان علمي (في القائمة الرئيسية) أو 💡 إحسان علمي (في شاشة المادة)"
    );
  });

  // ============================================
  // استقبال النصوص (عنوان/وصف الإحسان + البحث)
  // ============================================
  bot.on(":text", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);

    // ----- المسار القصير: استلام العنوان (step="title") -----
    if (
      userState.awaiting_contribution_step === "title" &&
      userState.awaiting_contribution_for_subject
    ) {
      const subjectId = userState.awaiting_contribution_for_subject;
      userState.awaiting_contribution_title = ctx.message.text.trim() || "بدون عنوان";
      userState.awaiting_contribution_step = "description";
      await saveUserState(userState);

      await ctx.reply(TEXTS.contribution.prompt_description, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${subjectId}`),
        parse_mode: "Markdown",
      });
      return;
    }

    // ----- المسار القصير: استلام الوصف (step="description") -----
    if (
      userState.awaiting_contribution_step === "description" &&
      userState.awaiting_contribution_for_subject
    ) {
      const subjectId = userState.awaiting_contribution_for_subject;
      const desc = ctx.message.text.trim();
      userState.awaiting_contribution_description = desc || "-";
      userState.awaiting_contribution_step = "confirm";
      await saveUserState(userState);

      await showShortPathPreview(ctx, userState, subjectId);
      return;
    }

    // ----- المسار الكامل: استلام العنوان (step="title") -----
    if (userState.contribution_main_step === "title") {
      userState.contribution_main_title = ctx.message.text.trim() || "بدون عنوان";
      userState.contribution_main_step = "description";
      await saveUserState(userState);

      await ctx.reply(TEXTS.contribution_main.prompt_description, {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
        parse_mode: "Markdown",
      });
      return;
    }

    // ----- المسار الكامل: استلام الوصف (step="description") -----
    if (userState.contribution_main_step === "description") {
      const desc = ctx.message.text.trim();
      userState.contribution_main_description = desc || "-";
      userState.contribution_main_step = "confirm";
      await saveUserState(userState);

      await showMainPathPreview(ctx, userState);
      return;
    }

    // ----- وضع البحث -----
    if (userState.awaiting_search) {
      userState.awaiting_search = false;
      await saveUserState(userState);
      const query = ctx.message.text;

      // البحث في Supabase
      let results: any[] = [];
      try {
        results = await supabase.select("content", {
          columns: "id,title,file_name,subject_id,content_type_id,file_size_mb,is_starred,download_count",
          filter: `title=ilike.%${encodeURIComponent(query)}%`,
          order: "download_count.desc",
          limit: 20,
        }) as any[];
      } catch (e) {
        console.error("Supabase search error:", e);
      }

      if (results.length === 0) {
        await ctx.reply(TEXTS.search.no_results, {
          reply_markup: new InlineKeyboard()
            .text("🔍 بحث جديد", "menu_search")
            .row()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        });
        return;
      }

      const mappedResults = results.map((r: any) => ({
        id: r.id.toString(),
        file_name: r.title || r.file_name || "ملف",
        subject_name: getSubjectByIdWithFallback(r.subject_id)?.name || "غير معروف",
      }));
      await ctx.reply(TEXTS.search.results_header(results.length), {
        reply_markup: searchResultsKeyboard(mappedResults, 0),
        parse_mode: "Markdown",
      });
      return;
    }

    // ----- رد افتراضي -----
    await ctx.reply(
      "👋 اكتب /start للعودة للقائمة الرئيسية، أو استخدم الأزرار للتنقل.",
      { reply_markup: mainMenuKeyboard() }
    );
  });
}
