// ============================================
// 🔍📊 Content Search & Stats Handlers (المرحلة 4)
// ============================================
// هذا الملف يحتوي على:
//   - search_content: بدء وضع البحث
//   - cancel_search: إلغاء البحث
//   - (استقبال النص في messages.ts عند awaiting_content_search=true)
//   - content_stats: عرض الإحصائيات
//
// البحث:
//   - يبحث في title + file_name
//   - النطاق: ضمن صلاحيات المسؤول (getManageableContent)
//   - النتائج: 20 كحد أقصى
//   - كل نتيجة زر يفتح content_detail_<id>
//
// الإحصائيات:
//   - إجمالي المحتوى
//   - توزيع حسب النوع (مع نسبة مئوية)
//   - أكثر 5 ملفات تحميلاً
//   - عدد المواد التي تحتوي على محتوى / إجمالي المواد
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions, getManageableContent } from "../../shared/rbac";
import {
  CONTENT_TYPES,
  getContentTypeLabel,
  getContentTypeEmoji,
} from "../../shared/data/admins";
import { getSubjectById } from "../../shared/data/subjects";
import { getCollegeById, COLLEGES } from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";

// ============================================
// Helper: الحصول على scope college_ids + scope label
// ============================================
function getAdminCollegeIds(perms: any): number[] {
  if (perms.is_central) {
    return COLLEGES.map((c) => c.id);
  }
  const colleges = perms.effective_scope?.colleges;
  if (!colleges) return [];
  return Array.isArray(colleges) ? colleges : Array.from(colleges);
}

async function getScopeLabel(perms: any): Promise<string> {
  if (perms.is_central) return "🌍 كل الكليات";
  const collegeIds = getAdminCollegeIds(perms);
  if (collegeIds.length > 0) {
    const colleges = collegeIds.map((id: number) => getCollegeById(id)?.short_name).filter(Boolean);
    if (colleges.length > 0) return `🏛 ${colleges.join("، ")}`;
  }
  return "📍 نطاقك";
}

export function registerContentSearchStatsHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // 🔍 البحث عن محتوى
  // ============================================

  // بدء وضع البحث
  bot.callbackQuery("search_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_search = true;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_search.prompt,
      {
        reply_markup: new InlineKeyboard().text("❌ إلغاء", "cancel_content_search"),
        parse_mode: "Markdown",
      }
    );
  });

  // إلغاء البحث
  bot.callbackQuery("cancel_content_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_content_search = false;
    await saveSession(session);

    await ctx.editMessageText(
      ADMIN_TEXTS.content_search.canceled,
      {
        reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 📊 إحصائيات المحتوى
  // ============================================
  bot.callbackQuery("content_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    const scopeLabel = await getScopeLabel(perms);

    // جلب كل المحتوى ضمن النطاق
    const allContent = await getManageableContent(ctx.from.id);
    if (allContent.length === 0) {
      await ctx.editMessageText(
        ADMIN_TEXTS.content_stats.empty,
        {
          reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    // إحمالي المحتوى + التحميلات
    const totalContent = allContent.length;
    const totalDownloads = allContent.reduce((sum: number, c: any) => sum + (c.download_count || 0), 0);

    // عدد المواد الفريدة التي تحتوي على محتوى
    const subjectIdsWithContent = new Set(allContent.map((c: any) => c.subject_id));
    const subjectsWithContent = subjectIdsWithContent.size;

    // إجمالي المواد ضمن النطاق
    let totalSubjects = 0;
    try {
      if (perms.is_central) {
        const result = await supabase.select("subjects", { columns: "id" });
        totalSubjects = Array.isArray(result) ? result.length : 0;
      } else {
        const collegeIds = getAdminCollegeIds(perms);
        // subjects → specialties → colleges
        // PostgREST: filter specialty_id=in.(...) — نحتاج specialty_ids للكليات
        // الأبسط: نعدّ كل subjects ثم نفلتر يدوياً
        const allSubjects = await supabase.select("subjects", {
          columns: "id,specialty_id",
          limit: 1000,
        });
        if (Array.isArray(allSubjects)) {
          // جلب specialty_ids للكليات
          const specs = await supabase.select("specialties", {
            columns: "id,college_id",
            limit: 100,
          });
          const validSpecIds = new Set(
            (Array.isArray(specs) ? specs : [])
              .filter((s: any) => collegeIds.includes(s.college_id))
              .map((s: any) => s.id)
          );
          totalSubjects = allSubjects.filter((s: any) => validSpecIds.has(s.specialty_id)).length;
        }
      }
    } catch (e) {
      console.error("Subjects count error:", e);
    }

    // توزيع حسب النوع
    const typeCounts: Record<string, number> = {};
    allContent.forEach((c: any) => {
      const t = c.content_type || c.content_type_id;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    // بناء رسالة الإحصائيات
    let msg = ADMIN_TEXTS.content_stats.title(scopeLabel);
    msg += ADMIN_TEXTS.content_stats.summary({
      total_content: totalContent,
      total_downloads: totalDownloads,
      subjects_with_content: subjectsWithContent,
      total_subjects: totalSubjects || subjectsWithContent,
    });

    // توزيع الأنواع
    msg += ADMIN_TEXTS.content_stats.by_type_header;
    for (const t of CONTENT_TYPES) {
      const count = typeCounts[t.id] || 0;
      if (count > 0) {
        const percentage = Math.round((count / totalContent) * 100);
        msg += ADMIN_TEXTS.content_stats.by_type_entry(t.emoji, t.name, count, percentage);
      }
    }

    // أكثر 5 ملفات تحميلاً
    const topDownloaded = [...allContent]
      .sort((a: any, b: any) => (b.download_count || 0) - (a.download_count || 0))
      .slice(0, 5);
    if (topDownloaded.length > 0) {
      msg += ADMIN_TEXTS.content_stats.top_downloaded_header(5);
      topDownloaded.forEach((c: any, idx: number) => {
        const subjectName = getSubjectById(c.subject_id)?.name || "غير معروف";
        msg += ADMIN_TEXTS.content_stats.top_downloaded_entry(
          idx + 1,
          c.title?.substring(0, 40) || "بدون عنوان",
          c.download_count || 0,
          subjectName
        );
      });
    }

    const kb = new InlineKeyboard()
      .text(ADMIN_TEXTS.content_stats.btn_refresh, "content_stats")
      .row()
      .text("🔙 إدارة المحتوى", "content_mgmt");

    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });
}

// ============================================
// Helper: تنفيذ البحث (يُستدعى من messages.ts)
// ============================================
export async function executeContentSearch(
  supabase: SupabaseClient,
  ctx: any,
  query: string
): Promise<void> {
  const perms = await getUserPermissions(ctx.from.id);
  const collegeIds = getAdminCollegeIds(perms);

  // البحث في title + file_name عبر ilike
  // نحتاج فلتر college_id عبر subjects → specialties
  // الأبسط: نأخذ كل المحتوى ضمن النطاق (getManageableContent) ثم نفلتر يدوياً
  const allContent = await getManageableContent(ctx.from.id);
  const q = query.trim().toLowerCase();

  const results = allContent.filter((c: any) => {
    const title = (c.title || "").toLowerCase();
    const fileName = (c.file_name || "").toLowerCase();
    return title.includes(q) || fileName.includes(q);
  });

  if (results.length === 0) {
    await ctx.reply(
      ADMIN_TEXTS.content_search.no_results,
      {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.content_search.btn_new_search, "search_content")
          .row()
          .text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const limitedResults = results.slice(0, 20);
  const kb = new InlineKeyboard();
  limitedResults.forEach((c: any) => {
    const icon = c.is_starred ? "⭐" : "📄";
    const title = (c.title || c.file_name || "ملف").substring(0, 35);
    kb.text(`${icon} ${title} (${c.download_count || 0}⬇️)`, `content_detail_${c.id}`).row();
  });
  kb.text(ADMIN_TEXTS.content_search.btn_new_search, "search_content")
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.reply(
    ADMIN_TEXTS.content_search.results_header(results.length),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}
