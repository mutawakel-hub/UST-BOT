// ============================================
// 📥 Contributions Handlers — pending, review, approve, reject
// ============================================
// في هذه المرحلة (Phase 2)، أضفنا:
//   - نقاط متغيرة حسب نوع المحتوى (POINTS_RANGES)
//   - أزرار لاختيار النقاط (min / mid / max / starred)
//   - تخزين النقاط المختارة في contributions.points_awarded
//   - منح النقاط الفعلية للطالب عبر award_contribution_points RPC
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS, formatContentCard } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getSubjectById } from "../../shared/data/subjects";
import { getContentTypeLabel } from "../../shared/data/admins";
import { getOrCreateSession } from "../state";
import {
  getSpecialtyById,
  getCollegeById,
} from "../../shared/data/colleges";
import { deleteFileFromStorage } from "../../shared/storage";

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
        columns: "id,file_name,title,subject_id,content_type_id,description,file_size_mb,created_at,user_telegram_id,telegram_message_id,telegram_file_id",
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
      user_telegram_id: c.user_telegram_id || 0,
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
        columns: "id,file_name,title,subject_id,content_type_id,description,file_size_mb,created_at,user_telegram_id,telegram_file_id,telegram_message_id,status",
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

    const subject = getSubjectById(contrib.subject_id);
    const subjectName = subject?.name || "غير معروف";
    const contentType: string = contrib.content_type_id || "summary";
    const typeLabel = getContentTypeLabel(contentType);
    const points = getPointsForType(contentType);
    const title = contrib.title || contrib.file_name || "بدون عنوان";

    // جلب بيانات الكلية/التخصص لعرضها في البطاقة
    const spec = subject ? getSpecialtyById(subject.specialty_id) : null;
    const college = spec ? getCollegeById(spec.college_id) : null;

    // جلب اسم المُحسِن من admin_users
    let contributorName = "طالب";
    if (contrib.user_telegram_id) {
      try {
        const userResult = await supabase.select("admin_users", {
          columns: "display_name,first_name",
          filter: `telegram_id=eq.${contrib.user_telegram_id}`,
          single: true,
        });
        const user = Array.isArray(userResult) ? userResult[0] : userResult;
        contributorName = user?.display_name || user?.first_name || "طالب";
      } catch {
        // تجاهل — استخدم "طالب"
      }
    }

    // بناء بطاقة المحتوى (سياق admin_review)
    const statusLabel = contrib.status === "pending" ? "🟡 قيد المراجعة" :
                        contrib.status === "approved" ? "✅ معتمد" :
                        contrib.status === "rejected" ? "❌ مرفوض" : contrib.status;

    const cardMsg = formatContentCard({
      title,
      contentType,
      subjectName,
      collegeName: college?.name,
      specialtyName: spec?.name,
      level: subject?.level,
      semester: subject?.semester,
      fileSizeMb: parseFloat(contrib.file_size_mb) || null,
      contributorName,
      uploadedAt: contrib.created_at,
      description: contrib.description,
      ihsanId: contrib.id,
      statusLabel,
    }, "admin_review");

    // إضافة سطر النقاط المتاحة في النهاية
    const msg = `${cardMsg}\n\n💎 *النقاط المتاحة:* ${points.min}–${points.max} (المميّز: ${points.starred})`;

    const kb = new InlineKeyboard();

    // زر معاينة الملف (يفتح الملف في شات المسؤول)
    if (contrib.telegram_file_id) {
      kb.text("👁 معاينة الملف", `preview_ihsan_${contribId}`).row();
    }

    // أزرار الاعتماد
    kb.text(`✅ اعتماد (${points.min} نقطة)`, `approve_${contribId}_${points.min}`)
      .text(`✅ اعتماد (${points.mid} نقطة)`, `approve_${contribId}_${points.mid}`).row();
    kb.text(`✅ اعتماد (${points.max} نقطة)`, `approve_${contribId}_${points.max}`)
      .text(`⭐ مميّز (${points.starred} نقطة)`, `approve_star_${contribId}_${points.starred}`).row();
    kb.text(ADMIN_TEXTS.review.reject, `reject_${contribId}`).row();
    kb.text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== معاينة ملف الإحسان قبل الاعتماد ======
  bot.callbackQuery(/preview_ihsan_(\d+)/, async (ctx) => {
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "⏳ جارٍ جلب الملف..." });

    let contrib: any = null;
    try {
      const result = await supabase.select("contributions", {
        columns: "id,file_name,title,telegram_file_id",
        filter: `id=eq.${contribId}`,
        single: true,
      });
      contrib = Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error("Failed to fetch contribution for preview:", e);
    }

    if (!contrib || !contrib.telegram_file_id) {
      await ctx.reply("⚠️ تعذّر جلب الملف. قد يكون file_id غير متاح.");
      return;
    }

    try {
      // إرسال الملف للمسؤول لمعاينته
      await bot.api.sendDocument(ctx.chat.id, contrib.telegram_file_id, {
        caption: `👁 *معاينة الإحسان #${contribId}*\n📝 ${contrib.title || contrib.file_name}`,
        parse_mode: "Markdown",
      });
    } catch (e: any) {
      console.error("Failed to send preview:", e);
      await ctx.reply(
        `⚠️ تعذّر إرسال الملف للمعاينة.\n` +
        `السبب: ${e?.message?.substring(0, 100) || "غير معروف"}\n` +
        `قد يكون file_id غير صالح لهذا البوت.`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // ====== A4b: اعتماد مساهمة (مع نقاط مختارة) ======
  // الصيغة الموسّعة: approve(_star)?_<contribId>(_<points>)?
  // - match[1]: contribId
  // - match[2]: points (اختياري - لو غير محدد، نستخدم min لنوع المحتوى)
  bot.callbackQuery(/approve(?:_star)?_(\d+)(?:_(\d+))?/, async (ctx) => {
    const isStarred = ctx.match[0].includes("star");
    const contribId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: isStarred ? "⭐ تم الاعتماد المميز" : "✅ تم الاعتماد" });

    // 1. قراءة بيانات المساهمة (بما في ذلك title و telegram_message_id)
    let contribution: any = null;
    try {
      const result = await supabase.select("contributions", {
        columns: "id,file_name,title,subject_id,content_type_id,description,file_size_mb,user_telegram_id,telegram_file_id,telegram_message_id",
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

    // 3. الملف رُفع بالفعل لقناة التخزين من بوت الطالب
    const uploadedFileId = contribution.telegram_file_id || contribution.file_name || "no_file_id";
    let contentInsertError: string | null = null;

    // 4. إنشاء سجل content — دائماً (حتى لو لم يكن file_id مثالياً)
    //    ننسخ telegram_message_id من contributions لتفعيل forwardMessage لاحقاً
    const contentTitle = contribution.title || contribution.file_name || "إحسان علمي";
    try {
      await supabase.insert("content", {
        subject_id: contribution.subject_id,
        content_type_id: contribution.content_type_id,
        title: contentTitle,
        file_name: contribution.file_name || contentTitle,
        file_size_mb: contribution.file_size_mb || 0,
        telegram_message_id: contribution.telegram_message_id || null,
        telegram_file_id: uploadedFileId,
        added_by_position_id: "central_chair",
        added_by_telegram_id: ctx.from.id,
        is_starred: isStarred,
        is_active: true,
        academic_year: new Date().getFullYear().toString(),
      });
      console.log(`✅ [Ihsan] Content record created for contribution ${contribId} (message_id=${contribution.telegram_message_id || "null"})`);
    } catch (e: any) {
      const errMsg = String(e?.message || e);
      console.error(`❌ [Ihsan] Content insert FAILED for ${contribId}:`, errMsg.substring(0, 300));
      contentInsertError = errMsg.substring(0, 150);
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
        (contentInsertError
          ? `⚠️ *خطأ في إنشاء سجل المحتوى:*\n${contentInsertError}\n\n`
          : `📤 تم نشر المحتوى للطلاب\n`) +
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
      (contentInsertError
        ? `⚠️ *خطأ في إنشاء سجل المحتوى:*\n${contentInsertError}\n\n`
        : `📤 تم نشر المحتوى للطلاب\n`) +
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
      // جلب بيانات المساهمة: user_telegram_id + telegram_message_id + subject_id
      const contribData = await supabase.select("contributions", {
        columns: "user_telegram_id,telegram_message_id,subject_id",
        filter: `id=eq.${contribId}`,
        single: true,
      }) as any;

      await supabase.update("contributions", {
        status: "rejected",
        reject_reason: reasons[reasonKey],
        reviewed_by_telegram_id: ctx.from.id,
        reviewed_at: new Date().toISOString(),
      }, `id=eq.${contribId}`);

      // حذف الملف من قناة التخزين (تنظيف — الملفات المرفوضة يجب ألا تبقى يتيمة)
      if (contribData?.telegram_message_id && contribData?.subject_id) {
        try {
          // جلب storage_channel_id من subject → specialty → college
          const subjectResult = await supabase.select("subjects", {
            columns: "specialty_id",
            filter: `id=eq.${contribData.subject_id}`,
            single: true,
          }) as any;
          const subject = Array.isArray(subjectResult) ? subjectResult[0] : subjectResult;

          if (subject?.specialty_id) {
            const specResult = await supabase.select("specialties", {
              columns: "college_id",
              filter: `id=eq.${subject.specialty_id}`,
              single: true,
            }) as any;
            const spec = Array.isArray(specResult) ? specResult[0] : specResult;

            if (spec?.college_id) {
              const collegeResult = await supabase.select("colleges", {
                columns: "storage_channel_id",
                filter: `id=eq.${spec.college_id}`,
                single: true,
              }) as any;
              const college = Array.isArray(collegeResult) ? collegeResult[0] : collegeResult;

              if (college?.storage_channel_id) {
                await deleteFileFromStorage(
                  bot,
                  college.storage_channel_id,
                  contribData.telegram_message_id
                );
                console.log(`🗑 [Ihsan] Deleted file from storage channel for rejected contribution #${contribId}`);
              }
            }
          }
        } catch (e) {
          // تجاهل أخطاء الحذف — قد تكون الرسالة محذوفة مسبقاً
          console.warn(`⚠️ [Ihsan] Failed to delete file from storage for #${contribId}:`, e);
        }
      }

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
      `✅ *تم رفض الإحسان #${contribId}*\n\nالسبب: ${reasons[reasonKey]}\n\n🔔 تم إشعار الطالب بالرفض.\n🗑 تم حذف الملف من قناة التخزين.`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_pending, "back_to_pending"),
        parse_mode: "Markdown",
      }
    );
  });
}
