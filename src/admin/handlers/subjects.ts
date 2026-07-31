// ============================================
// 📖 Subjects Handlers — إدارة المواد + النظام الأكاديمي
// ============================================
// هذا الملف يحتوي على:
//   - academic_mgmt (القائمة الرئيسية للنظام الأكاديمي)
//   - subjects_mgmt (قائمة إدارة المواد — ستُعاد كتابتها لاحقاً)
//   - add_subject (stub — سيُستبدل لاحقاً)
//   - list_subjects (stub — سيُستبدل لاحقاً)
//   - edit_subject (stub — سيُستبدل لاحقاً)
//   - academic_coming_soon (للأقسام قيد التطوير)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import {
  SUBJECTS,
} from "../../shared/data/subjects";
import { getOrCreateSession, saveSession } from "../state";

export function registerSubjectHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== القائمة الرئيسية للنظام الأكاديمي ======
  bot.callbackQuery("academic_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    const p = perms.permissions;

    const kb = new InlineKeyboard();

    // 📚 إدارة المواد — لمن يملك manage_subjects
    if (p.has("manage_subjects")) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_subjects, "subjects_mgmt").row();
    }

    // 🔗 روابط اللجان — لمن يملك manage_committee_channels
    if (p.has("manage_committee_channels")) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_channels, "manage_channels").row();
    }

    // الأقسام التالية قيد التطوير (للمركزي فقط حالياً)
    if (perms.is_central) {
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_colleges, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_specialties, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_study_systems, "academic_coming_soon").row();
      kb.text(ADMIN_TEXTS.academic_mgmt.btn_academic_plans, "academic_coming_soon").row();
    }

    kb.text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard");

    await ctx.editMessageText(ADMIN_TEXTS.academic_mgmt.title, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
  });

  // ====== أقسام قيد التطوير ======
  bot.callbackQuery("academic_coming_soon", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.academic_mgmt.coming_soon,
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_academic,
          "academic_mgmt"
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== قائمة إدارة المواد (stub — ستُعاد كتابتها في المرحلة 4) ======
  bot.callbackQuery("subjects_mgmt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      ADMIN_TEXTS.subjects_mgmt.title,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.subjects_mgmt.btn_add, "add_subject")
          .text(ADMIN_TEXTS.subjects_mgmt.btn_list, "list_subjects")
          .row()
          .text(ADMIN_TEXTS.subjects_mgmt.btn_edit, "edit_subject")
          .row()
          .text(ADMIN_TEXTS.navigation.back_to_academic, "academic_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_add = true;
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_academic,
        "academic_mgmt"
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("list_subjects", async (ctx) => {
    await ctx.answerCallbackQuery();
    let msg = ADMIN_TEXTS.subjects_mgmt.list_header(SUBJECTS.length);
    SUBJECTS.slice(0, 10).forEach((s) => {
      msg += `📖 ${s.name} (مستوى ${s.level}, فصل ${s.semester})\n`;
    });
    msg += `\n📋 عرض أول 10 مواد من ${SUBJECTS.length}.`;
    await ctx.editMessageText(msg, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_academic,
        "academic_mgmt"
      ),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("edit_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "✏️ *تعديل/حذف مادة*\n\n_سيتم تفعيل هذه الميزة قريباً._",
      {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_academic,
          "academic_mgmt"
        ),
        parse_mode: "Markdown",
      }
    );
  });
}
