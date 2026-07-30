// ============================================
// ⏰ Escalation Handler — التنبيه المتدرّج للإحسانات
// ============================================
// يُستدعى من scheduled handler كل ساعة
// يفحص الإحسانات المعلقة ويُرسل تنبيهات متدرّجة:
//
//   24 ساعة → تذكير لمسؤول المستوى (escalation_level 0→1)
//   48 ساعة → تنبيه لمسؤول الكلية (escalation_level 1→2)
//   72 ساعة → تنبيه للمسؤول المركزي (escalation_level 2→3)
//
// المبدأ: التنبيه لا يحوّل المسؤولية — مسؤول المستوى يبقى قادراً على المراجعة
// ============================================

import { Bot } from "grammy";
import { SupabaseClient } from "../../shared/db";
import { getContentTypeLabel } from "../../shared/data/admins";

// أوقات التنبيه بالساعات
const ESCALATION_HOURS = [24, 48, 72];

// ============================================
// الدالة الرئيسية — تُستدعى من scheduled handler
// ============================================
export async function runEscalationCheck(bot: Bot, supabase: SupabaseClient): Promise<void> {
  console.log("⏰ [Escalation] Starting hourly escalation check...");

  let totalEscalated = 0;

  for (let i = 0; i < ESCALATION_HOURS.length; i++) {
    const hours = ESCALATION_HOURS[i];
    const targetLevel = i + 1; // 1, 2, 3

    try {
      const count = await escalateAtLevel(bot, supabase, hours, targetLevel);
      totalEscalated += count;
      if (count > 0) {
        console.log(`⏰ [Escalation] Level ${targetLevel} (${hours}h): ${count} notifications sent`);
      }
    } catch (e) {
      console.error(`❌ [Escalation] Error at level ${targetLevel}:`, e);
    }
  }

  console.log(`⏰ [Escalation] Check complete. ${totalEscalated} notifications sent.`);
}

// ============================================
// تنبيه مستوى معيّن
// ============================================
async function escalateAtLevel(
  bot: Bot,
  supabase: SupabaseClient,
  hours: number,
  targetLevel: number
): Promise<number> {
  // ابحث عن الإحسانات المتأخرة في هذا المستوى
  // الحالة: pending + escalation_level < targetLevel + created_at > hours ago
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let overdueContribs: any[] = [];
  try {
    const result = await supabase.select("contributions", {
      columns: "id,user_telegram_id,subject_id,content_type_id,file_name,title,description,created_at,escalation_level",
      filter: `status=eq.pending&escalation_level=lt.${targetLevel}&created_at=lt.${cutoffTime}`,
      limit: 50,
    });
    overdueContribs = Array.isArray(result) ? result : [];
  } catch (e) {
    console.error(`❌ [Escalation] Failed to query overdue contributions at level ${targetLevel}:`, e);
    return 0;
  }

  if (overdueContribs.length === 0) return 0;

  console.log(`⏰ [Escalation] Found ${overdueContribs.length} contributions overdue at level ${targetLevel} (${hours}h)`);

  let notificationsSent = 0;

  for (const contrib of overdueContribs) {
    try {
      // ابحث عن المسؤولين المناسبين لهذا المستوى
      const adminIds = await getAdminsForEscalation(supabase, contrib.subject_id, targetLevel);

      if (adminIds.length === 0) {
        console.warn(`⚠️ [Escalation] No admin found for contribution ${contrib.id} at level ${targetLevel}`);
        continue;
      }

      // أرسل التنبيه لكل مسؤول
      for (const adminId of adminIds) {
        try {
          await sendEscalationMessage(bot, adminId, contrib, hours, targetLevel);
          notificationsSent++;
        } catch (e) {
          // تجاهل أخطاء الإرسال (قد يكون المستخدم حظر البوت)
          console.warn(`⚠️ [Escalation] Failed to notify ${adminId}:`, (e as Error).message?.substring(0, 100));
        }
      }

      // حدّث escalation_level للإحسان
      await supabase.update("contributions", {
        escalation_level: targetLevel,
        escalated_at: new Date().toISOString(),
      }, `id=eq.${contrib.id}`);

    } catch (e) {
      console.error(`❌ [Escalation] Error processing contribution ${contrib.id}:`, e);
    }
  }

  return notificationsSent;
}

// ============================================
// ابحث عن المسؤولين المناسبين لمستوى التنبيه
// ============================================
async function getAdminsForEscalation(
  supabase: SupabaseClient,
  subjectId: number,
  targetLevel: number
): Promise<number[]> {
  const adminIds: number[] = [];

  try {
    // اقرأ بيانات المادة للحصول على specialty_id
    const subjectResult = await supabase.select("subjects", {
      columns: "specialty_id,level",
      filter: `id=eq.${subjectId}`,
      single: true,
    });
    const subject = Array.isArray(subjectResult) ? subjectResult[0] : subjectResult;
    if (!subject) return [];

    // اقرأ بيانات التخصص للحصول على college_id
    const specResult = await supabase.select("specialties", {
      columns: "college_id",
      filter: `id=eq.${subject.specialty_id}`,
      single: true,
    });
    const spec = Array.isArray(specResult) ? specResult[0] : specResult;
    if (!spec) return [];

    // Level 1 (24h): مسؤول المستوى
    if (targetLevel >= 1) {
      const levelRepPosId = `level_rep_${subject.specialty_id}_${subject.level}`;
      try {
        const holder = await supabase.select("position_holders", {
          columns: "user_telegram_id",
          filter: `position_id=eq.${levelRepPosId}&is_active=eq.true`,
          limit: 1,
        });
        if (Array.isArray(holder) && holder.length > 0) {
          adminIds.push(holder[0].user_telegram_id);
        }
      } catch {
        // منصب المستوى قد لا يكون موجوداً بعد
      }
    }

    // Level 2 (48h): مسؤول الكلية
    if (targetLevel >= 2) {
      const collegeAdminPosId = `college_admin_${spec.college_id}`;
      try {
        const holder = await supabase.select("position_holders", {
          columns: "user_telegram_id",
          filter: `position_id=eq.${collegeAdminPosId}&is_active=eq.true`,
          limit: 1,
        });
        if (Array.isArray(holder) && holder.length > 0) {
          // لا تكرر لو نفس الشخص
          if (!adminIds.includes(holder[0].user_telegram_id)) {
            adminIds.push(holder[0].user_telegram_id);
          }
        }
      } catch {}
    }

    // Level 3 (72h): المسؤول المركزي
    if (targetLevel >= 3) {
      try {
        const holder = await supabase.select("position_holders", {
          columns: "user_telegram_id",
          filter: `position_id=eq.central_chair&is_active=eq.true`,
          limit: 1,
        });
        if (Array.isArray(holder) && holder.length > 0) {
          if (!adminIds.includes(holder[0].user_telegram_id)) {
            adminIds.push(holder[0].user_telegram_id);
          }
        }
      } catch {}
    }
  } catch (e) {
    console.error("Failed to find admins for escalation:", e);
  }

  return adminIds;
}

// ============================================
// أرسل رسالة التنبيه
// ============================================
async function sendEscalationMessage(
  bot: Bot,
  adminId: number,
  contrib: any,
  hours: number,
  level: number
): Promise<void> {
  const typeLabel = getContentTypeLabel(contrib.content_type_id) || contrib.content_type_id;
  const title = contrib.title || contrib.file_name || "بدون عنوان";
  const ageHours = Math.round((Date.now() - new Date(contrib.created_at).getTime()) / (60 * 60 * 1000));

  let icon: string;
  let header: string;

  if (level === 1) {
    icon = "⏰";
    header = "تذكير: إحسان بانتظار مراجعتك";
  } else if (level === 2) {
    icon = "⚠️";
    header = "تنبيه: إحسان متأخر في كليتك";
  } else {
    icon = "🚨";
    header = "تنبيه عاجل: تأخير كبير في المراجعة";
  }

  const msg =
    `${icon} *${header}*\n\n` +
    `يوجد محتوى بانتظار المراجعة منذ ${ageHours} ساعة.\n\n` +
    `📝 *العنوان:* ${title}\n` +
    `📂 *النوع:* ${typeLabel}\n` +
    `🔢 *رقم الإحسان:* #${contrib.id}\n\n`;

  let footer: string;
  if (level === 1) {
    footer = "يرجى المراجعة في أقرب وقت.";
  } else if (level === 2) {
    footer = "يرجى متابعة المندوب لضمان سرعة المراجعة.";
  } else {
    footer = "يرجى التدخل لضمان استمرار عملية المراجعة.";
  }

  await bot.api.sendMessage(adminId, msg + footer, { parse_mode: "Markdown" });
}

// ============================================
// شاشة أداء المسؤولين (للمسؤول المركزي)
// ============================================
export async function getAdminPerformanceReport(supabase: SupabaseClient): Promise<string> {
  let msg = "📊 *أداء المسؤولين*\n\n";

  try {
    // إحصائيات عامة
    const allContribs = await supabase.select("contributions", {
      columns: "id,status,escalation_level,created_at,reviewed_at",
      limit: 500,
    });

    if (!Array.isArray(allContribs) || allContribs.length === 0) {
      return msg + "📭 لا توجد بيانات كافية.";
    }

    const pending = allContribs.filter((c: any) => c.status === "pending");
    const reviewed = allContribs.filter((c: any) => c.status === "approved" || c.status === "rejected");
    const overdue24 = pending.filter((c: any) => {
      const age = (Date.now() - new Date(c.created_at).getTime()) / (60 * 60 * 1000);
      return age > 24;
    });
    const overdue48 = pending.filter((c: any) => {
      const age = (Date.now() - new Date(c.created_at).getTime()) / (60 * 60 * 1000);
      return age > 48;
    });

    // متوسط زمن المراجعة
    let totalReviewTime = 0;
    let reviewCount = 0;
    for (const r of reviewed) {
      if (r.reviewed_at && r.created_at) {
        const diff = (new Date(r.reviewed_at).getTime() - new Date(r.created_at).getTime()) / (60 * 60 * 1000);
        totalReviewTime += diff;
        reviewCount++;
      }
    }
    const avgReviewTime = reviewCount > 0 ? (totalReviewTime / reviewCount).toFixed(1) : "—";

    msg += `📋 *إحصائيات عامة:*\n`;
    msg += `   • إجمالي الإحسانات: ${allContribs.length}\n`;
    msg += `   • قيد المراجعة: ${pending.length}\n`;
    msg += `   • تمت المراجعة: ${reviewed.length}\n`;
    msg += `   • متوسط زمن المراجعة: ${avgReviewTime} ساعة\n\n`;

    msg += `⏰ *الحالات المتأخرة:*\n`;
    msg += `   • متأخر 24+ ساعة: ${overdue24.length}\n`;
    msg += `   • متأخر 48+ ساعة: ${overdue48.length}\n`;

    // معدل الاعتماد
    const approved = allContribs.filter((c: any) => c.status === "approved");
    const approvalRate = reviewed.length > 0
      ? Math.round((approved.length / reviewed.length) * 100)
      : 0;
    msg += `\n✅ *معدل الاعتماد:* ${approvalRate}%\n`;
  } catch (e) {
    console.error("Failed to generate performance report:", e);
    msg += "❌ تعذّر تحميل البيانات.";
  }

  return msg;
}

// ============================================
// تسجيل handlers الأداء
// ============================================
import { InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { getUserPermissions } from "../../shared/rbac";

export function registerEscalationHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== شاشة أداء المسؤولين ======
  bot.callbackQuery("admin_performance", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.is_central) {
      await ctx.editMessageText("❌ *هذه الميزة متاحة فقط للمسؤول المركزي.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    const report = await getAdminPerformanceReport(supabase);
    await ctx.editMessageText(report, {
      reply_markup: new InlineKeyboard()
        .text("🔄 تحديث", "admin_performance")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });
}
