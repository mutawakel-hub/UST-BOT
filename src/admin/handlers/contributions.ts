// ============================================
// 📥 Contributions Handlers — pending, review, approve, reject
// ============================================
// في هذه المرحلة (Phase 2)، أضفنا:
//   - نقاط متغيرة حسب نوع المحتوى (POINTS_RANGES)
//   - أزرار لاختيار النقاط (min / mid / max / starred)
//   - تخزين النقاط المختارة في contributions.points_awarded
//   - منح النقاط الفعلية للطالب عبر award_contribution_points RPC
// ============================================

import { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getSubjectById } from "../../shared/data/subjects";
import { uploadFileToStorageChannel } from "../../shared/storage";
import { getOrCreateSession } from "../state";

// ============================================
// نقاط لكل نوع محتوى (min / max)
// (هاردكود مؤقتاً — ستأتي من ihsan_settings في Phase 5)
// ============================================
const POINTS_RANGES: Record<string, { min: number; max: number }> = {
  book_theory: { min: 20, max: 50 },
  book_practical: { min: 20, max: 50 },
  summary: { min: 10, max: 30 },
  exam: { min: 15, max: 40 },
  video: { min: 30, max: 100 },
  reference: { min: 15, max: 50 },
  schedule: { min: 10, max: 30 },
};

// النطاق الافتراضي لو النوع غير معروف
const DEFAULT_RANGE: { min: number; max: number } = { min: 10, max: 30 };

// عامل المكافأة للمحتوى المميّز (max + 50%)
const STARRED_BONUS = 0.5;

// ============================================
// Helper: حساب النقاط (min / mid / max / starred) لنوع محتوى
// ============================================
function getPointsForType(contentType: string): {
  min: number;
  mid: number;
  max: number;
  starred: number;
} {
  const range = POINTS_RANGES[contentType] || DEFAULT_RANGE;
  const min = range.min;
  const max = range.max;
  const mid = Math.round((min + max) / 2);
  const starred = Math.round(max + max * STARRED_BONUS);
  return { min, mid, max, starred };
}


export function registerContributionHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A3: المساهمات المعلقة ======
  bot.callbackQuery("pending", async (ctx) => {
    await ctx.answerCallbackQuery();

    let dbContributions: any[] = [];
    try {
      dbContributions = await supabase.select("contributions", {
        columns: "id,file_name,subject_id,content_type_id,description,file_size_mb,created_at",
        filter: "status=eq.pending",
        order: "created_at.desc",
        limit: 20,
      }) as any[];
    } catch (e) {
      console.error("Supabase pending read error:", e);
    }

    const allPending = dbContributions.map((c: any) => ({
      id: c.id,
      file_name: c.file_name,
      subject_id: c.subject_id,
      subject_name: (getSubjectById(c.subject_id)?.name || "غير معروف") || "غير معروف",
      content_type: c.content_type_id,
      description: c.description,
      file_size_mb: parseFloat(c.file_size_mb) || 0,
      user_name: "طالب",
      user_telegram_id: 0,
      uploaded_at: "حديثاً",
      specialty_id: 0,
      college_id: 0,
      level: 0,
    }));

    if (allPending.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.pending.empty, {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    allPending.forEach((c) => {
      kb.text(`#${c.id} • ${c.file_name.substring(0, 25)}`, `review_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      ADMIN_TEXTS.pending.title(allPending.length),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ====== back_to_pending ======
  bot.callbackQuery("back_to_pending", async (ctx) => {
    await ctx.answerCallbackQuery();

    let dbContributions: any[] = [];
    try {
      dbContributions = await supabase.select("contributions", {
        columns: "id,file_name",
        filter: "status=eq.pending",
        order: "created_at.desc",
        limit: 20,
      }) as any[];
    } catch (e) {
      console.error("Supabase pending read error:", e);
    }
    const allPending = dbContributions.map((c: any) => ({ id: c.id, file_name: c.file_name }));

    const kb = new InlineKeyboard();
    allPending.forEach((c) => {
      kb.text(`#${c.id} • ${c.file_name.substring(0, 25)}`, `review_${c.id}`).row();
    });
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");
    await ctx.editMessageText(
      ADMIN_TEXTS.pending.title(allPending.length),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ====== A4: مراجعة مساهمة ======
  bot.callbackQuery(/review_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    let contrib: any = null;
    try {
      const result = await supabase.select("contributions", {
        columns: "id,file_name,subject_id,content_type_id,description,file_size_mb,created_at,user_telegram_id",
        filter: `id=eq.${contribId}`,
        single: true,
      });
      contrib = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Failed to fetch contribution:", e);
    }

    if (!contrib) {
      await ctx.reply("⚠️ الإحسان غير موجود أو تمت معالجته.");
      return;
    }

    const subjectName = getSubjectById(contrib.subject_id)?.name || "غير معروف";
    const contentType: string = contrib.content_type_id || "summary";
    const points = getPointsForType(contentType);

    await ctx.editMessageText(
      ADMIN_TEXTS.review.title({
        id: contrib.id, fileName: contrib.file_name, subjectName,
        userName: "طالب", uploadedAt: contrib.created_at || "حديثاً",
        fileSizeMb: parseFloat(contrib.file_size_mb) || 0, description: contrib.description,
      }) +
      `\n💎 *النقاط المتاحة:* ${points.min}–${points.max} (المميّز: ${points.starred})\n`,
      {
        reply_markup: new InlineKeyboard()
          .text(`✅ اعتماد (${points.min} نقطة)`, `approve_${contribId}_${points.min}`)
          .text(`✅ اعتماد (${points.mid} نقطة)`, `approve_${contribId}_${points.mid}`)
          .row()
          .text(`✅ اعتماد (${points.max} نقطة)`, `approve_${contribId}_${points.max}`)
          .text(`⭐ مميّز (${points.starred} نقطة)`, `approve_star_${contribId}_${points.starred}`)
          .row()
          .text(ADMIN_TEXTS.review.reject, `reject_${contribId}`)
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A4b: اعتماد مساهمة (مع نقاط مختارة) ======
  // الصيغة الموسّعة: approve(_star)?_<contribId>(_<points>)?
  // - match[1]: contribId
  // - match[2]: points (اختياري - لو غير محدد، نستخدم min لنوع المحتوى)
  bot.callbackQuery(/approve(?:_star)?_(\d+)(?:_(\d+))?/, async (ctx) => {
    const isStarred = ctx.match[0].includes("star");
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: isStarred ? "⭐ تم الاعتماد المميز" : "✅ تم الاعتماد" });

    // 1. قراءة بيانات المساهمة
    let contribution: any = null;
    try {
      const result = await supabase.select("contributions", {
        columns: "id,file_name,subject_id,content_type_id,description,file_size_mb,user_telegram_id,telegram_file_id",
        filter: `id=eq.${contribId}`,
        single: true,
      });
      contribution = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Failed to read contribution:", e);
    }

    if (!contribution) {
      await ctx.reply("⚠️ الإحسان غير موجود.");
      return;
    }

    // 2. معرفة الكلية + قناة التخزين
    let storageChannelId: string | null = null;
    let collegeId: number | null = null;
    try {
      const subjectResult = await supabase.select("subjects", {
        columns: "specialty_id",
        filter: `id=eq.${contribution.subject_id}`,
        single: true,
      });
      const subject = Array.isArray(subjectResult) ? subjectResult[0] : subjectResult;
      if (subject?.specialty_id) {
        const specResult = await supabase.select("specialties", {
          columns: "college_id",
          filter: `id=eq.${subject.specialty_id}`,
          single: true,
        });
        const spec = Array.isArray(specResult) ? specResult[0] : specResult;
        if (spec?.college_id) {
          collegeId = spec.college_id;
          const collegeResult = await supabase.select("colleges", {
            columns: "storage_channel_id",
            filter: `id=eq.${spec.college_id}`,
            single: true,
          });
          const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;
          storageChannelId = college?.storage_channel_id || null;
        }
      }
    } catch (e) {
      console.error("Failed to fetch college/storage channel:", e);
    }

    // 3. رفع الملف لقناة التخزين
    let uploadedMessageId: number | null = null;
    let uploadedFileId: string | null = null;
    if (storageChannelId && contribution.telegram_file_id) {
      try {
        const uploaded = await uploadFileToStorageChannel(
          bot,
          storageChannelId,
          { fileId: contribution.telegram_file_id, fileName: contribution.file_name },
          {
            caption: `📄 ${contribution.file_name}\n📚 مادة: ${contribution.subject_id}\n👤 رافع: ${contribution.user_telegram_id}`,
            parseMode: "Markdown",
          }
        );
        uploadedMessageId = uploaded.message_id;
        uploadedFileId = uploaded.file_id;
      } catch (e) {
        console.error("Failed to upload file to storage channel:", e);
      }
    }

    // 4. إنشاء سجل content
    if (uploadedMessageId && uploadedFileId && collegeId !== null) {
      try {
        await supabase.insert("content", {
          subject_id: contribution.subject_id,
          specialty_id: 0,
          college_id: collegeId,
          level: 1,
          semester: 1,
          content_type_id: contribution.content_type_id,
          title: contribution.file_name,
          file_name: contribution.file_name,
          file_size_mb: contribution.file_size_mb || 0,
          telegram_message_id: uploadedMessageId,
          telegram_file_id: uploadedFileId,
          added_by_position_id: "central_chair",
          added_by_telegram_id: ctx.from.id,
          is_starred: isStarred,
          is_active: true,
          academic_year: new Date().getFullYear().toString(),
        });
      } catch (e) {
        console.error("Failed to create content record:", e);
      }
    }

    // 5. تحديث حالة المساهمة + منح النقاط
    try {
      // تحديد النقاط: من الـ callback (match[2]) أو الافتراضي لنوع المحتوى
      const contentTypeForPoints: string = contribution.content_type_id || "summary";
      const fallbackPoints = isStarred
        ? getPointsForType(contentTypeForPoints).starred
        : getPointsForType(contentTypeForPoints).min;
      const points = ctx.match[2] ? parseInt(ctx.match[2]) : fallbackPoints;

      await supabase.update("contributions", {
        status: "approved",
        is_starred: isStarred,
        points_awarded: points,
        reviewed_by_telegram_id: ctx.from.id,
        reviewed_at: new Date().toISOString(),
      }, `id=eq.${contribId}`);

      if (contribution.user_telegram_id) {
        await supabase.rpc("award_contribution_points", {
          p_student_telegram_id: contribution.user_telegram_id,
          p_contribution_id: contribId,
          p_awarded_by_telegram_id: ctx.from.id,
          p_awarded_by_position_id: "central_chair",
          p_points: points,
        });
      }

      // عرض رسالة النجاح بالنقاط الفعلية والخروج
      await ctx.editMessageText(
        `${isStarred ? "⭐" : "✅"} *تم اعتماد الإحسان #${contribId}*\n\n` +
        (uploadedMessageId
          ? `📤 تم رفع الملف لقناة التخزين (message_id: ${uploadedMessageId})\n`
          : `⚠️ تعذّر رفع الملف لقناة التخزين — تحقق من إعدادات القناة\n`) +
        `💎 تم منح الطالب ${points} نقطة.`,
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
          parse_mode: "Markdown",
        }
      );
      return;
    } catch (e) {
      console.error("Supabase approve error:", e);
    }

    await ctx.editMessageText(
      `${isStarred ? "⭐" : "✅"} *تم اعتماد الإحسان #${contribId}*\n\n` +
      (uploadedMessageId
        ? `📤 تم رفع الملف لقناة التخزين (message_id: ${uploadedMessageId})\n`
        : `⚠️ تعذّر رفع الملف لقناة التخزين — تحقق من إعدادات القناة\n`) +
      `💎 تم منح الطالب نقاطًا.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== A4c: رفض مساهمة ======
  bot.callbackQuery(/reject_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADMIN_TEXTS.reject_reason.title, {
      reply_markup: new InlineKeyboard()
        .text("♻️ مكرر", `reject_reason_dup_${contribId}`)
        .text("👁 غير واضح", `reject_reason_bad_${contribId}`)
        .row()
        .text("🚫 لا يتعلق بالمادة", `reject_reason_irrelevant_${contribId}`)
        .text("📝 غير مكتمل", `reject_reason_incomplete_${contribId}`)
        .row()
        .text("⏭ تخطي السبب", `reject_reason_skip_${contribId}`)
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
      parse_mode: "Markdown",
    });
  });

  // ====== A4d: سبب الرفض ======
  bot.callbackQuery(/reject_reason_(dup|bad|irrelevant|incomplete|skip)_(\d+)/, async (ctx) => {
    const reasonKey = ctx.match[1];
    const contribId = parseInt(ctx.match[2]);
    const reasons: Record<string, string> = {
      dup: "♻️ مكرر", bad: "👁 غير واضح",
      irrelevant: "🚫 لا يتعلق بالمادة", incomplete: "📝 غير مكتمل", skip: "بدون سبب محدد",
    };
    await ctx.answerCallbackQuery({ text: "❌ تم الرفض" });

    try {
      const contribData = await supabase.select("contributions", {
        columns: "user_telegram_id",
        filter: `id=eq.${contribId}`,
        single: true,
      }) as any;

      await supabase.update("contributions", {
        status: "rejected",
        reject_reason: reasons[reasonKey],
        reviewed_by_telegram_id: ctx.from.id,
        reviewed_at: new Date().toISOString(),
      }, `id=eq.${contribId}`);

      if (contribData?.user_telegram_id) {
        await supabase.rpc("notify_contribution_rejected", {
          p_student_telegram_id: contribData.user_telegram_id,
          p_contribution_id: contribId,
          p_reject_reason: reasons[reasonKey],
        });
      }
    } catch (e) {
      console.error("Supabase reject error:", e);
    }

    await ctx.editMessageText(
      `✅ *تم رفض الإحسان #${contribId}*\n\nالسبب: ${reasons[reasonKey]}\n\n🔔 تم إشعار الطالب بالرفض.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });
}
