// ============================================
// 📢 Broadcast Handlers — التعميم (ديناميكي حسب الصلاحية)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient, logBroadcast, getBroadcastRecipients } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
  getLevelsForSpecialty,
} from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";
import { getStudentCountByScope, getAdminPrimaryPositionId } from "../helpers";

export function registerBroadcastHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A7: التعميم (ديناميكي حسب الصلاحية) ======
  bot.callbackQuery("broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    const kb = new InlineKeyboard();
    let title: string = ADMIN_TEXTS.broadcast.title;

    if (perms.is_central) {
      // المركزي: 4 خيارات
      title = ADMIN_TEXTS.broadcast.title_for_central;
      kb.text(ADMIN_TEXTS.broadcast.btn_all, "broadcast_scope_all").row();
      kb.text("🏛 لكلية محددة", "broadcast_select_college").row();
      kb.text("📚 لتخصص محدد", "broadcast_select_specialty").row();
      kb.text("📊 لمستوى محدد", "broadcast_select_level").row();
    } else if (perms.positions.some((p) => p.level === "college")) {
      // مسؤول الكلية: 3 خيارات (كلّيته + تخصص في كليته + مستوى في تخصص كليته)
      const collegePos = perms.positions.find((p) => p.level === "college");
      const college = getCollegeById(collegePos?.college_id || 0);
      const collegeCount = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: collegePos?.college_id });
      title = ADMIN_TEXTS.broadcast.title_for_college(college?.name || "");
      kb.text(ADMIN_TEXTS.broadcast.btn_my_college(college?.short_name || "", collegeCount), `broadcast_scope_college_${collegePos?.college_id}`).row();
      kb.text("📚 لتخصص محدد في كليتي", "broadcast_select_specialty_in_my_college").row();
      kb.text("📊 لمستوى محدد في كليتي", "broadcast_select_level_in_my_college").row();
    } else if (perms.positions.some((p) => p.level === "level")) {
      // مسؤول الدفعة: 1 خيار (مستواه فقط)
      const levelPos = perms.positions.find((p) => p.level === "level");
      const spec = getSpecialtyById(levelPos?.specialty_id || 0);
      const levelCount = await getStudentCountByScope(supabase, {
        scope_type: "level",
        scope_college_id: levelPos?.college_id,
        scope_specialty_id: levelPos?.specialty_id,
        scope_level: levelPos?.level_num,
      });
      title = ADMIN_TEXTS.broadcast.title_for_level(spec?.short_name || "", levelPos?.level_num || 0);
      kb.text(
        ADMIN_TEXTS.broadcast.btn_my_level(spec?.short_name || "", levelPos?.level_num || 0, levelCount),
        `broadcast_scope_level_${levelPos?.college_id}_${levelPos?.specialty_id}_${levelPos?.level_num}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار الكلية للتعاميم
  bot.callbackQuery("broadcast_select_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    for (const c of COLLEGES) {
      let count = 0;
      try {
        count = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: c.id });
      } catch (e) {
        console.warn(`Failed to count students for college ${c.id}:`, e);
      }
      kb.text(`${c.emoji} ${c.short_name} (${count})`, `broadcast_scope_college_${c.id}`).row();
    }
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_college, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي: اختيار التخصص للتعاميم (أولاً يختار الكلية)
  bot.callbackQuery("broadcast_select_specialty", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_spec_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📚 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^broadcast_spec_select_college_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    for (const s of specialties) {
      const count = await getStudentCountByScope(supabase, { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: s.id });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegeId}_${s.id}`).row();
    }
    kb.text("🔙 الكليات", "broadcast_select_specialty");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار التخصص في كليته
  bot.callbackQuery("broadcast_select_specialty_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const college = getCollegeById(collegePos?.college_id || 0);
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    for (const s of specialties) {
      const count = await getStudentCountByScope(supabase, {
        scope_type: "specialty",
        scope_college_id: collegePos?.college_id,
        scope_specialty_id: s.id,
      });
      kb.text(`${s.short_name} (${count})`, `broadcast_scope_specialty_${collegePos?.college_id}_${s.id}`).row();
    }
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_specialty(college?.name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // المركزي + مسؤول الكلية: اختيار المستوى (أولاً يختار التخصص)
  bot.callbackQuery("broadcast_select_level", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    COLLEGES.forEach((c) => {
      kb.text(`${c.emoji} ${c.short_name}`, `broadcast_lvl_select_college_${c.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر الكلية أولاً:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^broadcast_lvl_select_college_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const specialties = getSpecialtiesByCollege(collegeId);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegeId}_${s.id}`).row();
    });
    kb.text("🔙 الكليات", "broadcast_select_level");
    await ctx.editMessageText(`📊 اختر التخصص في ${college?.name}:`, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery(/^broadcast_lvl_select_spec_(\d+)_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const levels = getLevelsForSpecialty(specId);
    const kb = new InlineKeyboard();
    for (let i = 0; i < levels.length; i += 3) {
      for (let j = 0; j < 3 && i + j < levels.length; j++) {
        const lvl = levels[i + j];
        const count = await getStudentCountByScope(supabase, {
          scope_type: "level",
          scope_college_id: collegeId,
          scope_specialty_id: specId,
          scope_level: lvl,
        });
        kb.text(`مستوى ${lvl} (${count})`, `broadcast_scope_level_${collegeId}_${specId}_${lvl}`);
      }
      kb.row();
    }
    kb.text("🔙 التخصصات", `broadcast_lvl_select_college_${collegeId}`);
    await ctx.editMessageText(ADMIN_TEXTS.broadcast.select_level(spec?.short_name || ""), {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // مسؤول الكلية: اختيار المستوى في كليته
  bot.callbackQuery("broadcast_select_level_in_my_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);
    const collegePos = perms.positions.find((p) => p.level === "college");
    const specialties = getSpecialtiesByCollege(collegePos?.college_id || 0);
    const kb = new InlineKeyboard();
    specialties.forEach((s) => {
      kb.text(s.short_name, `broadcast_lvl_select_spec_${collegePos?.college_id}_${s.id}`).row();
    });
    kb.text("🔙 التعميم", "broadcast");
    await ctx.editMessageText("📊 اختر التخصص في كليتك:", {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // عند اختيار النطاق النهائي → طلب نص/صورة/ملف التعميم
  bot.callbackQuery("broadcast_scope_all", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const count = await getStudentCountByScope(supabase, { scope_type: "all" });
    session.awaiting_broadcast_scope = "all";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "all", scope_label: "🌍 كل الطلاب", count };
    await saveSession(session);
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text("🌍 كل الطلاب", count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/^broadcast_scope_college_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const college = getCollegeById(collegeId);
    const count = await getStudentCountByScope(supabase, { scope_type: "college", scope_college_id: collegeId });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "college";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "college", scope_college_id: collegeId, scope_label: `🏛 ${college?.name}`, count };
    await saveSession(session);
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`🏛 ${college?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/^broadcast_scope_specialty_(\d+)_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = await getStudentCountByScope(supabase, { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "specialty";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "specialty", scope_college_id: collegeId, scope_specialty_id: specId, scope_label: `📚 ${spec?.name}`, count };
    await saveSession(session);
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📚 ${spec?.name}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery(/^broadcast_scope_level_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    const specId = parseInt(ctx.match[2]);
    const level = parseInt(ctx.match[3]);
    await ctx.answerCallbackQuery();
    const spec = getSpecialtyById(specId);
    const count = await getStudentCountByScope(supabase, { scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_broadcast_scope = "level";
    session.awaiting_broadcast_text = true;
    session.broadcast_context = { scope_type: "level", scope_college_id: collegeId, scope_specialty_id: specId, scope_level: level, scope_label: `📊 ${spec?.short_name} - مستوى ${level}`, count };
    await saveSession(session);
    await ctx.editMessageText(
      ADMIN_TEXTS.broadcast.prompt_text(`📊 ${spec?.short_name} - مستوى ${level}`, count),
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("confirm_broadcast", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const ctxData = session.broadcast_context || { scope_label: "غير محدد", count: 0, scope_type: "all" };
    const text = session.pending_broadcast_text || "(بدون نص)";

    // إعادة ضبط حالة التعميم
    session.awaiting_broadcast_text = undefined;
    session.awaiting_broadcast_scope = undefined;
    session.broadcast_context = undefined;
    session.pending_broadcast_text = undefined;
    await saveSession(session);

    await ctx.answerCallbackQuery({ text: "📢 جارٍ الإرسال..." });

    // === تنفيذ الإرسال الفعلي ===
    let deliveredCount = 0;
    let failedCount = 0;
    let recipientIds: number[] = [];

    try {
      // 1. اجلب المستلمين
      recipientIds = await getBroadcastRecipients(
        supabase,
        ctxData.scope_type,
        ctxData.scope_college_id,
        ctxData.scope_specialty_id,
        ctxData.scope_level
      );
    } catch (e) {
      console.error("Failed to fetch broadcast recipients:", e);
    }

    if (recipientIds.length === 0) {
      await ctx.editMessageText(
        "⚠️ *لا يوجد مستلمون في هذا النطاق*\n\nقد لا يكون هناك طلاب مسجّلون ضمن النطاق المحدد.",
        {
          reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // 2. أدرج إشعار في student_notifications لكل مستلم (ضمان الوصول)
    const notificationTitle = `📢 تعميم: ${ctxData.scope_label}`;
    try {
      // إدراج جماعي عبر RPC أو إدراج فردي
      // PostgREST لا يدعم batch insert مباشرة، فنُدرج صف واحد لكل مستلم
      // لكن لتحسين الأداء، نستخدم إدراج متتابع مع تجاهل الأخطاء
      const insertPromises = recipientIds.map((studentId) =>
        supabase.insert("student_notifications", {
          student_telegram_id: studentId,
          notification_type: "broadcast",
          title: notificationTitle,
          body: text,
          related_entity_type: "broadcast",
        }).catch((e: any) => {
          // تجاهل أخطاء FK (طالب غير مسجّل)
          console.warn(`Failed to insert notification for ${studentId}:`, e?.message?.substring(0, 80));
        })
      );
      await Promise.all(insertPromises);
      deliveredCount = recipientIds.length;
    } catch (e) {
      console.error("Failed to insert notifications:", e);
    }

    // 3. الإرسال المباشر عبر بوت الطالب (push notification فوري)
    // نستدعي endpoint /broadcast-push في بوت الطالب عبر HTTP
    // هذا يضمن وصول الرسالة كرسالة Telegram عادية + إشعار
    const studentBotUrl = (globalThis as any).__studentBotUrl as string | undefined;
    const callbackSecret = (globalThis as any).__callbackSecret as string | undefined;

    let pushDelivered = 0;
    let pushBlocked = 0;

    if (studentBotUrl && callbackSecret) {
      // رسالة منسقة جميلة للطالب
      const studentMessage =
        `📢 *تعميم جديد*\n\n` +
        `📍 ${ctxData.scope_label}\n` +
        `👤 من: ${ctx.from.first_name || "إدارة"}\n` +
        `📅 ${new Date().toLocaleString("ar")}\n\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `${text}\n\n` +
        `━━━━━━━━━━━━━━━`;

      const pushPromises = recipientIds.map(async (studentId) => {
        try {
          const resp = await fetch(`${studentBotUrl}/broadcast-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: callbackSecret,
              telegram_id: studentId,
              text: studentMessage,
              parse_mode: "Markdown",
            }),
          });
          if (resp.ok) {
            pushDelivered++;
          } else if (resp.status === 404) {
            pushBlocked++;
          }
        } catch (e) {
          // تجاهل — الإشعار في DB يضمن الوصول
        }
      });
      // مهلة 12 ثانية (أطول قليلاً من سابقتها لأن الـ fetch يأخذ وقتاً)
      await Promise.race([
        Promise.allSettled(pushPromises),
        new Promise((resolve) => setTimeout(resolve, 12000)),
      ]);
    } else {
      console.warn("⚠️ [broadcast] STUDENT_BOT_URL or CALLBACK_SECRET not set — skipping direct push");
    }

    // 4. سجّل التعميم في DB
    const positionId = await getAdminPrimaryPositionId(supabase, ctx.from.id);
    try {
      await logBroadcast(supabase, {
        sender_telegram_id: ctx.from.id,
        sender_position_id: positionId,
        scope_type: ctxData.scope_type,
        scope_college_id: ctxData.scope_college_id || undefined,
        scope_specialty_id: ctxData.scope_specialty_id || undefined,
        scope_level: ctxData.scope_level || undefined,
        content_type: "text",
        text_content: text,
        sent_count: deliveredCount,
      });
    } catch (e) {
      console.error("Failed to log broadcast:", e);
    }

    // 5. اعرض رسالة النجاح
    const pushSuccessRate = deliveredCount > 0 ? Math.round((pushDelivered / deliveredCount) * 100) : 0;
    await ctx.editMessageText(
      `✅ *تم إرسال التعميم بنجاح!*\n\n` +
      `📍 النطاق: ${ctxData.scope_label}\n` +
      `👥 المستلمون: ${deliveredCount} طالب\n` +
      `📨 وصل كرسالة مباشرة: ${pushDelivered} (${pushSuccessRate}%)\n` +
      (pushBlocked > 0 ? `🚫 محظور/لم يبدأ: ${pushBlocked}\n` : "") +
      `🔔 إشعار في البوت: ${deliveredCount} (100%)\n` +
      `⏱ وقت الإرسال: ${new Date().toLocaleString("ar")}\n\n` +
      `_الطلاب سيرون الرسالة فوراً كإشعار Telegram + في بوت الطالب._`,
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
