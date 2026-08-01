// ============================================
// 👥 Positions Handlers — إدارة المسؤولين (هرمي - Phase 1)
// ============================================
// هذا الملف يحتوي على:
//
// 1) القائمة الرئيسية (manage_admins)
//    - المركزي: 4 أقسام + مناصبي
//    - مسؤول كلية: 3 أقسام + مناصبي
//
// 2) إدارة مسؤولي الكليات (central only)
//    - college_admins → قائمة الكليات السبع
//    - college_admin_detail_{collegeId} → تفاصيل + تعيين/استبدال/إزالة
//    - assign_college_{collegeId} / replace_college_{collegeId} → بدء التعيين
//    - revoke_college_{collegeId} → تأكيد الإزالة
//
// 3) إدارة مندوبي المستويات (central + college admin)
//    - level_reps → الكليات (أو تخصصات الكلية لمسؤول كلية واحدة)
//    - level_reps_college_{collegeId} → تخصصات الكلية
//    - level_reps_spec_{specId} → مستويات التخصص
//    - level_rep_detail_{specId}_{levelNum} → تفاصيل + تعيين/استبدال/إزالة
//    - assign_rep_{specId}_{levelNum} / replace_rep_{specId}_{levelNum} → بدء التعيين
//    - revoke_rep_{specId}_{levelNum} → تأكيد الإزالة
//
// 4) آلية التعيين (5 خطوات) — مشتركة
//    - assign_position_{positionId} → بدء (step=telegram_id)
//    - confirm_assign_{positionId} → تنفيذ
//    - cancel_assign → إلغاء
//    - (الخطوات تُعالج في messages.ts)
//
// 5) آلية الإزالة — مشتركة
//    - revoke_position_{positionId} → تأكيد
//    - confirm_revoke_{positionId} → تنفيذ
//    - cancel_revoke → إلغاء
//
// 6) مناصبي (my_positions)
// 7) الهيكل الإداري (org_chart) — عرض مبسّط
// 8) سجل التعيينات (audit_log) — آخر التغييرات
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import {
  SupabaseClient,
  generateInviteToken,
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from "../../shared/db";
import {
  getUserPermissions,
  getPositionScopeText,
  invalidateUserPermissions,
} from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import {
  getPositionById,
  getPositionHolder,
  getAdminUser,
  ensureLevelRepPosition,
  writePositionAuditLog,
  notifyNewAdmin,
  notifyRevokedAdmin,
  getAdminPrimaryPositionId,
} from "../helpers";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
} from "../../shared/data/colleges";

export function registerPositionHandlers(bot: Bot, supabase: SupabaseClient): void {
  // =====================================================
  // 1) القائمة الرئيسية: manage_admins
  // =====================================================
  bot.callbackQuery("manage_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const perms = await getUserPermissions(ctx.from.id);

    // مسؤول كلية (manage_level_reps فقط) أو مركزي (manage_admins)
    const canManageAdmins = perms.permissions.has("manage_admins");
    const canManageLevelReps = perms.permissions.has("manage_level_reps");

    if (!canManageAdmins && !canManageLevelReps) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_dashboard,
          "back_to_dashboard"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    if (canManageAdmins) {
      // المركزي — 4 أقسام
      kb.text(ADMIN_TEXTS.positions.btn_college_admins, "college_admins").row();
      kb.text(ADMIN_TEXTS.positions.btn_level_reps, "level_reps").row();
      kb.text(ADMIN_TEXTS.positions.btn_org_chart, "org_chart").row();
      kb.text(ADMIN_TEXTS.positions.btn_audit_log, "audit_log").row();
      // نظام دعوات المسؤولين (للمركزي فقط)
      kb.text("➕ دعوة مسؤول جديد", "invite_admin").row();
      kb.text("📋 الدعوات المعلّقة", "invite_list").row();
    } else {
      // مسؤول كلية — 3 أقسام
      kb.text(ADMIN_TEXTS.positions.btn_level_reps, "level_reps").row();
      kb.text(ADMIN_TEXTS.positions.btn_org_chart, "org_chart").row();
      kb.text(ADMIN_TEXTS.positions.btn_audit_log, "audit_log").row();
    }
    kb.text(ADMIN_TEXTS.positions.btn_my_positions, "my_positions").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    const title = perms.is_central
      ? ADMIN_TEXTS.positions.title_central
      : ADMIN_TEXTS.positions.title_college;

    await ctx.editMessageText(title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 2) إدارة مسؤولي الكليات (central only)
  // =====================================================
  bot.callbackQuery("college_admins", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const college of COLLEGES) {
      const posId = `college_admin_${college.id}`;
      const holder = await getPositionHolder(supabase, posId);
      const holderUser = holder
        ? await getAdminUser(supabase, holder.user_telegram_id)
        : null;
      const statusIcon = holderUser ? "✅" : "⚠️";
      kb.text(
        `${college.emoji} ${college.short_name} ${statusIcon}`,
        `college_admin_detail_${college.id}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(ADMIN_TEXTS.positions.college_admins_title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // تفاصيل مسؤول كلية
  bot.callbackQuery(/college_admin_detail_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من الصلاحية (defense in depth): manage_admins للمركزي فقط
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const college = getCollegeById(collegeId);
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }

    const positionId = `college_admin_${collegeId}`;
    const position = await getPositionById(supabase, positionId);
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود في قاعدة البيانات.");
      return;
    }

    const holder = await getPositionHolder(supabase, positionId);
    const holderUser = holder
      ? await getAdminUser(supabase, holder.user_telegram_id)
      : null;
    const holderName = holderUser?.first_name || null;
    const holderId = holder?.user_telegram_id || null;

    const msg = ADMIN_TEXTS.positions.college_admin_detail(
      college.name,
      holderName,
      holderId
    );

    const kb = new InlineKeyboard();
    if (holder) {
      kb.text(
        ADMIN_TEXTS.positions.btn_replace_college,
        `replace_college_${collegeId}`
      ).row();
      kb.text(
        ADMIN_TEXTS.positions.btn_revoke_college,
        `revoke_college_${collegeId}`
      ).row();
    } else {
      kb.text(
        ADMIN_TEXTS.positions.btn_assign_college,
        `assign_college_${collegeId}`
      ).row();
    }
    kb.text("🔙 مسؤولو الكليات", "college_admins").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 3) إدارة مندوبي المستويات (central + college admin)
  // =====================================================
  bot.callbackQuery("level_reps", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    if (!perms.permissions.has("manage_admins") && !perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // مسؤول كلية — انتقل مباشرة لقائمة تخصصات كليته
    if (!perms.is_central && perms.permissions.has("manage_level_reps")) {
      const collegeIds = Array.from(perms.effective_scope.colleges);
      if (collegeIds.length === 0) {
        await ctx.editMessageText(ADMIN_TEXTS.positions.empty, {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        });
        return;
      }
      // لو كلية واحدة — اعرض تخصصاتها مباشرة
      if (collegeIds.length === 1) {
        await showSpecialtyList(ctx, collegeIds[0]);
        return;
      }
      // لو عدة كليات (نادر) — اعرض قائمة الكليات
      await showCollegeListForLevelReps(ctx, collegeIds);
      return;
    }

    // المركزي — اعرض كل الكليات
    await showCollegeListForLevelReps(ctx, COLLEGES.map((c) => c.id));
  });

  bot.callbackQuery(/level_reps_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(collegeId)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await showSpecialtyList(ctx, collegeId);
  });

  bot.callbackQuery(/level_reps_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await showLevelList(ctx, specId);
  });

  bot.callbackQuery(/level_rep_detail_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const positionId = `level_rep_${specId}_${levelNum}`;
    const position = await getPositionById(supabase, positionId);
    const holder = await getPositionHolder(supabase, positionId);
    const holderUser = holder
      ? await getAdminUser(supabase, holder.user_telegram_id)
      : null;
    const holderName = holderUser?.first_name || null;
    const holderId = holder?.user_telegram_id || null;

    const msg = ADMIN_TEXTS.positions.level_rep_detail(
      spec.short_name,
      levelNum,
      holderName,
      holderId
    );

    const kb = new InlineKeyboard();
    if (holder) {
      kb.text(
        ADMIN_TEXTS.positions.btn_replace_rep,
        `replace_rep_${specId}_${levelNum}`
      ).row();
      kb.text(
        ADMIN_TEXTS.positions.btn_revoke_rep,
        `revoke_rep_${specId}_${levelNum}`
      ).row();
    } else {
      kb.text(
        ADMIN_TEXTS.positions.btn_assign_rep,
        `assign_rep_${specId}_${levelNum}`
      ).row();
    }
    kb.text("🔙 المستويات", `level_reps_spec_${specId}`).row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 4) أزرار التعيين/الاستبدال لكلا النوعين
  // =====================================================

  // تعيين مسؤول كلية (يبدأ flow من 5 خطوات)
  bot.callbackQuery(/assign_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من الصلاحية: manage_admins فقط
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await startAssignment(ctx, supabase, `college_admin_${collegeId}`, false);
  });

  // استبدال مسؤول كلية
  bot.callbackQuery(/replace_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من الصلاحية: manage_admins فقط
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await startAssignment(ctx, supabase, `college_admin_${collegeId}`, true);
  });

  // تعيين مندوب مستوى (يضمن وجود المنصب ديناميكياً أولاً)
  bot.callbackQuery(/assign_rep_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let positionId: string;
    try {
      positionId = await ensureLevelRepPosition(
        supabase,
        spec.college_id,
        specId,
        levelNum
      );
    } catch (e) {
      console.error("ensureLevelRepPosition failed:", e);
      await ctx.reply("⚠️ فشل إنشاء المنصب. حاول مرة أخرى.");
      return;
    }

    await startAssignment(ctx, supabase, positionId, false);
  });

  // استبدال مندوب مستوى
  bot.callbackQuery(/replace_rep_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let positionId: string;
    try {
      positionId = await ensureLevelRepPosition(
        supabase,
        spec.college_id,
        specId,
        levelNum
      );
    } catch (e) {
      console.error("ensureLevelRepPosition failed:", e);
      await ctx.reply("⚠️ فشل إنشاء المنصب. حاول مرة أخرى.");
      return;
    }

    await startAssignment(ctx, supabase, positionId, true);
  });

  // =====================================================
  // 5) Entry point عام: assign_position_{positionId}
  // =====================================================
  // يستخدم لأي position_id مباشرة (بدون تحويل). مفيد لو أردنا
  // إضافة شاشة قائمة عامة لاحقاً.
  bot.callbackQuery(/assign_position_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await startAssignment(ctx, supabase, positionId, false);
  });

  // =====================================================
  // 6) تنفيذ التعيين: confirm_assign_{positionId}
  // =====================================================
  bot.callbackQuery(/confirm_assign_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const assign = session.awaiting_position_assign;

    await ctx.answerCallbackQuery();

    if (!assign || assign.position_id !== positionId || assign.step !== "confirm") {
      await ctx.reply("⚠️ انتهت الجلسة أو الطلب غير صالح. ابدأ من جديد من لوحة الإدارة.");
      return;
    }

    const newHolderId = assign.telegram_id!;
    const customName = assign.custom_name || "";
    const positionTitle = assign.position_title || "المنصب";
    const performedBy = ctx.from.id;
    const performedByName = session.first_name || "المسؤول";

    // 1. اقرأ الشاغل القديم (للتدقيق والإشعار)
    const oldHolder = await getPositionHolder(supabase, positionId);
    const oldHolderId = oldHolder?.user_telegram_id || null;

    // 2. عطّل الشاغل القديم لو موجود (دون إشعاره بعد — حتى نضمن نجاح الإدراج)
    if (oldHolder) {
      try {
        await supabase.update(
          "position_holders",
          { is_active: false },
          `position_id=eq.${positionId}&is_active=eq.true`
        );
      } catch (e) {
        console.error("Failed to deactivate previous holder:", e);
      }
    }

    // 3. أدرج الشاغل الجديد
    try {
      await supabase.insert("position_holders", {
        position_id: positionId,
        user_telegram_id: newHolderId,
        assigned_by: performedBy,
        is_active: true,
      });
    } catch (e) {
      console.error("Failed to assign new holder:", e);
      await ctx.reply("⚠️ فشل تعيين المنصب في قاعدة البيانات. حاول مرة أخرى.");
      return;
    }

    // 4. حدّث الاسم المخصص في admin_users
    if (customName) {
      try {
        await supabase.update(
          "admin_users",
          { first_name: customName },
          `telegram_id=eq.${newHolderId}`
        );
      } catch (e) {
        console.warn("Failed to update admin user custom name:", e);
      }
    }

    // 5. اكتب سجل التدقيق
    await writePositionAuditLog(supabase, {
      position_id: positionId,
      action: "assign",
      old_holder_id: oldHolderId,
      new_holder_id: newHolderId,
      performed_by: performedBy,
    });

    // 6. ابطال cache للشاغلين (القديم والجديد)
    if (oldHolderId) {
      await invalidateUserPermissions(oldHolderId);
    }
    await invalidateUserPermissions(newHolderId);

    // 7. أرسل إشعاراً للشاغل القديم (لو وُجد — استبدال)
    if (oldHolderId) {
      await notifyRevokedAdmin(bot, oldHolderId, positionTitle, performedByName);
    }

    // 8. أرسل إشعاراً للمسؤول الجديد
    await notifyNewAdmin(bot, newHolderId, positionTitle, performedByName);

    // 9. امسح الجلسة واعرض رسالة النجاح
    session.awaiting_position_assign = undefined;
    await saveSession(session);

    const displayName = customName || `المستخدم ${newHolderId}`;
    await ctx.editMessageText(
      ADMIN_TEXTS.positions.assign_success(displayName, positionTitle),
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  // =====================================================
  // 7) إلغاء التعيين
  // =====================================================
  bot.callbackQuery("cancel_assign", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    await ctx.answerCallbackQuery();
    session.awaiting_position_assign = undefined;
    await saveSession(session);

    await ctx.editMessageText("❌ *تم إلغاء التعيين.*", {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 8) أزرار الإزالة لكلا النوعين + entry عام
  // =====================================================
  bot.callbackQuery(/revoke_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من الصلاحية: manage_admins فقط
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await showRevokeConfirm(ctx, supabase, `college_admin_${collegeId}`);
  });

  bot.callbackQuery(/revoke_rep_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من الصلاحية: manage_level_reps + نطاق الكلية
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_level_reps")) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission_college, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await showRevokeConfirm(ctx, supabase, `level_rep_${specId}_${levelNum}`);
  });

  bot.callbackQuery(/revoke_position_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await showRevokeConfirm(ctx, supabase, positionId);
  });

  // =====================================================
  // 9) تنفيذ الإزالة: confirm_revoke_{positionId}
  // =====================================================
  bot.callbackQuery(/confirm_revoke_(.+)/, async (ctx) => {
    const positionId = ctx.match[1];
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    await ctx.answerCallbackQuery();

    const position = await getPositionById(supabase, positionId);
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود.");
      return;
    }

    // 1. اقرأ الشاغل الحالي
    const oldHolder = await getPositionHolder(supabase, positionId);
    const oldHolderId = oldHolder?.user_telegram_id || null;

    if (!oldHolder) {
      await ctx.editMessageText("⚠️ المنصب شاغر بالفعل.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // 2. عطّل الشاغل
    try {
      await supabase.update(
        "position_holders",
        { is_active: false },
        `position_id=eq.${positionId}&is_active=eq.true`
      );
    } catch (e) {
      console.error("Failed to revoke holder:", e);
      await ctx.reply("⚠️ فشلت الإزالة في قاعدة البيانات. حاول مرة أخرى.");
      return;
    }

    // 3. اكتب سجل التدقيق
    await writePositionAuditLog(supabase, {
      position_id: positionId,
      action: "revoke",
      old_holder_id: oldHolderId,
      performed_by: ctx.from.id,
    });

    // 4. ابطال cache للشاغل المُزال
    if (oldHolderId) {
      await invalidateUserPermissions(oldHolderId);
    }

    // 5. أرسل إشعاراً للشاغل المُزال
    const revokedByName = session.first_name || "المسؤول";
    if (oldHolderId) {
      await notifyRevokedAdmin(bot, oldHolderId, position.title, revokedByName);
    }

    // 6. امسح الجلسة واعرض رسالة النجاح
    session.awaiting_position_revoke = undefined;
    await saveSession(session);

    await ctx.editMessageText(ADMIN_TEXTS.positions.revoke_success, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("cancel_revoke", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    await ctx.answerCallbackQuery();
    session.awaiting_position_revoke = undefined;
    await saveSession(session);

    await ctx.editMessageText("❌ *تم إلغاء الإزالة.*", {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 10) مناصبي
  // =====================================================
  bot.callbackQuery("my_positions", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userPerms = await getUserPermissions(ctx.from.id);
    const myPositions = userPerms.positions;

    if (myPositions.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.my_positions_empty, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.positions.my_positions_title(myPositions.length);
    for (const p of myPositions) {
      const scope = await getPositionScopeText(p);
      msg += `• ${p.title}\n  📍 ${scope}\n\n`;
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_manage_admins,
        "manage_admins"
      ),
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 11) الهيكل الإداري (org_chart) — تفاعلي متعدد المستويات
  // =====================================================

  // الشاشة الرئيسية: المركزي يرى قائمة الكليات، مسؤول الكلية ينتقل مباشرة لكليته
  bot.callbackQuery("org_chart", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);

    // مسؤول كلية: انتقل مباشرة لشاشة كليته (لو كلية واحدة)
    if (!perms.is_central) {
      const collegeIds = Array.from(perms.effective_scope.colleges);
      if (collegeIds.length === 0) {
        await ctx.editMessageText(ADMIN_TEXTS.positions.empty, {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        });
        return;
      }
      if (collegeIds.length === 1) {
        await showOrgChartCollege(ctx, collegeIds[0]);
        return;
      }
      // عدة كليات (نادر) — اعرض قائمة كلياته فقط
      const kbScoped = new InlineKeyboard();
      for (const cId of collegeIds) {
        const college = getCollegeById(cId);
        if (!college) continue;
        const posId = `college_admin_${college.id}`;
        const holder = await getPositionHolder(supabase, posId);
        const statusIcon = holder ? "✅" : "⚠️";
        kbScoped.text(
          `${college.emoji} ${college.short_name} ${statusIcon}`,
          `org_chart_college_${college.id}`
        ).row();
      }
      kbScoped.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");
      await ctx.editMessageText(ADMIN_TEXTS.positions.org_chart_title, {
        reply_markup: kbScoped,
        parse_mode: "Markdown",
      });
      return;
    }

    // المركزي: اعرض كل الكليات السبع مع مؤشر الحالة
    const kb = new InlineKeyboard();
    for (const college of COLLEGES) {
      const posId = `college_admin_${college.id}`;
      const holder = await getPositionHolder(supabase, posId);
      const statusIcon = holder ? "✅" : "⚠️";
      kb.text(
        `${college.emoji} ${college.short_name} ${statusIcon}`,
        `org_chart_college_${college.id}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(ADMIN_TEXTS.positions.org_chart_title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // شاشة الكلية: اسم الكلية + مسؤولها + عدّاد المندوبين + قائمة التخصصات
  bot.callbackQuery(/org_chart_college_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    // تحقق من النطاق: مسؤول الكلية يرى كليته فقط
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.is_central && !perms.effective_scope.colleges.has(collegeId)) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await showOrgChartCollege(ctx, collegeId);
  });

  // شاشة التخصص: اسم التخصص + الكلية + قائمة المستويات (نص فقط)
  bot.callbackQuery(/org_chart_specialty_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    // تحقق من النطاق: التخصص يجب أن ينتمي لكلية ضمن نطاق المستخدم
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.is_central && !perms.effective_scope.colleges.has(spec.college_id)) {
      await ctx.editMessageText(
        ADMIN_TEXTS.positions.no_permission_scope("هذا الإجراء"),
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.navigation.back_to_manage_admins,
            "manage_admins"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const college = getCollegeById(spec.college_id);
    const collegeName = college?.name || "—";

    let msg = ADMIN_TEXTS.positions.org_chart_specialty(spec.short_name, collegeName);
    for (let lvl = 1; lvl <= spec.levels_count; lvl++) {
      const posId = `level_rep_${specId}_${lvl}`;
      const holder = await getPositionHolder(supabase, posId);
      const holderUser = holder
        ? await getAdminUser(supabase, holder.user_telegram_id)
        : null;
      const holderName = holderUser?.first_name || null;
      msg += ADMIN_TEXTS.positions.org_chart_level(lvl, holderName);
    }

    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard()
        .text("🔙 الكلية", `org_chart_college_${spec.college_id}`)
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins"),
      parse_mode: "Markdown",
    });
  });

  // =====================================================
  // 12) سجل التعيينات (audit_log) — بفلاتر + ترقيم صفحات
  // =====================================================

  bot.callbackQuery("audit_log", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    // عند الدخول من القائمة الرئيسية: نبدأ من الصفحة 1 (الفلاتر تبقى كما هي)
    session.audit_log_page = 1;
    await saveSession(session);
    const perms = await getUserPermissions(ctx.from.id);
    await renderAuditLog(ctx, perms, session);
  });

  bot.callbackQuery(/audit_log_filter_(all|assign|revoke)/, async (ctx) => {
    const filter = ctx.match[1] as "all" | "assign" | "revoke";
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.audit_log_filter = filter;
    session.audit_log_page = 1; // فلتر جديد → نعود للصفحة 1
    await saveSession(session);
    const perms = await getUserPermissions(ctx.from.id);
    await renderAuditLog(ctx, perms, session);
  });

  bot.callbackQuery(/audit_log_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.audit_log_page = Math.max(1, page);
    await saveSession(session);
    const perms = await getUserPermissions(ctx.from.id);
    await renderAuditLog(ctx, perms, session);
  });

  // =====================================================
  // Helper functions
  // =====================================================

  async function showCollegeListForLevelReps(ctx: any, collegeIds: number[]): Promise<void> {
    const kb = new InlineKeyboard();
    for (const id of collegeIds) {
      const college = getCollegeById(id);
      if (!college) continue;
      kb.text(
        `${college.emoji} ${college.short_name}`,
        `level_reps_college_${college.id}`
      ).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(ADMIN_TEXTS.positions.level_reps_title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  }

  async function showSpecialtyList(ctx: any, collegeId: number): Promise<void> {
    const college = getCollegeById(collegeId);
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }

    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد تخصصات في هذه الكلية.", {
        reply_markup: new InlineKeyboard().text("🔙 الكليات", "level_reps"),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const spec of specialties) {
      kb.text(`📚 ${spec.short_name}`, `level_reps_spec_${spec.id}`).row();
    }
    kb.text("🔙 الكليات", "level_reps").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(
      ADMIN_TEXTS.positions.level_reps_select_specialty(college.name),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  }

  async function showLevelList(ctx: any, specId: number): Promise<void> {
    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    const kb = new InlineKeyboard();
    for (let lvl = 1; lvl <= spec.levels_count; lvl++) {
      const posId = `level_rep_${specId}_${lvl}`;
      const holder = await getPositionHolder(supabase, posId);
      const statusIcon = holder ? "✅" : "⚠️";
      kb.text(`📊 المستوى ${lvl} ${statusIcon}`, `level_rep_detail_${specId}_${lvl}`).row();
    }
    // Back to specialties of the same college
    kb.text("🔙 التخصصات", `level_reps_college_${spec.college_id}`).row();
    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(
      ADMIN_TEXTS.positions.level_reps_select_level(spec.short_name),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  }

  async function startAssignment(
    ctx: any,
    supabase: SupabaseClient,
    positionId: string,
    isReplacement: boolean
  ): Promise<void> {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    const position = await getPositionById(supabase, positionId);
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود في قاعدة البيانات.");
      return;
    }

    // اقرأ الشاغل الحالي (لو موجود) لعرض اسمه في شاشة التأكيد
    let currentHolderName: string | undefined;
    const currentHolder = await getPositionHolder(supabase, positionId);
    if (currentHolder) {
      const holderUser = await getAdminUser(supabase, currentHolder.user_telegram_id);
      if (holderUser?.first_name) currentHolderName = holderUser.first_name;
    }

    session.awaiting_position_assign = {
      step: "telegram_id",
      position_id: positionId,
      position_title: position.title,
      is_replacement: isReplacement,
      current_holder_name: currentHolderName,
    };
    await saveSession(session);

    await ctx.editMessageText(ADMIN_TEXTS.positions.assign_step1_prompt, {
      reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_assign"),
      parse_mode: "Markdown",
    });
  }

  async function showRevokeConfirm(
    ctx: any,
    supabase: SupabaseClient,
    positionId: string
  ): Promise<void> {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    const position = await getPositionById(supabase, positionId);
    if (!position) {
      await ctx.reply("⚠️ المنصب غير موجود.");
      return;
    }

    const holder = await getPositionHolder(supabase, positionId);
    if (!holder) {
      await ctx.editMessageText("⚠️ المنصب شاغر بالفعل.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const holderUser = await getAdminUser(supabase, holder.user_telegram_id);
    const holderName = holderUser?.first_name || `المستخدم ${holder.user_telegram_id}`;

    session.awaiting_position_revoke = {
      position_id: positionId,
      holder_name: holderName,
      position_title: position.title,
    };
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.positions.revoke_confirm(holderName, position.title),
      {
        reply_markup: new InlineKeyboard()
          .text(
            ADMIN_TEXTS.positions.btn_confirm_revoke,
            `confirm_revoke_${positionId}`
          )
          .text(ADMIN_TEXTS.positions.btn_cancel_revoke, "cancel_revoke"),
        parse_mode: "Markdown",
      }
    );
  }

  // =====================================================
  // Helper: org_chart — شاشة الكلية (مسؤولها + عدّاد المندوبين + تخصصات)
  // =====================================================
  async function showOrgChartCollege(ctx: any, collegeId: number): Promise<void> {
    const college = getCollegeById(collegeId);
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }

    const posId = `college_admin_${collegeId}`;
    const holder = await getPositionHolder(supabase, posId);
    const holderUser = holder
      ? await getAdminUser(supabase, holder.user_telegram_id)
      : null;
    const holderName = holderUser?.first_name || null;

    // عدّ المندوبين لكل تخصصات الكلية
    const specialties = getSpecialtiesByCollege(collegeId);
    let totalReps = 0;
    let filledReps = 0;
    for (const spec of specialties) {
      for (let lvl = 1; lvl <= spec.levels_count; lvl++) {
        totalReps++;
        const repHolder = await getPositionHolder(
          supabase,
          `level_rep_${spec.id}_${lvl}`
        );
        if (repHolder) filledReps++;
      }
    }

    const msg = ADMIN_TEXTS.positions.org_chart_college(
      college.name,
      holderName,
      totalReps,
      filledReps
    );

    const kb = new InlineKeyboard();
    for (const spec of specialties) {
      kb.text(`📚 ${spec.short_name}`, `org_chart_specialty_${spec.id}`).row();
    }
    kb.text("🔙 الهيكل الإداري", "org_chart").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  }

  // =====================================================
  // Helper: audit_log — عرض السجل مع فلتر + ترقيم صفحات
  // =====================================================
  async function renderAuditLog(
    ctx: any,
    perms: Awaited<ReturnType<typeof getUserPermissions>>,
    session: Awaited<ReturnType<typeof getOrCreateSession>>
  ): Promise<void> {
    const collegeIds = Array.from(perms.effective_scope.colleges);
    const specIds = new Set<number>();
    for (const cId of collegeIds) {
      for (const spec of getSpecialtiesByCollege(cId)) {
        specIds.add(spec.id);
      }
    }

    let allEntries: any[] = [];
    try {
      // نجلب حدّاً كبيراً لدعم الترقيم (للمركزي: كل السجلات، لمسؤول الكلية: نُفلتر بعدها)
      const result = await supabase.select("position_audit_logs", {
        columns:
          "position_id,action,old_holder_id,new_holder_id,performed_by,performed_at",
        order: "performed_at.desc",
        limit: 200,
      });
      const raw = Array.isArray(result) ? result : [];

      if (perms.is_central) {
        allEntries = raw;
      } else if (collegeIds.length === 0) {
        allEntries = [];
      } else {
        // فلترة client-side حسب نطاق الكليات
        allEntries = raw.filter((e: any) => {
          const caMatch = String(e.position_id).match(/^college_admin_(\d+)$/);
          if (caMatch) {
            return collegeIds.includes(parseInt(caMatch[1]));
          }
          const lrMatch = String(e.position_id).match(/^level_rep_(\d+)_(\d+)$/);
          if (lrMatch) {
            return specIds.has(parseInt(lrMatch[1]));
          }
          return false;
        });
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    }

    // طبقة الفلترة (all / assign / revoke)
    const filter = session.audit_log_filter || "all";
    if (filter !== "all") {
      allEntries = allEntries.filter((e: any) => e.action === filter);
    }

    // ترقيم الصفحات (15 لكل صفحة)
    const perPage = 15;
    const totalPages = Math.max(1, Math.ceil(allEntries.length / perPage));
    const currentPage = Math.min(
      Math.max(1, session.audit_log_page || 1),
      totalPages
    );
    const startIdx = (currentPage - 1) * perPage;
    const pageEntries = allEntries.slice(startIdx, startIdx + perPage);

    // بناء الرسالة
    if (allEntries.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.audit_log_empty, {
        reply_markup: buildAuditLogKeyboard(filter, currentPage, totalPages),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = ADMIN_TEXTS.positions.audit_log_title(allEntries.length);
    if (totalPages > 1) {
      msg += ADMIN_TEXTS.positions.audit_log_page(currentPage, totalPages) + "\n\n";
    }

    for (const e of pageEntries) {
      const actionIcon = e.action === "assign" ? "➕" : "❌";
      const newPos = await getPositionById(supabase, e.position_id);
      const posTitle = newPos?.title || e.position_id;
      const newUserName = e.new_holder_id
        ? (await getAdminUser(supabase, e.new_holder_id))?.first_name ||
          String(e.new_holder_id)
        : "—";
      const oldUserName = e.old_holder_id
        ? (await getAdminUser(supabase, e.old_holder_id))?.first_name ||
          String(e.old_holder_id)
        : "—";
      const performedByUser = e.performed_by
        ? (await getAdminUser(supabase, e.performed_by))?.first_name ||
          String(e.performed_by)
        : "—";
      const ts = new Date(e.performed_at).toLocaleString("ar-EG", {
        dateStyle: "short",
        timeStyle: "short",
      });
      msg += ADMIN_TEXTS.positions.audit_log_entry({
        actionIcon,
        posTitle,
        oldName: oldUserName,
        newName: newUserName,
        performedBy: performedByUser,
        timestamp: ts,
      });
    }

    await ctx.editMessageText(msg, {
      reply_markup: buildAuditLogKeyboard(filter, currentPage, totalPages),
      parse_mode: "Markdown",
    });
  }

  // بناء لوحة أزرار سجل التعيينات (فلاتر + ترقيم + رجوع)
  function buildAuditLogKeyboard(
    filter: string,
    currentPage: number,
    totalPages: number
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    // صف الفلاتر — الفعّال مُعلَّم بـ ✅
    const allLabel =
      (filter === "all" ? "✅ " : "") + ADMIN_TEXTS.positions.audit_log_filter_all;
    const assignLabel =
      (filter === "assign" ? "✅ " : "") +
      ADMIN_TEXTS.positions.audit_log_filter_assign;
    const revokeLabel =
      (filter === "revoke" ? "✅ " : "") +
      ADMIN_TEXTS.positions.audit_log_filter_revoke;
    kb.text(allLabel, "audit_log_filter_all")
      .text(assignLabel, "audit_log_filter_assign")
      .text(revokeLabel, "audit_log_filter_revoke")
      .row();

    // صف الترقيم (سابق/تالي) لو كان هناك أكثر من صفحة
    if (totalPages > 1) {
      if (currentPage > 1) {
        kb.text(
          ADMIN_TEXTS.positions.btn_prev_page,
          `audit_log_page_${currentPage - 1}`
        );
      }
      if (currentPage < totalPages) {
        kb.text(
          ADMIN_TEXTS.positions.btn_next_page,
          `audit_log_page_${currentPage + 1}`
        );
      }
      kb.row();
    }

    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");
    return kb;
  }

  // =====================================================
  // 13) نظام دعوات المسؤولين (Admin Invitations)
  // =====================================================
  // تدفق بديل لإدخال Telegram ID: يُنشئ دعوة برابط t.me يحمل token
  // المستلم يفتح الرابط فيبدأ /start invite_<token> فيُسجَّل كمسؤول تلقائياً.
  //
  // Handlers:
  //   - invite_admin                            → اختيار نوع المسؤول
  //   - invite_role_central                     → طلب اسم → (messages.ts) إنشاء دعوة
  //   - invite_role_college                     → اختيار كلية
  //   - invite_role_college_{collegeId}         → طلب اسم
  //   - invite_role_level                       → اختيار كلية
  //   - invite_role_level_college_{collegeId}   → اختيار تخصص
  //   - invite_role_level_spec_{specId}         → اختيار مستوى
  //   - invite_role_level_lvl_{specId}_{level}  → طلب اسم
  //   - invite_list                             → عرض الدعوات المعلّقة
  //   - invite_revoke_{invitationId}            → إلغاء دعوة
  //   - cancel_invite                           → إلغاء تدفق الاسم
  // =====================================================

  // ---- Helper: بناء رابط الدعوة ----
  function buildInviteLink(token: string): string {
    return `https://t.me/usttesteradminbot?start=invite_${token}`;
  }

  // ---- Helper: صياغة تسمية الدور ----
  function formatRoleLabel(role: "central" | "college" | "level"): string {
    switch (role) {
      case "central":
        return "🛡 مسؤول مركزي";
      case "college":
        return "🏛 مسؤول كلية";
      case "level":
        return "📊 مندوب مستوى";
      default:
        return role;
    }
  }

  // ---- Helper: صياغة نطاق الدعوة (كلية/تخصص/مستوى) ----
  function formatScopeLabel(inv: any): string {
    if (inv.role === "central") return "";
    if (inv.role === "college" && inv.college_id) {
      const c = getCollegeById(inv.college_id);
      return c ? `📍 ${c.name}` : "";
    }
    if (inv.role === "level" && inv.specialty_id && inv.level_num) {
      const s = getSpecialtyById(inv.specialty_id);
      const c = s ? getCollegeById(s.college_id) : null;
      const parts: string[] = [];
      if (c) parts.push(c.short_name);
      if (s) parts.push(s.short_name);
      parts.push(`المستوى ${inv.level_num}`);
      return `📍 ${parts.join(" / ")}`;
    }
    return "";
  }

  // ---- invite_admin: اختيار نوع المسؤول ----
  bot.callbackQuery("invite_admin", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard()
      .text("🛡 مسؤول مركزي", "invite_role_central")
      .row()
      .text("🏛 مسؤول كلية", "invite_role_college")
      .row()
      .text("📊 مندوب مستوى", "invite_role_level")
      .row()
      .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(
      "🎟️ *إنشاء دعوة مسؤول جديد*\n\nاختر نوع المسؤول المراد دعوته:\n\n⏳ الدعوة صالحة لمدة 7 أيام.",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ---- invite_role_central: طلب اسم المسؤول المركزي ----
  bot.callbackQuery("invite_role_central", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_invite_name = true;
    session.awaiting_invite_context = { role: "central" };
    await saveSession(session);

    await ctx.editMessageText(
      "🛡 *دعوة مسؤول مركزي*\n\nأرسل اسم المسؤول (سيظهر داخل النظام):",
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_invite"),
        parse_mode: "Markdown",
      }
    );
  });

  // ---- invite_role_college: عرض قائمة الكليات ----
  bot.callbackQuery("invite_role_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const college of COLLEGES) {
      kb.text(
        `${college.emoji} ${college.short_name}`,
        `invite_role_college_${college.id}`
      ).row();
    }
    kb.text("🔙 اختيار النوع", "invite_admin").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(
      "🏛 *دعوة مسؤول كلية*\n\nاختر الكلية:",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ---- invite_role_college_{collegeId}: طلب اسم مسؤول الكلية ----
  bot.callbackQuery(/^invite_role_college_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const college = getCollegeById(collegeId);
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_invite_name = true;
    session.awaiting_invite_context = { role: "college", college_id: collegeId };
    await saveSession(session);

    await ctx.editMessageText(
      `🏛 *دعوة مسؤول كلية ${college.name}*\n\nأرسل اسم المسؤول:`,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_invite"),
        parse_mode: "Markdown",
      }
    );
  });

  // ---- invite_role_level: عرض قائمة الكليات (للمندوب) ----
  bot.callbackQuery("invite_role_level", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const college of COLLEGES) {
      kb.text(
        `${college.emoji} ${college.short_name}`,
        `invite_role_level_college_${college.id}`
      ).row();
    }
    kb.text("🔙 اختيار النوع", "invite_admin").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(
      "📊 *دعوة مندوب مستوى*\n\nاختر الكلية أولاً:",
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ---- invite_role_level_college_{collegeId}: عرض تخصصات الكلية ----
  bot.callbackQuery(/^invite_role_level_college_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const college = getCollegeById(collegeId);
    if (!college) {
      await ctx.reply("⚠️ الكلية غير موجودة.");
      return;
    }

    const specialties = getSpecialtiesByCollege(collegeId);
    if (specialties.length === 0) {
      await ctx.editMessageText("⚠️ لا توجد تخصصات في هذه الكلية.", {
        reply_markup: new InlineKeyboard().text(
          "🔙 الكليات",
          "invite_role_level"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const spec of specialties) {
      kb.text(
        `📚 ${spec.short_name}`,
        `invite_role_level_spec_${spec.id}`
      ).row();
    }
    kb.text("🔙 الكليات", "invite_role_level").row();
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(
      `📚 *مندوب مستوى — ${college.name}*\n\nاختر التخصص:`,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ---- invite_role_level_spec_{specId}: عرض مستويات التخصص ----
  bot.callbackQuery(/^invite_role_level_spec_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    const kb = new InlineKeyboard();
    for (let lvl = 1; lvl <= spec.levels_count; lvl++) {
      kb.text(
        `📊 المستوى ${lvl}`,
        `invite_role_level_lvl_${specId}_${lvl}`
      ).row();
    }
    kb.text("🔙 التخصصات", `invite_role_level_college_${spec.college_id}`).row();
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(
      `📊 *مندوب مستوى — ${spec.short_name}*\n\nاختر المستوى:`,
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ---- invite_role_level_lvl_{specId}_{levelNum}: طلب اسم المندوب ----
  bot.callbackQuery(/^invite_role_level_lvl_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.reply("⚠️ التخصص غير موجود.");
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_invite_name = true;
    session.awaiting_invite_context = {
      role: "level",
      college_id: spec.college_id,
      specialty_id: specId,
      level_num: levelNum,
    };
    await saveSession(session);

    await ctx.editMessageText(
      `📊 *دعوة مندوب مستوى*\n\n📍 ${spec.short_name} — المستوى ${levelNum}\n\nأرسل اسم المندوب:`,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_invite"),
        parse_mode: "Markdown",
      }
    );
  });

  // ---- invite_list: عرض الدعوات المعلّقة ----
  bot.callbackQuery("invite_list", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let invitations: any[] = [];
    try {
      invitations = await getPendingInvitations(supabase);
    } catch (e) {
      console.error("Failed to load pending invitations:", e);
    }

    if (invitations.length === 0) {
      await ctx.editMessageText(
        "📋 *الدعوات المعلّقة*\n\nلا توجد دعوات معلّقة حالياً.",
        {
          reply_markup: new InlineKeyboard()
            .text("➕ دعوة مسؤول جديد", "invite_admin")
            .row()
            .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    let msg = `📋 *الدعوات المعلّقة (${invitations.length})*\n\n`;
    const kb = new InlineKeyboard();
    for (const inv of invitations) {
      const roleLabel = formatRoleLabel(inv.role);
      const scopeLabel = formatScopeLabel(inv);
      const name = inv.custom_name || "—";
      const link = buildInviteLink(inv.token);
      const expires = inv.expires_at
        ? new Date(inv.expires_at).toLocaleDateString("ar-EG")
        : "—";
      msg +=
        `🎟️ *${roleLabel}*` +
        (scopeLabel ? ` — ${scopeLabel}` : "") +
        `\n👤 ${name}\n🔗 \`${link}\`\n⏳ ينتهي: ${expires}\n\n`;
      kb.url("🔗 فتح", link).text("❌ إلغاء", `invite_revoke_${inv.id}`).row();
    }
    kb.text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins");

    await ctx.editMessageText(msg, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ---- invite_revoke_{invitationId}: إلغاء دعوة معلّقة ----
  bot.callbackQuery(/^invite_revoke_(\d+)$/, async (ctx) => {
    const invitationId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_admins")) {
      await ctx.editMessageText(ADMIN_TEXTS.positions.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_manage_admins,
          "manage_admins"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    let ok = false;
    try {
      ok = await revokeInvitation(supabase, invitationId);
    } catch (e) {
      console.error("revokeInvitation failed:", e);
    }

    if (!ok) {
      await ctx.reply("⚠️ فشل إلغاء الدعوة. ربما تم استخدامها أو إلغاؤها مسبقاً.");
      return;
    }

    await ctx.editMessageText(
      "✅ *تم إلغاء الدعوة بنجاح.*\n\nلم يعد الرابط صالحاً للاستخدام.",
      {
        reply_markup: new InlineKeyboard()
          .text("📋 الدعوات المعلّقة", "invite_list")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins"),
        parse_mode: "Markdown",
      }
    );
  });

  // ---- cancel_invite: إلغاء تدفق إدخال الاسم ----
  bot.callbackQuery("cancel_invite", async (ctx) => {
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    await ctx.answerCallbackQuery();
    session.awaiting_invite_name = undefined;
    session.awaiting_invite_context = undefined;
    await saveSession(session);

    await ctx.editMessageText("❌ *تم إلغاء إنشاء الدعوة.*", {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.navigation.back_to_manage_admins, "manage_admins")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });
}
