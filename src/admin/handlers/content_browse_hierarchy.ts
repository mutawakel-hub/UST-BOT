// ============================================
// 📂 Content Browse Hierarchy Handler (المرحلة 5)
// ============================================
// استعراض المحتوى بشكل هرمي:
//   كلية → تخصص → مستوى → مادة → محتوى
//
// التزام RBAC:
//   - مسؤول مركزي: يبدأ من الكليات
//   - مسؤول كلية: يتخطّى الكلية (تُؤخذ من صلاحياته)، يبدأ من التخصصات
//   - مسؤول مستوى: يتخطّى الكلية + التخصص + المستوى (لو مستوى واحد)، يبدأ من المواد
//
// الأداء:
//   - استعلام واحد يجلب كل المحتوى ضمن النطاق
//   - تجميع client-side في Map<collegeId, Map<specId, Map<level, Map<subjectId, content[]>>>>
//   - عرض الأعداد في كل زر
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import { SupabaseClient } from "../../shared/db";
import { getUserPermissions } from "../../shared/rbac";
import { getSubjectById } from "../../shared/data/subjects";
import { getSpecialtyById, getCollegeById, COLLEGES, getSpecialtiesByCollege } from "../../shared/data/colleges";
import { getOrCreateSession, saveSession } from "../state";
import { getContentTypeEmoji } from "../../shared/data/admins";

// ============================================
// Helper: الحصول على scope college_ids للمسؤول
// ============================================
function getAdminCollegeIds(perms: any): number[] {
  if (perms.is_central) {
    return COLLEGES.map((c) => c.id);
  }
  const colleges = perms.effective_scope?.colleges;
  if (!colleges) return [];
  return Array.isArray(colleges) ? colleges : Array.from(colleges);
}

// ============================================
// Helper: الحصول على scope label
// ============================================
function getScopeLabel(perms: any): string {
  if (perms.is_central) return "🌍 كل الكليات";
  const collegeIds = getAdminCollegeIds(perms);
  if (collegeIds.length > 0) {
    const colleges = collegeIds.map((id) => getCollegeById(id)?.short_name).filter(Boolean);
    if (colleges.length > 0) return `🏛 ${colleges.join("، ")}`;
  }
  return "📍 نطاقك";
}

// ============================================
// Helper: جلب كل المحتوى ضمن النطاق + بيانات المادة/التخصص/الكلية
// ============================================
// نحتاج: content + subjects(specialty_id, level, semester, name) + specialties(college_id, name)
// PostgREST resource embedding يدعم هذا عبر:
//   /content?select=id,title,content_type_id,subject_id,is_starred,download_count,subjects(specialty_id,level,name,specialties(college_id,name))&is_active=eq.true
//
// لكن للبساطة + الأمان (قد لا يدعم PostgREST embedding في كل إصدارات Supabase):
// نجلب content + subjects + specialties في 3 استعلامات ونجمّع client-side
// ============================================
interface ContentItem {
  id: number;
  title: string;
  file_name?: string;
  content_type_id: string;
  subject_id: number;
  is_starred: boolean;
  download_count: number;
  // من JOIN يدوي:
  subject_name?: string;
  specialty_id?: number;
  specialty_name?: string;
  level?: number;
  college_id?: number;
  college_name?: string;
}

async function fetchManageableContentWithHierarchy(
  supabase: SupabaseClient,
  telegramId: number,
  perms: any
): Promise<ContentItem[]> {
  const collegeIds = getAdminCollegeIds(perms);
  if (collegeIds.length === 0) return [];

  // 1. اجلب specialty_ids للكليات
  let specIds: number[] = [];
  try {
    const specs = await supabase.select("specialties", {
      columns: "id,college_id,name",
      filter: `college_id=in.(${collegeIds.join(",")})`,
      limit: 200,
    });
    specIds = (Array.isArray(specs) ? specs : []).map((s: any) => s.id);
    if (specIds.length === 0) return [];

    // خزّن بيانات التخصصات للاستخدام لاحقاً
    const specsMap = new Map<number, { college_id: number; name: string }>();
    (Array.isArray(specs) ? specs : []).forEach((s: any) => {
      specsMap.set(s.id, { college_id: s.college_id, name: s.name });
    });

    // 2. اجلب subjects للتخصصات
    const subjectsResult = await supabase.select("subjects", {
      columns: "id,specialty_id,level,semester,name",
      filter: `specialty_id=in.(${specIds.join(",")})`,
      limit: 1000,
    });
    const subjects = Array.isArray(subjectsResult) ? subjectsResult : [];
    if (subjects.length === 0) return [];

    const subjectsMap = new Map<number, { specialty_id: number; level: number; semester: number; name: string }>();
    subjects.forEach((s: any) => {
      subjectsMap.set(s.id, {
        specialty_id: s.specialty_id,
        level: s.level,
        semester: s.semester,
        name: s.name,
      });
    });

    // 3. اجلب content لهذه المواد
    const subjectIds = subjects.map((s: any) => s.id);
    if (subjectIds.length === 0) return [];

    const contentResult = await supabase.select("content", {
      columns: "id,title,file_name,content_type_id,subject_id,is_starred,download_count",
      filter: `subject_id=in.(${subjectIds.join(",")})&is_active=eq.true`,
      order: "is_starred.desc,download_count.desc",
      limit: 500,
    });
    const contentItems = Array.isArray(contentResult) ? contentResult : [];

    // 4. ادمج البيانات
    return contentItems.map((c: any): ContentItem => {
      const subj = subjectsMap.get(c.subject_id);
      const spec = subj ? specsMap.get(subj.specialty_id) : undefined;
      const college = spec ? getCollegeById(spec.college_id) : undefined;
      return {
        id: c.id,
        title: c.title || c.file_name || "بدون عنوان",
        file_name: c.file_name,
        content_type_id: c.content_type_id,
        subject_id: c.subject_id,
        is_starred: c.is_starred || false,
        download_count: c.download_count || 0,
        subject_name: subj?.name,
        specialty_id: subj?.specialty_id,
        specialty_name: spec ? getSpecialtyById(subj.specialty_id)?.name : undefined,
        level: subj?.level,
        college_id: spec?.college_id,
        college_name: college?.name,
      };
    });
  } catch (e) {
    console.error("fetchManageableContentWithHierarchy error:", e);
    return [];
  }
}

// ============================================
// Helper: تجميع المحتوى حسب college_id
// ============================================
function groupByCollege(items: ContentItem[]): Map<number, ContentItem[]> {
  const map = new Map<number, ContentItem[]>();
  for (const item of items) {
    if (item.college_id == null) continue;
    if (!map.has(item.college_id)) map.set(item.college_id, []);
    map.get(item.college_id)!.push(item);
  }
  return map;
}

// ============================================
// Helper: تجميع المحتوى حسب specialty_id
// ============================================
function groupBySpecialty(items: ContentItem[]): Map<number, ContentItem[]> {
  const map = new Map<number, ContentItem[]>();
  for (const item of items) {
    if (item.specialty_id == null) continue;
    if (!map.has(item.specialty_id)) map.set(item.specialty_id, []);
    map.get(item.specialty_id)!.push(item);
  }
  return map;
}

// ============================================
// Helper: تجميع المحتوى حسب level
// ============================================
function groupByLevel(items: ContentItem[]): Map<number, ContentItem[]> {
  const map = new Map<number, ContentItem[]>();
  for (const item of items) {
    if (item.level == null) continue;
    if (!map.has(item.level)) map.set(item.level, []);
    map.get(item.level)!.push(item);
  }
  return map;
}

// ============================================
// Helper: تجميع المحتوى حسب subject_id
// ============================================
function groupBySubject(items: ContentItem[]): Map<number, ContentItem[]> {
  const map = new Map<number, ContentItem[]>();
  for (const item of items) {
    if (!map.has(item.subject_id)) map.set(item.subject_id, []);
    map.get(item.subject_id)!.push(item);
  }
  return map;
}

export function registerContentBrowseHierarchyHandlers(bot: Bot, supabase: SupabaseClient): void {
  // ============================================
  // browse_content — نقطة الدخول (تقرر من أين تبدأ حسب الصلاحية)
  // ============================================
  bot.callbackQuery("browse_content", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    const scopeLabel = getScopeLabel(perms);

    // جلب كل المحتوى ضمن النطاق
    let allContent: ContentItem[] = [];
    try {
      allContent = await fetchManageableContentWithHierarchy(supabase, ctx.from.id, perms);
    } catch (e) {
      console.error("browse_content: fetch error:", e);
      await ctx.editMessageText(
        "⚠️ *تعذّر تحميل المحتوى*\n\nحدث خطأ أثناء جلب المحتوى. حاول مرة أخرى لاحقاً.",
        {
          reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    if (allContent.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.browse_content.empty, {
        reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      });
      return;
    }

    // خزّن كل المحتوى في session للتنقّل السريع دون إعادة الاستعلام
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    (session as any).browse_hierarchy_cache = allContent;
    await saveSession(session);

    // === تحديد نقطة البداية حسب الصلاحية ===

    // مسؤول مركزي → اعرض الكليات
    if (perms.is_central) {
      await showCollegesList(ctx, allContent, scopeLabel);
      return;
    }

    // مسؤول كلية → اعرض التخصصات لكليته
    const collegeIds = getAdminCollegeIds(perms);
    if (collegeIds.length === 1) {
      const collegeId = collegeIds[0];
      const collegeContent = allContent.filter((c) => c.college_id === collegeId);
      const college = getCollegeById(collegeId);
      await showSpecialtiesList(ctx, collegeContent, college?.name || "", collegeId);
      return;
    }

    // لو مسؤول كلية بعدة كليات → اعرض الكليات
    if (collegeIds.length > 1) {
      await showCollegesList(ctx, allContent, scopeLabel);
      return;
    }

    // fallback
    await showCollegesList(ctx, allContent, scopeLabel);
  });

  // ============================================
  // اختيار كلية → عرض التخصصات
  // ============================================
  bot.callbackQuery(/br_col_(\d+)/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const allContent: ContentItem[] = (session as any).browse_hierarchy_cache || [];

    // لو cache فارغة، أعد الجلب
    let content = allContent;
    if (content.length === 0) {
      const perms = await getUserPermissions(ctx.from.id);
      content = await fetchManageableContentWithHierarchy(supabase, ctx.from.id, perms);
      (session as any).browse_hierarchy_cache = content;
      await saveSession(session);
    }

    const collegeContent = content.filter((c) => c.college_id === collegeId);
    const college = getCollegeById(collegeId);
    await showSpecialtiesList(ctx, collegeContent, college?.name || "", collegeId);
  });

  // ============================================
  // اختيار تخصص → عرض المستويات
  // ============================================
  bot.callbackQuery(/br_spec_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const allContent: ContentItem[] = (session as any).browse_hierarchy_cache || [];

    const specContent = allContent.filter((c) => c.specialty_id === specId);
    const spec = getSpecialtyById(specId);
    await showLevelsList(ctx, specContent, spec?.name || "", specId);
  });

  // ============================================
  // اختيار مستوى → عرض المواد
  // ============================================
  bot.callbackQuery(/br_lvl_(\d+)_(\d+)/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const level = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const allContent: ContentItem[] = (session as any).browse_hierarchy_cache || [];

    const levelContent = allContent.filter(
      (c) => c.specialty_id === specId && c.level === level
    );
    const spec = getSpecialtyById(specId);
    await showSubjectsList(ctx, levelContent, spec?.name || "", level, specId);
  });

  // ============================================
  // اختيار مادة → عرض المحتوى
  // ============================================
  bot.callbackQuery(/br_subj_(\d+)/, async (ctx) => {
    const subjectId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const allContent: ContentItem[] = (session as any).browse_hierarchy_cache || [];

    const subjectContent = allContent.filter((c) => c.subject_id === subjectId);
    const subject = getSubjectById(subjectId);

    await showFilesList(ctx, subjectContent, subject?.name || "غير معروف", subjectId);
  });

  // ============================================
  // عرض كل المحتوى (مسطّح — خيار بديل)
  // ============================================
  bot.callbackQuery("br_flat", async (ctx) => {
    await ctx.answerCallbackQuery();

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const allContent: ContentItem[] = (session as any).browse_hierarchy_cache || [];

    if (allContent.length === 0) {
      await ctx.editMessageText(ADMIN_TEXTS.browse_content.empty, {
        reply_markup: new InlineKeyboard().text("🔙 إدارة المحتوى", "content_mgmt"),
        parse_mode: "Markdown",
      });
      return;
    }

    let msg = `📂 *كل المحتوى (${allContent.length})*\n\nاختر عنصراً:`;
    const kb = new InlineKeyboard();
    allContent.slice(0, 20).forEach((c) => {
      const icon = c.is_starred ? "⭐" : getContentTypeEmoji(c.content_type_id);
      const title = c.title.substring(0, 30);
      kb.text(`${icon} ${title} (${c.download_count}⬇️)`, `content_detail_${c.id}`).row();
    });
    if (allContent.length > 20) {
      msg += `\n\n📋 عرض أول 20 من ${allContent.length} عنصر.\n💡 استخدم التنقّل الهرمي لرؤية البقية.`;
    }
    kb.text("🔙 التنقّل الهرمي", "browse_content")
      .row()
      .text("🔙 إدارة المحتوى", "content_mgmt");

    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
  });
}

// ============================================
// Helper: عرض قائمة الكليات
// ============================================
async function showCollegesList(ctx: any, content: ContentItem[], scopeLabel: string): Promise<void> {
  const grouped = groupByCollege(content);

  // رتّب حسب display_order (COLLEGES مرتبة مسبقاً)
  const sortedCollegeIds = COLLEGES
    .filter((c) => grouped.has(c.id))
    .map((c) => c.id);

  const kb = new InlineKeyboard();
  for (const collegeId of sortedCollegeIds) {
    const items = grouped.get(collegeId) || [];
    const college = getCollegeById(collegeId);
    if (!college) continue;
    kb.text(`${college.emoji} ${college.short_name} (${items.length})`, `br_col_${collegeId}`).row();
  }
  kb.text(ADMIN_TEXTS.browse_content.btn_flat, "br_flat")
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.editMessageText(
    ADMIN_TEXTS.browse_content.title(content.length, scopeLabel),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

// ============================================
// Helper: عرض قائمة التخصصات لكلية
// ============================================
async function showSpecialtiesList(ctx: any, content: ContentItem[], collegeName: string, collegeId: number): Promise<void> {
  if (content.length === 0) {
    await ctx.editMessageText(
      ADMIN_TEXTS.browse_content.empty_at_level(`كلية ${collegeName}`),
      {
        reply_markup: new InlineKeyboard().text("🔙 الكليات", "browse_content"),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const grouped = groupBySpecialty(content);

  // رتّب حسب ترتيب getSpecialtiesByCollege
  const allSpecs = getSpecialtiesByCollege(collegeId);
  const sortedSpecIds = allSpecs
    .filter((s) => grouped.has(s.id))
    .map((s) => s.id);

  const kb = new InlineKeyboard();
  for (const specId of sortedSpecIds) {
    const items = grouped.get(specId) || [];
    const spec = getSpecialtyById(specId);
    if (!spec) continue;
    kb.text(`📚 ${spec.short_name || spec.name} (${items.length})`, `br_spec_${specId}`).row();
  }
  kb.text("🔙 الكليات", "browse_content")
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.editMessageText(
    ADMIN_TEXTS.browse_content.title_specialty(collegeName, content.length),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

// ============================================
// Helper: عرض قائمة المستويات لتخصص
// ============================================
async function showLevelsList(ctx: any, content: ContentItem[], specName: string, specId: number): Promise<void> {
  if (content.length === 0) {
    await ctx.editMessageText(
      ADMIN_TEXTS.browse_content.empty_at_level(`تخصص ${specName}`),
      {
        reply_markup: new InlineKeyboard().text("🔙 التخصصات", `br_col_${getSpecialtyById(specId)?.college_id || 0}`),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const grouped = groupByLevel(content);

  // رتّب المستويات تصاعدياً
  const sortedLevels = Array.from(grouped.keys()).sort((a, b) => a - b);

  const kb = new InlineKeyboard();
  for (const level of sortedLevels) {
    const items = grouped.get(level) || [];
    kb.text(`📊 المستوى ${level} (${items.length})`, `br_lvl_${specId}_${level}`).row();
  }
  const spec = getSpecialtyById(specId);
  kb.text("🔙 التخصصات", `br_col_${spec?.college_id || 0}`)
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.editMessageText(
    ADMIN_TEXTS.browse_content.title_level(specName, content.length),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

// ============================================
// Helper: عرض قائمة المواد لمستوى
// ============================================
async function showSubjectsList(ctx: any, content: ContentItem[], specName: string, level: number, specId: number): Promise<void> {
  if (content.length === 0) {
    await ctx.editMessageText(
      ADMIN_TEXTS.browse_content.empty_at_level(`المستوى ${level} في ${specName}`),
      {
        reply_markup: new InlineKeyboard().text("🔙 المستويات", `br_spec_${specId}`),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const grouped = groupBySubject(content);

  // رتّب حسب اسم المادة
  const sortedSubjectIds = Array.from(grouped.keys()).sort((a, b) => {
    const nameA = getSubjectById(a)?.name || "";
    const nameB = getSubjectById(b)?.name || "";
    return nameA.localeCompare(nameB, "ar");
  });

  const kb = new InlineKeyboard();
  for (const subjectId of sortedSubjectIds) {
    const items = grouped.get(subjectId) || [];
    const subject = getSubjectById(subjectId);
    if (!subject) continue;
    kb.text(`📖 ${subject.name} (${items.length})`, `br_subj_${subjectId}`).row();
  }
  kb.text("🔙 المستويات", `br_spec_${specId}`)
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.editMessageText(
    ADMIN_TEXTS.browse_content.title_subject(specName, level, content.length),
    { reply_markup: kb, parse_mode: "Markdown" }
  );
}

// ============================================
// Helper: عرض قائمة الملفات لمادة
// ============================================
async function showFilesList(ctx: any, content: ContentItem[], subjectName: string, subjectId: number): Promise<void> {
  if (content.length === 0) {
    const subject = getSubjectById(subjectId);
    const spec = subject ? getSpecialtyById(subject.specialty_id) : null;
    await ctx.editMessageText(
      ADMIN_TEXTS.browse_content.empty_at_level(`مادة ${subjectName}`),
      {
        reply_markup: new InlineKeyboard().text(
          "🔙 المواد",
          spec ? `br_lvl_${spec.id}_${subject.level}` : "browse_content"
        ),
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // رتّب: المميّز أولاً، ثم الأكثر تحميلاً
  const sorted = [...content].sort((a, b) => {
    if ((b.is_starred ? 1 : 0) !== (a.is_starred ? 1 : 0)) {
      return (b.is_starred ? 1 : 0) - (a.is_starred ? 1 : 0);
    }
    return (b.download_count || 0) - (a.download_count || 0);
  });

  let msg = `📂 *${subjectName}*\n📊 ${content.length} ملف\n\nاختر ملفاً:`;
  const kb = new InlineKeyboard();
  sorted.slice(0, 20).forEach((c) => {
    const icon = c.is_starred ? "⭐" : getContentTypeEmoji(c.content_type_id);
    const title = c.title.substring(0, 35);
    kb.text(`${icon} ${title} (${c.download_count}⬇️)`, `content_detail_${c.id}`).row();
  });
  if (content.length > 20) {
    msg += `\n\n📋 عرض أول 20 من ${content.length} ملف.`;
  }

  const subject = getSubjectById(subjectId);
  const spec = subject ? getSpecialtyById(subject.specialty_id) : null;
  kb.text("🔙 المواد", spec ? `br_lvl_${spec.id}_${subject?.level}` : "browse_content")
    .row()
    .text("🔙 إدارة المحتوى", "content_mgmt");

  await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: "Markdown" });
}
