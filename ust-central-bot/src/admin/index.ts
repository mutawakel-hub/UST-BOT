// ============================================
// بوت الإدارة - جامعة العلوم والتكنولوجيا (محسّن)
// Mockup على Cloudflare Workers + grammY
// 15 شاشة + نظام تسجيل دخول + 4 أدوار هرمية
// ============================================

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { TEXTS, ADMIN_TEXTS } from "../shared/texts";
import {
  adminDashboardKeyboard,
  pendingListKeyboard,
  reviewContributionKeyboard,
  rejectReasonKeyboard,
  rejectConfirmKeyboard,
  filesMgmtKeyboard,
  browseFilesKeyboard,
  subjectsMgmtKeyboard,
  broadcastKeyboard,
  broadcastConfirmKeyboard,
  manageAdminsKeyboard,
  statisticsKeyboard,
  customizeKeyboard,
  leaderboardUpdateKeyboard,
  breadcrumb,
} from "../shared/keyboards";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../shared/data/colleges";
import {
  SUBJECTS,
  getSubjectById,
  getSubjectsBySpecialtyLevelSemester,
  getMockFilesForSubject,
} from "../shared/data/subjects";
import {
  MOCK_ADMINS,
  MOCK_PENDING_CONTRIBUTIONS,
  MOCK_STATISTICS,
  type MockAdmin,
  type MockContribution,
  getAdminByLoginId,
  getRoleLabel,
  getRoleScope,
} from "../shared/data/admins";

// ============================================
// حالة الجلسة لكل مسؤول
// ============================================
interface AdminSession {
  admin: MockAdmin;
  awaiting_login?: boolean;
  awaiting_upload_step?: "major" | "level" | "semester" | "subject" | "type" | "file";
  awaiting_broadcast_scope?: "all" | "college" | "major" | "level";
  awaiting_broadcast_text?: string;
  awaiting_subject_add?: boolean;
  awaiting_text_edit?: string;
  awaiting_text_value?: string;
  awaiting_admin_add_step?: "name" | "telegram_id" | "role" | "college" | "specialty" | "level";
  new_admin_data?: any;
  upload_context?: any;
}

const adminSessions = new Map<number, AdminSession>();

// قائمة المسؤولين الحالية (تبدأ من MOCK_ADMINS)
const ALL_ADMINS: MockAdmin[] = [...MOCK_ADMINS];

// قائمة المساهمات المعلقة (تبدأ من MOCK_PENDING_CONTRIBUTIONS)
let pendingContributions: MockContribution[] = [...MOCK_PENDING_CONTRIBUTIONS];

// النصوص المخصصة (محاكاة - في الذاكرة)
const customTexts = new Map<string, string>();

function getPendingCount(): number {
  return pendingContributions.length;
}

function getContributionById(id: number): MockContribution | undefined {
  return pendingContributions.find((c) => c.id === id);
}

function removeContribution(id: number): void {
  pendingContributions = pendingContributions.filter((c) => c.id !== id);
}

// ============================================
// إنشاء البوت
// ============================================
export function createAdminBot(token: string): Bot {
  const bot = new Bot(token);

  // ====== A1: تسجيل الدخول ======
  bot.command("start", async (ctx) => {
    // إذا كان مسجل دخول بالفعل
    if (adminSessions.has(ctx.from.id)) {
      const session = adminSessions.get(ctx.from.id)!;
      await ctx.reply(
        ADMIN_TEXTS.dashboard.title(
          session.admin.name,
          getRoleLabel(session.admin.role),
          getPendingCount()
        ) + "\n\n📍 النطاق: " + getRoleScope(session.admin),
        {
          reply_markup: adminDashboardKeyboard(session.admin.role, getPendingCount()),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // طلب تسجيل الدخول
    adminSessions.set(ctx.from.id, { admin: null as any, awaiting_login: true });
    await ctx.reply(ADMIN_TEXTS.login.welcome, { parse_mode: "Markdown" });
  });

  // استقبال معرّف تسجيل الدخول
  bot.on(":text", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);

    if (session?.awaiting_login) {
      const loginId = ctx.message.text.trim();
      const admin = getAdminByLoginId(loginId);

      if (!admin) {
        await ctx.reply(ADMIN_TEXTS.login.not_authorized(loginId), {
          reply_markup: new InlineKeyboard().text("🔄 محاولة أخرى", "retry_login"),
          parse_mode: "Markdown",
        });
        return;
      }

      session.admin = admin;
      session.awaiting_login = false;
      await ctx.reply(
        ADMIN_TEXTS.login.success(admin.name, getRoleLabel(admin.role), getRoleScope(admin)) +
          "\n\n" +
          ADMIN_TEXTS.dashboard.title(admin.name, getRoleLabel(admin.role), getPendingCount()),
        {
          reply_markup: adminDashboardKeyboard(admin.role, getPendingCount()),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال نص التعميم
    if (session?.awaiting_broadcast_text === "awaiting") {
      session.awaiting_broadcast_text = ctx.message.text;
      const scopeLabel = {
        all: "🌍 للجميع",
        college: "🏛 لكلية محددة",
        major: "📚 لتخصص محدد",
        level: "📊 لمستوى محدد",
      }[session.awaiting_broadcast_scope || "all"];

      const recipientCount = {
        all: 1247,
        college: 312,
        major: 89,
        level: 23,
      }[session.awaiting_broadcast_scope || "all"];

      await ctx.reply(
        ADMIN_TEXTS.broadcast.preview(ctx.message.text, scopeLabel, recipientCount),
        {
          reply_markup: broadcastConfirmKeyboard(),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // استقبال اسم مادة جديدة
    if (session?.awaiting_subject_add) {
      session.awaiting_subject_add = false;
      await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_done(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال نص مخصص جديد
    if (session?.awaiting_text_value === "awaiting") {
      const screenKey = session.awaiting_text_edit!;
      session.awaiting_text_value = undefined;
      session.awaiting_text_edit = undefined;
      customTexts.set(screenKey, ctx.message.text);
      await ctx.reply(ADMIN_TEXTS.customize.saved(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // استقبال اسم مسؤول جديد
    if (session?.awaiting_admin_add_step === "name") {
      session.new_admin_data = { name: ctx.message.text };
      session.awaiting_admin_add_step = "telegram_id";
      await ctx.reply(
        "🆔 أرسل معرّف تلجرام للمسؤول الجديد (رقم):\n\n💡 للحصول على المعرّف: توجّه إلى @userinfobot",
        {
          reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_admins"),
        }
      );
      return;
    }

    if (session?.awaiting_admin_add_step === "telegram_id") {
      const tid = parseInt(ctx.message.text);
      if (isNaN(tid)) {
        await ctx.reply("⚠️ المعرّف يجب أن يكون رقماً. أعد المحاولة:");
        return;
      }
      session.new_admin_data.telegram_id = tid;
      session.awaiting_admin_add_step = "role";
      const kb = new InlineKeyboard()
        .text("🛡 مركزي", "new_admin_role_central")
        .text("🏛 كلية", "new_admin_role_college")
        .row()
        .text("📚 تخصص", "new_admin_role_specialty")
        .text("📊 مستوى", "new_admin_role_level")
        .row()
        .text("❌ إلغاء", "manage_admins");
      await ctx.reply("🎭 اختر دور المسؤول الجديد:", { reply_markup: kb });
      return;
    }

    // رسالة افتراضية
    if (session?.admin) {
      await ctx.reply(
        "👋 استخدم الأزرار للتنقل، أو /start للعودة للوحة الإدارة."
      );
    } else {
      await ctx.reply(ADMIN_TEXTS.login.welcome, { parse_mode: "Markdown" });
    }
  });

  bot.callbackQuery("retry_login", async (ctx) => {
    await ctx.answerCallbackQuery();
    adminSessions.set(ctx.from.id, { admin: null as any, awaiting_login: true });
    await ctx.editMessageText(ADMIN_TEXTS.login.welcome, { parse_mode: "Markdown" });
  });

  // ====== A2: لوحة الإدارة ======
  bot.callbackQuery("back_to_dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (!session?.admin) return;
    session.awaiting_upload_step = undefined;
    session.awaiting_broadcast_text = undefined;
    session.awaiting_subject_add = false;
    session.awaiting_text_edit = undefined;
    session.awaiting_text_value = undefined;
    session.upload_context = undefined;
    session.awaiting_admin_add_step = undefined;
    session.new_admin_data = undefined;
    await ctx.editMessageText(
      ADMIN_TEXTS.dashboard.title(
        session.admin.name,
        getRoleLabel(session.admin.role),
        getPendingCount()
      ) + "\n\n📍 النطاق: " + getRoleScope(session.admin),
      {
        reply_markup: adminDashboardKeyboard(session.admin.role, getPendingCount()),
        parse_mode: "Markdown",
      }
    );
  });

  // تسجيل الخروج
  bot.callbackQuery("admin_logout", async (ctx) => {
    await ctx.answerCallbackQuery();
    adminSessions.delete(ctx.from.id);
    await ctx.editMessageText(
      "🚪 *تم تسجيل الخروج بنجاح*\n\nللعودة، أرسل /start وأدخل معرّف المسؤول.",
      { parse_mode: "Markdown" }
    );
  });

  // ====== A3: قائمة المساهمات المعلقة ======
  bot.callbackQuery("pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (pendingContributions.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.pending.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(ADMIN_TEXTS.pending.title(pendingContributions.length), {
      reply_markup: pendingListKeyboard(pendingContributions),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (pendingContributions.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.pending.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(ADMIN_TEXTS.pending.title(pendingContributions.length), {
      reply_markup: pendingListKeyboard(pendingContributions),
      parse_mode: "Markdown",
    });
  });

  // ====== A4: مراجعة مساهمة ======
  bot.callbackQuery(/review_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery();
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة أو تمت معالجتها.");
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.review.title({
        id: contrib.id,
        fileName: contrib.file_name,
        subjectName: contrib.subject_name,
        userName: contrib.user_name,
        uploadedAt: contrib.uploaded_at,
        fileSizeMb: contrib.file_size_mb,
        description: contrib.description,
      }),
      {
        reply_markup: reviewContributionKeyboard(contrib.id),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/back_to_review_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery();
    if (!contrib) {
      await ctx.answerCallbackQuery({ text: "تمت معالجة هذه المساهمة" });
      return;
    }
    await ctx.editMessageText(
      ADMIN_TEXTS.review.title({
        id: contrib.id,
        fileName: contrib.file_name,
        subjectName: contrib.subject_name,
        userName: contrib.user_name,
        uploadedAt: contrib.uploaded_at,
        fileSizeMb: contrib.file_size_mb,
        description: contrib.description,
      }),
      {
        reply_markup: reviewContributionKeyboard(contrib.id),
        parse_mode: "Markdown",
      }
    );
  });

  // اعتماد
  bot.callbackQuery(/approve_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery({ text: "✅ تم الاعتماد" });
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة.");
      return;
    }
    removeContribution(contribId);
    await ctx.editMessageText(
      `✅ *تم اعتماد المساهمة #${contribId}*\n\n` +
        `📎 الملف: \`${contrib.file_name}\`\n` +
        `📚 المادة: ${contrib.subject_name}\n` +
        `👤 المساهم: ${contrib.user_name}\n\n` +
        `تم نقل الملف لقناة التخزين ونشره للطلاب (محاكاة).`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // اعتماد مميز
  bot.callbackQuery(/approve_star_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery({ text: "⭐ تم الاعتماد المميز" });
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة.");
      return;
    }
    removeContribution(contribId);
    await ctx.editMessageText(
      `⭐ *تم اعتماد المساهمة #${contribId} كمحتوى مميز*\n\n` +
        `📎 الملف: \`${contrib.file_name}\`\n` +
        `📚 المادة: ${contrib.subject_name}\n` +
        `👤 المساهم: ${contrib.user_name}\n\n` +
        `تم نشر الملف مع علامة التميز ⭐ (محاكاة).`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // رفض → A4b
  bot.callbackQuery(/reject_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!getContributionById(contribId)) {
      await ctx.reply("⚠️ المساهمة غير موجودة.");
      return;
    }
    await ctx.editMessageText(ADMIN_TEXTS.reject_reason.title, {
      reply_markup: rejectReasonKeyboard(contribId),
      parse_mode: "Markdown",
    });
  });

  // اختيار سبب الرفض → تأكيد
  bot.callbackQuery(/reject_reason_(dup|bad|irrelevant|incomplete|skip)_(\d+)/, async (ctx) => {
    const reasonKey = ctx.match[1];
    const contribId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const reasons = {
      dup: "♻️ مكرر",
      bad: "👁 غير واضح",
      irrelevant: "🚫 لا يتعلق بالمادة",
      incomplete: "📝 غير مكتمل",
      skip: "بدون سبب محدد",
    };
    const reason = reasons[reasonKey as keyof typeof reasons];

    await ctx.editMessageText(ADMIN_TEXTS.reject_reason.confirm(reason, contribId), {
      reply_markup: rejectConfirmKeyboard(contribId, reasonKey),
      parse_mode: "Markdown",
    });
  });

  // تأكيد الرفض
  bot.callbackQuery(/confirm_reject_(\d+)_(\w+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const reasonKey = ctx.match[2];
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery({ text: "❌ تم الرفض" });
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة.");
      return;
    }
    removeContribution(contribId);
    const reasons = {
      dup: "♻️ مكرر",
      bad: "👁 غير واضح",
      irrelevant: "🚫 لا يتعلق بالمادة",
      incomplete: "📝 غير مكتمل",
      skip: "بدون سبب محدد",
    };
    const reason = reasons[reasonKey as keyof typeof reasons] || reasonKey;
    await ctx.editMessageText(
      ADMIN_TEXTS.reject_reason.done(reason, contribId) +
        `\n\n📎 الملف: \`${contrib.file_name}\`\n👤 المساهم: ${contrib.user_name}`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A5: إدارة الملفات ======
  bot.callbackQuery("files_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.files_mgmt.title, {
      reply_markup: filesMgmtKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_files_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.files_mgmt.title, {
      reply_markup: filesMgmtKeyboard(),
      parse_mode: "Markdown",
    });
  });

  // A5a: معالج رفع الملفات (مع شريط تقدّم)
  bot.callbackQuery("upload_file", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_upload_step = "major";
      session.upload_context = {};
    }
    const bc = breadcrumb("📁 إدارة الملفات", "📤 رفع ملف", "1/6");
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => kb.text(`${c.emoji} ${c.short_name}`, `upload_col_${c.id}`).row());
    kb.text("❌ إلغاء", "back_to_files_mgmt");
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.start}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, college_id: collegeId };
    session.awaiting_upload_step = "level";
    await ctx.answerCallbackQuery();

    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const bc = breadcrumb("📁 إدارة الملفات", "📤 رفع ملف", `2/6 • ${college?.emoji} ${college?.short_name}`);

    const kb = new InlineKeyboard();
    specialties.forEach((s) => kb.text(s.short_name, `upload_major_${s.id}`).row());
    kb.text("🔙 الكليات", "upload_file");
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.select_major}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, specialty_id: specId };
    session.awaiting_upload_step = "semester";
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    const levels = getLevelsForSpecialty(specId);
    const bc = breadcrumb("📁 إدارة الملفات", "📤 رفع ملف", `3/6 • ${spec?.short_name}`);

    const kb = new InlineKeyboard();
    for (let i = 0; i < levels.length; i += 3) {
      for (let j = 0; j < 3 && i + j < levels.length; j++) {
        kb.text(`مستوى ${levels[i + j]}`, `upload_level_${levels[i + j]}`);
      }
      kb.row();
    }
    kb.text("🔙 التخصصات", `upload_col_${session.upload_context?.college_id}`);
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.select_level}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_level_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session || !session.upload_context?.specialty_id) return;
    session.upload_context = { ...session.upload_context, level };
    session.awaiting_upload_step = "subject";
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(session.upload_context.specialty_id);
    const bc = breadcrumb("📁 إدارة الملفات", "📤 رفع ملف", `4/6 • ${spec?.short_name} • مستوى ${level}`);

    const kb = new InlineKeyboard();
    kb.text("🍂 الفصل الأول", "upload_sem_1").row();
    kb.text("🌸 الفصل الثاني", "upload_sem_2").row();
    kb.text("🔙 المستويات", `upload_major_${session.upload_context?.specialty_id}`);
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.select_semester}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_sem_(\d+)/, async (ctx) => {
    const semester = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session || !session.upload_context?.specialty_id || !session.upload_context?.level) return;
    session.upload_context.semester = semester;
    session.awaiting_upload_step = "type";
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(session.upload_context.specialty_id);
    const bc = breadcrumb(
      "📁 إدارة الملفات",
      "📤 رفع ملف",
      `5/6 • ${spec?.short_name} • مستوى ${session.upload_context.level} • فصل ${semester}`
    );

    const subjects = getSubjectsBySpecialtyLevelSemester(
      session.upload_context.specialty_id,
      session.upload_context.level,
      semester as 1 | 2
    );
    const kb = new InlineKeyboard();
    if (subjects.length === 0) {
      kb.text("➕ إضافة مادة", "add_subject").row();
    } else {
      subjects.forEach((s) => kb.text(s.name, `upload_subj_${s.id}`).row());
    }
    kb.text("🔙 الفصول", `upload_level_${session.upload_context?.level}`);
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.select_subject}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, subject_id: subjectId };
    session.awaiting_upload_step = "file";
    await ctx.answerCallbackQuery();

    const subject = getSubjectById(subjectId);
    const bc = breadcrumb("📁 إدارة الملفات", "📤 رفع ملف", `6/6 • ${subject?.name}`);

    const kb = new InlineKeyboard();
    kb.text("📘 المقرر (نظري)", "upload_type_book_theory");
    if (subject?.has_practical) kb.text("📗 المقرر (عملي)", "upload_type_book_practical");
    kb.row();
    kb.text("📑 نماذج اختبارات", "upload_type_exam");
    kb.text("📝 ملخصات", "upload_type_summary");
    kb.row();
    kb.text("🔙 المواد", `upload_sem_${session.upload_context?.semester}`);
    await ctx.editMessageText(`${bc}\n\n${ADMIN_TEXTS.upload_wizard.select_type}`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_type_(.+)/, async (ctx) => {
    const type = ctx.match[1];
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, category: type };
    session.awaiting_upload_step = "file";
    await ctx.answerCallbackQuery();

    const subject = getSubjectById(session.upload_context?.subject_id || 0);
    const typeLabels: Record<string, string> = {
      book_theory: "📘 المقرر (نظري)",
      book_practical: "📗 المقرر (عملي)",
      exam: "📑 نماذج اختبارات",
      summary: "📝 ملخصات",
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.upload_wizard.confirm(
        "(سيُحدد عند الرفع)",
        subject?.name || "غير معروف",
        typeLabels[type] || type
      ),
      {
        reply_markup: new InlineKeyboard().text("🔙 التصنيفات", `upload_subj_${session.upload_context?.subject_id}`),
        parse_mode: "Markdown",
      }
    );
    await ctx.reply(ADMIN_TEXTS.upload_wizard.awaiting_file, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", "back_to_files_mgmt"),
      parse_mode: "Markdown",
    });
  });

  bot.on(":document", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (session?.awaiting_upload_step === "file") {
      const doc = ctx.message.document;
      session.awaiting_upload_step = undefined;
      await ctx.reply(ADMIN_TEXTS.upload_wizard.success, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
    }
  });

  // A5b: استعراض الملفات
  bot.callbackQuery("browse_files", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.browse_files.title, {
      reply_markup: browseFilesKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("browse_all", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.browse_files.files_header(SUBJECTS.length * 4);
    let count = 0;
    for (const subject of SUBJECTS.slice(0, 5)) {
      const cats = ["book_theory", "exam", "summary"];
      for (const cat of cats) {
        const files = getMockFilesForSubject(subject.id, cat);
        for (const f of files) {
          if (count >= 8) break;
          msg += ADMIN_TEXTS.browse_files.file_entry({
            id: f.id,
            name: f.file_name,
            subject: subject.name,
            size: f.file_size_mb,
            downloads: f.download_count,
          });
          count++;
        }
      }
    }
    msg += `\n📋 إظهار أول 8 ملفات من إجمالي ${SUBJECTS.length * 4} ملف.`;
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("⬅️ السابق", "noop")
        .text("➡️ التالي", "noop")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_files_mgmt, "back_to_files_mgmt"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("noop", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "ℹ️ Pagination في الإنتاج" });
  });

  bot.callbackQuery("browse_by_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => kb.text(`${c.emoji} ${c.short_name}`, `noop`).row());
    kb.text(ADMIN_TEXTS.navigation.back_to_files_mgmt, "back_to_files_mgmt");
    await ctx.editMessageText("🏛 *اختر الكلية للفلترة:*\n\n(محاكاة - في الإنتاج ستظهر ملفات الكلية)", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("browse_by_specialty", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📚 *فلترة بالتخصص*\n\n(محاكاة - في الإنتاج ستظهر قائمة التخصصات ثم الملفات)",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_files_mgmt, "back_to_files_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("browse_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "🔍 *البحث في الملفات*\n\n(محاكاة - في الإنتاج: أرسل كلمة بحثية)",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_files_mgmt, "back_to_files_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A6: إدارة المواد ======
  bot.callbackQuery("subjects_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.title, {
      reply_markup: subjectsMgmtKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_subjects_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.title, {
      reply_markup: subjectsMgmtKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) session.awaiting_subject_add = true;
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("list_subjects", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.subjects_mgmt.list_header(SUBJECTS.length);
    SUBJECTS.slice(0, 10).forEach((s) => {
      msg += `📖 ${s.name} (مستوى ${s.level}, فصل ${s.semester})\n`;
    });
    msg += `\n📋 إظهار أول 10 مواد من ${SUBJECTS.length}.`;
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "back_to_subjects_mgmt"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("edit_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "✏️ *تعديل/حذف مادة*\n\nاختر التخصص أولاً (محاكاة - متاح كاملاً في الإنتاج):",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_subjects_mgmt, "back_to_subjects_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A7: التعميم ======
  bot.callbackQuery("broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.title, {
      reply_markup: broadcastKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.title, {
      reply_markup: broadcastKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/broadcast_(all|college|major|level)/, async (ctx) => {
    const scope = ctx.match[1] as "all" | "college" | "major" | "level";
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_broadcast_scope = scope;
      session.awaiting_broadcast_text = "awaiting";
    }
    await ctx.answerCallbackQuery();
    const scopeLabels = {
      all: "🌍 للجميع",
      college: "🏛 لكلية محددة",
      major: "📚 لتخصص محدد",
      level: "📊 لمستوى محدد",
    };
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.prompt_text(scopeLabels[scope]), {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_broadcast, "broadcast"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("confirm_broadcast", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    const text = session.awaiting_broadcast_text || "";
    const scope = session.awaiting_broadcast_scope || "all";
    const recipientCounts = { all: 1247, college: 312, major: 89, level: 23 };
    const count = recipientCounts[scope];
    session.awaiting_broadcast_text = undefined;
    session.awaiting_broadcast_scope = undefined;
    await ctx.answerCallbackQuery({ text: "📢 تم الإرسال" });
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.sent(count), {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // ====== A8: إدارة المسؤولين ======
  bot.callbackQuery("manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.manage_admins.title, {
      reply_markup: manageAdminsKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.manage_admins.title, {
      reply_markup: manageAdminsKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("list_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.manage_admins.list_header(ALL_ADMINS.length);
    ALL_ADMINS.forEach((a) => {
      msg += ADMIN_TEXTS.manage_admins.entry({
        name: a.name,
        roleLabel: getRoleLabel(a.role),
        scope: getRoleScope(a),
        id: a.id,
      });
    });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_manage_admins, "back_to_manage_admins"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("add_admin", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_admin_add_step = "name";
      session.new_admin_data = {};
    }
    await ctx.editMessageText(
      "➕ *إضافة مسؤول جديد*\n\nالخطوة 1/3: أرسل اسم المسؤول الكريم:",
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "manage_admins"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/new_admin_role_(central|college|specialty|level)/, async (ctx) => {
    const role = ctx.match[1] as any;
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.new_admin_data.role = role;
    if (role === "central") {
      // إضافة مباشرة - لا نطالب بنطاق
      const newAdmin: MockAdmin = {
        id: `DEMO${String(ALL_ADMINS.length + 1).padStart(3, "0")}`,
        telegram_id: session.new_admin_data.telegram_id,
        name: session.new_admin_data.name,
        role: "central",
      };
      ALL_ADMINS.push(newAdmin);
      session.awaiting_admin_add_step = undefined;
      session.new_admin_data = undefined;
      await ctx.answerCallbackQuery({ text: "✅ تمت الإضافة" });
      await ctx.editMessageText(
        `✅ *تمت إضافة المسؤول بنجاح!*\n\n👤 الاسم: ${newAdmin.name}\n🎭 الدور: ${getRoleLabel(newAdmin.role)}\n🆔 المعرّف: \`${newAdmin.id}\``,
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_manage_admins, "back_to_manage_admins"),
          parse_mode: "Markdown",
        }
      );
    } else {
      // للتبسيط في الـ Mockup - نضيف بنطاق الكلية الحاسبات
      const collegeId = 5;
      let newAdmin: MockAdmin;
      if (role === "college") {
        newAdmin = {
          id: `DEMO${String(ALL_ADMINS.length + 1).padStart(3, "0")}`,
          telegram_id: session.new_admin_data.telegram_id,
          name: session.new_admin_data.name,
          role: "college",
          college_id: collegeId,
        };
      } else if (role === "specialty") {
        newAdmin = {
          id: `DEMO${String(ALL_ADMINS.length + 1).padStart(3, "0")}`,
          telegram_id: session.new_admin_data.telegram_id,
          name: session.new_admin_data.name,
          role: "specialty",
          college_id: collegeId,
          specialty_id: 16,
        };
      } else {
        newAdmin = {
          id: `DEMO${String(ALL_ADMINS.length + 1).padStart(3, "0")}`,
          telegram_id: session.new_admin_data.telegram_id,
          name: session.new_admin_data.name,
          role: "level",
          college_id: collegeId,
          specialty_id: 16,
          level: 1,
        };
      }
      ALL_ADMINS.push(newAdmin);
      session.awaiting_admin_add_step = undefined;
      session.new_admin_data = undefined;
      await ctx.answerCallbackQuery({ text: "✅ تمت الإضافة" });
      await ctx.editMessageText(
        `✅ *تمت إضافة المسؤول بنجاح!*\n\n👤 الاسم: ${newAdmin.name}\n🎭 الدور: ${getRoleLabel(newAdmin.role)}\n📍 النطاق: ${getRoleScope(newAdmin)}\n🆔 المعرّف: \`${newAdmin.id}\`\n\nℹ️ في الإنتاج سيُطلب منك تحديد النطاق بدقة (كلية/تخصص/مستوى).`,
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_manage_admins, "back_to_manage_admins"),
          parse_mode: "Markdown",
        }
      );
    }
  });

  // ====== A9: الإحصائيات ======
  bot.callbackQuery("statistics", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(MOCK_STATISTICS),
      {
        reply_markup: statisticsKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("stats_refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    const updatedStats = {
      ...MOCK_STATISTICS,
      total_users: MOCK_STATISTICS.total_users + Math.floor(Math.random() * 5),
      active_today: MOCK_STATISTICS.active_today + Math.floor(Math.random() * 20),
      total_downloads: MOCK_STATISTICS.total_downloads + Math.floor(Math.random() * 50),
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(updatedStats),
      {
        reply_markup: statisticsKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A10: تخصيص النصوص ======
  bot.callbackQuery("customize_texts", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.customize.title, {
      reply_markup: customizeKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_customize", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.customize.title, {
      reply_markup: customizeKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/custom_screen_(.+)/, async (ctx) => {
    const screenKey = ctx.match[1];
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_text_edit = screenKey;
      session.awaiting_text_value = "awaiting";
    }
    await ctx.answerCallbackQuery();

    const currentTexts: Record<string, string> = {
      main_menu: customTexts.get("main_menu") || TEXTS.main_menu.welcome,
      choose_college: customTexts.get("choose_college") || TEXTS.choose_college.title,
      subject_menu: customTexts.get("subject_menu") || "(ديناميكي - يعرض اسم المادة + خيارات)",
      search: customTexts.get("search") || TEXTS.search.intro,
    };
    const current = currentTexts[screenKey] || "(نص افتراضي)";

    await ctx.editMessageText(ADMIN_TEXTS.customize.edit_prompt(current), {
      reply_markup: new InlineKeyboard().text("↩️ استعادة الافتراضي", "reset_default").row().text(ADMIN_TEXTS.navigation.back_to_customize, "back_to_customize"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("reset_default", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session?.awaiting_text_edit) {
      customTexts.delete(session.awaiting_text_edit);
      session.awaiting_text_edit = undefined;
      session.awaiting_text_value = undefined;
    }
    await ctx.editMessageText(ADMIN_TEXTS.customize.reset, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_customize, "back_to_customize"),
      parse_mode: "Markdown",
    });
  });

  // ====== A11: تحديث لوحة الشرف ======
  bot.callbackQuery("leaderboard_update", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.leaderboard_update.title, {
      reply_markup: leaderboardUpdateKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/leader_(global|college|specialty)/, async (ctx) => {
    const scope = ctx.match[1];
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    const scopeLabels = { global: "العالمية", college: "الكليات", specialty: "التخصصات" };
    await ctx.editMessageText(
      ADMIN_TEXTS.leaderboard_update.refresh_done(scopeLabels[scope as keyof typeof scopeLabels]),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== معالجة الأخطاء (مهم: لا تُرجع 500، فقط سجّل) ======
  bot.catch(async (err) => {
    const e = err.error as any;
    const ctx = err.ctx;
    console.error("Admin bot error:", e?.message || e);

    const ignorableMessages = [
      "query is too old",
      "message is not modified",
      "chat not found",
      "message to edit not found",
      "message to delete not found",
      "QUERY_ID_INVALID",
      "MESSAGE_ID_INVALID",
    ];
    const errMsg = (e?.message || "").toLowerCase();
    const isIgnorable = ignorableMessages.some((m) => errMsg.includes(m.toLowerCase()));
    if (isIgnorable) {
      return;
    }

    try {
      if (ctx?.chat?.id) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى بكتابة /start"
        );
      }
    } catch {
      // تجاهل
    }
  });

  return bot;
}

// ============================================
// Cloudflare Worker Entry Point
// ============================================
export interface Env {
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  ENVIRONMENT: string;
  WORKERS_SUBDOMAIN: string;
}

let botInstance: Bot | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (!botInstance) {
        botInstance = createAdminBot(env.BOT_TOKEN);
      }
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            bot: env.BOT_USERNAME,
            environment: env.ENVIRONMENT,
            version: "2.2",
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname === "/webhook") {
        // معالجة الـ webhook بشكل آمن - إرجاع 200 دائماً لمنع إعادة المحاولة
        try {
          const callback = webhookCallback(botInstance, "cloudflare-mod");
          return await callback(request);
        } catch (err) {
          console.error("Webhook handler error (returning 200 to stop retries):", err?.message || err);
          return new Response("", { status: 200 });
        }
      }

      return new Response(
        "🛡 UST Admin Bot v2.0 - Mockup\n\nWebhook: /webhook\nHealth: /health\nBot: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
