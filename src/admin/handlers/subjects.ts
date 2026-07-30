// ============================================
// 📖 Subjects Handlers — إدارة المواد
// ============================================
// هذا الملف يحتوي على:
//   - subjects_mgmt (القائمة الرئيسية للمواد)
//   - add_subject (إضافة مادة جديدة)
//   - list_subjects (استعراض المواد)
//   - edit_subject (تعديل/حذف مادة)
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import {
  SUBJECTS,
  getSubjectById,
  getSubjectsBySpecialtyLevelSemester,
} from "../../shared/data/subjects";
import { getOrCreateSession, saveSession } from "../state";

export function registerSubjectHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ====== A6: إدارة المواد ======
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
          .text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });

  bot.callbackQuery("add_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_subject_add = true;
    await ctx.editMessageText(ADMIN_TEXTS.subjects_mgmt.add_prompt, {
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
      reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("edit_subject", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "✏️ *تعديل/حذف مادة*\n\nاختر التخصص أولاً (محاكاة - متاح كاملاً في الإنتاج):",
      {
        reply_markup: new InlineKeyboard().text(ADMIN_TEXTS.navigation.back_to_dashboard, "back_to_dashboard"),
        parse_mode: "Markdown",
      }
    );
  });
}
