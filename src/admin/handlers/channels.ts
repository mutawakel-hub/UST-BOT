// ============================================
// 📢 Channels Handlers — CRUD كامل لقنوات اللجان العلمية
// ============================================
// هذا الملف يحتوي على:
//   - manage_channels (القائمة الرئيسية)
//   - channels_central (استعراض القنوات المركزية)
//   - channels_colleges (استعراض قنوات الكليات)
//   - channels_levels (استعراض هرمي: كليات → تخصصات → مستويات)
//   - Add flow: ch_add → scope → college/specialty/level → URL → display_name → confirm
//   - Edit flow: edit_channel_<id> (URL) + ch_edit_name_<id> (display_name)
//   - Delete flow: ch_delete_<id> → confirm_delete_ch_<id> (soft delete)
//   - Toggle: ch_toggle_<id> (تفعيل/تعطيل)
//   - Detail: ch_detail_<id>
//
// الجلسة (في state.ts):
//   - awaiting_channel_add_step: "url" | "display_name" | "confirm"
//   - awaiting_channel_add_context: { scope_type, college_id?, specialty_id?, level_num?, url?, display_name? }
//   - awaiting_channel_edit: channel_id
//   - awaiting_channel_edit_field: "url" | "display_name"
//
// ملاحظة: استقبال النص (URL / display_name) يحدث في messages.ts
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import { ADMIN_TEXTS } from "../../shared/texts";
import {
  SupabaseClient,
  createCommitteeChannel,
  deleteCommitteeChannel,
  toggleCommitteeChannel,
} from "../../shared/db";
import { getUserPermissions, UserPermissions } from "../../shared/rbac";
import { getOrCreateSession, saveSession } from "../state";
import { getAdminPrimaryPositionId } from "../helpers";
import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
  getSpecialtiesByCollege,
} from "../../shared/data/colleges";

// ============================================
// نصوص inline مخصصة (مكمّلة لـ ADMIN_TEXTS.channels)
// ============================================
const CHANNEL_TEXTS = {
  no_permission: "❌ *ليست لديك صلاحية إدارة قنوات اللجان.*",

  // Add flow
  add_select_scope: "🔗 *إضافة رابط قناة جديد*\n\nاختر نوع النطاق:",
  add_scope_central: "🛡 لجنة مركزية",
  add_scope_college: "🏛 لجنة كلية",
  add_scope_specialty_level: "📊 لجنة مستوى (تخصص/مستوى)",
  add_select_college: "🏛 اختر الكلية:",
  add_select_specialty: (collegeName: string) =>
    `📚 *${collegeName}*\n\nاختر التخصص:`,
  add_select_level: (specName: string) =>
    `📊 *${specName}*\n\nاختر المستوى:`,
  add_prompt_url:
    "🔗 أرسل رابط القناة الآن:\n\n💡 الصيغة: `https://t.me/+xxxxx` أو `https://t.me/channelname`",
  add_prompt_display_name:
    "📝 أرسل *اسم العرض* للقناة (سيظهر للطلاب في القوائم):",
  add_confirm: (info: { scopeLabel: string; url: string; displayName: string }) =>
    `✅ *تأكيد الإضافة*\n\n` +
    `📍 النطاق: ${info.scopeLabel}\n` +
    `🔗 الرابط: ${info.url}\n` +
    `📝 الاسم: ${info.displayName}\n\n` +
    `هل تريد المتابعة؟`,
  add_success: "✅ *تمت إضافة رابط القناة بنجاح.*",
  add_canceled: "❌ تم إلغاء الإضافة.",
  add_failed: "⚠️ فشل إضافة الرابط. حاول مرة أخرى لاحقاً.",
  add_invalid_url:
    "⚠️ الرابط غير صالح. يجب أن يبدأ بـ `https://t.me/` أو `http://t.me/`.\n\nأعد الإرسال:",
  add_invalid_name: "⚠️ الاسم لا يمكن أن يكون فارغاً.\n\nأعد الإرسال:",

  // Edit flow
  edit_url_prompt: (channelName: string) =>
    `🔗 أرسل الرابط الجديد لـ:\n*${channelName}*\n\n💡 الصيغة: \`https://t.me/+xxxxx\``,
  edit_name_prompt: (channelName: string) =>
    `📝 أرسل اسم العرض الجديد لـ:\n*${channelName}*`,
  edit_canceled: "❌ تم إلغاء التعديل.",

  // Delete flow
  delete_prompt: (channelName: string) =>
    `🗑 *تأكيد الحذف*\n\n` +
    `هل أنت متأكد من حذف رابط القناة:\n*${channelName}*\n\n` +
    `⚠️ سيتم تعطيل الرابط (حذف ناعم).`,
  delete_success: "✅ تم حذف الرابط.",
  delete_failed: "⚠️ فشل حذف الرابط.",

  // Toggle
  toggle_on: "✅ *تم تفعيل القناة.*",
  toggle_off: "⏸️ *تم تعطيل القناة.*",
  toggle_failed: "⚠️ فشل تبديل حالة القناة.",

  // Detail
  not_found: "⚠️ الرابط غير موجود أو تم حذفه.",
  detail_title: "📢 *تفاصيل رابط القناة*\n\n",
  detail_fields: (d: {
    scopeLabel: string;
    displayName: string;
    url: string;
    isActive: boolean;
    updatedAt?: string;
  }) =>
    `📍 النطاق: ${d.scopeLabel}\n` +
    `📝 الاسم: ${d.displayName}\n` +
    `🔗 الرابط: ${d.url}\n` +
    `🔄 الحالة: ${d.isActive ? "✅ مفعّل" : "⏸️ معطّل"}\n` +
    (d.updatedAt ? `📅 آخر تحديث: ${d.updatedAt}\n` : ""),

  // Scope labels
  scope_central: "🛡 مركزي",
  scope_college: (name: string) => `🏛 ${name}`,
  scope_level: (specName: string, level: number) =>
    `📊 ${specName} — مستوى ${level}`,

  // Levels browse
  levels_list_title: (specName: string) =>
    `📊 *${specName}*\n\nاختر المستوى لعرض/إدارة رابط اللجنة:`,
  level_has_channel: (level: number) => `📊 مستوى ${level} ✅`,
  level_no_channel: (level: number) => `📊 مستوى ${level} ➕`,

  btn_edit_url: "✏️ تعديل الرابط",
  btn_edit_name: "📝 تعديل الاسم",
  btn_delete: "🗑 حذف",
  btn_toggle_on: "⏸️ تعطيل",
  btn_toggle_off: "✅ تفعيل",
  btn_confirm_delete: "✅ نعم، احذف",
  btn_cancel: "❌ إلغاء",
  btn_confirm_add: "✅ تأكيد الإضافة",
} as const;

// ============================================
// نوع قناة اللجنة (من DB)
// ============================================
interface CommitteeChannel {
  id: number;
  scope_type: "central" | "college" | "specialty_level";
  college_id?: number | null;
  specialty_id?: number | null;
  level_num?: number | null;
  channel_url: string;
  channel_id?: string | null;
  display_name: string;
  is_active: boolean;
  updated_by_position_id?: string | null;
  updated_at?: string | null;
}

// ============================================
// Helpers داخلية
// ============================================

/**
 * فحص صلاحية manage_committee_channels.
 * يرجع perms عند النجاح، أو null ويُظهر رسالة خطأ عند الفشل.
 */
async function requireManageChannels(ctx: any): Promise<UserPermissions | null> {
  const perms = await getUserPermissions(ctx.from.id);
  if (!perms.permissions.has("manage_committee_channels")) {
    await ctx.editMessageText(CHANNEL_TEXTS.no_permission, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.navigation.back_to_academic,
        "academic_mgmt"
      ),
      parse_mode: "Markdown",
    });
    return null;
  }
  return perms;
}

/**
 * يجلب القنوات من DB حسب scope_type.
 * لا يفلتر بـ is_active (يُرجع الكل) لعرض المعطّل أيضاً.
 */
async function getChannelsByScopeType(
  supabase: SupabaseClient,
  scopeType: "central" | "college" | "specialty_level"
): Promise<CommitteeChannel[]> {
  try {
    const result = await supabase.select("committee_channels", {
      filter: `scope_type=eq.${scopeType}`,
      order: "display_name.asc",
    });
    return Array.isArray(result) ? (result as CommitteeChannel[]) : [];
  } catch (e) {
    console.error("getChannelsByScopeType error:", e);
    return [];
  }
}

/**
 * يجلب قناة واحدة من DB بـ id.
 */
async function getChannelByIdFromDB(
  supabase: SupabaseClient,
  channelId: number
): Promise<CommitteeChannel | null> {
  try {
    const result = await supabase.select("committee_channels", {
      filter: `id=eq.${channelId}`,
      single: true,
    });
    const channel = Array.isArray(result) ? result[0] : result;
    return (channel as CommitteeChannel) || null;
  } catch (e) {
    console.error("getChannelByIdFromDB error:", e);
    return null;
  }
}

/**
 * يجلب قنوات مستويات تخصص معيّن → Map<level_num, channel>
 * يُستخدم في استعراض المستويات لفحص وجود رابط لكل مستوى.
 */
async function getLevelChannelsForSpecialty(
  supabase: SupabaseClient,
  specId: number
): Promise<Map<number, CommitteeChannel>> {
  const map = new Map<number, CommitteeChannel>();
  try {
    const result = await supabase.select("committee_channels", {
      filter: `scope_type=eq.specialty_level&specialty_id=eq.${specId}`,
      order: "level_num.asc",
    });
    if (Array.isArray(result)) {
      for (const ch of result as CommitteeChannel[]) {
        if (ch.level_num != null && !map.has(ch.level_num)) {
          map.set(ch.level_num, ch);
        }
      }
    }
  } catch (e) {
    console.error("getLevelChannelsForSpecialty error:", e);
  }
  return map;
}

/**
 * يبني keyboard للكليات (كل الكليات السبع).
 * الـ prefix يحدد مسار callback: "ch_add" للإضافة، "chl" للاستعراض الهرمي.
 */
function collegesKeyboard(prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const c of COLLEGES) {
    kb.text(`${c.emoji} ${c.short_name}`, `${prefix}_col_${c.id}`).row();
  }
  kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");
  return kb;
}

/**
 * يبني keyboard للتخصصات داخل كلية.
 */
function specialtiesKeyboard(collegeId: number, prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const specs = getSpecialtiesByCollege(collegeId);
  for (const s of specs) {
    kb.text(`📚 ${s.short_name || s.name}`, `${prefix}_spec_${s.id}`).row();
  }
  kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");
  return kb;
}

/**
 * يبني keyboard للمستويات ضمن تخصص (للاستخدام في Add flow).
 * يستخدم spec?.levels_count كحد أقصى (افتراضي 6).
 */
function levelsKeyboard(specId: number, prefix: string): InlineKeyboard {
  const spec = getSpecialtyById(specId);
  const maxLevel = spec?.levels_count || 6;
  const kb = new InlineKeyboard();
  for (let i = 1; i <= maxLevel; i++) {
    kb.text(`📊 المستوى ${i}`, `${prefix}_lvl_${specId}_${i}`);
    if (i % 2 === 0) kb.row();
  }
  kb.row().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");
  return kb;
}

/**
 * يبني label النطاق لقناة معيّنة (للعرض في التفاصيل والتأكيد).
 */
function getScopeLabel(channel: CommitteeChannel): string {
  if (channel.scope_type === "central") {
    return CHANNEL_TEXTS.scope_central;
  }
  if (channel.scope_type === "college" && channel.college_id) {
    const c = getCollegeById(channel.college_id);
    return CHANNEL_TEXTS.scope_college(c?.name || `كلية ${channel.college_id}`);
  }
  if (channel.scope_type === "specialty_level" && channel.specialty_id) {
    const s = getSpecialtyById(channel.specialty_id);
    return CHANNEL_TEXTS.scope_level(
      s?.name || `تخصص ${channel.specialty_id}`,
      channel.level_num || 0
    );
  }
  return channel.display_name || "—";
}

/**
 * يعرض تفاصيل قناة + أزرار (تعديل رابط/تعديل اسم/حذف/تفعيل-تعطيل/رجوع).
 */
async function showChannelDetail(
  bot: Bot,
  supabase: SupabaseClient,
  ctx: any,
  channelId: number
): Promise<void> {
  // bot مُمرَّر للتوافق مع التوقيع المُتفق عليه (يُستخدم في notifyNewAdmin-like flows لاحقاً)
  void bot;

  const channel = await getChannelByIdFromDB(supabase, channelId);
  if (!channel) {
    await ctx.editMessageText(CHANNEL_TEXTS.not_found, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.channels.btn_back_to_channels,
        "manage_channels"
      ),
      parse_mode: "Markdown",
    });
    return;
  }

  const scopeLabel = getScopeLabel(channel);
  const text =
    CHANNEL_TEXTS.detail_title +
    CHANNEL_TEXTS.detail_fields({
      scopeLabel,
      displayName: channel.display_name,
      url: channel.channel_url,
      isActive: !!channel.is_active,
      updatedAt: channel.updated_at || undefined,
    });

  const kb = new InlineKeyboard()
    .text(CHANNEL_TEXTS.btn_edit_url, `edit_channel_${channelId}`)
    .text(CHANNEL_TEXTS.btn_edit_name, `ch_edit_name_${channelId}`)
    .row()
    .text(
      channel.is_active ? CHANNEL_TEXTS.btn_toggle_on : CHANNEL_TEXTS.btn_toggle_off,
      `ch_toggle_${channelId}`
    )
    .row()
    .text(CHANNEL_TEXTS.btn_delete, `ch_delete_${channelId}`)
    .row()
    .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");

  await ctx.editMessageText(text, {
    reply_markup: kb,
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * يعرض شاشة تأكيد الإضافة (يُستدعى من messages.ts بعد استقبال display_name).
 * مُصدَّر ليُستدعى من handlers/messages.ts.
 */
export async function showChannelAddConfirmation(
  ctx: any,
  session: any
): Promise<void> {
  const data = session.awaiting_channel_add_context;
  if (!data || !data.url) return;

  let scopeLabel: string = CHANNEL_TEXTS.scope_central;
  if (data.scope_type === "college" && data.college_id) {
    const c = getCollegeById(data.college_id);
    scopeLabel = CHANNEL_TEXTS.scope_college(c?.name || `كلية ${data.college_id}`);
  } else if (data.scope_type === "specialty_level" && data.specialty_id) {
    const s = getSpecialtyById(data.specialty_id);
    scopeLabel = CHANNEL_TEXTS.scope_level(
      s?.name || `تخصص ${data.specialty_id}`,
      data.level_num || 0
    );
  }

  const displayName = data.display_name || data.url;

  session.awaiting_channel_add_step = "confirm";
  await saveSession(session);

  await ctx.reply(
    CHANNEL_TEXTS.add_confirm({
      scopeLabel,
      url: data.url,
      displayName,
    }),
    {
      reply_markup: new InlineKeyboard()
        .text(CHANNEL_TEXTS.btn_confirm_add, "confirm_add_channel")
        .text(CHANNEL_TEXTS.btn_cancel, "cancel_add_channel")
        .row()
        .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    }
  );
}

/**
 * يعمل INSERT للقناة الجديدة.
 * يرجع true عند النجاح، false عند الفشل.
 */
async function performChannelInsert(
  supabase: SupabaseClient,
  telegramId: number,
  data: NonNullable<import("../state").AdminSession["awaiting_channel_add_context"]>
): Promise<boolean> {
  const positionId = await getAdminPrimaryPositionId(supabase, telegramId);

  let collegeId: number | null = null;
  let specialtyId: number | null = null;
  let levelNum: number | null = null;

  if (data.scope_type === "college") {
    collegeId = data.college_id || null;
  } else if (data.scope_type === "specialty_level") {
    collegeId = data.college_id || null;
    specialtyId = data.specialty_id || null;
    levelNum = data.level_num || null;
  }

  const newId = await createCommitteeChannel(supabase, {
    scope_type: data.scope_type,
    college_id: collegeId,
    specialty_id: specialtyId,
    level_num: levelNum,
    channel_url: data.url!,
    display_name: data.display_name || data.url!,
    is_active: true,
    updated_by_position_id: positionId,
  });

  return newId !== null;
}

/**
 * يعيد عرض القائمة المناسبة حسب scope_type (بعد INSERT/UPDATE/DELETE).
 */
function scopeListCallback(
  scopeType: "central" | "college" | "specialty_level"
): string {
  if (scopeType === "central") return "channels_central";
  if (scopeType === "college") return "channels_colleges";
  return "channels_levels";
}

// ============================================
// التسجيل الرئيسي
// ============================================
export function registerChannelHandlers(
  bot: Bot,
  supabase: SupabaseClient
): void {
  // ====== القائمة الرئيسية: manage_channels ======
  bot.callbackQuery("manage_channels", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await getUserPermissions(ctx.from.id);
    if (!perms.permissions.has("manage_committee_channels")) {
      await ctx.editMessageText(CHANNEL_TEXTS.no_permission, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.navigation.back_to_academic,
          "academic_mgmt"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(ADMIN_TEXTS.channels.title, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.channels.btn_central, "channels_central")
        .row()
        .text(ADMIN_TEXTS.channels.btn_colleges, "channels_colleges")
        .row()
        .text(ADMIN_TEXTS.channels.btn_levels, "channels_levels")
        .row()
        .text(ADMIN_TEXTS.channels.btn_add, "ch_add")
        .row()
        .text(ADMIN_TEXTS.navigation.back_to_academic, "academic_mgmt"),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 📋 BROWSE — استعراض الروابط
  // ============================================

  // ====== استعراض مركزي ======
  bot.callbackQuery("channels_central", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    let channels: CommitteeChannel[] = [];
    try {
      channels = await getChannelsByScopeType(supabase, "central");
    } catch (e) {
      console.error("channels_central: getChannelsByScopeType error:", e);
    }

    if (channels.length === 0) {
      await ctx.editMessageText(
        ADMIN_TEXTS.channels.central_title + ADMIN_TEXTS.channels.empty,
        {
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TEXTS.channels.btn_add, "ch_add_scope_central")
            .row()
            .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    let text = ADMIN_TEXTS.channels.central_title;
    const kb = new InlineKeyboard();
    for (const ch of channels) {
      text += ADMIN_TEXTS.channels.channel_entry({
        display_name: ch.display_name,
        channel_url: ch.channel_url,
      });
      kb
        .text(ADMIN_TEXTS.channels.btn_edit, `ch_detail_${ch.id}`)
        .text(CHANNEL_TEXTS.btn_delete, `ch_delete_${ch.id}`)
        .text(
          ch.is_active ? CHANNEL_TEXTS.btn_toggle_on : CHANNEL_TEXTS.btn_toggle_off,
          `ch_toggle_${ch.id}`
        )
        .row();
    }
    kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");

    await ctx.editMessageText(text, {
      reply_markup: kb,
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  });

  // ====== استعراض كليات ======
  bot.callbackQuery("channels_colleges", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    let channels: CommitteeChannel[] = [];
    try {
      channels = await getChannelsByScopeType(supabase, "college");
    } catch (e) {
      console.error("channels_colleges: getChannelsByScopeType error:", e);
    }

    if (channels.length === 0) {
      await ctx.editMessageText(
        ADMIN_TEXTS.channels.colleges_title + ADMIN_TEXTS.channels.empty,
        {
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TEXTS.channels.btn_add, "ch_add_scope_college")
            .row()
            .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    let text = ADMIN_TEXTS.channels.colleges_title;
    const kb = new InlineKeyboard();
    for (const ch of channels) {
      const college = ch.college_id ? getCollegeById(ch.college_id) : undefined;
      const label = college
        ? `${college.emoji} ${ch.display_name}`
        : ch.display_name;
      text += ADMIN_TEXTS.channels.channel_entry({
        display_name: label,
        channel_url: ch.channel_url,
      });
      kb
        .text(ADMIN_TEXTS.channels.btn_edit, `ch_detail_${ch.id}`)
        .text(CHANNEL_TEXTS.btn_delete, `ch_delete_${ch.id}`)
        .text(
          ch.is_active ? CHANNEL_TEXTS.btn_toggle_on : CHANNEL_TEXTS.btn_toggle_off,
          `ch_toggle_${ch.id}`
        )
        .row();
    }
    kb.text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");

    await ctx.editMessageText(text, {
      reply_markup: kb,
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  });

  // ====== استعراض مستويات (هرمي) — نقطة الدخول ======
  bot.callbackQuery("channels_levels", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    await ctx.editMessageText(ADMIN_TEXTS.channels.levels_title + "اختر الكلية:", {
      reply_markup: collegesKeyboard("chl"),
      parse_mode: "Markdown",
    });
  });

  // ====== استعراض مستويات: اختيار كلية → عرض التخصصات ======
  bot.callbackQuery(/^chl_col_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;
    const college = getCollegeById(collegeId);
    await ctx.editMessageText(
      CHANNEL_TEXTS.add_select_specialty(college?.name || `كلية ${collegeId}`),
      {
        reply_markup: specialtiesKeyboard(collegeId, "chl"),
        parse_mode: "Markdown",
      }
    );
  });

  // ====== استعراض مستويات: اختيار تخصص → عرض المستويات (مع فحص وجود رابط) ======
  bot.callbackQuery(/^chl_spec_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.editMessageText("⚠️ التخصص غير موجود.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const maxLevel = spec.levels_count || 6;
    const channelMap = await getLevelChannelsForSpecialty(supabase, specId);

    const kb = new InlineKeyboard();
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const existing = channelMap.get(lvl);
      if (existing) {
        // يوجد رابط → زر يفتح التفاصيل
        const statusIcon = existing.is_active ? "✅" : "⏸️";
        kb.text(
          `${CHANNEL_TEXTS.level_has_channel(lvl)} ${statusIcon}`,
          `ch_detail_${existing.id}`
        );
      } else {
        // لا يوجد رابط → زر إضافة
        kb.text(
          CHANNEL_TEXTS.level_no_channel(lvl),
          `ch_add_lvl_${specId}_${lvl}`
        );
      }
      if (lvl % 2 === 0) kb.row();
    }
    kb.row().text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels");

    await ctx.editMessageText(
      CHANNEL_TEXTS.levels_list_title(spec.name),
      {
        reply_markup: kb,
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // ➕ ADD FLOW — إضافة رابط
  // ============================================

  // نقطة الدخول: اختيار scope
  bot.callbackQuery("ch_add", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    await ctx.editMessageText(CHANNEL_TEXTS.add_select_scope, {
      reply_markup: new InlineKeyboard()
        .text(CHANNEL_TEXTS.add_scope_central, "ch_add_scope_central")
        .row()
        .text(CHANNEL_TEXTS.add_scope_college, "ch_add_scope_college")
        .row()
        .text(
          CHANNEL_TEXTS.add_scope_specialty_level,
          "ch_add_scope_specialty_level"
        )
        .row()
        .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
      parse_mode: "Markdown",
    });
  });

  // scope = central → طلب URL مباشرة
  bot.callbackQuery("ch_add_scope_central", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_add_step = "url";
    session.awaiting_channel_add_context = { scope_type: "central" };
    await saveSession(session);

    await ctx.editMessageText(CHANNEL_TEXTS.add_prompt_url, {
      reply_markup: new InlineKeyboard().text(
        CHANNEL_TEXTS.btn_cancel,
        "cancel_add_channel"
      ),
      parse_mode: "Markdown",
    });
  });

  // scope = college → اختيار كلية ثم طلب URL
  bot.callbackQuery("ch_add_scope_college", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_add_step = undefined;
    session.awaiting_channel_add_context = { scope_type: "college" };
    await saveSession(session);

    await ctx.editMessageText(CHANNEL_TEXTS.add_select_college, {
      reply_markup: collegesKeyboard("ch_add"),
      parse_mode: "Markdown",
    });
  });

  // scope = specialty_level → اختيار كلية → تخصص → مستوى → URL
  bot.callbackQuery("ch_add_scope_specialty_level", async (ctx) => {
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_add_step = undefined;
    session.awaiting_channel_add_context = { scope_type: "specialty_level" };
    await saveSession(session);

    await ctx.editMessageText(CHANNEL_TEXTS.add_select_college, {
      reply_markup: collegesKeyboard("ch_add"),
      parse_mode: "Markdown",
    });
  });

  // اختيار كلية (في Add flow) — يفحص scope_type من الجلسة
  bot.callbackQuery(/^ch_add_col_(\d+)$/, async (ctx) => {
    const collegeId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const ctxData = session.awaiting_channel_add_context;

    if (!ctxData) {
      // الجلسة ضاعت — أعد التوجيه لاختيار scope
      await ctx.editMessageText(
        "⚠️ انتهت الجلسة. ابدأ الإضافة من جديد.",
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.channels.btn_add,
            "ch_add"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const college = getCollegeById(collegeId);
    ctxData.college_id = collegeId;
    await saveSession(session);

    if (ctxData.scope_type === "college") {
      // scope=college → اطلب URL الآن
      session.awaiting_channel_add_step = "url";
      await saveSession(session);
      await ctx.editMessageText(CHANNEL_TEXTS.add_prompt_url, {
        reply_markup: new InlineKeyboard().text(
          CHANNEL_TEXTS.btn_cancel,
          "cancel_add_channel"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    // scope=specialty_level → اعرض التخصصات
    await ctx.editMessageText(
      CHANNEL_TEXTS.add_select_specialty(college?.name || `كلية ${collegeId}`),
      {
        reply_markup: specialtiesKeyboard(collegeId, "ch_add"),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار تخصص (في Add flow, scope=specialty_level) → عرض المستويات
  bot.callbackQuery(/^ch_add_spec_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const ctxData = session.awaiting_channel_add_context;
    if (!ctxData || ctxData.scope_type !== "specialty_level") {
      await ctx.editMessageText(
        "⚠️ انتهت الجلسة. ابدأ الإضافة من جديد.",
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.channels.btn_add,
            "ch_add"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.editMessageText("⚠️ التخصص غير موجود.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    ctxData.specialty_id = specId;
    ctxData.college_id = spec.college_id;
    await saveSession(session);

    await ctx.editMessageText(
      CHANNEL_TEXTS.add_select_level(spec.name),
      {
        reply_markup: levelsKeyboard(specId, "ch_add"),
        parse_mode: "Markdown",
      }
    );
  });

  // اختيار مستوى (في Add flow أو من استعراض المستويات) → طلب URL
  // هذا الـ handler يعمل في حالتين:
  //   1) من Add flow بعد اختيار تخصص (الجلسة تحتوي scope_type=specialty_level)
  //   2) من استعراض المستويات (chl_spec) عند النقر على مستوى بلا رابط
  // في كلتا الحالتين نضبط السياق كاملاً ونطلب URL.
  bot.callbackQuery(/^ch_add_lvl_(\d+)_(\d+)$/, async (ctx) => {
    const specId = parseInt(ctx.match[1]);
    const levelNum = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const spec = getSpecialtyById(specId);
    if (!spec) {
      await ctx.editMessageText("⚠️ التخصص غير موجود.", {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_add_context = {
      scope_type: "specialty_level",
      college_id: spec.college_id,
      specialty_id: specId,
      level_num: levelNum,
    };
    session.awaiting_channel_add_step = "url";
    await saveSession(session);

    await ctx.editMessageText(CHANNEL_TEXTS.add_prompt_url, {
      reply_markup: new InlineKeyboard().text(
        CHANNEL_TEXTS.btn_cancel,
        "cancel_add_channel"
      ),
      parse_mode: "Markdown",
    });
  });

  // تأكيد الإضافة → INSERT
  bot.callbackQuery("confirm_add_channel", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "💾 جارٍ الإضافة..." });
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    const data = session.awaiting_channel_add_context;

    if (!data || !data.url || !data.scope_type) {
      session.awaiting_channel_add_step = undefined;
      session.awaiting_channel_add_context = undefined;
      await saveSession(session);
      await ctx.editMessageText(
        "⚠️ انتهت الجلسة. ابدأ الإضافة من جديد.",
        {
          reply_markup: new InlineKeyboard().text(
            ADMIN_TEXTS.channels.btn_add,
            "ch_add"
          ),
          parse_mode: "Markdown",
        }
      );
      return;
    }

    let ok = false;
    try {
      ok = await performChannelInsert(supabase, ctx.from.id, data);
    } catch (e: any) {
      console.error("confirm_add_channel: insert error:", e);
    }

    // إعادة ضبط الجلسة
    const scopeType = data.scope_type;
    session.awaiting_channel_add_step = undefined;
    session.awaiting_channel_add_context = undefined;
    await saveSession(session);

    if (!ok) {
      await ctx.editMessageText(CHANNEL_TEXTS.add_failed, {
        reply_markup: new InlineKeyboard()
          .text(ADMIN_TEXTS.channels.btn_add, "ch_add")
          .row()
          .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(CHANNEL_TEXTS.add_success, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.channels.btn_add, "ch_add")
        .row()
        .text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          scopeListCallback(scopeType)
        ),
      parse_mode: "Markdown",
    });
  });

  // إلغاء الإضافة → إعادة ضبط الجلسة
  bot.callbackQuery("cancel_add_channel", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_add_step = undefined;
    session.awaiting_channel_add_context = undefined;
    await saveSession(session);
    await ctx.editMessageText(CHANNEL_TEXTS.add_canceled, {
      reply_markup: new InlineKeyboard().text(
        ADMIN_TEXTS.channels.btn_back_to_channels,
        "manage_channels"
      ),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 👁 DETAIL — عرض تفاصيل قناة
  // ============================================
  bot.callbackQuery(/^ch_detail_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;
    await showChannelDetail(bot, supabase, ctx, channelId);
  });

  // ============================================
  // ✏️ EDIT — تعديل الرابط (URL) والاسم
  // (استقبال النص يحدث في messages.ts)
  // ============================================

  // تعديل الرابط (URL) — يحافظ على callback القديم edit_channel_<id> للتوافق
  bot.callbackQuery(/^edit_channel_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const channel = await getChannelByIdFromDB(supabase, channelId);
    if (!channel) {
      await ctx.editMessageText(CHANNEL_TEXTS.not_found, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_edit = channelId;
    session.awaiting_channel_edit_field = "url";
    await saveSession(session);

    await ctx.editMessageText(
      CHANNEL_TEXTS.edit_url_prompt(channel.display_name),
      {
        reply_markup: new InlineKeyboard().text(
          CHANNEL_TEXTS.btn_cancel,
          `ch_detail_${channelId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // تعديل الاسم (display_name)
  bot.callbackQuery(/^ch_edit_name_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const channel = await getChannelByIdFromDB(supabase, channelId);
    if (!channel) {
      await ctx.editMessageText(CHANNEL_TEXTS.not_found, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_edit = channelId;
    session.awaiting_channel_edit_field = "display_name";
    await saveSession(session);

    await ctx.editMessageText(
      CHANNEL_TEXTS.edit_name_prompt(channel.display_name),
      {
        reply_markup: new InlineKeyboard().text(
          CHANNEL_TEXTS.btn_cancel,
          `ch_detail_${channelId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });

  // ============================================
  // 🗑 DELETE — حذف رابط (soft delete)
  // ============================================

  // طلب تأكيد الحذف
  bot.callbackQuery(/^ch_delete_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    const channel = await getChannelByIdFromDB(supabase, channelId);
    if (!channel) {
      await ctx.editMessageText(CHANNEL_TEXTS.not_found, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_delete_id = channelId;
    await saveSession(session);

    await ctx.editMessageText(
      CHANNEL_TEXTS.delete_prompt(channel.display_name),
      {
        reply_markup: new InlineKeyboard()
          .text(CHANNEL_TEXTS.btn_confirm_delete, `confirm_delete_ch_${channelId}`)
          .text(CHANNEL_TEXTS.btn_cancel, `ch_detail_${channelId}`)
          .row()
          .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
        parse_mode: "Markdown",
      }
    );
  });

  // تأكيد الحذف → soft delete
  bot.callbackQuery(/^confirm_delete_ch_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🗑 جارٍ الحذف..." });
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    let ok = false;
    try {
      ok = await deleteCommitteeChannel(supabase, channelId);
    } catch (e) {
      console.error("confirm_delete_ch: deleteCommitteeChannel error:", e);
    }

    const session = await getOrCreateSession(ctx.from.id, ctx.from.first_name);
    session.awaiting_channel_delete_id = undefined;
    await saveSession(session);

    if (!ok) {
      await ctx.editMessageText(CHANNEL_TEXTS.delete_failed, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(CHANNEL_TEXTS.delete_success, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TEXTS.channels.btn_central, "channels_central")
        .row()
        .text(ADMIN_TEXTS.channels.btn_colleges, "channels_colleges")
        .row()
        .text(ADMIN_TEXTS.channels.btn_levels, "channels_levels")
        .row()
        .text(ADMIN_TEXTS.channels.btn_back_to_channels, "manage_channels"),
      parse_mode: "Markdown",
    });
  });

  // ============================================
  // 🔄 TOGGLE — تفعيل/تعطيل
  // ============================================
  bot.callbackQuery(/^ch_toggle_(\d+)$/, async (ctx) => {
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "🔄 جارٍ التبديل..." });
    const perms = await requireManageChannels(ctx);
    if (!perms) return;

    // اقرأ الحالة الحالية قبل التبديل
    const before = await getChannelByIdFromDB(supabase, channelId);
    if (!before) {
      await ctx.editMessageText(CHANNEL_TEXTS.not_found, {
        reply_markup: new InlineKeyboard().text(
          ADMIN_TEXTS.channels.btn_back_to_channels,
          "manage_channels"
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    try {
      // toggleCommitteeChannel يقرأ الحالة الحالية، يعكسها، ويحدّث DB
      // القيمة الراجعة قد تكون غامضة (false = خطأ أو الحالة الجديدة معطّلة)
      // لذلك نعتمد على إعادة القراءة بعد العملية لتحديد الحالة الفعلية
      await toggleCommitteeChannel(supabase, channelId);
    } catch (e) {
      console.error("ch_toggle: toggleCommitteeChannel error:", e);
    }

    // أعد قراءة للحصول على الحالة الفعلية
    const after = await getChannelByIdFromDB(supabase, channelId);
    const finalState = after ? !!after.is_active : !before.is_active;

    // إذا لم تتغير الحالة → فشل التبديل
    if (after && after.is_active === before.is_active) {
      await ctx.editMessageText(CHANNEL_TEXTS.toggle_failed, {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل القناة",
          `ch_detail_${channelId}`
        ),
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(
      finalState ? CHANNEL_TEXTS.toggle_on : CHANNEL_TEXTS.toggle_off,
      {
        reply_markup: new InlineKeyboard().text(
          "🔙 تفاصيل القناة",
          `ch_detail_${channelId}`
        ),
        parse_mode: "Markdown",
      }
    );
  });
}
