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
      "• 🏆 شاهد أبرز المحسنين من زملائك\n" +
      "• 👤 تابع نشاطك (تحميلات + إحسانات)\n" +
      "• 🌟 ساهم في إثراء المحتوى",
    welcome_registered: (name: string, college: string, specialty: string, level: number) =>
      `🎓 *مرحباً بك ${name}!*\n` +
      `*جامعة العلوم والتكنولوجيا - اليمن*\n\n` +
      `📌 *تخصصك الحالي:*\n` +
      `🏛 ${college}\n📚 ${specialty}\n📊 المستوى ${level}\n\n` +
      "اختر الخدمة المطلوبة:",
    btn_colleges: "🏛 الكليات",
    btn_search: "🔍 بحث",
    btn_leaderboard: "🏆 روّاد الإحسان",
    btn_profile: "👤 حسابي",
    btn_committee: "📢 قناة اللجنة",
    btn_contact: "📞 تواصل معنا",
    btn_contribute: "🌟 إحسان علمي",
  },

  // ====== شاشة S0: التسجيل الإلزامي (لمستخدمي البوت الجدد) ======
  registration: {
    intro:
      "👋 *مرحباً بك في البوت العلمي المركزي!*\n\n" +
      "🚀 لإكمال تسجيلك والاستفادة من جميع الميزات، نحتاج لمعرفة تخصصك.\n\n" +
      "📋 *لماذا نحتاج هذه المعلومات؟*\n" +
      "• 📢 لتصلك تعاميم اللجنة العلمية الخاصة بتخصصك\n" +
      "• 📊 لإحصائك ضمن روّاد الإحسان\n" +
      "• 🎯 لعرض محتوى تخصصك أولاً\n\n" +
      "_العملية تستغرق 30 ثانية فقط._",
    btn_start: "🚀 ابدأ التسجيل",
    btn_later: "⏭ لاحقاً (تصفّح فقط)",
    step: (step: number, total: number, label: string) =>
      `📝 *التسجيل - خطوة ${step}/${total}*\n\n${label}`,
    select_college: "اختر كليتك:",
    select_specialty: "اختر تخصصك:",
    select_level: "اختر مستواك الدراسي:",
    complete: (name: string, college: string, specialty: string, level: number) =>
      `✅ *تم التسجيل بنجاح!*\n\n` +
      `👤 *الاسم:* ${name}\n` +
      `🏛 *الكلية:* ${college}\n` +
      `📚 *التخصص:* ${specialty}\n` +
      `📊 *المستوى:* ${level}\n\n` +
      "🎉 يمكنك الآن استخدام البوت بالكامل.\n" +
      "📢 ستصلك تعاميم اللجنة العلمية لتخصصك تلقائياً.\n\n" +
      "_يمكنك تغيير تخصصك لاحقاً من: 👤 حسابي → 🔄 تغيير التخصص_",
    later_notice:
      "⚠️ *التسجيل مؤجل*\n\n" +
      "يمكنك تصفّح البوت بحرية، لكن لن تصلك تعاميم اللجنة العلمية.\n\n" +
      "💡 يمكنك التسجيل لاحقاً من: 👤 حسابي → 📌 تحديد تخصصي",
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
    title: (subjectName: string) =>
      `📖 *${subjectName}*\n\n` +
      "اختر نوع المحتوى:",
    btn_book_theory: (count: number) => `📘 المقرر (نظري) — ${count}`,
    btn_book_practical: (count: number) => `📗 المقرر (عملي) — ${count}`,
    btn_exams: (count: number) => `📑 نماذج اختبارات — ${count}`,
    btn_summaries: (count: number) => `📝 ملخصات — ${count}`,
    btn_contribute: "💡 إحسان علمي",
    no_files_in_category: "لا توجد ملفات",
  },

  // ====== شاشة S8: قائمة الملفات ======
  files_list: {
    title: (subjectName: string, typeLabel: string) =>
      `📄 *${subjectName} - ${typeLabel}*\n\nاختر ملفاً للمعاينة:`,
    no_files: "📭 لا توجد ملفات في هذا التصنيف حالياً.\n💡 يمكنك الإحسان بأول ملف!",
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
      is_starred: boolean;
    }) => {
      let msg = "";
      msg += `📝 *الاسم:* \`${f.file_name}\`\n`;
      msg += `📊 *الحجم:* ${f.file_size_mb.toFixed(2)} MB\n`;
      msg += `🏷 *التصنيف:* ${f.type_label}\n`;
      msg += `📚 *المادة:* ${f.subject_name}\n`;
      msg += `📅 *الرفع:* ${f.uploaded_at}\n`;
      msg += `⬇️ *التحميلات:* ${f.download_count}\n`;
      if (f.is_starred) msg += "⭐ *محتوى مميز*\n";
      return msg;
    },
    btn_download: "⬇️ تحميل الملف",
    btn_back: "🔙 رجوع للقائمة",
  },

  // ====== شاشة S9: الإحسان (من شاشة المادة - 5 خطوات) ======
  contribution: {
    intro: (subjectName: string) =>
      `🌟 *الإحسان في: ${subjectName}*\n\n` +
      "اختر نوع المحتوى:\n",
    cancel: "✅ تم إلغاء الإحسان. يمكنك البدء من جديد في أي وقت.",
    prompt_title: "📝 *أدخل عنوان المحتوى*\n\nأرسل عنواناً وصفيّاً للإحسان:",
    prompt_description: "📌 *أدخل وصفاً مختصراً*\n\nأرسل وصفاً موجزاً (اختياري - أرسل '-' للتخطي):",
    prompt_file: (title: string) =>
      `📎 *رفع المحتوى*\n\n📝 العنوان: ${title}\n\nأرسل الملف الآن:`,
    preview: (data: {
      typeName: string;
      subjectName: string;
      title: string;
      description?: string;
    }) =>
      `🌟 *مراجعة الإحسان*\n\n` +
      `النوع: ${data.typeName}\n` +
      `المادة: ${data.subjectName}\n` +
      `العنوان: ${data.title}\n` +
      (data.description ? `الوصف: ${data.description}\n` : "") +
      `\n[✅ إرسال]\n[❌ إلغاء]`,
    received: (id: number) =>
      `✅ *تم استلام الإحسان!*\n\n` +
      `🔢 *رقم الإحسان:* \`#${id}\`\n\n` +
      "🟡 حالته الآن: *قيد المراجعة*\n" +
      "سيتم إشعارك عند الاعتماد.\n\n" +
      "🌟 شكراً لإحسانك العلمي!",
    // Main flow (from main menu)
    main_intro: "🌟 *إحسان علمي*\n\nشارك في بناء المحتوى العلمي\n\n➕ قدم إحسانًا",
  },

  // ====== شاشة S13: الإحسان من القائمة الرئيسية (5 خطوات) ======
  contribution_main: {
    intro: "🌟 *إحسان علمي*\n\nشارك في بناء المحتوى العلمي\n\n➕ قدم إحسانًا",
    cancel: "✅ تم إلغاء الإحسان. يمكنك البدء من جديد في أي وقت من زر 🌟 إحسان علمي.",
    select_type: "اختر نوع المحتوى:",
    select_college: "اختر الكلية:",
    select_specialty: "اختر التخصص:",
    select_subject: "اختر المادة:",
    prompt_title: "📝 *أدخل عنوان المحتوى*\n\nأرسل عنواناً وصفيّاً للإحسان:",
    prompt_description: "📌 *أدخل وصفاً مختصراً*\n\nأرسل وصفاً موجزاً (اختياري - أرسل '-' للتخطي):",
    prompt_file: (title: string) =>
      `📎 *رفع المحتوى*\n\n📝 العنوان: ${title}\n\nأرسل الملف الآن:`,
    preview: (data: {
      typeName: string;
      subjectName: string;
      title: string;
      description?: string;
    }) =>
      `🌟 *مراجعة الإحسان*\n\n` +
      `النوع: ${data.typeName}\n` +
      `المادة: ${data.subjectName}\n` +
      `العنوان: ${data.title}\n` +
      (data.description ? `الوصف: ${data.description}\n` : "") +
      `\n[✅ إرسال]\n[❌ إلغاء]`,
    received: (id: number) =>
      `✅ *تم استلام الإحسان!*\n\n` +
      `🔢 *رقم الإحسان:* \`#${id}\`\n\n` +
      "🟡 حالته الآن: *قيد المراجعة*\n" +
      "سيتم إشعارك عند الاعتماد.\n\n" +
      "🌟 شكراً لإحسانك العلمي!",
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

  // ====== شاشة S11: Leaderboard — روّاد الإحسان ======
  leaderboard: {
    title: "🏆 *روّاد الإحسان*\n\nأبرز المحسنين هذا الفصل الدراسي:",
    btn_current: "🌍 الترتيب الحالي",
    btn_archive: "📜 أرشيف الدورات السابقة",
    archive_message:
      "📜 *أرشيف الدورات السابقة*\n\n" +
      "يمكنك مشاهدة ترتيب روّاد الإحسان في الدورات السابقة عبر قناة الأرشيف:\n\n" +
      "🔗 @ust_ihsan_archive",
    select_college: "🏛 *روّاد الإحسان — اختر الكلية:*",
    select_specialty: (collegeName: string) => `📚 *روّاد الإحسان — ${collegeName}*\n\nاختر التخصص:`,
    select_level: (specName: string) => `📊 *روّاد الإحسان — ${specName}*\n\nاختر المستوى:`,
    empty_level: "لا يوجد محسنون في هذا المستوى بعد.",
    header_level: (specName: string, level: number) =>
      `🏆 *روّاد الإحسان*\n\n📚 ${specName} — 📊 المستوى ${level}\n\n`,
    entry: (e: {
      badge?: string;
      rank: number;
      name: string;
      points: number;
      contributions?: number;
      specialty?: string;
    }) => {
      const icon = e.badge || ` ${e.rank}.`;
      let line = `${icon} *${e.name}* — ${e.points} ⭐\n`;
      if (e.contributions !== undefined) {
        line += `     📥 ${e.contributions} إحسان`;
        if (e.specialty) line += ` • 📚 ${e.specialty}`;
      }
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
      total_points?: number;
      rank?: number;
      current_college?: string;
      current_specialty?: string;
      current_level?: number;
    }) => {
      let msg = "📊 *إحصائياتي:*\n";
      msg += `• ⭐ نقاطك: ${stats.total_points ?? 0}\n`;
      msg += `• 🏆 ترتيبك: ${stats.rank && stats.rank > 0 ? `#${stats.rank} في مستواك` : "غير مصنّف بعد"}\n`;
      msg += `• 📥 إجمالي التحميلات: ${stats.total_downloads}\n`;
      msg += `• ✅ الإحسانات المقبولة: ${stats.accepted_contributions}\n`;
      msg += `• ⏳ الإحسانات المعلقة: ${stats.pending_contributions}\n\n`;
      msg += "🎯 *تخصصي الحالي:*\n";
      msg += `• 🏛 الكلية: ${stats.current_college || "غير محدد"}\n`;
      msg += `• 📚 التخصص: ${stats.current_specialty || "غير محدد"}\n`;
      msg += `• 📊 المستوى: ${stats.current_level || "غير محدد"}`;
      return msg;
    },
    btn_my_contributions: "🌟 إحساناتي",
    btn_change_major: "🔄 تغيير التخصص",
    btn_back: "🔙 رجوع",
    no_contributions: "🌟 لا توجد إحسانات بعد.\nابدأ الإحسان من قائمة أي مادة!",
  },

  // ====== شاشة إحساناتي (تفاصيل) ======
  ihsanati: {
    title: (total: number) => `🌟 *إحساناتي (${total})*\n\n`,
    summary: (s: {
      total_points: number;
      rank?: number;
      approved: number;
      approved_starred: number;
      pending: number;
      rejected: number;
    }) => {
      let msg = "";
      msg += `📊 نقاطك: ${s.total_points} ⭐\n`;
      msg += `🏆 ترتيبك: ${s.rank && s.rank > 0 ? `#${s.rank} في مستواك` : "غير مصنّف بعد"}\n\n`;
      msg += `✅ معتمد: ${s.approved}`;
      if (s.approved_starred > 0) msg += ` (⭐ ${s.approved_starred} مميّز)`;
      msg += `\n`;
      msg += `🟡 قيد المراجعة: ${s.pending}\n`;
      msg += `❌ مرفوض: ${s.rejected}\n`;
      return msg;
    },
    btn_details: "📋 عرض التفاصيل",
    btn_back_to_summary: "🔙 العودة للملخص",
    details_title: "🌟 *إحساناتي — التفاصيل*\n\n",
    entry: (c: {
      status_icon: string;
      title: string;
      subject_name: string;
      type_label: string;
      points?: number;
      status_label: string;
      is_starred?: boolean;
      reject_reason?: string;
      pending_since?: string;
    }) => {
      let line = `${c.status_icon} ${c.title} — ${c.subject_name}\n`;
      line += `   ${c.type_label}`;
      if (c.points && c.points > 0) line += ` | ${c.points} نقطة`;
      line += ` | ${c.status_label}`;
      if (c.is_starred) line += " ⭐";
      line += `\n`;
      if (c.reject_reason) line += `   ❓ ${c.reject_reason}\n`;
      if (c.pending_since) line += `   ⏱ ${c.pending_since}\n`;
      return line;
    },
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
      "✅ *تم التحميل!*\n\n📄 {fileName}\n📚 {subjectName}",
    mockup_pdf_caption:
      "📄 *ملف تجريبي (Mockup)*\n\nفي الإنتاج سيصلك الملف الفعلي من قناة التخزين الخاصة بالكلية.",
  },
} as const;

// ============================================
// نصوص بوت الإدارة
// ============================================
export const ADMIN_TEXTS = {
  // ====== شاشة A2: AdminDashboard (وصول مباشر - لا تسجيل دخول) ======
  dashboard: {
    title: (adminName: string, roleLabel: string, pendingCount: number) =>
      `🛡 *لوحة الإدارة*\n\n` +
      `👤 *${adminName}*\n` +
      `🎭 ${roleLabel}\n\n` +
      `📥 الإحسانات المعلقة: *${pendingCount}*\n\n` +
      "اختر الإجراء المطلوب:",
    btn_pending: (count: number) => `📥 الإحسانات المعلقة (${count})`,
    btn_files_mgmt: "📁 إدارة الملفات",
    btn_subjects_mgmt: "📖 إدارة المواد",
    btn_broadcast: "📢 تعميم",
    btn_manage_admins: "👥 إدارة المسؤولين",
    btn_statistics: "📊 إحصائيات",
    btn_customize: "⚙️ تخصيص النصوص",
    btn_leaderboard: "🏆 روّاد الإحسان",
  },

  // ====== شاشة A3: PendingList ======
  pending: {
    title: (count: number) =>
      `📥 *الإحسانات المعلقة (${count})*\n\nاختر إحساناً للمراجعة:`,
    empty:
      "✅ *لا توجد إحسانات معلقة*\n\nجميع الإحسانات تمت مراجعتها. أحسنت!",
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
      `📥 *مراجعة إحسان #${c.id}*\n\n` +
      `📎 *الملف:* \`${c.fileName}\`\n` +
      `📊 *الحجم:* ${c.fileSizeMb.toFixed(2)} MB\n` +
      `📚 *المادة:* ${c.subjectName}\n` +
      `👤 *المحسن:* ${c.userName}\n` +
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
      `❌ *تأكيد رفض الإحسان #${id}*\n\n` +
      `السبب المختار: *${reason}*\n\n` +
      "هل أنت متأكد؟",
    btn_confirm: "✅ نعم، ارفض",
    btn_cancel: "❌ إلغاء",
    done: (reason: string, id: number) =>
      `✅ *تم رفض الإحسان #${id}*\n\nالسبب: ${reason}\n\nسيتم إشعار المحسن برسالة توضيحية.`,
  },

  // ====== شاشة A5: FilesMgmt ======
  files_mgmt: {
    title: "📁 *إدارة الملفات*\n\nاختر الإجراء:",
    btn_upload: "📤 رفع ملف",
    btn_browse: "📂 استعراض الملفات",
  },

  // ====== شاشة A5a: UploadWizard — مُحدّث في المرحلة 1 (انظر content_mgmt.upload_wizard) ======

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

  // ====== شاشة A6: SubjectsMgmt (إدارة المواد الحقيقية) ======
  subjects_mgmt: {
    title: "📚 *إدارة المواد*\n\nاختر الإجراء:",
    btn_add: "➕ إضافة مادة",
    btn_list: "📋 استعراض المواد",
    btn_edit: "✏️ تعديل/حذف مادة",
    // إضافة
    add_select_college: "➕ *إضافة مادة*\n\nاختر الكلية:",
    add_select_specialty: (collegeName: string) => `➕ *إضافة مادة*\n\n🏛 ${collegeName}\n\nاختر التخصص:`,
    add_select_level: (specName: string) => `➕ *إضافة مادة*\n\n📚 ${specName}\n\nاختر المستوى:`,
    add_select_semester: (specName: string, level: number) =>
      `➕ *إضافة مادة*\n\n📊 ${specName} — المستوى ${level}\n\nاختر الفصل:`,
    add_prompt_name: "📝 أرسل *اسم المادة* الجديدة:",
    add_prompt_code: "🏷 أرسل *كود المادة* (مثلاً: CS101)\n\nأرسل '-' للتخطي:",
    add_prompt_credits: "⏱ أرسل *عدد الساعات المعتمدة* (رقم)\n\nأرسل '-' للتخطي:",
    add_prompt_theory: "📖 هل تحتوي المادة على مقرر نظري؟",
    add_prompt_practical: "📗 هل تحتوي المادة على مقرر عملي؟",
    add_confirm: (data: {
      name: string; code?: string; credits?: number;
      has_theory: boolean; has_practical: boolean;
      specName: string; level: number; semester: number;
    }) =>
      `✅ *تأكيد إضافة المادة*\n\n` +
      `📝 *الاسم:* ${data.name}\n` +
      (data.code ? `🏷 *الكود:* ${data.code}\n` : "") +
      (data.credits ? `⏱ *الساعات:* ${data.credits}\n` : "") +
      `📖 *نظري:* ${data.has_theory ? "✅" : "❌"}\n` +
      `📗 *عملي:* ${data.has_practical ? "✅" : "❌"}\n\n` +
      `📚 *التخصص:* ${data.specName}\n` +
      `📊 *المستوى:* ${data.level} | *الفصل:* ${data.semester}\n\n` +
      `هل تريد الإضافة؟`,
    add_success: (name: string) => `✅ *تمت إضافة المادة بنجاح!*\n\n📝 ${name}\n\nباتت متاحة للطلاب الآن.`,
    add_canceled: "✅ تم إلغاء إضافة المادة.",
    // استعراض
    list_select_college: "📋 *استعراض المواد*\n\nاختر الكلية:",
    list_select_specialty: (collegeName: string) => `📋 *استعراض المواد*\n\n🏛 ${collegeName}\n\nاختر التخصص:`,
    list_select_level: (specName: string) => `📋 *استعراض المواد*\n\n📚 ${specName}\n\nاختر المستوى:`,
    list_select_semester: (specName: string, level: number) =>
      `📋 *استعراض المواد*\n\n📊 ${specName} — المستوى ${level}\n\nاختر الفصل:`,
    list_empty: "📭 لا توجد مواد في هذا القسم.\n💡 أضف مادة من زر ➕ إضافة مادة.",
    list_subjects_header: (count: number) => `📋 *المواد (${count})*\n\nاختر مادة للإدارة:`,
    // تفاصيل المادة
    detail_title: "📖 *تفاصيل المادة*\n\n",
    detail_fields: (s: {
      name: string; code?: string; credits?: number;
      has_theory: boolean; has_practical: boolean;
      level: number; semester: number; sort_order: number;
      content_count: number;
    }) =>
      `📝 *الاسم:* ${s.name}\n` +
      (s.code ? `🏷 *الكود:* ${s.code}\n` : "") +
      (s.credits ? `⏱ *الساعات:* ${s.credits}\n` : "") +
      `📖 *نظري:* ${s.has_theory ? "✅" : "❌"}\n` +
      `📗 *عملي:* ${s.has_practical ? "✅" : "❌"}\n` +
      `📊 *المستوى:* ${s.level} | *الفصل:* ${s.semester} | *الترتيب:* ${s.sort_order}\n` +
      `📁 *المحتوى المرتبط:* ${s.content_count} ملف\n`,
    btn_edit_name: "📝 تعديل الاسم",
    btn_edit_code: "🏷 تعديل الكود",
    btn_edit_credits: "⏱ تعديل الساعات",
    btn_move_semester: "🔄 نقل لفصل آخر",
    btn_move_level: "🔄 نقل لمستوى آخر",
    btn_reorder_up: "🔺 للأعلى",
    btn_reorder_down: "🔻 للأسفل",
    btn_delete: "🗑 حذف المادة",
    // تعديل
    edit_prompt_name: "📝 أرسل *الاسم الجديد* للمادة:",
    edit_prompt_code: "🏷 أرسل *الكود الجديد* (أرسل '-' لمسح الكود):",
    edit_prompt_credits: "⏱ أرسل *الساعات الجديدة* (أرسل '-' لمسح الساعات):",
    edit_success: (field: string) => `✅ تم تحديث *${field}* بنجاح.`,
    // نقل
    move_sem_select: (currentSem: number) => `🔄 *نقل المادة لفصل آخر*\n\nالفصل الحالي: ${currentSem}\n\nاختر الفصل الجديد:`,
    move_lvl_select: (currentLevel: number, maxLevel: number) => `🔄 *نقل المادة لمستوى آخر*\n\nالمستوى الحالي: ${currentLevel}\n\nاختر المستوى الجديد:`,
    move_success: (newLabel: string) => `✅ تم نقل المادة بنجاح إلى ${newLabel}.`,
    // ترتيب
    reorder_success_up: "✅ تم تحريك المادة للأعلى.",
    reorder_success_down: "✅ تم تحريك المادة للأسفل.",
    reorder_no_change: "⚠️ المادة في الحافة — لا يمكن تحريكها أكثر.",
    // حذف
    delete_confirm: (name: string, contentCount: number) =>
      `⚠️ *تأكيد حذف المادة*\n\n` +
      `📄 ${name}\n` +
      (contentCount > 0
        ? `⚠️ *تحذير:* تحتوي على ${contentCount} ملف محتوى.\n` +
          `المحتوى سيبقى لكن لن تظهر المادة للطلاب.\n\n`
        : `لا يوجد محتوى مرتبط بها.\n\n`) +
      `سيتم تعطيل المادة (حذف ناعم).\n\nهل أنت متأكد؟`,
    delete_success: "✅ تم حذف المادة بنجاح.\n\nالمادة معطّلة ولن تظهر للطلاب.",
  },

  // ====== شاشة A7: Broadcast ======
  broadcast: {
    title: "📢 *التعميم*\n\nاختر نطاق التعميم:",
    title_for_central: "📢 *التعميم (مسؤول مركزي)*\n\nاختر نطاق التعميم:",
    title_for_college: (collegeName: string) =>
      `📢 *التعميم (مسؤول ${collegeName})*\n\nاختر نطاق التعميم:`,
    title_for_level: (specialtyName: string, level: number) =>
      `📢 *التعميم (مسؤول دفعة ${specialtyName} - مستوى ${level})*\n\nاختر النطاق:`,
    btn_all: "🌍 لكل الطلاب",
    btn_college: (count: number) => "🏛 لكلية محددة",
    btn_my_college: (collegeName: string, count: number) => `🏛 ${collegeName} (${count} طالب)`,
    btn_specialty: (count: number) => "📚 لتخصص محدد",
    btn_my_specialty: (specialtyName: string, count: number) => `📚 ${specialtyName} (${count} طالب)`,
    btn_level: (count: number) => "📊 لمستوى محدد",
    btn_my_level: (specialtyName: string, level: number, count: number) =>
      `📊 ${specialtyName} - مستوى ${level} (${count} طالب)`,
    select_college: "🏛 اختر الكلية للتعاميم:",
    select_specialty: (collegeName: string) => `📚 اختر التخصص في ${collegeName}:`,
    select_level: (specialtyName: string) => `📊 اختر المستوى في ${specialtyName}:`,
    recipient_preview: (scopeLabel: string, count: number) =>
      `📍 *النطاق:* ${scopeLabel}\n👥 *المستلمون:* ${count} طالب\n\n`,
    prompt_text: (scopeLabel: string, count: number) =>
      `📢 *التعميم*\n\n` +
      `📍 النطاق: ${scopeLabel}\n` +
      `👥 المستلمون: ${count} طالب\n\n` +
      "💡 *يمكنك إرسال:*\n" +
      "📝 نص عادي (اكتب فقط)\n" +
      "🖼 صورة (مع أو بدون تعليق)\n" +
      "📎 ملف (PDF/DOCX/...)",
    preview: (text: string, scope: string, recipientCount: number) =>
      `👀 *معاينة التعميم*\n\n` +
      `📍 النطاق: ${scope}\n` +
      `👥 المستلمون: ${recipientCount}\n\n` +
      `📝 *النص:*\n${text}\n\n` +
      "هل تريد الإرسال؟",
    btn_send: "✅ إرسال",
    btn_cancel: "❌ إلغاء",
    sent: (count: number, scope: string) =>
      `✅ *تم إرسال التعميم بنجاح!*\n\n` +
      `📍 النطاق: ${scope}\n` +
      `👥 المستلمون: ${count} طالب\n` +
      `⏱ وقت الإرسال: ${new Date().toLocaleString("ar")}\n\n` +
      "_في الإنتاج: سيتم الإرسال الفعلي عبر Cloudflare Queues._",
    sent_file: (fileName: string, count: number, scope: string) =>
      `✅ *تم إرسال التعميم بنجاح!*\n\n` +
      `📎 الملف: \`${fileName}\`\n` +
      `📍 النطاق: ${scope}\n` +
      `👥 المستلمون: ${count} طالب\n` +
      `⏱ وقت الإرسال: ${new Date().toLocaleString("ar")}`,
    sent_photo: (caption: string, count: number, scope: string) =>
      `✅ *تم إرسال التعميم بنجاح!*\n\n` +
      `🖼 صورة\n` +
      `📝 التعليق: ${caption}\n` +
      `📍 النطاق: ${scope}\n` +
      `👥 المستلمون: ${count} طالب\n` +
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
      `   • إجمالي الإحسانات: ${s.total_contributions}\n` +
      `   • الإحسانات المعلقة: ${s.pending_contributions}\n\n` +
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
    title: "🏆 *تحديث روّاد الإحسان*\n\nاختر النطاق للتحديث:",
    btn_global: "🌍 لوحة عالمية",
    btn_college: "🏛 لوحة كلية",
    btn_specialty: "📚 لوحة تخصص",
    refresh_done: (scope: string) =>
      `✅ *تم تحديث روّاد الإحسان*\n\n📍 النطاق: ${scope}\n⏱ وقت التحديث: ${new Date().toLocaleString("ar")}`,
  },

  // ====== أزرار التنقل ======
  navigation: {
    back_to_dashboard: "🔙 لوحة الإدارة",
    back_to_pending: "🔙 الإحسانات",
    back_to_review: "🔙 المراجعة",
    back_to_files_mgmt: "🔙 إدارة الملفات",
    back_to_subjects_mgmt: "🔙 إدارة المواد",
    back_to_broadcast: "🔙 التعميم",
    back_to_manage_admins: "🔙 إدارة المناصب",
    back_to_customize: "🔙 تخصيص النصوص",
    back_to_content_mgmt: "🔙 إدارة المحتوى",
    back_to_positions: "🔙 المناصب",
    back_to_channels: "🔙 قنوات اللجان",
    back_to_academic: "🔙 النظام الأكاديمي",
    back_to_settings: "🔙 إعدادات النظام",
  },

  // ====== شاشة: إعدادات النظام ======
  system_settings: {
    title: "⚙️ *إعدادات النظام*\n\nاختر القسم:",
    btn_interface: "📝 إدارة واجهة البوت",
    btn_system_info: "ℹ️ معلومات النظام",
    coming_soon: "🚧 _هذا القسم قيد التطوير وسيكون متاحاً قريباً._",
    // معلومات النظام
    info_title: "ℹ️ *معلومات النظام*\n\n",
    info_content: (s: {
      version: string;
      version_date: string;
      total_students: number;
      total_admins: number;
      total_content: number;
      total_downloads: number;
      total_contributions: number;
      total_broadcasts: number;
      pending_contributions: number;
      new_this_week: number;
      db_size: string;
      last_update: string;
      status: string;
    }) =>
      `📌 *إصدار البوت:* ${s.version}\n` +
      `📅 *تاريخ الإصدار:* ${s.version_date}\n\n` +
      `👨‍🎓 *عدد الطلاب:* ${s.total_students}\n` +
      `👨‍💼 *عدد المسؤولين:* ${s.total_admins}\n` +
      `📚 *عدد المحتويات:* ${s.total_content}\n` +
      `📥 *عدد التحميلات:* ${s.total_downloads}\n` +
      `🌟 *إجمالي الإحسانات:* ${s.total_contributions}\n` +
      `📢 *إجمالي التعميمات:* ${s.total_broadcasts}\n` +
      `⏳ *إحسانات معلقة:* ${s.pending_contributions}\n` +
      `🆕 *طلاب جدد هذا الأسبوع:* ${s.new_this_week}\n\n` +
      `🗄 *حجم قاعدة البيانات:* ${s.db_size}\n` +
      `🕒 *آخر تحديث:* ${s.last_update}\n` +
      `🟢 *حالة النظام:* ${s.status}`,
    btn_refresh: "🔄 تحديث",
  },

  // ====== شاشة: إدارة النظام الأكاديمي ======
  academic_mgmt: {
    title: "🏛 *إدارة النظام الأكاديمي*\n\nاختر القسم:",
    btn_subjects: "📚 إدارة المواد",
    btn_channels: "🔗 روابط اللجان العلمية",
    btn_colleges: "🏛 إدارة الكليات",
    btn_specialties: "🎓 إدارة التخصصات",
    btn_study_systems: "🧩 أنظمة الدراسة",
    btn_academic_plans: "🗂 الخطط الاسترشادية",
    coming_soon: "🚧 _هذا القسم قيد التطوير وسيكون متاحاً قريباً._",
  },

  // ====== شاشة A5: Content Management (جديدة) ======
  content_mgmt: {
    title: (scopeLabel: string = "") =>
      `📁 *إدارة المحتوى*\n${scopeLabel ? `📍 ${scopeLabel}\n` : ""}\nاختر الإجراء:`,
    btn_browse: "📂 استعراض المحتوى",
    btn_upload: "➕ إضافة محتوى",
    btn_search: "🔍 البحث عن محتوى",
    btn_stats: "📊 إحصائيات المحتوى",
    btn_import: "📥 استيراد متتابع",
    btn_audit_log: "📝 سجل العمليات",
    btn_filter: "🔍 فلترة المحتوى",
    empty: "📭 لا يوجد محتوى ضمن نطاق صلاحياتك حالياً.",
  },

  // ====== شاشة A5a: Upload Wizard (مسار الرفع الكامل) ======
  upload_wizard: {
    progress: (step: string, total: string) =>
      `📤 *رفع محتوى جديد* — ${step} (${total})\n\n`,
    select_type: "اختر نوع المحتوى:",
    select_college: "اختر الكلية:",
    select_specialty: (collegeName: string) => `📚 *${collegeName}*\n\nاختر التخصص:`,
    select_level: (specName: string) => `📊 *${specName}*\n\nاختر المستوى:`,
    select_subject: (specName: string, level: number) =>
      `📖 *${specName}* — المستوى ${level}\n\nاختر المادة:`,
    prompt_file: (typeName: string, subjectName: string) =>
      `📎 *رفع الملف*\n\n🏷 النوع: ${typeName}\n📚 المادة: ${subjectName}\n\nأرسل الملف الآن:`,
    awaiting_title: "📝 أرسل *عنواناً* للملف (سيظهر للطلاب):",
    awaiting_description: "📌 أرسل *وصفاً مختصراً* (اختياري — أرسل '-' للتخطي):",
    success: (title: string, subjectName: string) =>
      `✅ *تم رفع المحتوى بنجاح!*\n\n📄 ${title}\n📚 ${subjectName}\n\nبات متاحاً للطلاب الآن.`,
    canceled: "✅ تم إلغاء عملية الرفع.",
  },

  // ====== شاشة A5b: Browse Content (هرمي — المرحلة 5) ======
  browse_content: {
    title: (count: number, scopeLabel: string) =>
      `📂 *استعراض المحتوى*\n📍 ${scopeLabel}\n📊 ${count} عنصر\n\nاختر الكلية:`,
    title_specialty: (collegeName: string, count: number) =>
      `📂 *استعراض المحتوى*\n🏛 ${collegeName}\n📊 ${count} عنصر\n\nاختر التخصص:`,
    title_level: (specName: string, count: number) =>
      `📂 *استعراض المحتوى*\n📚 ${specName}\n📊 ${count} عنصر\n\nاختر المستوى:`,
    title_subject: (specName: string, level: number, count: number) =>
      `📂 *استعراض المحتوى*\n📊 ${specName} — المستوى ${level}\n📊 ${count} عنصر\n\nاختر المادة:`,
    title_files: (subjectName: string, typeLabel: string, count: number) =>
      `📂 *${subjectName}* — ${typeLabel}\n📊 ${count} ملف\n\nاختر ملفاً للمعاينة:`,
    empty: "📭 لا يوجد محتوى ضمن نطاق صلاحياتك حالياً.\n💡 ابدأ بإضافة محتوى من زر ➕ إضافة محتوى.",
    empty_at_level: (levelLabel: string) => `📭 لا يوجد محتوى في ${levelLabel}.`,
    btn_flat: "📋 عرض كل المحتوى (مسطّح)",
    btn_back_to_filters: "🔙 الفلاتر",
  },

  // ====== شاشة A5c: Content Detail ======
  content_detail: {
    title: "📄 *تفاصيل المحتوى*\n\n",
    details: (c: {
      title: string;
      type_label: string;
      subject_name: string;
      specialty_name: string;
      college_name: string;
      level: number;
      semester: number;
      file_size: number;
      download_count: number;
      is_starred: boolean;
      added_by: string;
      added_at: string;
      academic_year: string;
    }) => {
      let msg = "";
      msg += `📝 *العنوان:* ${c.title}\n`;
      msg += `🏷 *النوع:* ${c.type_label}\n`;
      msg += `📚 *المادة:* ${c.subject_name}\n`;
      msg += `🏛 *الكلية:* ${c.specialty_name} - ${c.college_name}\n`;
      msg += `📊 *المستوى:* ${c.level} | 📅 *الفصل:* ${c.semester}\n`;
      msg += `📈 *السنة الدراسية:* ${c.academic_year}\n\n`;
      msg += `📊 *الحجم:* ${c.file_size.toFixed(2)} MB\n`;
      msg += `⬇️ *التحميلات:* ${c.download_count}\n`;
      if (c.is_starred) msg += "⭐ *محتوى مميز (عبر الإحسان)*\n";
      msg += `👤 *رافعه:* ${c.added_by}\n`;
      msg += `📅 *تاريخ الرفع:* ${c.added_at}\n`;
      return msg;
    },
    btn_edit: "✏️ تعديل البيانات",
    btn_move: "📂 نقل المحتوى",
    btn_copy: "📋 نسخ المحتوى",
    btn_delete: "🗑 حذف المحتوى",
    btn_view_file: "👁 معاينة الملف",
    delete_confirm: (title: string) =>
      `⚠️ *تأكيد الحذف*\n\nسيتم حذف:\n📄 *${title}*\n\n+ حذف المنشور من قناة التخزين.\n\nهل أنت متأكد؟`,
    btn_confirm_delete: "✅ نعم، احذف",
    btn_cancel_delete: "❌ إلغاء",
    delete_success: "✅ تم حذف المحتوى بنجاح.\n\nالمنشور محذوف من القناة.",
    move_prompt: "🔄 *نقل المحتوى*\n\nاختر الوجهة الجديدة:",
    move_success: (newSubjectName: string) =>
      `✅ *تم نقل المحتوى بنجاح!*\n\n📚 المادة الجديدة: ${newSubjectName}`,
    edit_prompt: "✏️ أرسل العنوان الجديد للمحتوى:",
    edit_success: "✅ تم تحديث العنوان.",
  },

  // ====== شاشة A5d: تعديل المحتوى (المرحلة 2) ======
  content_edit: {
    title: (c: { title: string; subject_name: string }) =>
      `✏️ *تعديل بيانات المحتوى*\n\n` +
      `📄 *العنوان الحالي:* ${c.title}\n` +
      `📚 *المادة:* ${c.subject_name}\n\n` +
      `اختر الحقل المراد تعديله:`,
    btn_title: "📝 تعديل العنوان",
    btn_description: "📌 تعديل الوصف",
    btn_type: "🏷 تغيير النوع",
    btn_back: "🔙 تفاصيل المحتوى",
    prompt_title: "📝 أرسل *العنوان الجديد* للمحتوى:",
    prompt_description: (current?: string) =>
      `📌 أرسل *الوصف الجديد* (اختياري — أرسل '-' لمسح الوصف الحالي):\n\n` +
      (current ? `_الوصف الحالي:_ ${current}` : "_لا يوجد وصف حالياً_"),
    select_type: "🏷 اختر *النوع الجديد* للمحتوى:",
    success: (field: string) => `✅ تم تحديث *${field}* بنجاح.\n\n📝 آخر تعديل بواسطتك.`,
    canceled: "✅ تم إلغاء التعديل.",
  },

  // ====== شاشة A5e: نقل المحتوى (المرحلة 2) ======
  content_move: {
    title: (currentSubjectName: string) =>
      `📂 *نقل المحتوى*\n\n` +
      `📚 *المادة الحالية:* ${currentSubjectName}\n\n` +
      `اختر الكلية الوجهة:`,
    select_specialty: (collegeName: string) =>
      `📂 *نقل المحتوى*\n\n🏛 ${collegeName}\n\nاختر التخصص الوجهة:`,
    select_level: (specName: string) =>
      `📂 *نقل المحتوى*\n\n📚 ${specName}\n\nاختر المستوى الوجهة:`,
    select_subject: (specName: string, level: number) =>
      `📂 *نقل المحتوى*\n\n📊 ${specName} — المستوى ${level}\n\nاختر المادة الوجهة:`,
    confirm: (currentSubjectName: string, newSubjectName: string) =>
      `⚠️ *تأكيد النقل*\n\n` +
      `📚 من: ${currentSubjectName}\n` +
      `📚 إلى: ${newSubjectName}\n\n` +
      `سيتم تحديث المادة المرتبطة بالمحتوى.\n` +
      `ملاحظة: الملف في قناة التخزين لن يتأثر.\n\n` +
      `هل أنت متأكد؟`,
    btn_confirm: "✅ نعم، انقل",
    btn_cancel: "❌ إلغاء",
    success: (newSubjectName: string) =>
      `✅ *تم نقل المحتوى بنجاح!*\n\n📚 المادة الجديدة: ${newSubjectName}`,
    canceled: "✅ تم إلغاء النقل.",
  },

  // ====== شاشة A5f: نسخ المحتوى (المرحلة 2) ======
  content_copy: {
    title: (sourceSubjectName: string) =>
      `📋 *نسخ المحتوى*\n\n` +
      `📚 *المادة المصدر:* ${sourceSubjectName}\n\n` +
      `اختر الكلية الوجهة (حيث سيُنسخ المحتوى):`,
    select_specialty: (collegeName: string) =>
      `📋 *نسخ المحتوى*\n\n🏛 ${collegeName}\n\nاختر التخصص الوجهة:`,
    select_level: (specName: string) =>
      `📋 *نسخ المحتوى*\n\n📚 ${specName}\n\nاختر المستوى الوجهة:`,
    select_subject: (specName: string, level: number) =>
      `📋 *نسخ المحتوى*\n\n📊 ${specName} — المستوى ${level}\n\nاختر المادة الوجهة:`,
    confirm: (sourceSubjectName: string, targetSubjectName: string) =>
      `⚠️ *تأكيد النسخ*\n\n` +
      `📚 من: ${sourceSubjectName}\n` +
      `📚 إلى: ${targetSubjectName}\n\n` +
      `سيتم إنشاء نسخة جديدة من المحتوى في المادة الوجهة.\n` +
      `الملف الأصلي سيُشارك عبر file_id (لا حاجة لإعادة الرفع).\n\n` +
      `هل أنت متأكد؟`,
    btn_confirm: "✅ نعم، انسخ",
    btn_cancel: "❌ إلغاء",
    success: (targetSubjectName: string) =>
      `✅ *تم نسخ المحتوى بنجاح!*\n\n📚 المادة الوجهة: ${targetSubjectName}`,
    canceled: "✅ تم إلغاء النسخ.",
  },

  // ====== شاشة A5g: استيراد متتابع (المرحلة 3) ======
  content_import: {
    title: "📥 *الاستيراد المتتابع*\n\nارفع عدة ملفات لمادة واحدة بسرعة.\n\nاختر الكلية:",
    select_specialty: (collegeName: string) =>
      `📥 *الاستيراد المتتابع*\n\n🏛 ${collegeName}\n\nاختر التخصص:`,
    select_level: (specName: string) =>
      `📥 *الاستيراد المتتابع*\n\n📚 ${specName}\n\nاختر المستوى:`,
    select_subject: (specName: string, level: number) =>
      `📥 *الاستيراد المتتابع*\n\n📊 ${specName} — المستوى ${level}\n\nاختر المادة:`,
    select_type: "📥 *الاستيراد المتتابع*\n\nاختر نوع المحتوى (سيُطبّق على كل الملفات):",
    prompt_first_file: (typeName: string, subjectName: string) =>
      `📥 *الاستيراد المتتابع*\n\n🏷 النوع: ${typeName}\n📚 المادة: ${subjectName}\n\n` +
      `أرسل *الملف الأول* الآن:`,
    prompt_next_file: (count: number) =>
      `✅ *تم استيراد ${count} ملف حتى الآن.*\n\nأرسل *الملف التالي* أو اختر:`,
    prompt_title: (fileName: string, count: number) =>
      `📥 *الملف #${count + 1}*\n\n📄 *الاسم:* ${fileName}\n\nأرسل *عنواناً* لهذا الملف:`,
    file_uploaded: (title: string, count: number) =>
      `✅ *تم استيراد:* ${title}\n📊 الإجمالي: ${count} ملف`,
    summary: (count: number, subjectName: string) =>
      `✅ *اكتمل الاستيراد المتتابع*\n\n📊 عدد الملفات: ${count}\n📚 المادة: ${subjectName}\n\nجميع الملفات متاحة للطلاب الآن.`,
    btn_skip: "⏭ تخطي هذا الملف",
    btn_finish: "✅ إنهاء الاستيراد",
    btn_cancel: "❌ إلغاء",
    canceled: "✅ تم إلغاء الاستيراد. ما تم استيراده محفوظ.",
    skipped: "⏭ تم تخطي الملف.",
    invalid_file: "❌ نوع الملف غير مقبول. أرسل ملفاً بالامتداد الصحيح.",
  },

  // ====== شاشة A5h: سجل العمليات (المرحلة 3) ======
  content_audit_log: {
    title: (count: number) =>
      `📝 *سجل عمليات المحتوى (${count})*\n\nاختر فلتراً:`,
    btn_filter_all: "📋 الكل",
    btn_filter_create: "➕ الإضافات",
    btn_filter_update: "✏️ التعديلات",
    btn_filter_move: "📂 النقل",
    btn_filter_copy: "📋 النسخ",
    btn_filter_delete: "🗑 الحذف",
    btn_filter_import: "📥 الاستيراد",
    entries_title: (filterLabel: string, count: number) =>
      `📝 *السجل (${filterLabel})* — ${count} عملية\n\n`,
    entry: (e: {
      action_icon: string;
      action_label: string;
      content_title: string;
      performer_name: string;
      position_title: string;
      timestamp: string;
    }) =>
      `${e.action_icon} *${e.action_label}* — ${e.content_title}\n` +
      `   👤 ${e.performer_name} (${e.position_title})\n` +
      `   🕐 ${e.timestamp}\n\n`,
    empty: "📝 لا توجد عمليات مطابقة للفلتر.",
    page_info: (page: number, totalPages: number) => `📄 صفحة ${page}/${totalPages}`,
    btn_next_page: "▶️ التالي",
    btn_prev_page: "◀️ السابق",
    btn_back_to_filters: "🔙 الفلاتر",
  },

  // ====== شاشة A5i: بحث المحتوى (المرحلة 4) ======
  content_search: {
    prompt: "🔍 *البحث عن محتوى*\n\nأرسل *اسم المادة* أو *عنوان المحتوى* أو *كلمة مفتاحية*:\n\n_أمثلة:_\n• `قواعد البيانات`\n• `ملخص الوحدة`\n• `فلاتر`",
    no_results: "🔍 لم يتم العثور على نتائج. جرب كلمة أخرى.",
    results_header: (count: number) =>
      `🔍 *نتائج البحث (${count})*\n\nاختر عنصراً للإدارة:`,
    btn_new_search: "🔍 بحث جديد",
    canceled: "✅ تم إلغاء البحث.",
  },

  // ====== شاشة A5j: إحصائيات المحتوى (المرحلة 4) ======
  content_stats: {
    title: (scopeLabel: string) =>
      `📊 *إحصائيات المحتوى*\n📍 ${scopeLabel}\n\n`,
    summary: (s: {
      total_content: number;
      total_downloads: number;
      subjects_with_content: number;
      total_subjects: number;
    }) =>
      `📁 *إجمالي المحتويات:* ${s.total_content}\n` +
      `⬇️ *إجمالي التحميلات:* ${s.total_downloads.toLocaleString()}\n` +
      `📖 *مواد تحتوي على محتوى:* ${s.subjects_with_content}/${s.total_subjects}\n\n`,
    by_type_header: "🏷 *توزيع المحتوى حسب النوع:*\n",
    by_type_entry: (emoji: string, label: string, count: number, percentage: number) =>
      `${emoji} ${label}: ${count} (${percentage}٪)\n`,
    top_downloaded_header: (limit: number) => `\n🏆 *أكثر ${limit} ملفات تحميلاً:*\n`,
    top_downloaded_entry: (rank: number, title: string, downloads: number, subjectName: string) =>
      `${rank}. 📄 *${title}*\n   📚 ${subjectName} • ⬇️ ${downloads}\n`,
    empty: "📊 لا توجد إحصائيات متاحة ضمن نطاقك.",
    btn_refresh: "🔄 تحديث",
  },

  // ====== شاشة A8: Positions Management (إدارة المسؤولين — هرمي) ======
  positions: {
    // ===== القائمة الرئيسية =====
    title_central: "👥 *إدارة المسؤولين*\n\nاختر القسم:",
    title_college: "👥 *إدارة المسؤولين*\n\nاختر القسم:",
    btn_college_admins: "🏛️ إدارة مسؤولي الكليات",
    btn_level_reps: "🎓 إدارة مندوبي المستويات",
    btn_org_chart: "🗂️ الهيكل الإداري",
    btn_audit_log: "📜 سجل التعيينات",
    btn_my_positions: "👤 مناصبي الحالية",

    // ===== إدارة مسؤولي الكليات =====
    college_admins_title: "🏛️ *إدارة مسؤولي الكليات*\n\nاختر الكلية:",
    college_admin_detail: (collegeName: string, holderName: string | null, holderId: number | null) =>
      `🏛️ *${collegeName}*\n\n` +
      (holderName
        ? `👤 *المسؤول الحالي:* ${holderName}\n🆔 *المعرّف:* \`${holderId}\``
        : `⚠️ *المنصب شاغر*`),
    btn_assign_college: "➕ تعيين مسؤول",
    btn_replace_college: "🔄 استبدال المسؤول",
    btn_revoke_college: "❌ إزالة المسؤول",

    // ===== إدارة مندوبي المستويات =====
    level_reps_title: "🎓 *إدارة مندوبي المستويات*\n\nاختر الكلية أولاً:",
    level_reps_select_specialty: (collegeName: string) =>
      `🎓 *مندوبي مستويات ${collegeName}*\n\nاختر التخصص:`,
    level_reps_select_level: (specialtyName: string) =>
      `📊 *مندوبي ${specialtyName}*\n\nاختر المستوى:`,
    level_rep_detail: (specialtyName: string, level: number, holderName: string | null, holderId: number | null) =>
      `📊 *${specialtyName} — المستوى ${level}*\n\n` +
      (holderName
        ? `👤 *المندوب الحالي:* ${holderName}\n🆔 *المعرّف:* \`${holderId}\``
        : `⚠️ *المنصب شاغر*`),
    btn_assign_rep: "➕ تعيين مندوب",
    btn_replace_rep: "🔄 استبدال المندوب",
    btn_revoke_rep: "❌ إزالة المندوب",

    // ===== آلية التعيين (5 خطوات) =====
    assign_step1_prompt: "👤 *الخطوة 1/4: معرّف تلجرام*\n\nأرسل معرّف تلجرام (Telegram ID) للمستخدم المراد تعيينه.\n\n💡 *للحصول على المعرّف:* توجّه إلى @userinfobot",
    assign_step1_invalid: "⚠️ *معرّف غير صالح*\n\nيجب أن يكون المعرّف رقماً. أعد المحاولة:",
    assign_step2_checking: "🔍 جارٍ التحقق من المستخدم...",
    assign_step2_not_found: (telegramId: number) =>
      `⚠️ *المستخدم غير موجود*\n\nالمستخدم بمعرّف \`${telegramId}\` غير مسجّل في النظام.\n\nطلب منه الدخول لبوت الطالب أولاً (@usttesterbot) ثم أعد المحاولة.`,
    assign_step3_prompt: (telegramId: number) =>
      `✅ *الخطوة 3/4: الاسم المخصص*\n\nتم العثور على المستخدم: \`${telegramId}\`\n\nأرسل الاسم الذي سيظهر داخل النظام:`,
    assign_step4_confirm: (telegramId: number, customName: string, positionTitle: string, currentHolder?: string) =>
      `✅ *الخطوة 4/4: التأكيد*\n\n` +
      `👤 *الاسم المخصص:* ${customName}\n` +
      `🆔 *معرّف تلجرام:* \`${telegramId}\`\n` +
      `💼 *المنصب:* ${positionTitle}\n` +
      (currentHolder ? `\n⚠️ *سيتم استبدال:* ${currentHolder}\n` : "") +
      `\nهل تؤكد التعيين؟`,
    btn_confirm_assign: "✅ تأكيد التعيين",
    btn_cancel_assign: "❌ إلغاء",
    assign_success: (customName: string, positionTitle: string) =>
      `✅ *تم التعيين بنجاح!*\n\n👤 *الاسم:* ${customName}\n💼 *المنصب:* ${positionTitle}\n\n🔔 تم إرسال إشعار للمستخدم الجديد.`,
    assign_self_error: "⚠️ لا يمكنك تعيين نفسك في منصب آخر.",

    // ===== إشعار المسؤول الجديد =====
    notification_assigned: (positionTitle: string, assignedBy: string) =>
      `🎉 *مبروك! تم تعيينك*\n\n` +
      `💼 *المنصب:* ${positionTitle}\n` +
      `👤 *عُيّنت بواسطة:* ${assignedBy}\n\n` +
      `يمكنك الآن الدخول لبوت الإدارة: @usttesteradminbot`,
    notification_revoked: (positionTitle: string, revokedBy: string) =>
      `⚠️ *تم إزالتك من منصب*\n\n` +
      `💼 *المنصب:* ${positionTitle}\n` +
      `👤 *أزالک:* ${revokedBy}\n\n` +
      `لو تعتقد أن هذا خطأ، تواصل مع الإدارة.`,

    // ===== الإزالة =====
    revoke_confirm: (holderName: string, positionTitle: string) =>
      `⚠️ *تأكيد الإزالة*\n\nسيتم إزالة:\n👤 ${holderName}\nمن منصب:\n💼 ${positionTitle}\n\nسيخسر جميع صلاحيات هذا المنصب فوراً.`,
    btn_confirm_revoke: "✅ نعم، أزِل",
    btn_cancel_revoke: "❌ إلغاء",
    revoke_success: "✅ تم إزالة المسؤول.\n\nفقد جميع الصلاحيات المرتبطة.\n🔔 تم إرسال إشعار للمستخدم.",

    // ===== مناصبي =====
    my_positions_empty: "⚠️ لا تشغل أي منصب حالياً.",
    my_positions_title: (count: number) => `👤 *مناصبي الحالية (${count})*\n\n`,

    // ===== الهيكل الإداري التفاعلي =====
    org_chart_title: "🗂️ *الهيكل الإداري*\n\nاختر كلية لعرض تفاصيلها:",
    org_chart_college: (collegeName: string, holderName: string | null, totalReps: number, filledReps: number) =>
      `🗂️ *${collegeName}*\n\n` +
      `👤 مسؤول الكلية: ${holderName || "⚠️ شاغر"}\n` +
      `📊 المندوبين: ${filledReps}/${totalReps} مشغول\n\n` +
      `اختر تخصصاً لعرض المندوبين:`,
    org_chart_specialty: (specName: string, collegeName: string) =>
      `📚 *${specName}* — ${collegeName}\n\n`,
    org_chart_level: (level: number, holderName: string | null) =>
      `📊 المستوى ${level}: ${holderName || "⚠️ شاغر"}\n`,

    // ===== سجل التعيينات بفلاتر =====
    audit_log_title: (count: number) => `📜 *سجل التعيينات (${count})*\n\n`,
    audit_log_empty: "📜 لا توجد سجلات تعيينات ضمن نطاقك بعد.",
    audit_log_filter_all: "📋 الكل",
    audit_log_filter_assign: "➕ التعيينات",
    audit_log_filter_revoke: "❌ الإزالات",
    audit_log_page: (page: number, totalPages: number) => `📄 صفحة ${page}/${totalPages}`,
    audit_log_entry: (e: {
      actionIcon: string;
      posTitle: string;
      oldName: string;
      newName: string;
      performedBy: string;
      timestamp: string;
    }) =>
      `${e.actionIcon} *${e.posTitle}*\n` +
      `   ${e.oldName} → ${e.newName}\n` +
      `   👤 بواسطة: ${e.performedBy}\n` +
      `   🕐 ${e.timestamp}\n\n`,
    btn_audit_filter: "🔍 فلترة",
    btn_next_page: "▶️ التالي",
    btn_prev_page: "◀️ السابق",

    // ===== رسائل عامة =====
    empty: "⚠️ لا توجد مناصب ضمن نطاقك.",
    no_permission: "❌ *ليست لديك صلاحية إدارة المسؤولين.*\n\nهذه الميزة متاحة فقط للمسؤول المركزي.",
    no_permission_college: "❌ *ليست لديك صلاحية إدارة مندوبي المستويات.*",
    no_permission_scope: (action: string) => `❌ *ليست لديك صلاحية ${action}.*\n\nهذا الإجراء خارج نطاقك.`,
  },

  // ====== شاشة A12: Committee Channels (جديدة) ======
  channels: {
    title: "📢 *إدارة روابط اللجان العلمية*\n\nاختر القسم:",
    btn_central: "🛡 اللجنة المركزية",
    btn_colleges: "🏛 لجان الكليات",
    btn_levels: "📊 لجان المستويات",
    btn_add: "➕ إضافة رابط جديد",
    central_title: "🛡 *قناة اللجنة العلمية المركزية*\n\n",
    colleges_title: "🏛 *لجان الكليات (7)*\n\n",
    levels_title: "📊 *لجان المستويات*\n\n",
    channel_entry: (c: { display_name: string; channel_url: string }) =>
      `${c.display_name}\n🔗 ${c.channel_url}\n\n`,
    edit_prompt: (channelName: string) =>
      `🔗 أرسل الرابط الجديد لـ:\n*${channelName}*\n\n💡 الصيغة: \`https://t.me/+xxxxx\``,
    edit_success: "✅ تم تحديث الرابط بنجاح.",
    btn_edit: "✏️ تعديل الرابط",
    btn_open: "🔗 فتح القناة",
    btn_back_to_channels: "🔙 قنوات اللجان",
    empty: "⚠️ لا توجد روابط مسجّلة في هذا القسم.",
  },

  // ====== شاشة A13: Honors Management (تكريم المساهمين - للمركزي) ======
  honors: {
    title: "🏆 *إدارة تكريم المحسنين*\n\nاختر القسم:",
    btn_pending: (count: number) => `⏳ تكريمات معلّقة (${count})`,
    btn_approved: "✅ تكريمات معتمدة",
    btn_new: "➕ منح تكريم يدوي",
    btn_reset_points: "🔄 إعادة ضبط النقاط",
    btn_view_log: "📜 سجل التكريم",
    pending_title: (count: number) => `⏳ *التكريمات المعلّقة (${count})*\n\n`,
    honor_entry: (h: {
      student_name: string;
      honor_title: string;
      points_at_honor: number;
      bonus_points: number;
    }) =>
      `• 👤 *${h.student_name}*\n` +
      `  🏆 ${h.honor_title}\n` +
      `  📊 النقاط: ${h.points_at_honor} | 💎 مكافأة: +${h.bonus_points}\n\n`,
    honor_detail: (h: {
      student_name: string;
      honor_title: string;
      honor_type: string;
      scope: string;
      honor_period: string;
      points_at_honor: number;
      bonus_points: number;
      nominated_by: string;
      created_at: string;
    }) =>
      `🏆 *تفاصيل التكريم*\n\n` +
      `👤 *الطالب:* ${h.student_name}\n` +
      `🏆 *العنوان:* ${h.honor_title}\n` +
      `🏷 *النوع:* ${h.honor_type}\n` +
      `📍 *النطاق:* ${h.scope}\n` +
      `📅 *الفترة:* ${h.honor_period}\n\n` +
      `📊 *نقاط الطالب:* ${h.points_at_honor}\n` +
      `💎 *مكافأة التكريم:* +${h.bonus_points} نقطة\n\n` +
      `👤 *رشّحه:* ${h.nominated_by}\n` +
      `📅 *تاريخ الترشيح:* ${h.created_at}`,
    btn_approve: "✅ اعتماد التكريم",
    btn_reject: "❌ رفض التكريم",
    approve_success: (studentName: string, bonus: number) =>
      `✅ *تم اعتماد التكريم!*\n\n👤 ${studentName}\n💎 +${bonus} نقطة إضافية\n🔔 تم إشعار الطالب.`,
    reject_prompt: "❌ أرسل سبب رفض التكريم:",
    reject_success: "✅ تم رفض التكريم. الطالب لم يُمنح المكافأة.",
    reset_prompt: "🔄 *إعادة ضبط النقاط*\n\nاختر نطاق إعادة الضبط:",
    btn_reset_global: "🌍 كل الطلاب",
    btn_reset_college: "🏛 كلية محددة",
    btn_reset_specialty: "📚 تخصص محدد",
    reset_confirm: (scope: string, studentsCount: number, totalPoints: number) =>
      `⚠️ *تأكيد إعادة الضبط*\n\n📍 النطاق: ${scope}\n👥 الطلاب المتأثرون: ${studentsCount}\n📊 إجمالي النقاط المُصفّرة: ${totalPoints}\n\n⚠️ *لا يمكن التراجع عن هذا الإجراء!*`,
    btn_confirm_reset: "✅ نعم، أعد الضبط",
    btn_cancel_reset: "❌ إلغاء",
    reset_success: "✅ تم إعادة ضبط النقاط بنجاح.\n\n🔔 تم إشعار جميع الطلاب المتأثرين.",
    log_title: (count: number) => `📜 *سجل التكريم (${count})*\n\n`,
    log_entry: (h: {
      student_name: string;
      honor_title: string;
      bonus_points: number;
      approved_at: string;
    }) =>
      `• 👤 ${h.student_name} — ${h.honor_title}\n  💎 +${h.bonus_points} نقطة | 📅 ${h.approved_at}\n`,
    log_empty: "📜 لا توجد تكريمات معتمدة بعد.",
    new_honor_prompt_student: "👤 أرسل معرّف تلجرام للطالب المراد تكريمه:",
    new_honor_prompt_title: "🏆 أرسل عنوان التكريم (مثال: «أبرز مساهم في تخصص IT»):",
    new_honor_prompt_bonus: "💎 أرسل عدد نقاط المكافأة الإضافية (رقم):",
    new_honor_success: (studentName: string, title: string) =>
      `✅ *تم منح التكريم!*\n\n👤 ${studentName}\n🏆 ${title}\n🔔 تم إشعار الطالب.`,
  },
} as const;

// ============================================
// 📋 تنسيق بطاقة المحتوى الموحدة (3 سياقات)
// ============================================
// contexts:
//   - "channel_archive"  : caption الملف في قناة التخزين عند الرفع
//   - "student_preview"  : معاينة الطالب في وضع التصفح
//   - "admin_review"     : معاينة المسؤول قبل الاعتماد
//
// الحقول المعروضة:
//   - عنوان + نوع (سطر علوي)
//   - السياق الأكاديمي (كلية/تخصص/مستوى/مادة)
//   - معلومات الملف (حجم/مُحسِن/تاريخ)
//   - الوصف
//   - رقم الإحسان (للقناة والإدارة فقط)
//
// ملاحظة: المُحسِن لا يظهر للطالب (خصوصية)
// ============================================

export type ContentCardContext = "channel_archive" | "student_preview" | "admin_review";

// تسميات الأنواع (للاستخدام في البطاقة)
export const CONTENT_TYPE_LABELS_AR: Record<string, { label: string; emoji: string }> = {
  book_theory:    { label: "كتاب نظري",        emoji: "📘" },
  book_practical: { label: "كتاب عملي",        emoji: "📗" },
  summary:        { label: "ملخصات",           emoji: "📄" },
  exam:           { label: "نماذج اختبارات",   emoji: "📝" },
  video:          { label: "مرئيات",           emoji: "🎥" },
  audio:          { label: "صوتيات",           emoji: "🎧" },
  reference:      { label: "مراجع",            emoji: "📖" },
  schedule:       { label: "جداول دراسية",     emoji: "📅" },
};

export interface ContentCardData {
  title: string;
  contentType: string;          // book_theory | book_practical | summary | exam | video | audio | reference | schedule
  subjectName: string;
  collegeName?: string;
  specialtyName?: string;
  level?: number | null;
  semester?: number | null;
  fileSizeBytes?: number | null;
  fileSizeMb?: number | null;
  contributorName?: string;     // المُحسِن
  uploadedAt?: string;          // ISO date
  description?: string;
  ihsanId?: number | null;      // رقم الإحسان
  isStarred?: boolean;
  downloadCount?: number;
  statusLabel?: string;         // للإدارة: قيد المراجعة / معتمد / مرفوض
}

const SEPARATOR = "━━━━━━━━━━━━━━━";

export function formatContentCard(
  data: ContentCardData,
  context: ContentCardContext
): string {
  const typeInfo = CONTENT_TYPE_LABELS_AR[data.contentType] || { label: data.contentType, emoji: "📄" };
  const lines: string[] = [];

  // السطر العلوي: [نوع] — عنوان
  lines.push(`${typeInfo.emoji} [${typeInfo.label}] — ${data.title}`);
  lines.push("");

  // ===== السياق الأكاديمي =====
  lines.push(SEPARATOR);
  if (data.collegeName) {
    lines.push(`🏛 الكلية:     ${data.collegeName}`);
  }
  if (data.specialtyName) {
    lines.push(`🎓 التخصص:    ${data.specialtyName}`);
  }
  if (data.level !== undefined && data.level !== null) {
    lines.push(`📊 المستوى:   ${data.level}`);
  }
  if (data.subjectName) {
    lines.push(`📖 المادة:    ${data.subjectName}`);
  }
  lines.push(SEPARATOR);
  lines.push("");

  // ===== معلومات الملف =====
  // الحجم + المُحسِن + التاريخ تظهر فقط في القناة والإدارة (ليس للطالب)
  if (context !== "student_preview") {
    let sizeLabel = "غير محدد";
    if (data.fileSizeBytes && data.fileSizeBytes > 0) {
      sizeLabel = formatBytesArabic(data.fileSizeBytes);
    } else if (data.fileSizeMb && data.fileSizeMb > 0) {
      sizeLabel = `${data.fileSizeMb.toFixed(2)} MB`;
    }
    lines.push(`📦 الحجم:     ${sizeLabel}`);

    if (data.contributorName) {
      lines.push(`👤 المُحسِن:   ${data.contributorName}`);
    }

    if (data.uploadedAt) {
      const dateLabel = formatDateArabic(data.uploadedAt);
      lines.push(`📅 التاريخ:   ${dateLabel}`);
    }
  }

  if (context === "admin_review" && data.statusLabel) {
    lines.push(`🚦 الحالة:    ${data.statusLabel}`);
  }

  if (context === "student_preview" && data.downloadCount !== undefined) {
    lines.push(`⬇️ التحميلات: ${data.downloadCount}`);
  }

  if (data.isStarred) {
    lines.push("⭐ محتوى مميّز");
  }

  lines.push("");

  // ===== الوصف =====
  if (data.description && data.description.trim() && data.description !== "-") {
    lines.push("📝 الوصف:");
    lines.push(data.description.trim());
    lines.push("");
  }

  // ===== رقم الإحسان (للقناة والإدارة) =====
  if (data.ihsanId && context !== "student_preview") {
    lines.push(SEPARATOR);
    lines.push(`🆔 إحسان #${data.ihsanId}`);
  }

  return lines.join("\n");
}

// تحويل البايتات لصيغة عربية مقروءة
function formatBytesArabic(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// تنسيق التاريخ بالعربية
function formatDateArabic(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
