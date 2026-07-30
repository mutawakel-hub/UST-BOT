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
      "• 👤 تابع نشاطك (تحميلات + مساهمات)\n" +
      "• 🌟 ساهم في إثراء المحتوى",
    welcome_registered: (name: string, college: string, specialty: string, level: number) =>
      `🎓 *مرحباً بك ${name}!*\n` +
      `*جامعة العلوم والتكنولوجيا - اليمن*\n\n` +
      `📌 *تخصصك الحالي:*\n` +
      `🏛 ${college}\n📚 ${specialty}\n📊 المستوى ${level}\n\n` +
      "اختر الخدمة المطلوبة:",
    btn_colleges: "🏛 الكليات",
    btn_search: "🔍 بحث",
    btn_leaderboard: "🏆 لوحة الشرف",
    btn_profile: "👤 حسابي",
    btn_committee: "📢 قناة اللجنة",
    btn_contact: "📞 تواصل معنا",
    btn_contribute: "🌟 المساهمة",
  },

  // ====== شاشة S0: التسجيل الإلزامي (لمستخدمي البوت الجدد) ======
  registration: {
    intro:
      "👋 *مرحباً بك في البوت العلمي المركزي!*\n\n" +
      "🚀 لإكمال تسجيلك والاستفادة من جميع الميزات، نحتاج لمعرفة تخصصك.\n\n" +
      "📋 *لماذا نحتاج هذه المعلومات؟*\n" +
      "• 📢 لتصلك تعاميم اللجنة العلمية الخاصة بتخصصك\n" +
      "• 📊 لإحصائك ضمن لوحة الشرف\n" +
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
    btn_contribute: "💡 مساهمة",
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

  // ====== شاشة S9: Contribution (من شاشة المادة - 4 خطوات) ======
  contribution: {
    intro: (subjectName: string) =>
      `💡 *المساهمة في: ${subjectName}*\n\n` +
      "شكراً لرغبتك في إثراء المحتوى! مساهمات الطلاب تساعد آلاف الزملاء.\n\n" +
      "*الخطوة 1/3:* اختر نوع المساهمة:\n",
    cancel: "✅ تم إلغاء المساهمة. يمكنك البدء من جديد في أي وقت.",
    prompt_title: (subjectName: string, contentType: string) =>
      `📝 *الخطوة 2/3: عنوان المساهمة*\n\n` +
      `📚 المادة: ${subjectName}\n` +
      `🏷 النوع: ${contentType}\n\n` +
      "أرسل عنواناً وصفيّاً للمساهمة.\n\n" +
      "*أمثلة:*\n" +
      "• `ملخص Python للفصل الأول`\n" +
      "• `نموذج اختبار منتصف الفصل 1445`\n" +
      "• `حلول تمارين الفصل 3`",
    prompt_file: (subjectName: string, contentType: string, title: string) =>
      `📎 *الخطوة 3/3: رفع المساهمة*\n\n` +
      `📚 المادة: ${subjectName}\n` +
      `🏷 النوع: ${contentType}\n` +
      `📝 العنوان: ${title}\n\n` +
      "أرسل الملف الآن:\n" +
      "✅ الحد الأقصى: 50 MB (PDF/DOCX)، 10 MB (صور)\n" +
      "❌ ممنوع: EXE, BAT, ZIP, RAR, APK",
    received: (id: number, fileName: string, subjectName: string, contentType: string, title: string) =>
      `✅ *تم استلام مساهمتك بنجاح!*\n\n` +
      `📝 *العنوان:* ${title}\n` +
      `📚 *المادة:* ${subjectName}\n` +
      `🏷 *النوع:* ${contentType}\n` +
      `📎 *الملف:* \`${fileName}\`\n` +
      `🔢 *رقم المساهمة:* \`#${id}\`\n\n` +
      "🙏 *شكراً لك!* مساهمتك ستُراجع من قبل *مسؤول الدفعة* في أقرب وقت.\n\n" +
      "⏱ زمن المراجعة المتوقع: 24-48 ساعة\n" +
      "🏆 عند الاعتماد، ستحصل على *10 نقاط* تُضاف لرصيدك في لوحة الشرف.\n\n" +
      "💡 يمكنك متابعة الحالة من: *👤 حسابي → 📋 مساهماتي*\n" +
      "🔔 ستصل رسالة تنبيه فور اعتماد أو رفض المساهمة.",
  },

  // ====== شاشة S13: Contribution من القائمة الرئيسية (9 خطوات) ======
  contribution_main: {
    intro:
      "🌟 *المساهمة في إثراء المحتوى*\n\n" +
      "🤝 مساهمات الطلاب هي أساس هذا البوت. كل ملف ترفعه يساعد عشرات الزملاء في تخصصك.\n\n" +
      "🏆 *التكريم:* في نهاية كل فصل، يتم تكريم *أبرز 5 مساهمين* من كل تخصص من قبل اللجنة العلمية المركزية.\n\n" +
      "💎 *المكافآت:*\n" +
      "• ✅ كل مساهمة معتمدة = *10 نقاط*\n" +
      "• ⭐ المساهمة المميزة = *20 نقطة*\n" +
      "• 🏆 التكريم الفصلي = *50 نقطة إضافية*\n\n" +
      "📋 *خطوات المساهمة (9 خطوات بسيطة):*\n" +
      "1️⃣ اختيار الكلية\n" +
      "2️⃣ اختيار التخصص\n" +
      "3️⃣ اختيار المستوى\n" +
      "4️⃣ اختيار الفصل\n" +
      "5️⃣ اختيار المادة\n" +
      "6️⃣ اختيار نوع المساهمة\n" +
      "7️⃣ عنوان المساهمة\n" +
      "8️⃣ رفع الملف\n" +
      "9️⃣ رسالة التأكيد\n\n" +
      "_للمساهمة السريعة، تنقّل لأي مادة واضغط زر 💡 مساهمة (4 خطوات فقط)._",
    step: (step: number, total: number, label: string) =>
      `🌟 *المساهمة - خطوة ${step}/${total}*\n\n${label}`,
    progress: (steps: string[]) =>
      steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    select_college: "اختر الكلية:",
    select_specialty: "اختر التخصص:",
    select_level: "اختر المستوى:",
    select_semester: "اختر الفصل الدراسي:",
    select_subject: "اختر المادة:",
    select_type: "اختر نوع المساهمة:",
    prompt_title: (subjectName: string, contentType: string) =>
      `📝 *عنوان المساهمة*\n\n` +
      `📚 المادة: ${subjectName}\n` +
      `🏷 النوع: ${contentType}\n\n` +
      "أرسل عنواناً وصفيّاً.\n\n*أمثلة:* `ملخص Python للفصل الأول`، `نموذج اختبار نهائي 1445`",
    prompt_file: (title: string) =>
      `📎 *رفع المساهمة*\n\n` +
      `📝 العنوان: ${title}\n\n` +
      "أرسل الملف الآن (PDF/DOCX/صورة)\n" +
      "✅ الحد: 50 MB | ❌ ممنوع: EXE, ZIP, APK",
    cancel: "✅ تم إلغاء المساهمة. يمكنك البدء من جديد في أي وقت من زر 🌟 المساهمة.",
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
      current_college?: string;
      current_specialty?: string;
      current_level?: number;
    }) => {
      let msg = "📊 *إحصائياتي:*\n";
      msg += `• 📥 إجمالي التحميلات: ${stats.total_downloads}\n`;
      msg += `• ✅ المساهمات المقبولة: ${stats.accepted_contributions}\n`;
      msg += `• ⏳ المساهمات المعلقة: ${stats.pending_contributions}\n\n`;
      msg += "🎯 *تخصصي الحالي:*\n";
      msg += `• 🏛 الكلية: ${stats.current_college || "غير محدد"}\n`;
      msg += `• 📚 التخصص: ${stats.current_specialty || "غير محدد"}\n`;
      msg += `• 📊 المستوى: ${stats.current_level || "غير محدد"}`;
      return msg;
    },
    btn_my_contributions: "📋 مساهماتي",
    btn_my_downloads: "📥 آخر تحميلاتي",
    btn_change_major: "🔄 تغيير التخصص",
    btn_back: "🔙 رجوع",
    no_contributions: "📚 لا توجد مساهمات بعد.\nابدأ المساهمة من قائمة أي مادة!",
    no_downloads: "📥 لا توجد تحميلات بعد.\nابدأ التصفّح من القائمة الرئيسية!",
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
    back_to_manage_admins: "🔙 إدارة المناصب",
    back_to_customize: "🔙 تخصيص النصوص",
    back_to_content_mgmt: "🔙 إدارة المحتوى",
    back_to_positions: "🔙 المناصب",
    back_to_channels: "🔙 قنوات اللجان",
  },

  // ====== شاشة A5: Content Management (جديدة) ======
  content_mgmt: {
    title: "📁 *إدارة المحتوى*\n\nاختر الإجراء:",
    btn_browse: "📂 استعراض المحتوى",
    btn_upload: "📤 رفع محتوى جديد",
    btn_filter: "🔍 فلترة المحتوى",
    empty: "📭 لا يوجد محتوى ضمن نطاق صلاحياتك حالياً.",
  },

  // ====== شاشة A5b: Browse Content ======
  browse_content: {
    title: (count: number) => `📂 *المحتوى (${count})*\n\nاختر عنصراً للعرض:`,
    filter_prompt: "🔍 اختر معيار الفلترة:",
    btn_by_college: "🏛 بالكلية",
    btn_by_specialty: "📚 بالتخصص",
    btn_by_subject: "📖 بالمادة",
    btn_by_type: "🏷 بالنوع",
    btn_all: "📋 عرض الكل",
    filter_active: (filterLabel: string) =>
      `🔍 *الفلترة الحالية:* ${filterLabel}\n\nاختر عنصراً:`,
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
      msg += `${c.is_starred ? "⭐ *محتوى مميز*\n" : ""}`;
      msg += `👤 *رافعه:* ${c.added_by}\n`;
      msg += `📅 *تاريخ الرفع:* ${c.added_at}\n`;
      return msg;
    },
    btn_edit: "✏️ تعديل",
    btn_move: "🔄 نقل",
    btn_delete: "🗑 حذف",
    btn_star: "⭐ تمييز",
    btn_unstar: "☆ إلغاء التمييز",
    btn_view_file: "👁 معاينة الملف",
    delete_confirm: (title: string) =>
      `⚠️ *تأكيد الحذف*\n\nسيتم حذف:\n📄 *${title}*\n\n+ حذف المنشور من قناة التخزين.\n\nهل أنت متأكد؟`,
    btn_confirm_delete: "✅ نعم، احذف",
    btn_cancel_delete: "❌ إلغاء",
    delete_success: "✅ تم حذف المحتوى بنجاح.\n\nالمنشور محذوف من القناة.",
    move_prompt: "🔄 *نقل المحتوى*\n\nاختر الوجهة الجديدة:",
    move_success: "✅ تم نقل المحتوى بنجاح.",
    edit_prompt: "✏️ أرسل العنوان الجديد للمحتوى:",
    edit_success: "✅ تم تحديث العنوان.",
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

    // ===== رسائل عامة =====
    empty: "⚠️ لا توجد مناصب ضمن نطاقك.",
    no_permission: "❌ *ليست لديك صلاحية إدارة المسؤولين.*\n\nهذه الميزة متاحة فقط للمسؤول المركزي.",
    no_permission_college: "❌ *ليست لديك صلاحية إدارة مندوبي المستويات.*",
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
    title: "🏆 *إدارة تكريم المساهمين*\n\nاختر القسم:",
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
