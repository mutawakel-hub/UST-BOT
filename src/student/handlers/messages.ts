// ============================================
// 💬 Message Handlers — استقبال الرسائل والملفات
// ============================================
// هذا الملف يحتوي على:
//   - bot.on(":text")   — استقبال النصوص (عنوان المساهمة + البحث)
//   - bot.on(":document") — استقبال الملفات (للمسارين: القصير + الكامل)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { getSubjectByIdWithFallback } from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  mainMenuKeyboard,
  searchResultsKeyboard,
} from "../../shared/keyboards";
import { getUserState } from "../state";

export function registerMessageHandlers(bot: Bot, supabase: SupabaseClient): void {
  // استقبال ملف المساهمة (للمسارين: القصير + الكامل)
  bot.on(":document", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const doc = ctx.message.document;
    const contributionId = 9900 + Math.floor(Math.random() * 1000);

    // المسار القصير (من شاشة المادة - 4 خطوات)
    if (userState.awaiting_contribution_for_subject && userState.awaiting_contribution_step === "file") {
    const subjectId = userState.awaiting_contribution_for_subject;
    const subject = getSubjectByIdWithFallback(subjectId);
    const contentType = userState.awaiting_contribution_type || "summary";
    const title = userState.awaiting_contribution_title || doc.file_name || "بدون عنوان";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;

      userState.my_contributions.unshift({
        id: contributionId,
        file_name: doc.file_name || "ملف بدون اسم",
        subject_name: subject?.name || "غير معروف",
        status: "pending",
        submitted_at: "الآن",
      });

    // حفظ المساهمة في Supabase
        try {
          // أولاً: التأكد من وجود الطالب في admin_users (مطلوب FK)
          await supabase.insert("admin_users", {
            telegram_id: ctx.from.id,
            first_name: ctx.from.first_name || "طالب",
            username: ctx.from.username || null,
          }).catch(() => {}); // تجاهل لو موجود مسبقاً

          // ثانياً: حفظ المساهمة
          await supabase.insert("contributions", {
            user_telegram_id: ctx.from.id,
            subject_id: subjectId,
            content_type_id: contentType,
            file_name: doc.file_name || "ملف بدون اسم",
            file_size_mb: (doc.file_size / 1024 / 1024).toFixed(2),
            telegram_file_id: doc.file_id || null,
            description: title,
            status: "pending",
          });
          console.log(`✅ Contribution saved to Supabase for student ${ctx.from.id}`);
        } catch (e) {
          console.error("Supabase contribution save error:", e);
        }

    // إعادة ضبط حالة المساهمة
      userState.awaiting_contribution_for_subject = undefined;
      userState.awaiting_contribution_type = undefined;
      userState.awaiting_contribution_step = undefined;
      userState.awaiting_contribution_title = undefined;

    await ctx.reply(
        TEXTS.contribution.received(
          contributionId,
          doc.file_name || "ملف",
          subject?.name || "غير معروف",
          typeLabel,
          title
        ),
        {
          reply_markup: new InlineKeyboard()
            .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
            .row()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // المسار الكامل (من القائمة الرئيسية - 9 خطوات)
    if (userState.contribution_main_step === "file" && userState.contribution_main_context?.subject_id) {
    const ctx_data = userState.contribution_main_context;
    const subject = getSubjectByIdWithFallback(ctx_data.subject_id);
    const contentType = ctx_data.content_type || "summary";
    const title = userState.contribution_main_title || doc.file_name || "بدون عنوان";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;

      userState.my_contributions.unshift({
        id: contributionId,
        file_name: doc.file_name || "ملف بدون اسم",
        subject_name: subject?.name || "غير معروف",
        status: "pending",
        submitted_at: "الآن",
      });

    // حفظ المساهمة في Supabase (المسار الكامل)
        try {
          await supabase.insert("admin_users", {
            telegram_id: ctx.from.id,
            first_name: ctx.from.first_name || "طالب",
            username: ctx.from.username || null,
          }).catch(() => {});

          await supabase.insert("contributions", {
            user_telegram_id: ctx.from.id,
            subject_id: ctx_data.subject_id,
            content_type_id: contentType,
            file_name: doc.file_name || "ملف بدون اسم",
            file_size_mb: (doc.file_size / 1024 / 1024).toFixed(2),
            telegram_file_id: doc.file_id || null,
            description: title,
            status: "pending",
          });
          console.log(`✅ Contribution (main flow) saved to Supabase for student ${ctx.from.id}`);
        } catch (e) {
          console.error("Supabase contribution save error:", e);
        }

    // إعادة ضبط الحالة
      userState.contribution_main_context = undefined;
      userState.contribution_main_step = undefined;
      userState.contribution_main_title = undefined;

    await ctx.reply(
        TEXTS.contribution.received(
          contributionId,
          doc.file_name || "ملف",
          subject?.name || "غير معروف",
          typeLabel,
          title
        ),
        {
          reply_markup: new InlineKeyboard()
            .text(TEXTS.navigation.back_to_main, "back_to_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // لو وصل ملف بدون طلب
    await ctx.reply(
      "ℹ️ لم تبدأ عملية مساهمة بعد.\n\n" +
      "ابدأ من: 🌟 المساهمة (في القائمة الرئيسية) أو 💡 مساهمة (في شاشة المادة)"
    );
  });

  bot.on(":text", async (ctx) => {
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);

    // استقبال عنوان المساهمة (المسار القصير - من شاشة المادة)
    if (userState.awaiting_contribution_step === "title" && userState.awaiting_contribution_for_subject) {
      userState.awaiting_contribution_title = ctx.message.text;
      userState.awaiting_contribution_step = "file";
    const subject = getSubjectByIdWithFallback(userState.awaiting_contribution_for_subject);
    const contentType = userState.awaiting_contribution_type || "summary";
    const typeLabel = {
        book_theory: "📘 المقرر النظري",
        book_practical: "📗 المقرر العملي",
        exam: "📑 نماذج اختبارات",
        summary: "📝 ملخصات",
        video: "🎥 مرئيات",
        reference: "📚 مراجع",
      }[contentType] || contentType;
    await ctx.reply(
        TEXTS.contribution.prompt_file(subject?.name || "", typeLabel, ctx.message.text),
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${userState.awaiting_contribution_for_subject}`),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    // استقبال عنوان المساهمة (المسار الكامل - من القائمة الرئيسية)
    if (userState.contribution_main_step === "title") {
      userState.contribution_main_title = ctx.message.text;
      userState.contribution_main_step = "file";
    await ctx.reply(
        TEXTS.contribution_main.prompt_file(ctx.message.text),
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
          parse_mode: "Markdown",
        }
      );
    return;
    }

    if (userState.awaiting_search) {
      userState.awaiting_search = false;
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
    } else {
    await ctx.reply(
        "👋 اكتب /start للعودة للقائمة الرئيسية، أو استخدم الأزرار للتنقل.",
        { reply_markup: mainMenuKeyboard() }
      );
    }
  });
}
