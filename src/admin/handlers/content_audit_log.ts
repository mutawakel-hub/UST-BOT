// ============================================
// 📝 Content Audit Log Handler (المرحلة 3)
// ============================================
// هذا الملف يحتوي على:
//   - content_audit_log: عرض قائمة الفلاتر + العدد الإجمالي
//   - cal_filter_<filter>: ضبط الفلتر وعرض الصفحة 1
//   - cal_page_<page>: عرض صفحة معينة
//
// الفلاتر المتاحة:
//   - all (الكل)
//   - create (الإضافات)
//   - update (التعديلات)
//   - move (النقل)
//   - copy (النسخ)
//   - delete (الحذف)
//   - import (الاستيراد)
//
// الترقيم: 10 عمليات لكل صفحة
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminUser, getPositionById } from "../helpers";

const PAGE_SIZE = 10;

// خريطة الأيقونات والتسميات لكل نوع عملية
const ACTION_META: Record<string, { icon: string; label: string }> = {
  create:  { icon: "➕", label: "إضافة" },
  update:  { icon: "✏️", label: "تعديل" },
  move:    { icon: "📂", label: "نقل" },
  copy:    { icon: "📋", label: "نسخ" },
  delete:  { icon: "🗑", label: "حذف" },
  import:  { icon: "📥", label: "استيراد" },
  star:    { icon: "⭐", label: "تمييز" },
  unstar:  { icon: "☆", label: "إلغاء تمييز" },
};

// تسمية الفلتر للعرض
const FILTER_LABELS: Record<string, string> = {
  all: "الكل",
  create: "الإضافات",
  update: "التعديلات",
  move: "النقل",
  copy: "النسخ",
  delete: "الحذف",
  import: "الاستيراد",
};

export function registerContentAuditLogHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // عرض قائمة الفلاتر + العدد الإجمالي
  // ============================================
  bot.callbackQuery("content_audit_log", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);

    // عدد العمليات الإجمالي
    let totalCount = 0;
    try {
      const result = await supabase.select("content_audit_logs", {
        columns: "id",
        limit: 1000,
      });
      totalCount = Array.isArray(result) ? result.length : 0;
    } catch (e) {
      console.error("Audit log count error:", e);
    }

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_all, "cal_filter_all")
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_create, "cal_filter_create")
      .row()
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_update, "cal_filter_update")
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_move, "cal_filter_move")
      .row()
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_copy, "cal_filter_copy")
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_delete, "cal_filter_delete")
      .row()
      .text(ADMIN_TEXTS.content_audit_log.btn_filter_import, "cal_filter_import")
      .row()
      .text("🔙 إدارة المحتوى", "content_mgmt");

    await ctx.editMessageText(
      ADMIN_TEXTS.content_audit_log.title(totalCount),
      { reply_markup: kb, parse_mode: "Markdown" }
    );
  });

  // ============================================
  // ضبط الفلتر وعرض الصفحة 1
  // ============================================
  bot.callbackQuery(/cal_filter_(\w+)/, async (ctx) => {
    const filter = ctx.match[1];
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.content_audit_filter = filter as any;
    session.content_audit_page = 1;
    await saveSession(session);

    await showAuditLogPage(bot, supabase, ctx, filter, 1);
  });

  // ============================================
  // التنقل بين الصفحات
  // ============================================
  bot.callbackQuery(/cal_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const filter = session.content_audit_filter || "all";
    session.content_audit_page = page;
    await saveSession(session);

    await showAuditLogPage(bot, supabase, ctx, filter, page);
  });
}

// ============================================
// Helper: عرض صفحة من السجل
// ============================================
async function showAuditLogPage(
  bot: Bot,
  supabase: SupabaseClient,
  ctx: any,
  filter: string,
  page: number
): Promise<void> {
  // بناء الفلتر
  const dbFilter = filter === "all" ? undefined : `action=eq.${filter}`;

  // جلب العدد الإجمالي للفلتر الحالي
  let totalCount = 0;
  try {
    const countResult = await supabase.select("content_audit_logs", {
      columns: "id",
      filter: dbFilter,
      limit: 10000,
    });
    totalCount = Array.isArray(countResult) ? countResult.length : 0;
  } catch (e) {
    console.error("Audit log count error:", e);
  }

  if (totalCount === 0) {
    await ctx.editMessageText(
      ADMIN_TEXTS.content_audit_log.empty,
      {
        reply_markup: new InlineKeyboard()
          .text("🔙 الفلاتر", "content_audit_log"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  // جلب العمليات لهذه الصفحة
  let entries: any[] = [];
  try {
    const result = await supabase.select("content_audit_logs", {
      columns: "id,content_id,action,old_data,new_data,performed_by_position_id,performed_by_telegram_id,performed_at",
      filter: dbFilter,
      order: "performed_at.desc",
      limit: PAGE_SIZE,
      offset,
    });
    entries = Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("Audit log fetch error:", e);
  }

  // بناء رسالة السجل
  const filterLabel = FILTER_LABELS[filter] || filter;
  let msg = ADMIN_TEXTS.content_audit_log.entries_title(filterLabel, totalCount);

  // جلب أسماء المنفّذين + عناوين المحتوى دفعة واحدة
  const performerIds = [...new Set(entries.map((e) => e.performed_by_telegram_id).filter(Boolean))];
  const positionIds = [...new Set(entries.map((e) => e.performed_by_position_id).filter(Boolean))];
  const contentIds = [...new Set(entries.map((e) => e.content_id).filter(Boolean))];

  // جلب أسماء المنفّذين
  const performerNames: Record<number, string> = {};
  for (const tid of performerIds) {
    try {
      const user = await getAdminUser(supabase, tid);
      if (user) {
        performerNames[tid] = user.display_name || user.first_name || `مستخدم ${tid}`;
      }
    } catch {
      performerNames[tid] = `مستخدم ${tid}`;
    }
  }

  // جلب عناوين المناصب
  const positionTitles: Record<string, string> = {};
  for (const pid of positionIds) {
    try {
      const pos = await getPositionById(supabase, pid);
      positionTitles[pid] = pos?.title || pid;
    } catch {
      positionTitles[pid] = pid;
    }
  }

  // جلب عناوين المحتوى (من new_data أو old_data لو المحتوى محذوف)
  const contentTitles: Record<number, string> = {};
  for (const cid of contentIds) {
    // جرّب DB أولاً
    try {
      const result = await supabase.select("content", {
        columns: "id,title",
        filter: `id=eq.${cid}`,
        single: true,
      }) as any;
      const content = Array.isArray(result) ? result[0] : result;
      if (content?.title) {
        contentTitles[cid] = content.title;
        continue;
      }
    } catch {
      // محتوى محذوف — استخرج من old_data
    }
    // استخرج من new_data أو old_data
    const entry = entries.find((e) => e.content_id === cid);
    const titleFromData =
      entry?.new_data?.title ||
      entry?.old_data?.title ||
      entry?.new_data?.file_name ||
      entry?.old_data?.file_name ||
      `محتوى #${cid}`;
    contentTitles[cid] = titleFromData;
  }

  // بناء مدخلات السجل
  for (const e of entries) {
    const meta = ACTION_META[e.action] || { icon: "•", label: e.action };
    const performerName = performerNames[e.performed_by_telegram_id] || "غير معروف";
    const positionTitle = positionTitles[e.performed_by_position_id] || "منصب غير معروف";
    const contentTitle = e.content_id ? (contentTitles[e.content_id] || `محتوى #${e.content_id}`) : "—";

    msg += ADMIN_TEXTS.content_audit_log.entry({
      action_icon: meta.icon,
      action_label: meta.label,
      content_title: contentTitle,
      performer_name: performerName,
      position_title: positionTitle,
      timestamp: formatDate(e.performed_at),
    });
  }

  // أزرار الترقيم
  const kb = new InlineKeyboard();
  if (page > 1) {
    kb.text(ADMIN_TEXTS.content_audit_log.btn_prev_page, `cal_page_${page - 1}`);
  }
  if (page < totalPages) {
    kb.text(ADMIN_TEXTS.content_audit_log.btn_next_page, `cal_page_${page + 1}`);
  }
  kb.row()
    .text(ADMIN_TEXTS.content_audit_log.btn_back_to_filters, "content_audit_log");

  msg += `\n${ADMIN_TEXTS.content_audit_log.page_info(page, totalPages)}`;

  await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
}

// تنسيق التاريخ
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
