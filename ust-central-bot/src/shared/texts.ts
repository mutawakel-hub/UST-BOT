// ============================================
// النصوص الافتراضية للبوتين - فصحى مبسّطة
// ============================================

export const TEXTS = {
  // ====== شاشة S1: MainMenu ======
  main_menu: {
    welcome:
      "🎓 *مرحباً بك في البوت العلمي المركزي*\n" +
      "*جامعة العلوم والتكنولوجيا - اليمن*\n\n" +
      "🚀 صُمّم ليكون مرجعك الأكاديمي الشامل. اختر الخدمة المطلوبة:\n\n" +
      "• 🏛 تصفّح الكليات لتنزيل المقررات والنماذج\n" +
      "• 🔍 ابحث عن مادة معينة بالاسم\n" +
      "• 🏆 شاهد أبرز المساهمين من زملائك\n" +
      "• 👤 تابع نشاطك (تحميلات + مساهمات)",
    btn_colleges: "🏛 الكليات",
    btn_search: "🔍 بحث",
    btn_leaderboard: "🏆 لوحة الشرف",
    btn_profile: "👤 حسابي",
    btn_committee: "📢 قناة اللجنة",
    btn_contact: "📞 تواصل معنا",
  },

  // ====== شاشة S2: ChooseCollege ======
  choose_college: {
    title: "🏛 *اختر الكلية*",
    footer: "\n\n💡 يمكنك العودة للقائمة الرئيسية في أي وقت.",
  },

  // ====== شاشة S3: ChooseMajor ======
  choose_major: {
    title: "📚 *اختر التخصص*",
    no_specialties: "⚠️ لا توجد تخصصات متاحة في هذه الكلية حالياً.",
  },

  // ====== شاشة S4: ChooseLevel ======
  choose_level: {
    title: "📊 *اختر المستوى الدراسي*",
    plan_button: "🗺 الخطة الاسترشادية",
    plan_message:
      "🗺 *الخطة الاسترشادية*\n\n" +
      "تعرض هذه الخطة المواد المطلوبة لكل مستوى في التخصص.\n\n" +
      "✅ يتم تحديثها دورياً من قبل اللجنة العلمية.",
    plan_file_caption: "🗺 الخطة الاسترشادية - وضع تجريبي",
  },

  // ====== شاشة S5: ChooseSemester ======
  choose_semester: {
    title: "📅 *اختر الفصل الدراسي*",
    sem1_label: "🍂 الفصل الأول (الخريف)",
    sem2_label: "🌸 الفصل الثاني (الربيع)",
  },

  // ====== شاشة S6: ChooseSubject ======
  choose_subject: {
    title: "📖 *اختر المادة*",
    no_subjects: "⚠️ لا توجد مواد في هذا الفصل حالياً.",
  },

  // ====== شاشة S7: SubjectMenu ======
  subject_menu: {
    title: (subjectName: string, isSubscribed: boolean) =>
      `📖 *${subjectName}*\n\n` +
      (isSubscribed ? "🔔 *أنت مشترك في هذه المادة*\n\n" : "") +
      "اختر نوع المحتوى:",
    btn_book_theory: (count: number) => `📘 المقرر (نظري) — ${count}`,
    btn_book_practical: (count: number) => `📗 المقرر (عملي) — ${count}`,
    btn_exams: (count: number) => `📑 نماذج اختبارات — ${count}`,
    btn_summaries: (count: number) => `📝 ملخصات — ${count}`,
    btn_contribute: "💡 مساهمة",
    btn_subscribe: "🔔 اشتراك",
    btn_unsubscribe: "🔕 إلغاء الاشتراك",
    no_files_in_category: "لا توجد ملفات",
  },

  // ====== شاشة S8: قائمة الملفات ======
  files_list: {
    title: (subjectName: string, typeLabel: string) =>
      `📄 *${subjectName} - ${typeLabel}*\n\nاختر ملفاً للمعاينة:`,
    no_files: "📭 لا توجد ملفات في هذا التصنيف حالياً.\n💡 يمكنك المساهمة بأول ملف!",
  },

  // ====== شاشة S8b: معاينة الملف (جديدة) ======
  file_preview: {
    title: "📄 *معاينة الملف*\n\n",
    details: (f: {
      file_name: string;
      file_size_mb: number;
      type_label: string;
      subject_name: string;
      uploaded_at: string;
      download_count: number;
      uploaded_by: string;
      is_starred: boolean;
    }) => {
      let msg = "";
      msg += `📝 *الاسم:* \`${f.file_name}\`\n`;
      msg += `📊 *الحجم:* ${f.file_size_mb.toFixed(2)} MB\n`;
      msg += `🏷 *التصنيف:* ${f.type_label}\n`;
      msg += `📚 *المادة:* ${f.subject_name}\n`;
      msg += `📅 *الرفع:* ${f.uploaded_at}\n`;
      msg += `⬇️ *التحميلات:* ${f.download_count}\n`;
      msg += `👤 *رافع الملف:* ${f.uploaded_by}\n`;
      if (f.is_starred) msg += "⭐ *محتوى مميز*\n";
      return msg;
    },
    btn_download: "⬇️ تحميل الملف",
    btn_back: "🔙 رجوع للقائمة",
  },

  // ====== شاشة S9: Contribution ======
  contribution: {
    intro: (subjectName: string) =>
      `💡 *المساهمة في: ${subjectName}*\n\n` +
      "شكراً لرغبتك في إثراء المحتوى! مساهمات الطلاب تساعد آلاف الزملاء.\n\n" +
      "*للمساهمة:*\n" +
      "📎 أرسل الآن الملف (PDF/DOCX/صورة)\n\n" +
      "*ملاحظات:*\n" +
      "✅ الحد الأقصى: 50 MB (PDF/DOCX)، 10 MB (صور)\n" +
      "❌ ممنوع: EXE, BAT, ZIP, RAR, APK\n" +
      "⏱ ستتم مراجعتك من المسؤول خلال 24-48 ساعة\n" +
      "🏆 المساهمات المقبولة تمنحك نقاطاً في لوحة الشرف",
    cancel: "✅ تم إلغاء المساهمة. يمكنك البدء من جديد في أي وقت.",
    received: (id: number, fileName: string) =>
      `✅ *تم استلام مساهمتك!*\n\n` +
      `📎 الملف: \`${fileName}\`\n` +
      `🔢 رقم المساهمة: \`#${id}\`\n\n` +
      "⏱ سيتم مراجعتها من قبل المسؤول خلال 24-48 ساعة.\n\n" +
      "💡 يمكنك متابعة حالة المساهمة من: *👤 حسابي → 📋 مساهماتي*",
  },

  // ====== شاشة S10: Search ======
  search: {
    intro:
      "🔍 *وضع البحث*\n\n" +
      "أرسل اسم المادة أو الملف أو الكلمة المفتاحية:\n\n" +
      "*أمثلة:*\n" +
      "• `Python` — يبحث في كل الملفات\n" +
      "• `قواعد البيانات`\n" +
      "• `الرياضيات`\n" +
      "• `OOP`",
    no_results: "🔍 لم يتم العثور على نتائج. جرب كلمة أخرى أو تحقق من الإملاء.",
    results_header: (count: number) =>
      `🔍 *نتائج البحث (${count} نتيجة)*\n\nاختر ملفاً للمعاينة:`,
    new_search: "🔍 بحث جديد",
  },

  // ====== شاشة S11: Leaderboard ======
  leaderboard: {
    title: "🏆 *لوحة الشرف*\n\nأبرز الطلاب المساهمين هذا الفصل:",
    filter_college: "🏛 تصفية بالكلية",
    filter_specialty: "📚 تصفية بالتخصص",
    refresh: "🔄 تحديث",
    show_all: "🌍 عرض الكل",
    empty_filtered: "📊 لا توجد بيانات في هذا النطاق.\nجرّب نطاقاً آخر أو اعرض الكل.",
    entry: (e: {
      badge?: string;
      rank: number;
      name: string;
      points: number;
      contributions: number;
      specialty?: string;
    }) => {
      const icon = e.badge || ` ${e.rank}.`;
      let line = `${icon} *${e.name}* — ${e.points} نقطة\n`;
      line += `     📥 ${e.contributions} مساهمة`;
      if (e.specialty) line += ` • 📚 ${e.specialty}`;
      return line;
    },
  },

  // ====== شاشة S12: Profile ======
  profile: {
    title: (name: string) => `👤 *حسابي*\n\nمرحباً *${name}* 👋\n\n`,
    stats: (stats: {
      total_downloads: number;
      accepted_contributions: number;
      pending_contributions: number;
      subscriptions_count: number;
      current_college?: string;
      current_specialty?: string;
      current_level?: number;
    }) => {
      let msg = "📊 *إحصائياتي:*\n";
      msg += `• 📥 إجمالي التحميلات: ${stats.total_downloads}\n`;
      msg += `• ✅ المساهمات المقبولة: ${stats.accepted_contributions}\n`;
      msg += `• ⏳ المساهمات المعلقة: ${stats.pending_contributions}\n`;
      msg += `• 🔔 الاشتراكات النشطة: ${stats.subscriptions_count}\n\n`;
      msg += "🎯 *تخصصي الحالي:*\n";
      msg += `• 🏛 الكلية: ${stats.current_college || "غير محدد"}\n`;
      msg += `• 📚 التخصص: ${stats.current_specialty || "غير محدد"}\n`;
      msg += `• 📊 المستوى: ${stats.current_level || "غير محدد"}`;
      return msg;
    },
    btn_my_contributions: "📋 مساهماتي",
    btn_my_downloads: "📥 آخر تحميلاتي",
    btn_my_subscriptions: "🔔 اشتراكاتي",
    btn_change_major: "🔄 تغيير التخصص",
    btn_back: "🔙 رجوع",
    no_contributions: "📚 لا توجد مساهمات بعد.\nابدأ المساهمة من قائمة أي مادة!",
    no_downloads: "📥 لا توجد تحميلات بعد.\nابدأ التصفّح من القائمة الرئيسية!",
    no_subscriptions: "🔔 لا توجد اشتراكات بعد.\nاشترك في أي مادة لتصلك إشعاراتها!",
  },

  // ====== أزرار التنقل العامة ======
  navigation: {
    back_to_main: "🔙 القائمة الرئيسية",
    back_to_colleges: "🔙 الكليات",
    back_to_majors: "🔙 التخصصات",
    back_to_levels: "🔙 المستويات",
    back_to_semesters: "🔙 الفصول",
    back_to_subjects: "🔙 المواد",
    back_to_subject_menu: "🔙 قائمة المادة",
    back_to_files_list: "🔙 قائمة الملفات",
    next_page: "➡️ التالي",
    prev_page: "⬅️ السابق",
  },

  // ====== رسائل عامة ======
  common: {
    loading: "⏳ جارٍ التحميل...",
    error: "⚠️ حدث خطأ. حاول مرة أخرى لاحقاً.",
    file_sent: "✅ تم إرسال الملف بنجاح!",
    file_sent_with_caption:
      "✅ *تم التحميل!*\n\n📄 {fileName}\n📚 {subjectName}\n\nشكراً لاستخدامك البوت. إن أعجبك المحتوى، شاركه مع زملائك!",
    subscribed: "🔔 تم الاشتراك! ستصلك إشعارات الملفات الجديدة.",
    unsubscribed: "🔕 تم إلغاء الاشتراك.",
    mockup_pdf_caption:
      "📄 *ملف تجريبي (Mockup)*\n\nفي الإنتاج سيصلك الملف الفعلي من قناة التخزين الخاصة بالكلية.",
  },
} as const;

// ============================================
// نصوص بوت الإدارة
// ============================================
export const ADMIN_TEXTS = {
  // ====== شاشة A1: AdminLogin ======
  login: {
    welcome:
      "🛡 *بوت الإدارة - UST Central*\n\n" +
      "مرحباً بك! للوصول إلى لوحة الإدارة، يجب التحقق من هويتك.\n\n" +
      "أرسل الآن معرّف المسؤول (Admin ID) المخصص لك.\n\n" +
      "*🧪 معرّفات تجريبية للاختبار:*\n" +
      "• `DEMO001` — 🛡 مسؤول مركزي (صلاحية كاملة)\n" +
      "• `DEMO002` — 🏛 مسؤول كلية الحاسبات\n" +
      "• `DEMO003` — 📚 مسؤول تخصص IT\n" +
      "• `DEMO004` — 📊 مسؤول مستوى (IT - مستوى 1)",
    not_authorized: (id: string) =>
      `❌ *غير مصرّح*\n\nالمعرّف \`${id}\` غير موجود في قائمة المسؤولين.\n\nتواصل مع المسؤول المركزي للحصول على صلاحية، أو جرّب أحد المعرّفات التجريبية.`,
    awaiting_login: "🔑 في انتظار معرّف المسؤول...",
    success: (adminName: string, roleLabel: string, scope: string) =>
      `✅ *تم تسجيل الدخول بنجاح!*\n\n` +
      `👤 الاسم: *${adminName}*\n` +
      `🎭 الدور: *${roleLabel}*\n` +
      `📍 النطاق: ${scope}`,
  },

  // ====== شاشة A2: AdminDashboard ======
  dashboard: {
    title: (adminName: string, roleLabel: string, pendingCount: number) =>
      `🛡 *لوحة الإدارة*\n\n` +
      `👤 *${adminName}*\n` +
      `🎭 ${roleLabel}\n\n` +
      `📥 المساهمات المعلقة: *${pendingCount}*\n\n` +
      "اختر الإجراء المطلوب:",
    btn_pending: (count: number) => `📥 المساهمات المعلقة (${count})`,
    btn_files_mgmt: "📁 إدارة الملفات",
    btn_subjects_mgmt: "📖 إدارة المواد",
    btn_broadcast: "📢 تعميم",
    btn_manage_admins: "👥 إدارة المسؤولين",
    btn_statistics: "📊 إحصائيات",
    btn_customize: "⚙️ تخصيص النصوص",
    btn_leaderboard: "🏆 لوحة الشرف",
    btn_logout: "🚪 تسجيل الخروج",
  },

  // ====== شاشة A3: PendingList ======
  pending: {
    title: (count: number) =>
      `📥 *المساهمات المعلقة (${count})*\n\nاختر مساهمة للمراجعة:`,
    empty:
      "✅ *لا توجد مساهمات معلقة*\n\nجميع المساهمات تمت مراجعتها. أحسنت!",
  },

  // ====== شاشة A4: ReviewContribution ======
  review: {
    title: (c: {
      id: number;
      fileName: string;
      subjectName: string;
      userName: string;
      uploadedAt: string;
      fileSizeMb: number;
      description?: string;
    }) =>
      `📥 *مراجعة مساهمة #${c.id}*\n\n` +
      `📎 *الملف:* \`${c.fileName}\`\n` +
      `📊 *الحجم:* ${c.fileSizeMb.toFixed(2)} MB\n` +
      `📚 *المادة:* ${c.subjectName}\n` +
      `👤 *المساهم:* ${c.userName}\n` +
      `📅 *الرفع:* ${c.uploadedAt}\n` +
      (c.description ? `📝 *الوصف:* ${c.description}\n` : "") +
      "\nاختر الإجراء:",
    approve: "✅ اعتماد",
    approve_starred: "⭐ اعتماد مميز",
    reject: "❌ رفض",
  },

  // ====== شاشة A4b: RejectReason ======
  reject_reason: {
    title: "❌ *اختر سبب الرفض:*",
    dup: "♻️ مكرر",
    bad: "👁 غير واضح",
    irrelevant: "🚫 لا يتعلق بالمادة",
    incomplete: "📝 غير مكتمل",
    skip: "⏭ تخطي السبب",
    confirm: (reason: string, id: number) =>
      `❌ *تأكيد رفض المساهمة #${id}*\n\n` +
      `السبب المختار: *${reason}*\n\n` +
      "هل أنت متأكد؟",
    btn_confirm: "✅ نعم، ارفض",
    btn_cancel: "❌ إلغاء",
    done: (reason: string, id: number) =>
      `✅ *تم رفض المساهمة #${id}*\n\nالسبب: ${reason}\n\nسيتم إشعار المساهم برسالة توضيحية.`,
  },

  // ====== شاشة A5: FilesMgmt ======
  files_mgmt: {
    title: "📁 *إدارة الملفات*\n\nاختر الإجراء:",
    btn_upload: "📤 رفع ملف",
    btn_browse: "📂 استعراض الملفات",
  },

  // ====== شاشة A5a: UploadWizard ======
  upload_wizard: {
    progress_header: (step: number, total: number) =>
      `📤 *رفع ملف - خطوة ${step}/${total}*\n\n`,
    start: "اختر الكلية:",
    select_major: "اختر التخصص:",
    select_level: "اختر المستوى:",
    select_semester: "اختر الفصل:",
    select_subject: "اختر المادة:",
    select_type: "اختر تصنيف الملف:",
    confirm: (fileName: string, subjectName: string, typeLabel: string) =>
      `✅ *تأكيد الرفع*\n\n` +
      `📎 الملف: \`${fileName}\`\n` +
      `📚 المادة: ${subjectName}\n` +
      `🏷 التصنيف: ${typeLabel}\n\n` +
      "أرسل الملف الآن للتأكيد (في وضع التجربة سيتم محاكاة الرفع).",
    awaiting_file: "📎 *أرسل الملف الآن* (PDF/DOCX/صورة):",
    success: "✅ *تم رفع الملف بنجاح!*\n\nالملف متاح الآن للطلاب في القناة.",
  },

  // ====== شاشة A5b: BrowseFiles ======
  browse_files: {
    title: "📂 *استعراض الملفات*\n\nاختر فلتراً أو اعرض الكل:",
    btn_all: "📋 عرض كل الملفات",
    btn_by_college: "🏛 فلترة بالكلية",
    btn_by_specialty: "📚 فلترة بالتخصص",
    btn_search: "🔍 بحث في الملفات",
    files_header: (count: number) => `📂 *الملفات (${count})*\n\n`,
    file_entry: (f: {
      id: string;
      name: string;
      subject: string;
      size: number;
      downloads: number;
    }) =>
      `📄 *${f.name}*\n   📚 ${f.subject} • ${f.size.toFixed(1)} MB • ⬇️ ${f.downloads}\n`,
  },

  // ====== شاشة A6: SubjectsMgmt ======
  subjects_mgmt: {
    title: "📖 *إدارة المواد*\n\nاختر الإجراء:",
    btn_add: "➕ إضافة مادة",
    btn_list: "📋 قائمة المواد",
    btn_edit: "✏️ تعديل/حذف مادة",
    add_prompt: "📝 أرسل اسم المادة الجديدة:",
    add_done: (name: string) => `✅ تمت إضافة المادة: *${name}* (محاكاة)`,
    list_header: (count: number) => `📋 *قائمة المواد (${count})*\n\n`,
  },

  // ====== شاشة A7: Broadcast ======
  broadcast: {
    title: "📢 *التعميم*\n\nاختر نطاق التعميم:",
    btn_all: "🌍 للكل",
    btn_college: "🏛 لكلية",
    btn_major: "📚 لتخصص",
    btn_level: "📊 لمستوى",
    prompt_text: (scope: string) =>
      `📝 *التعميم - ${scope}*\n\nأرسل نص التعميم الآن:`,
    preview: (text: string, scope: string, recipientCount: number) =>
      `👀 *معاينة التعميم*\n\n` +
      `📍 النطاق: ${scope}\n` +
      `👥 المستلمون المتوقعون: ${recipientCount}\n\n` +
      `📝 *النص:*\n${text}\n\n` +
      "هل تريد الإرسال؟",
    btn_send: "✅ إرسال",
    btn_cancel: "❌ إلغاء",
    sent: (count: number) =>
      `✅ *تم إرسال التعميم*\n\n` +
      `👥 عدد المستلمين: ${count}\n` +
      `⏱ وقت الإرسال: ${new Date().toLocaleString("ar")}`,
  },

  // ====== شاشة A8: ManageAdmins ======
  manage_admins: {
    title: "👥 *إدارة المسؤولين*\n\nاختر الإجراء:",
    btn_add: "➕ إضافة مسؤول",
    btn_list: "📋 قائمة المسؤولين",
    list_header: (count: number) => `📋 *قائمة المسؤولين (${count})*\n\n`,
    entry: (a: {
      name: string;
      roleLabel: string;
      scope: string;
      id: string;
    }) =>
      `• *${a.name}*\n  ${a.roleLabel} • ${a.scope}\n  🆔 \`${a.id}\`\n`,
  },

  // ====== شاشة A9: Statistics ======
  statistics: {
    title: "📊 *الإحصائيات العامة*\n\n",
    content: (s: {
      total_users: number;
      active_today: number;
      new_this_week: number;
      total_files: number;
      total_contributions: number;
      pending_contributions: number;
      total_downloads: number;
      total_broadcasts: number;
    }) =>
      `👥 *المستخدمون:*\n` +
      `   • الإجمالي: ${s.total_users.toLocaleString()}\n` +
      `   • نشط اليوم: ${s.active_today}\n` +
      `   • جدد هذا الأسبوع: ${s.new_this_week}\n\n` +
      `📁 *المحتوى:*\n` +
      `   • إجمالي الملفات: ${s.total_files}\n` +
      `   • إجمالي المساهمات: ${s.total_contributions}\n` +
      `   • المساهمات المعلقة: ${s.pending_contributions}\n\n` +
      `📊 *النشاط:*\n` +
      `   • إجمالي التحميلات: ${s.total_downloads.toLocaleString()}\n` +
      `   • إجمالي التعميمات: ${s.total_broadcasts}`,
    refresh: "🔄 تحديث",
  },

  // ====== شاشة A10: CustomizeTexts ======
  customize: {
    title: "⚙️ *تخصيص النصوص*\n\nاختر الشاشة لتخصيصها:",
    btn_main_menu: "🏠 القائمة الرئيسية",
    btn_choose_college: "🏛 اختيار الكلية",
    btn_subject_menu: "📖 قائمة المادة",
    btn_search: "🔍 شاشة البحث",
    edit_prompt: (current: string) =>
      `✏️ *النص الحالي:*\n\n${current}\n\nأرسل النص الجديد:`,
    saved: (newText: string) =>
      `✅ *تم حفظ النص المخصص*\n\nالنص الجديد:\n${newText}\n\nسيظهر للطلاب في الشاشة المحددة.`,
    reset: "↩️ تم استعادة النص الافتراضي.",
  },

  // ====== شاشة A11: LeaderboardUpdate ======
  leaderboard_update: {
    title: "🏆 *تحديث لوحة الشرف*\n\nاختر النطاق للتحديث:",
    btn_global: "🌍 لوحة عالمية",
    btn_college: "🏛 لوحة كلية",
    btn_specialty: "📚 لوحة تخصص",
    refresh_done: (scope: string) =>
      `✅ *تم تحديث لوحة الشرف*\n\n📍 النطاق: ${scope}\n⏱ وقت التحديث: ${new Date().toLocaleString("ar")}`,
  },

  // ====== أزرار التنقل ======
  navigation: {
    back_to_dashboard: "🔙 لوحة الإدارة",
    back_to_pending: "🔙 المساهمات",
    back_to_review: "🔙 المراجعة",
    back_to_files_mgmt: "🔙 إدارة الملفات",
    back_to_subjects_mgmt: "🔙 إدارة المواد",
    back_to_broadcast: "🔙 التعميم",
    back_to_manage_admins: "🔙 إدارة المسؤولين",
    back_to_customize: "🔙 تخصيص النصوص",
  },
} as const;
