// ============================================
// 🌟 Ihsan Management — إدارة إحسان علمي (هرمي)
// ============================================
// واجهات منفصلة لكل دور:
//   - مندوب المستوى: مراجعة + إحصائيات المستوى
//   - مسؤول الكلية: إحسانات مصعدة + تقرير الكلية + محتوى مميّز
//   - المسؤول المركزي: متابعة + إحصائيات + تكريم + إعدادات + إنهاء دورة
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getAdminUser, getPositionHolder } from "../helpers";
import { getContentTypeLabel, CONTENT_TYPES } from "../../shared/data/admins";
import { getCollegeById, getSpecialtyById, getSpecialtiesByCollege, COLLEGES } from "../../shared/data/colleges";
import { getSubjectById } from "../../shared/data/subjects";

// قناة الأرشيف
const ARCHIVE_CHANNEL_ID = "-1004342924841";

export function registerIhsanManagementHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== القائمة الرئيسية لإدارة الإحسان ======
  bot.callbackQuery("ihsan_management", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    let msg = "🌟 *إدارة الإحسان العلمي*\n\n";
    const kb = new InlineKeyboard();

    if (perms.is_central) {
      // المسؤول المركزي
      let pendingCount = 0;
      try {
        const pending = await supabase.select<{ id: number }>("contributions", {
          columns: "id",
          filter: "status=eq.pending",
          limit: 100,
        });
        pendingCount = Array.isArray(pending) ? pending.length : 0;
      } catch {}

      msg += "اختر القسم:";
      kb.text(`📥 متابعة الإحسانات${pendingCount > 0 ? ` (${pendingCount})` : ""}`, "ihsan_central_overview");
      kb.row();
      kb.text("⭐ المحتوى المميّز", "ihsan_starred");
      kb.row();
      kb.text("📊 إحصائيات تفصيلية", "ihsan_central_stats");
      kb.row();
      kb.text("🏆 روّاد الإحسان", "leaderboard_update");
      kb.row();
      kb.text("🏆 إدارة التكريم", "manage_honors");
      kb.row();
      kb.text("📊 أداء المسؤولين", "admin_performance");
      kb.row();
      kb.text("⚙️ إعدادات الإحسان", "ihsan_settings");
      kb.row();
      kb.text("🔄 إنهاء الدورة", "end_ihsan_cycle");
      kb.row();
    } else if (perms.permissions.has("manage_level_reps") || perms.permissions.has("approve_level_contributions")) {
      // مندوب المستوى أو مسؤول الكلية
      let pendingCount = 0;
      try {
        const pending = await supabase.select<{ id: number }>("contributions", {
          columns: "id",
          filter: "status=eq.pending",
          limit: 100,
        });
        pendingCount = Array.isArray(pending) ? pending.length : 0;
      } catch {}

      msg += `📥 إحسانات بانتظار المراجعة: ${pendingCount}\n\n`;
      msg += "اختر القسم:";
      kb.text(`📥 مراجعة الإحسانات${pendingCount > 0 ? ` (${pendingCount})` : ""}`, "pending");
      kb.row();

      if (perms.permissions.has("manage_level_reps")) {
        // مسؤول كلية
        kb.text("📊 تقرير الكلية", "ihsan_college_report");
        kb.row();
        kb.text("⭐ المحتوى المميّز", "ihsan_starred");
        kb.row();
      } else {
        // مندوب مستوى
        kb.text("📊 إحصائيات المستوى", "ihsan_level_stats");
        kb.row();
      }
    }

    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== إحصائيات المستوى (للمندوب) ======
  bot.callbackQuery("ihsan_level_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    let msg = "📊 *إحصائيات المستوى*\n\n";
    try {
      const allContribs = await supabase.select("contributions", {
        columns: "id,status,created_at,reviewed_at,content_type_id",
        limit: 500,
      });

      if (!Array.isArray(allContribs) || allContribs.length === 0) {
        msg += "📭 لا توجد بيانات كافية.";
      } else {
        const pending = allContribs.filter((c: any) => c.status === "pending");
        const approved = allContribs.filter((c: any) => c.status === "approved");
        const rejected = allContribs.filter((c: any) => c.status === "rejected");

        // عدّ حسب النوع
        const byType: Record<string, number> = {};
        for (const c of allContribs) {
          const t = c.content_type_id || "unknown";
          byType[t] = (byType[t] || 0) + 1;
        }

        msg += `📋 *الإجمالي:* ${allContribs.length}\n`;
        msg += `🟡 قيد المراجعة: ${pending.length}\n`;
        msg += `✅ معتمد: ${approved.length}\n`;
        msg += `❌ مرفوض: ${rejected.length}\n\n`;

        msg += "📊 *حسب النوع:*\n";
        for (const type of CONTENT_TYPES) {
          const count = byType[type.id] || 0;
          if (count > 0) {
            msg += `   ${type.emoji} ${type.name}: ${count}\n`;
          }
        }
      }
    } catch (e) {
      msg += "❌ تعذّر تحميل البيانات.";
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "ihsan_management"),
      parse_mode: "Markdown",
    });
  });

  // ====== تقرير الكلية (لمسؤول الكلية) ======
  bot.callbackQuery("ihsan_college_report", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    const collegeIds = Array.from(perms.effective_scope.colleges);

    let msg = "📊 *تقرير الكلية*\n\n";
    try {
      const allContribs = await supabase.select("contributions", {
        columns: "id,status,created_at,reviewed_at",
        limit: 500,
      });

      if (!Array.isArray(allContribs) || allContribs.length === 0) {
        msg += "📭 لا توجد بيانات كافية.";
      } else {
        const pending = allContribs.filter((c: any) => c.status === "pending");
        const approved = allContribs.filter((c: any) => c.status === "approved");
        const overdue = pending.filter((c: any) => {
          const age = (Date.now() - new Date(c.created_at).getTime()) / (60 * 60 * 1000);
          return age > 48;
        });

        msg += `📋 *إجمالي الإحسانات:* ${allContribs.length}\n`;
        msg += `🟡 قيد المراجعة: ${pending.length}\n`;
        msg += `✅ معتمد: ${approved.length}\n`;
        msg += `⏰ متأخر 48+ ساعة: ${overdue.length}\n\n`;

        // أكثر نوع محتوى
        msg += "💡 *ملاحظة:* تفاصيل أكثر متاحة في شاشة الأداء العام.";
      }
    } catch (e) {
      msg += "❌ تعذّر تحميل البيانات.";
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "ihsan_management"),
      parse_mode: "Markdown",
    });
  });

  // ====== نظرة عامة للمركزي ======
  bot.callbackQuery("ihsan_central_overview", async (ctx) => {
    await ctx.answerCallbackQuery();

    let msg = "📥 *متابعة الإحسانات*\n\n";
    try {
      const allContribs = await supabase.select("contributions", {
        columns: "id,status,created_at",
        limit: 500,
      });

      if (!Array.isArray(allContribs) || allContribs.length === 0) {
        msg += "📭 لا توجد إحسانات بعد.";
      } else {
        const pending = allContribs.filter((c: any) => c.status === "pending");
        const approved = allContribs.filter((c: any) => c.status === "approved");
        const rejected = allContribs.filter((c: any) => c.status === "rejected");

        const overdue24 = pending.filter((c: any) => {
          const age = (Date.now() - new Date(c.created_at).getTime()) / (60 * 60 * 1000);
          return age > 24;
        });

        msg += `📊 *الحالات:*\n`;
        msg += `   🟡 قيد المراجعة: ${pending.length}\n`;
        msg += `   ✅ معتمد: ${approved.length}\n`;
        msg += `   ❌ مرفوض: ${rejected.length}\n\n`;
        msg += `⏰ *متأخر 24+ ساعة:* ${overdue24.length}\n`;
      }
    } catch (e) {
      msg += "❌ تعذّر تحميل البيانات.";
    }

    const kb = new InlineKeyboard();
    kb.text("📥 مراجعة الإحسانات", "pending");
    kb.row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "ihsan_management");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== إحصائيات المركزي التفصيلية ======
  bot.callbackQuery("ihsan_central_stats", async (ctx) => {
    await ctx.answerCallbackQuery();

    let msg = "📊 *الإحصائيات التفصيلية*\n\n";
    try {
      const allContribs = await supabase.select("contributions", {
        columns: "id,status,content_type_id,created_at",
        limit: 1000,
      });

      if (!Array.isArray(allContribs) || allContribs.length === 0) {
        msg += "📭 لا توجد بيانات كافية.";
      } else {
        // إحصائيات حسب النوع
        const byType: Record<string, { total: number; approved: number; pending: number }> = {};
        for (const c of allContribs) {
          const t = c.content_type_id || "unknown";
          if (!byType[t]) byType[t] = { total: 0, approved: 0, pending: 0 };
          byType[t].total++;
          if (c.status === "approved") byType[t].approved++;
          if (c.status === "pending") byType[t].pending++;
        }

        msg += "📊 *حسب نوع المحتوى:*\n\n";
        for (const type of CONTENT_TYPES) {
          const stats = byType[type.id];
          if (stats) {
            msg += `${type.emoji} ${type.name}: ${stats.total} (${stats.approved}✅ ${stats.pending}🟡)\n`;
          }
        }

        // أكثر كلية نشاطاً (تقريبي)
        msg += `\n📈 *إجمالي الإحسانات:* ${allContribs.length}\n`;
        const approvedCount = allContribs.filter((c: any) => c.status === "approved").length;
        msg += `✅ *معتمد:* ${approvedCount}\n`;
        msg += `📊 *معدل الاعتماد:* ${allContribs.length > 0 ? Math.round((approvedCount / allContribs.length) * 100) : 0}%\n`;
      }
    } catch (e) {
      msg += "❌ تعذّر تحميل البيانات.";
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "ihsan_management"),
      parse_mode: "Markdown",
    });
  });

  // ====== المحتوى المميّز ======
  bot.callbackQuery("ihsan_starred", async (ctx) => {
    await ctx.answerCallbackQuery();

    let msg = "⭐ *المحتوى المميّز*\n\n";
    try {
      const result = await supabase.select("contributions", {
        columns: "id,title,file_name,subject_id,content_type_id,points_awarded,created_at",
        filter: "status=eq.approved&is_starred=eq.true",
        order: "created_at.desc",
        limit: 20,
      });

      if (!Array.isArray(result) || result.length === 0) {
        msg += "📭 لا يوجد محتوى مميّز بعد.";
      } else {
        for (const c of result) {
          const typeLabel = getContentTypeLabel(c.content_type_id) || c.content_type_id;
          const title = c.title || c.file_name || "بدون عنوان";
          const subject = getSubjectById(c.subject_id);
          msg += `⭐ *${title}*\n`;
          msg += `   ${typeLabel} | ${subject?.name || "غير معروف"} | ${c.points_awarded || 0} نقطة\n\n`;
        }
      }
    } catch (e) {
      msg += "❌ تعذّر تحميل البيانات.";
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "ihsan_management"),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // ⚙️ إعدادات النظام (للمركزي فقط)
  // ============================================
  bot.callbackQuery("ihsan_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.is_central) {
      await ctx.editMessageText("❌ *هذه الميزة متاحة فقط للمسؤول المركزي.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // اقرأ الإعدادات من DB (أو استخدم الافتراضية)
    let settings: any = null;
    try {
      const result = await supabase.select("ihsan_settings", {
        filter: "id=eq.1",
        single: true,
      });
      settings = Array.isArray(result) ? result[0] : result;
    } catch {}

    const s = settings || {};
    let msg = "⚙️ *إعدادات نظام الإحسان*\n\n";
    msg += "⭐ *نقاط الأنواع (min - max):*\n";
    msg += `   📘 نظري: ${s.book_theory_min || 20} - ${s.book_theory_max || 50}\n`;
    msg += `   📗 عملي: ${s.book_practical_min || 20} - ${s.book_practical_max || 50}\n`;
    msg += `   📄 ملخصات: ${s.summary_min || 10} - ${s.summary_max || 30}\n`;
    msg += `   📝 اختبارات: ${s.exam_min || 15} - ${s.exam_max || 40}\n`;
    msg += `   🎥 مرئيات: ${s.video_min || 30} - ${s.video_max || 100}\n`;
    msg += `   📖 مراجع: ${s.reference_min || 15} - ${s.reference_max || 50}\n`;
    msg += `   📅 جداول: ${s.schedule_min || 10} - ${s.schedule_max || 30}\n\n`;
    msg += "⏱️ *مدة التنبيه:*\n";
    msg += `   • تذكير: ${s.escalation_hours_1 || 24} ساعة\n`;
    msg += `   • تنبيه الكلية: ${s.escalation_hours_2 || 48} ساعة\n`;
    msg += `   • تنبيه المركزي: ${s.escalation_hours_3 || 72} ساعة\n\n`;
    msg += "🏆 *عدد المتصدرين:* " + (s.leaderboard_top_n || 3) + "\n";
    msg += "📅 *الدورة الحالية:* " + (s.current_cycle_name || "الفصل الأول 2026") + "\n";

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 🔄 إنهاء الدورة (أرشفة + تصفير)
  // ============================================
  bot.callbackQuery("end_ihsan_cycle", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.is_central) {
      await ctx.editMessageText("❌ *هذه الميزة متاحة فقط للمسؤول المركزي.*", {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      });
      return;
    }

    // اقرأ اسم الدورة الحالية
    let cycleName = "الفصل الأول 2026";
    try {
      const result = await supabase.select("ihsan_settings", {
        columns: "current_cycle_name",
        filter: "id=eq.1",
        single: true,
      });
      const settings = Array.isArray(result) ? result[0] : result;
      if (settings?.current_cycle_name) cycleName = settings.current_cycle_name;
    } catch {}

    // اقرأ روّاد الإحسان الحاليين
    let leaders: any[] = [];
    try {
      const result = await supabase.select("students", {
        columns: "telegram_id,first_name,total_points_current_cycle,current_college_id,current_specialty_id,current_level",
        filter: "total_points_current_cycle=gt.0",
        order: "total_points_current_cycle.desc",
        limit: 50,
      });
      leaders = Array.isArray(result) ? result : [];
    } catch {}

    let msg = "🔄 *إنهاء الدورة الحالية*\n\n";
    msg += `📅 *الدورة:* ${cycleName}\n`;
    msg += `👥 *عدد المحسنين:* ${leaders.length}\n\n`;
    msg += "⚠️ *سيتم:*\n";
    msg += "   1. أرشفة ترتيب المتصدرين في قناة الأرشيف\n";
    msg += "   2. تصفير نقاط الدورة الحالية\n";
    msg += "   3. الإبقاء على النقاط التاريخية\n\n";
    msg += "_⚠️ هذا الإجراء لا يمكن التراجع عنه._\n\n";
    msg += "هل تريد المتابعة؟";

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("✅ تأكيد إنهاء الدورة", "confirm_end_cycle")
        .row()
        .text("❌ إلغاء", "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // ====== تأكيد إنهاء الدورة ======
  bot.callbackQuery("confirm_end_cycle", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏳ جارٍ إنهاء الدورة..." });

    // 1. اقرأ اسم الدورة
    let cycleName = "الفصل الأول 2026";
    try {
      const result = await supabase.select("ihsan_settings", {
        columns: "current_cycle_name",
        filter: "id=eq.1",
        single: true,
      });
      const settings = Array.isArray(result) ? result[0] : result;
      if (settings?.current_cycle_name) cycleName = settings.current_cycle_name;
    } catch {}

    // 2. اجمع روّاد الإحسان
    let leaders: any[] = [];
    try {
      const result = await supabase.select("students", {
        columns: "telegram_id,first_name,total_points_current_cycle,current_college_id,current_specialty_id,current_level",
        filter: "total_points_current_cycle=gt.0",
        order: "total_points_current_cycle.desc",
        limit: 50,
      });
      leaders = Array.isArray(result) ? result : [];
    } catch {}

    // 3. ابنِ رسالة الأرشيف
    let archiveMsg = `🏆 *روّاد الإحسان*\n\n📅 *${cycleName}*\n\n`;
    if (leaders.length === 0) {
      archiveMsg += "📭 لا يوجد محسنون في هذه الدورة.";
    } else {
      // رتّب حسب الكلية → التخصص → المستوى
      const byScope: Record<string, any[]> = {};
      for (const s of leaders) {
        const key = `${s.current_college_id || 0}-${s.current_specialty_id || 0}-${s.current_level || 0}`;
        if (!byScope[key]) byScope[key] = [];
        byScope[key].push(s);
      }

      for (const key of Object.keys(byScope)) {
        const students = byScope[key].slice(0, 3);
        const first = students[0];
        const college = first.current_college_id ? getCollegeById(first.current_college_id) : null;
        const spec = first.current_specialty_id ? getSpecialtyById(first.current_specialty_id) : null;

        archiveMsg += `${college?.emoji || "🎓"} ${college?.short_name || "غير محدد"}\n`;
        archiveMsg += `📚 ${spec?.short_name || "غير محدد"} | المستوى ${first.current_level || "?"}\n`;

        students.forEach((s, i) => {
          const badge = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
          archiveMsg += `${badge} ${s.first_name} — ${s.total_points_current_cycle} ⭐\n`;
        });
        archiveMsg += "\n";
      }
    }

    // 4. أرسل لقناة الأرشيف
    let messageId: number | null = null;
    try {
      const sentMsg = await bot.api.sendMessage(ARCHIVE_CHANNEL_ID, archiveMsg, {
        parse_mode: "Markdown",
      });
      messageId = sentMsg.message_id;
      console.log(`📦 [Archive] Sent to channel, message_id=${messageId}`);
    } catch (e) {
      console.error("❌ Failed to send archive message:", e);
    }

    // 5. سجّل في ihsan_archive
    if (messageId) {
      try {
        await supabase.insert("ihsan_archive", {
          cycle_name: cycleName,
          telegram_message_id: messageId,
          archived_by: ctx.from.id,
        });
      } catch (e) {
        console.error("Failed to insert archive record:", e);
      }
    }

    // 6. صفّر نقاط الدورة الحالية
    try {
      await supabase.update("students", {
        total_points_current_cycle: 0,
      }, "total_points_current_cycle=gt.0");
      console.log("✅ [Archive] Reset all current cycle points");
    } catch (e) {
      console.error("Failed to reset points:", e);
    }

    // 7. حدّث اسم الدورة (للدورة القادمة)
    const nextCycle = "الفصل القادم " + new Date().getFullYear();
    try {
      await supabase.update("ihsan_settings", {
        current_cycle_name: nextCycle,
        updated_at: new Date().toISOString(),
      }, "id=eq.1");
    } catch (e) {
      console.error("Failed to update cycle name:", e);
    }

    let msg = "✅ *تم إنهاء الدورة بنجاح!*\n\n";
    msg += `📅 *الدورة المنتهية:* ${cycleName}\n`;
    msg += `👥 *عدد المحسنين:* ${leaders.length}\n`;
    msg += `📦 *أرشيف:* ${messageId ? "✅ تم الإرسال لقناة الأرشيف" : "⚠️ تعذّر الإرسال"}\n`;
    msg += `🔄 *تم تصفير النقاط الحالية*\n`;
    msg += `📊 *النقاط التاريخية محفوظة*\n\n`;
    msg += `📅 *الدورة الجديدة:* ${nextCycle}`;

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });
}
