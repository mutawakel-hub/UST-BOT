// ============================================
// 🌟 Ihsan Contribution Handlers — الإحسان العلمي (مساران)
// ============================================
// هذا الملف يحتوي على:
//   - المسار القصير (من شاشة المادة - 5 خطوات):
//       contribute_(\d+), ctype_(\w+)_(\d+), cancel_contribute_(\d+),
//       confirm_contribute_(\d+)
//   - المسار الكامل (من القائمة الرئيسية - 5 خطوات):
//       menu_contribute_main, contribute_main_start,
//       cm_type_(\w+), cm_col_(\d+), cm_major_(\d+), cm_subj_(\d+),
//       confirm_contribute_main, cancel_contribute_main
//
// الترتيب:
//   المسار القصير: نوع → ملف → عنوان → وصف → معاينة → تأكيد
//   المسار الكامل: نوع → كلية → تخصص → مادة → ملف → عنوان → وصف → معاينة → تأكيد
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import {
  getSubjectByIdWithFallback,
  getSubjectsBySpecialtyLevelSemester,
} from "../../shared/data/subjects";
import { TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  collegesKeyboard,
} from "../../shared/keyboards";
import { getUserState, saveUserState } from "../state";
import {
  CONTENT_TYPES,
} from "../../shared/data/admins";
import {
  getSpecialtiesByCollege,
} from "../../shared/data/colleges";

// ============================================
// Helper: بناء keyboard لأنواع المحتوى (7 أنواع)
// ============================================
function contentTypesKeyboard(prefix: string, subjectId?: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const callback = (typeId: string) =>
    subjectId !== undefined
      ? `${prefix}_${typeId}_${subjectId}`
      : `${prefix}_${typeId}`;
  // صفان لكل 2 أنواع
  for (let i = 0; i < CONTENT_TYPES.length; i += 2) {
    kb.text(
      `${CONTENT_TYPES[i].emoji} ${CONTENT_TYPES[i].name}`,
      callback(CONTENT_TYPES[i].id)
    );
    if (CONTENT_TYPES[i + 1]) {
      kb.text(
        `${CONTENT_TYPES[i + 1].emoji} ${CONTENT_TYPES[i + 1].name}`,
        callback(CONTENT_TYPES[i + 1].id)
      );
    }
    kb.row();
  }
  return kb;
}

// ============================================
// Helper: إدراج الطالب في admin_users (لـ FK constraint)
// ============================================
async function ensureStudentInAdminUsers(
  supabase: SupabaseClient,
  telegramId: number,
  firstName?: string,
  username?: string
): Promise<void> {
  try {
    await supabase
      .insert("admin_users", {
        telegram_id: telegramId,
        first_name: firstName || "طالب",
        username: username || null,
      })
      .catch(() => {}); // تجاهل لو موجود مسبقاً
  } catch (e) {
    // تجاهل
  }
}

// ============================================
// Helper: حفظ الإحسان في Supabase
// ============================================
async function saveContribution(
  supabase: SupabaseClient,
  data: {
    userTelegramId: number;
    subjectId: number;
    contentType: string;
    fileName: string;
    fileSizeMb: number;
    telegramFileId: string;
    title: string;
    description?: string;
  }
): Promise<number | null> {
  try {
    // أولاً: التأكد من وجود الطالب في admin_users (مطلوب FK)
    await ensureStudentInAdminUsers(
      supabase,
      data.userTelegramId,
      undefined,
      undefined
    );

    // ثانياً: حفظ الإحسان
    const result = await supabase.insert("contributions", {
      user_telegram_id: data.userTelegramId,
      subject_id: data.subjectId,
      content_type_id: data.contentType,
      file_name: data.fileName,
      file_size_mb: data.fileSizeMb,
      telegram_file_id: data.telegramFileId,
      title: data.title,
      description: data.description || null,
      status: "pending",
    });
    const inserted = result as any;
    return inserted?.id ?? null;
  } catch (e) {
    console.error("Supabase contribution save error:", e);
    return null;
  }
}

export function registerContributionHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // S9: المسار القصير (من شاشة المادة - 5 خطوات)
  // ============================================

  // الخطوة 1: اختيار نوع المحتوى
  // ملاحظة: نستخدم ^ و $ لتجنب مطابقة cancel_contribute_* أو confirm_contribute_*
  bot.callbackQuery(/^contribute_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = subjectId;
    // إعادة ضبط الحقول
    userState.awaiting_contribution_type = undefined;
    userState.awaiting_contribution_step = undefined;
    userState.awaiting_contribution_title = undefined;
    userState.awaiting_contribution_description = undefined;
    userState.awaiting_contribution_file_id = undefined;
    userState.awaiting_contribution_file_name = undefined;
    userState.awaiting_contribution_file_size = undefined;
    await saveUserState(userState);

    const kb = contentTypesKeyboard("ctype", subjectId);
    kb.text("❌ إلغاء", `cancel_contribute_${subjectId}`);

    await ctx.editMessageText(
      TEXTS.contribution.intro(subject?.name || ""),
      {
        reply_markup: kb,
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار نوع المحتوى → طلب الملف (الخطوة 2)
  bot.callbackQuery(/ctype_(\w+)_(\d+)/, async (ctx) => {
    const contentType = ctx.match[1];
    const subjectId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = subjectId;
    userState.awaiting_contribution_type = contentType;
    userState.awaiting_contribution_step = "file";
    await saveUserState(userState);

    // عنوان افتراضي مبدئي (يُستخدم في prompt_file حتى يُدخل المستخدم عنوانه)
    const tempTitle = "—";
    await ctx.editMessageText(
      TEXTS.contribution.prompt_file(tempTitle),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", `cancel_contribute_${subjectId}`),
        parse_mode: "Markdown",
      }
    );
  });

  // إلغاء المسار القصير
  bot.callbackQuery(/^cancel_contribute_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.awaiting_contribution_for_subject = undefined;
    userState.awaiting_contribution_type = undefined;
    userState.awaiting_contribution_step = undefined;
    userState.awaiting_contribution_title = undefined;
    userState.awaiting_contribution_description = undefined;
    userState.awaiting_contribution_file_id = undefined;
    userState.awaiting_contribution_file_name = undefined;
    userState.awaiting_contribution_file_size = undefined;
    await saveUserState(userState);
    await ctx.editMessageText(TEXTS.contribution.cancel, {
      reply_markup: new InlineKeyboard().text(
        TEXTS.navigation.back_to_subject_menu,
        `back_to_subject_menu_${subjectId}`
      ),
    });
  });

  // الخطوة 5: تأكيد الإرسال (المسار القصير)
  bot.callbackQuery(/^confirm_contribute_(\d+)$/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "✅ جارٍ الإرسال..." });

    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const subject = getSubjectByIdWithFallback(subjectId);
    const contentType = userState.awaiting_contribution_type || "summary";
    const title = userState.awaiting_contribution_title || "بدون عنوان";
    const description =
      userState.awaiting_contribution_description &&
      userState.awaiting_contribution_description !== "-"
        ? userState.awaiting_contribution_description
        : undefined;
    const fileName = userState.awaiting_contribution_file_name || "ملف بدون اسم";
    const fileSizeMb = userState.awaiting_contribution_file_size || 0;
    const fileId = userState.awaiting_contribution_file_id || "";

    // حفظ في Supabase
    const newId = await saveContribution(supabase, {
      userTelegramId: ctx.from.id,
      subjectId,
      contentType,
      fileName,
      fileSizeMb,
      telegramFileId: fileId,
      title,
      description,
    });

    const displayId = newId || Math.floor(100000 + Math.random() * 900000);

    // تحديث ذاكرة جلسة الطالب (للعرض في حسابي)
    userState.my_contributions.unshift({
      id: displayId,
      file_name: fileName,
      subject_name: subject?.name || "غير معروف",
      status: "pending",
      submitted_at: "الآن",
    });
    if (userState.my_contributions.length > 20) userState.my_contributions.pop();

    // إعادة ضبط حالة الإحسان
    userState.awaiting_contribution_for_subject = undefined;
    userState.awaiting_contribution_type = undefined;
    userState.awaiting_contribution_step = undefined;
    userState.awaiting_contribution_title = undefined;
    userState.awaiting_contribution_description = undefined;
    userState.awaiting_contribution_file_id = undefined;
    userState.awaiting_contribution_file_name = undefined;
    userState.awaiting_contribution_file_size = undefined;
    await saveUserState(userState);

    await ctx.editMessageText(
      TEXTS.contribution.received(displayId),
      {
        reply_markup: new InlineKeyboard()
          .text(TEXTS.navigation.back_to_subject_menu, `back_to_subject_menu_${subjectId}`)
          .row()
          .text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // S13: المسار الكامل (من القائمة الرئيسية - 5 خطوات)
  // ============================================

  // شاشة intro
  bot.callbackQuery("menu_contribute_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.contribution_main.intro, {
      reply_markup: new InlineKeyboard()
        .text("➕ قدم إحسانًا", "contribute_main_start")
        .row()
        .text(TEXTS.navigation.back_to_main, "back_to_main"),
      parse_mode: "Markdown",
    });
  });

  // الخطوة 1: اختيار نوع المحتوى
  bot.callbackQuery("contribute_main_start", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {};
    userState.contribution_main_step = "type";
    userState.contribution_main_title = undefined;
    userState.contribution_main_description = undefined;
    userState.contribution_main_file_id = undefined;
    userState.contribution_main_file_name = undefined;
    userState.contribution_main_file_size = undefined;
    await saveUserState(userState);

    const kb = contentTypesKeyboard("cm_type");
    kb.text("❌ إلغاء", "cancel_contribute_main");

    await ctx.editMessageText(TEXTS.contribution_main.select_type, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // اختيار النوع → عرض الكليات
  bot.callbackQuery(/cm_type_(\w+)/, async (ctx) => {
    const contentType = ctx.match[1];
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {
      ...userState.contribution_main_context,
      content_type: contentType,
    };
    userState.contribution_main_step = "college";
    await saveUserState(userState);

    const kb = collegesKeyboard(0, "cm_col");
    await ctx.editMessageText(TEXTS.contribution_main.select_college, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ترقيم صفحات الكليات (للمسار الكامل)
  bot.callbackQuery(/cm_col_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(TEXTS.contribution_main.select_college, {
      reply_markup: collegesKeyboard(page, "cm_col"),
      parse_mode: "Markdown",
    });
  });

  // اختيار الكلية → عرض التخصصات
  bot.callbackQuery(/cm_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {
      ...userState.contribution_main_context,
      college_id: collegeId,
    };
    userState.contribution_main_step = "specialty";
    await saveUserState(userState);

    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد تخصصات في هذه الكلية.");
      return;
    }

    // بناء keyboard مخصص للتخصصات (مع prefix "cm_major")
    const kb = new InlineKeyboard();
    for (const s of specialties) {
      kb.text(`📚 ${s.short_name || s.name}`, `cm_major_${s.id}`).row();
    }
    kb.text("🔙 رجوع", "contribute_main_start");
    await ctx.editMessageText(TEXTS.contribution_main.select_specialty, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // اختيار التخصص → عرض المواد
  // نعرض المواد لكل مستويات/فصول التخصص
  bot.callbackQuery(/cm_major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {
      ...userState.contribution_main_context,
      specialty_id: specId,
    };
    userState.contribution_main_step = "subject";
    await saveUserState(userState);

    // تجميع المواد من كل المستويات والفصول للتخصص
    const allSubjects: Array<{ id: number; name: string; level: number; semester: 1 | 2 }> = [];
    for (let level = 1; level <= 6; level++) {
      for (const sem of [1, 2] as const) {
        const subs = getSubjectsBySpecialtyLevelSemester(specId, level, sem);
        for (const s of subs) {
          allSubjects.push({ id: s.id, name: s.name, level: s.level, semester: s.semester });
        }
      }
    }

    if (allSubjects.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد مواد في هذا التخصص.");
      return;
    }

    const kb = new InlineKeyboard();
    for (const s of allSubjects) {
      kb.text(`📖 ${s.name} (م${s.level}/ف${s.semester})`, `cm_subj_${s.id}`).row();
    }
    kb.text("🔙 رجوع", `cm_col_${userState.contribution_main_context?.college_id || 0}`);
    await ctx.editMessageText(TEXTS.contribution_main.select_subject, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // اختيار المادة → طلب رفع الملف (الخطوة 3 في المسار الكامل)
  bot.callbackQuery(/cm_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const subject = getSubjectByIdWithFallback(subjectId);
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = {
      ...userState.contribution_main_context,
      subject_id: subjectId,
    };
    userState.contribution_main_step = "file";
    await saveUserState(userState);

    // الملف سيُعالج في messages.ts (bot.on(":document"))
    // بعدها ننتقل لـ step="title" ثم step="description" ثم step="confirm"
    await ctx.editMessageText(
      `📚 *المادة المختارة:* ${subject?.name || "غير معروف"}\n\n` +
      TEXTS.contribution_main.prompt_file("—"),
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_contribute_main"),
        parse_mode: "Markdown",
      }
    );
  });

  // إلغاء المسار الكامل
  bot.callbackQuery("cancel_contribute_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    userState.contribution_main_context = undefined;
    userState.contribution_main_step = undefined;
    userState.contribution_main_title = undefined;
    userState.contribution_main_description = undefined;
    userState.contribution_main_file_id = undefined;
    userState.contribution_main_file_name = undefined;
    userState.contribution_main_file_size = undefined;
    await saveUserState(userState);
    await ctx.editMessageText(
      TEXTS.contribution_main.cancel,
      {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
      }
    );
  });

  // الخطوة 5: تأكيد الإرسال (المسار الكامل)
  bot.callbackQuery("confirm_contribute_main", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ جارٍ الإرسال..." });

    const userState = await getUserState(ctx.from.id, ctx.from.first_name);
    const ctxData = userState.contribution_main_context || {};
    const subjectId = ctxData.subject_id;
    if (!subjectId) {
      await ctx.reply("⚠️ انتهت الجلسة. ابدأ من جديد من زر 🌟 إحسان علمي.");
      return;
    }
    const subject = getSubjectByIdWithFallback(subjectId);
    const contentType = ctxData.content_type || "summary";
    const title = userState.contribution_main_title || "بدون عنوان";
    const description =
      userState.contribution_main_description &&
      userState.contribution_main_description !== "-"
        ? userState.contribution_main_description
        : undefined;
    const fileName = userState.contribution_main_file_name || "ملف بدون اسم";
    const fileSizeMb = userState.contribution_main_file_size || 0;
    const fileId = userState.contribution_main_file_id || "";

    // حفظ في Supabase
    const newId = await saveContribution(supabase, {
      userTelegramId: ctx.from.id,
      subjectId,
      contentType,
      fileName,
      fileSizeMb,
      telegramFileId: fileId,
      title,
      description,
    });

    const displayId = newId || Math.floor(100000 + Math.random() * 900000);

    // تحديث ذاكرة الجلسة
    userState.my_contributions.unshift({
      id: displayId,
      file_name: fileName,
      subject_name: subject?.name || "غير معروف",
      status: "pending",
      submitted_at: "الآن",
    });
    if (userState.my_contributions.length > 20) userState.my_contributions.pop();

    // إعادة ضبط حالة الإحسان
    userState.contribution_main_context = undefined;
    userState.contribution_main_step = undefined;
    userState.contribution_main_title = undefined;
    userState.contribution_main_description = undefined;
    userState.contribution_main_file_id = undefined;
    userState.contribution_main_file_name = undefined;
    userState.contribution_main_file_size = undefined;
    await saveUserState(userState);

    await ctx.editMessageText(
      TEXTS.contribution_main.received(displayId),
      {
        reply_markup: new InlineKeyboard().text(TEXTS.navigation.back_to_main, "back_to_main"),
        parse_mode: "Markdown",
      }
    );
  });

}
