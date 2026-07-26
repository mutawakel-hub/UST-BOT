// ============================================
// بوت الإدارة - جامعة العلوم والتكنولوجيا
// Mockup على Cloudflare Workers + grammY
// 15 شاشة كاملة + 4 أدوار هرمية + صلاحيات
// ============================================

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { TEXTS, ADMIN_TEXTS } from "../shared/texts";
import {
  adminDashboardKeyboard,
  pendingListKeyboard,
  reviewContributionKeyboard,
  rejectReasonKeyboard,
  filesMgmtKeyboard,
  subjectsMgmtKeyboard,
  broadcastKeyboard,
  manageAdminsKeyboard,
  statisticsKeyboard,
  customizeKeyboard,
  leaderboardUpdateKeyboard,
} from "../shared/keyboards";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../shared/data/colleges";
import { SUBJECTS, getSubjectById, getSubjectsBySpecialtyLevelSemester } from "../shared/data/subjects";

// ============================================
// قائمة المسؤولين الافتراضيين (محاكاة)
// ============================================
interface MockAdmin {
  telegram_id: number;
  name: string;
  role: "central" | "college" | "specialty" | "level";
  college_id?: number;
  specialty_id?: number;
  level?: number;
}

const MOCK_ADMINS: MockAdmin[] = [
  { telegram_id: 123456789, name: "أحمد المركزي", role: "central" },
  { telegram_id: 987654321, name: "سارة - كلية الحاسبات", role: "college", college_id: 5 },
  { telegram_id: 555444333, name: "محمد - IT", role: "specialty", college_id: 5, specialty_id: 16 },
  { telegram_id: 111222333, name: "فاطمة - IT المستوى 1", role: "level", college_id: 5, specialty_id: 16, level: 1 },
];

// ============================================
// المساهمات المعلقة (محاكاة)
// ============================================
interface MockContribution {
  id: number;
  file_name: string;
  subject_id: number;
  user_name: string;
  user_telegram_id: number;
  uploaded_at: string;
}

const MOCK_PENDING_CONTRIBUTIONS: MockContribution[] = [
  { id: 1001, file_name: "ملخص Python شامل.pdf", subject_id: 102, user_name: "طالب مجتهد", user_telegram_id: 1111111, uploaded_at: "قبل ساعة" },
  { id: 1002, file_name: "نموذج اختبار قواعد بيانات.pdf", subject_id: 108, user_name: "طالب آخر", user_telegram_id: 2222222, uploaded_at: "قبل 3 ساعات" },
  { id: 1003, file_name: "حلول تمارين الخوارزميات.pdf", subject_id: 208, user_name: "طالب ثالث", user_telegram_id: 3333333, uploaded_at: "قبل يوم" },
];

// ============================================
// حالة المسؤول الحالية
// ============================================
interface AdminSession {
  admin: MockAdmin;
  awaiting_upload_step?: "college" | "major" | "level" | "semester" | "subject" | "type" | "file";
  awaiting_broadcast_scope?: "all" | "college" | "major" | "level";
  awaiting_broadcast_text?: boolean;
  awaiting_subject_add?: boolean;
  awaiting_text_edit?: string;
  upload_context?: {
    college_id?: number;
    specialty_id?: number;
    level?: number;
    semester?: number;
    subject_id?: number;
    category?: string;
  };
}

const adminSessions = new Map<number, AdminSession>();

function getAdmin(telegramId: number): MockAdmin | undefined {
  return MOCK_ADMINS.find((a) => a.telegram_id === telegramId);
}

function getRoleLabel(role: string): string {
  const labels = {
    central: "🛡 مسؤول مركزي",
    college: "🏛 مسؤول كلية",
    specialty: "📚 مسؤول تخصص",
    level: "📊 مسؤول مستوى",
  };
  return labels[role as keyof typeof labels] || role;
}

function getPendingList(): MockContribution[] {
  return MOCK_PENDING_CONTRIBUTIONS;
}

function getContributionById(id: number): MockContribution | undefined {
  return MOCK_PENDING_CONTRIBUTIONS.find((c) => c.id === id);
}

// ============================================
// إنشاء البوت
// ============================================
export function createAdminBot(token: string): Bot {
  const bot = new Bot(token);

  // ====== A1: تسجيل الدخول ======
  bot.command("start", async (ctx) => {
    const admin = getAdmin(ctx.from.id);

    if (!admin) {
      // في الـ Mockup، نقبل أي مستخدم كمسؤول تجريبي مركزي
      const demoAdmin: MockAdmin = {
        telegram_id: ctx.from.id,
        name: ctx.from.first_name || "مسؤول تجريبي",
        role: "central",
      };
      MOCK_ADMINS.push(demoAdmin);
      adminSessions.set(ctx.from.id, { admin: demoAdmin });
      await ctx.reply(
        ADMIN_TEXTS.login.success(demoAdmin.name, getRoleLabel(demoAdmin.role)) +
          "\n\n" +
          "ℹ️ *وضع التجربة:* تم منحك صلاحية *مسؤول مركزي* تجريبياً.\n" +
          "في الإنتاج، يجب أن تكون مُسجّلاً مسبقاً من قبل المسؤول المركزي.",
        {
          reply_markup: adminDashboardKeyboard(true, true),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    adminSessions.set(ctx.from.id, { admin });
    await ctx.reply(
      ADMIN_TEXTS.login.success(admin.name, getRoleLabel(admin.role)),
      {
        reply_markup: adminDashboardKeyboard(admin.role === "central", admin.role === "central"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A3: قائمة المساهمات المعلقة ======
  bot.callbackQuery("pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = getPendingList();
    if (pending.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.pending.empty, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.editMessageText(ADMIN_TEXTS.pending.title(pending.length), {
      reply_markup: pendingListKeyboard(pending),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("back_to_pending", async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = getPendingList();
    await ctx.editMessageText(ADMIN_TEXTS.pending.title(pending.length), {
      reply_markup: pendingListKeyboard(pending),
      parse_mode: "Markdown",
    });
  });

  // ====== A4: مراجعة مساهمة ======
  bot.callbackQuery(/review_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    const contrib = getContributionById(contribId);
    await ctx.answerCallbackQuery();
    if (!contrib) {
      await ctx.reply("⚠️ المساهمة غير موجودة.");
      return;
    }
    const subject = getSubjectById(contrib.subject_id);
    await ctx.editMessageText(
      ADMIN_TEXTS.review.title(
        contrib.id,
        contrib.file_name,
        subject?.name || "غير معروف",
        contrib.user_name
      ),
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
    if (!contrib) return;
    const subject = getSubjectById(contrib.subject_id);
    await ctx.editMessageText(
      ADMIN_TEXTS.review.title(
        contrib.id,
        contrib.file_name,
        subject?.name || "غير معروف",
        contrib.user_name
      ),
      {
        reply_markup: reviewContributionKeyboard(contrib.id),
        parse_mode: "Markdown",
      }
    );
  });

  // اعتماد
  bot.callbackQuery(/approve_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "✅ تم الاعتماد" });
    await ctx.editMessageText(
      `✅ *تم اعتماد المساهمة #${contribId}*\n\nتم نقل الملف لقناة التخزين ونشره للطلاب (محاكاة).`,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_pending,
          "back_to_pending"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // اعتماد مميز
  bot.callbackQuery(/approve_star_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "⭐ تم الاعتماد المميز" });
    await ctx.editMessageText(
      `⭐ *تم اعتماد المساهمة #${contribId} كمحتوى مميز*\n\nتم نشر الملف مع علامة التميز ⭐ (محاكاة).`,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_pending,
          "back_to_pending"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // رفض → A4b
  bot.callbackQuery(/reject_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.reject_reason.title, {
      reply_markup: rejectReasonKeyboard(contribId),
      parse_mode: "Markdown",
    });
  });

  // أسباب الرفض
  bot.callbackQuery(/reject_reason_(dup|bad|irrelevant|incomplete|skip)_(\d+)/, async (ctx) => {
    const reasonKey = ctx.match[1];
    const contribId = parseInt(ctx.match[2]);
    const reasons = {
      dup: "♻️ مكرر",
      bad: "👁 غير واضح",
      irrelevant: "🚫 لا يتعلق بالمادة",
      incomplete: "📝 غير مكتمل",
      skip: "بدون سبب محدد",
    };
    await ctx.answerCallbackQuery({ text: "❌ تم الرفض" });
    await ctx.editMessageText(
      ADMIN_TEXTS.reject_reason.done(reasons[reasonKey as keyof typeof reasons]) +
        `\n\nرقم المساهمة: #${contribId}`,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_pending,
          "back_to_pending"
        ),
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

  // A5a: معالج رفع الملفات
  bot.callbackQuery("upload_file", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_upload_step = "college";
      session.upload_context = {};
    }
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.start, {
      reply_markup: uploadCollegeKeyboard(),
      parse_mode: "Markdown",
    });
  });

  function uploadCollegeKeyboard(): InlineKeyboard {
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => kb.text(c.short_name, `upload_col_${c.id}`).row());
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_files_mgmt");
    return kb;
  }

  bot.callbackQuery(/upload_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, college_id: collegeId };
    session.awaiting_upload_step = "major";
    await ctx.answerCallbackQuery();

    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => kb.text(s.short_name, `upload_major_${s.id}`).row());
    kb.text("🔙 الكليات", "upload_file");
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.select_major, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_major_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, specialty_id: specId };
    session.awaiting_upload_step = "level";
    await ctx.answerCallbackQuery();

    const levels = getLevelsForSpecialty(specId);
    const kb = new InlineKeyboard();
    for (let i = 0; i < levels.length; i += 2) {
      kb.text(`مستوى ${levels[i]}`, `upload_level_${levels[i]}`);
      if (i + 1 < levels.length) {
        kb.text(`مستوى ${levels[i + 1]}`, `upload_level_${levels[i + 1]}`);
      }
      kb.row();
    }
    kb.text("🔙 التخصصات", `upload_col_${session.upload_context?.college_id}`);
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.select_level, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_level_(\d+)/, async (ctx) => {
    const level = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, level };
    session.awaiting_upload_step = "semester";
    await ctx.answerCallbackQuery();

    const kb = new InlineKeyboard();
    kb.text("الفصل الأول", "upload_sem_1").row();
    kb.text("الفصل الثاني", "upload_sem_2").row();
    kb.text("🔙 المستويات", `upload_major_${session.upload_context?.specialty_id}`);
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.select_semester, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_sem_(\d+)/, async (ctx) => {
    const semester = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session || !session.upload_context?.specialty_id || !session.upload_context?.level) return;
    session.upload_context.semester = semester;
    session.awaiting_upload_step = "subject";
    await ctx.answerCallbackQuery();

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
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.select_subject, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/upload_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    const session = adminSessions.get(ctx.from.id);
    if (!session) return;
    session.upload_context = { ...session.upload_context, subject_id: subjectId };
    session.awaiting_upload_step = "type";
    await ctx.answerCallbackQuery();

    const subject = getSubjectById(subjectId);
    const kb = new InlineKeyboard();
    kb.text("📘 المقرر (نظري)", "upload_type_book_theory");
    if (subject?.has_practical) kb.text("📗 المقرر (عملي)", "upload_type_book_practical");
    kb.row();
    kb.text("📑 نماذج اختبارات", "upload_type_exam");
    kb.text("📝 ملخصات", "upload_type_summary");
    kb.row();
    kb.text("🔙 المواد", `upload_sem_${session.upload_context?.semester}`);
    await ctx.editMessageText(ADMIN_TEXTS.upload_wizard.select_type, {
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
        "اسم الملف (سيُحدد عند الرفع)",
        subject?.name || "غير معروف",
        typeLabels[type] || type
      ),
      {
        reply_markup: new InlineKeyboard().text("🔙 التصنيفات", `upload_subj_${session.upload_context?.subject_id}`),
        parse_mode: "Markdown",
      }
    );
    await ctx.reply("📎 *أرسل الملف الآن* للتأكيد (في وضع التجربة سيتم محاكاة الرفع):", {
      parse_mode: "Markdown",
    });
  });

  // استقبال ملف الرفع
  bot.on(":document", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (session?.awaiting_upload_step === "file") {
      const doc = ctx.message.document;
      session.awaiting_upload_step = undefined;
      await ctx.reply(ADMIN_TEXTS.upload_wizard.success, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      });
    }
  });

  bot.callbackQuery("back_to_files_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.files_mgmt.title, {
      reply_markup: filesMgmtKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("browse_files", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📂 *استعراض الملفات*\n\nعدد الملفات الإجمالي: " +
        SUBJECTS.length * 4 +
        " (محاكاة)\n\nفي الإنتاج سيظهر استعراض كامل مع فلاتر وبحث.",
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
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

  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) session.awaiting_subject_add = true;
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt, {
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("edit_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "✏️ *تعديل/حذف مادة*\n\nاختر التخصص لعرض مواده (محاكاة - متاح كاملاً في الإنتاج).",
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
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

  bot.callbackQuery(/broadcast_(all|college|major|level)/, async (ctx) => {
    const scope = ctx.match[1] as "all" | "college" | "major" | "level";
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_broadcast_scope = scope;
      session.awaiting_broadcast_text = true;
    }
    await ctx.answerCallbackQuery();
    const scopeLabels = {
      all: "🌍 للجميع",
      college: "🏛 لكلية محددة",
      major: "📚 لتخصص محدد",
      level: "📊 لمستوى محدد",
    };
    await ctx.editMessageText(
      `${ADMIN_TEXTS.broadcast.prompt_text}\n\n📍 النطاق: ${scopeLabels[scope]}`,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  bot.on(":text", async (ctx) => {
    const session = adminSessions.get(ctx.from.id);
    if (session?.awaiting_subject_add) {
      session.awaiting_subject_add = false;
      await ctx.reply(ADMIN_TEXTS.subjects_mgmt.add_done(ctx.message.text), {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      });
      return;
    }
    if (session?.awaiting_broadcast_text) {
      session.awaiting_broadcast_text = false;
      const recipientCounts = { all: 1247, college: 312, major: 89, level: 23 };
      const count = recipientCounts[session.awaiting_broadcast_scope || "all"];
      session.awaiting_broadcast_scope = undefined;
      await ctx.reply(ADMIN_TEXTS.broadcast.sent(count), {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      });
      return;
    }
    // رسالة افتراضية
    await ctx.reply(
      "👋 اكتب /start للوصول للوحة الإدارة، أو استخدم الأزرار للتنقل."
    );
  });

  // ====== A8: إدارة المسؤولين ======
  bot.callbackQuery("manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.manage_admins.title, {
      reply_markup: manageAdminsKeyboard(),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("add_admin", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "➕ *إضافة مسؤول جديد*\n\nأرسل الآن معرّف تيليجرام للمسؤول الجديد (مثال: `123456789`)",
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("list_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.manage_admins.list_header + "\n\n";
    MOCK_ADMINS.forEach((a, i) => {
      const collegeName = a.college_id ? getCollegeById(a.college_id)?.name : "";
      const specName = a.specialty_id ? getSpecialtyById(a.specialty_id)?.name : "";
      msg += `${i + 1}. ${a.name}\n   ${getRoleLabel(a.role)}\n`;
      if (collegeName) msg += `   📍 ${collegeName}`;
      if (specName) msg += ` - ${specName}`;
      if (a.level) msg += ` - مستوى ${a.level}`;
      msg += "\n   🆔 `${a.telegram_id}`\n\n";
    });
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_dashboard,
        "back_to_dashboard"
      ),
      parse_mode: "Markdown",
    });
  });

  // ====== A9: الإحصائيات ======
  bot.callbackQuery("statistics", async (ctx) => {
    await ctx.answerCallbackQuery();
    const stats = {
      total_users: 1247,
      total_files: SUBJECTS.length * 4,
      total_contributions: 89,
      pending_contributions: getPendingList().length,
      total_downloads: 5432,
      total_broadcasts: 23,
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(stats),
      {
        reply_markup: statisticsKeyboard(),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("stats_refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    const stats = {
      total_users: 1247 + Math.floor(Math.random() * 10),
      total_files: SUBJECTS.length * 4,
      total_contributions: 89 + Math.floor(Math.random() * 5),
      pending_contributions: getPendingList().length,
      total_downloads: 5432 + Math.floor(Math.random() * 100),
      total_broadcasts: 23,
    };
    await ctx.editMessageText(
      ADMIN_TEXTS.statistics.title + ADMIN_TEXTS.statistics.content(stats),
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

  bot.callbackQuery(/custom_screen_(.+)/, async (ctx) => {
    const screenKey = ctx.match[1];
    const session = adminSessions.get(ctx.from.id);
    if (session) session.awaiting_text_edit = screenKey;
    await ctx.answerCallbackQuery();

    const currentTexts: Record<string, string> = {
      main_menu: TEXTS.main_menu.welcome,
      choose_college: TEXTS.choose_college.title,
      subject_menu: "(ديناميكي - يعرض اسم المادة)",
    };
    const current = currentTexts[screenKey] || "(نص افتراضي)";

    await ctx.editMessageText(ADMIN_TEXTS.customize.edit_prompt(current), {
      reply_markup: new InlineKeyboard()
        .text("↩️ استعادة الافتراضي", "reset_default")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("reset_default", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(ADMIN_TEXTS.customize.reset, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_dashboard,
        "back_to_dashboard"
      ),
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
    await ctx.answerCallbackQuery({ text: "✅ تم التحديث" });
    const scope = ctx.match[1];
    const scopeLabels = { global: "العالمية", college: "الكليات", specialty: "التخصصات" };
    await ctx.editMessageText(
      ADMIN_TEXTS.leaderboard_update.refresh_done +
        `\n\n📍 النطاق: ${scopeLabels[scope as keyof typeof scopeLabels]}`,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== زر الرجوع للوحة الإدارة ======
  bot.callbackQuery("back_to_dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = adminSessions.get(ctx.from.id);
    if (session) {
      session.awaiting_upload_step = undefined;
      session.awaiting_broadcast_text = false;
      session.awaiting_subject_add = false;
      session.awaiting_text_edit = undefined;
      session.upload_context = undefined;
    }
    const admin = session?.admin;
    if (admin) {
      await ctx.editMessageText(ADMIN_TEXTS.dashboard.title(admin.name), {
        reply_markup: adminDashboardKeyboard(admin.role === "central", admin.role === "central"),
        parse_mode: "Markdown",
      });
    }
  });

  // ====== معالجة الأخطاء ======
  bot.catch((err) => {
    console.error("Admin bot error:", err);
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
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname === "/webhook") {
        const callback = webhookCallback(botInstance, "cloudflare-mod");
        return callback(request);
      }

      return new Response(
        "🛡 UST Admin Bot - Mockup\n\n" +
          "Webhook: /webhook\n" +
          "Health: /health\n\n" +
          "Open this bot in Telegram: @" + env.BOT_USERNAME,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (error) {
      console.error("Worker fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
