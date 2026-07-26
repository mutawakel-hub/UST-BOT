// ============================================
// النصوص الافتراضية للبوت - فصحى مبسّطة
// ============================================

export const TEXTS = {
  // ====== شاشة S1: MainMenu ======
  main_menu: {
    welcome:
      "🎓 *مرحباً بك في البوت العلمي المركزي*\n" +
      "*جامعة العلوم والتكنولوجيا - اليمن*\n\n" +
      "اختر الخدمة المطلوبة من القائمة أدناه: 👇",
    btn_colleges: "🏛 الكليات",
    btn_search: "🔍 بحث",
    btn_leaderboard: "🏆 لوحة الشرف",
    btn_profile: "👤 حسابي",
    btn_committee: "📢 قناة اللجنة",
    btn_contact: "📞 تواصل معنا",
  },

  // ====== شاشة S2: ChooseCollege ======
  choose_college: {
    title: "🏛 *اختر الكلية*\n\nاختر كليتك من القائمة أدناه:",
    footer: "\n\n💡 يمكنك العودة للقائمة الرئيسية في أي وقت.",
  },

  // ====== شاشة S3: ChooseMajor ======
  choose_major: {
    title: "📚 *اختر التخصص*\n\nالتخصصات المتاحة في الكلية:",
    no_specialties: "⚠️ لا توجد تخصصات متاحة في هذه الكلية حالياً.",
  },

  // ====== شاشة S4: ChooseLevel ======
  choose_level: {
    title: "📊 *اختر المستوى الدراسي*\n\nملاحظة: يحتوي كل مستوى على فصلين دراسيين.",
    plan_button: "🗺 الخطة الاسترشادية",
    plan_message: "🗺 *الخطة الاسترشادية*\n\nسيتم توفير ملف الخطة الاسترشادية قريباً عند الانتقال لمرحلة الإنتاج.",
  },

  // ====== شاشة S5: ChooseSemester ======
  choose_semester: {
    title: "📅 *اختر الفصل الدراسي*\n\nالفصل الأول (الخريف) | الفصل الثاني (الربيع)",
  },

  // ====== شاشة S6: ChooseSubject ======
  choose_subject: {
    title: "📖 *اختر المادة*\n\nالمواد المتاحة في هذا الفصل:",
    no_subjects: "⚠️ لا توجد مواد متاحة في هذا الفصل حالياً.\n\n💡 للتجربة، استخدم: كلية الحاسبات → تقنية معلومات (IT) → المستوى الأول أو الثاني.",
  },

  // ====== شاشة S7: SubjectMenu ======
  subject_menu: {
    title: (subjectName: string) =>
      `📖 *${subjectName}*\n\nاختر نوع المحتوى المطلوب:`,
    btn_book_theory: "📘 المقرر (نظري)",
    btn_book_practical: "📗 المقرر (عملي)",
    btn_exams: "📑 نماذج اختبارات",
    btn_summaries: "📝 ملخصات",
    btn_contribute: "💡 مساهمة",
    btn_subscribe: "🔔 اشتراك",
    btn_unsubscribe: "🔕 إلغاء الاشتراك",
  },

  // ====== شاشة S8: BookType (نظري/عملي) ======
  book_type: {
    choose_book_type: (subjectName: string) =>
      `📘 *${subjectName} - المقرر الدراسي*\n\nاختر النوع:`,
    theory_only: "⚠️ هذه المادة لا تحتوي على مقرر عملي.",
    files_list: "📄 *قائمة الملفات*\n\nاختر ملفاً للتحميل:",
    no_files: "⚠️ لا توجد ملفات في هذا التصنيف حالياً.",
  },

  // ====== شاشة S9: Contribution ======
  contribution: {
    intro: (subjectName: string) =>
      `💡 *المساهمة في: ${subjectName}*\n\n` +
      "شكراً لرغبتك في المساهمة! يساعدنا طلابنا في إثراء المحتوى.\n\n" +
      "*للمساهمة، أرسل الآن:*\n" +
      "📎 الملف (PDF/DOCX/صورة)\n\n" +
      "*ملاحظات مهمة:*\n" +
      "✅ الحد الأقصى: 50 MB للملفات، 10 MB للصور\n" +
      "❌ ممنوع: EXE, BAT, ZIP, RAR, APK\n" +
      "⏱ سيتم مراجعة المساهمة من قبل المسؤول قبل نشرها",
    cancel: "✅ تم إلغاء المساهمة. يمكنك البدء من جديد في أي وقت.",
    received: "✅ *تم استلام ملفك!*\n\nشكراً لمساهمتك. سيتم مراجعتها من قبل المسؤول خلال 24-48 ساعة.\n\nرقم المساهمة: `#{id}`",
  },

  // ====== شاشة S10: Search ======
  search: {
    intro:
      "🔍 *وضع البحث*\n\n" +
      "أرسل اسم المادة أو الكلمة المفتاحية للبحث:\n\n" +
      "*أمثلة:*\n" +
      "• `Python`\n" +
      "• `قواعد البيانات`\n" +
      "• `الرياضيات`",
    no_results: "🔍 لم يتم العثور على نتائج. جرب كلمة أخرى.",
    results_header: (count: number) =>
      `🔍 *نتائج البحث (${count} نتيجة)*\n\nاختر ملفاً للتحميل:`,
  },

  // ====== شاشة S11: Leaderboard ======
  leaderboard: {
    title: "🏆 *لوحة الشرف*\n\nأفضل الطلاب المساهمين:",
    filter_college: "🏛 تصفية بالكلية",
    filter_specialty: "📚 تصفية بالتخصص",
    refresh: "🔄 تحديث",
    no_data: "📊 لا توجد بيانات في لوحة الشرف حالياً.\n\nسيتم تحديثها دورياً من قبل المسؤول المركزي.",
    rank_label: "الترتيب",
    points_label: "النقاط",
    contributions_label: "المساهمات",
  },

  // ====== شاشة S12: Profile ======
  profile: {
    title: "👤 *حسابي*\n\n",
    stats: (stats: {
      total_downloads: number;
      accepted_contributions: number;
      current_college?: string;
      current_specialty?: string;
      current_level?: number;
    }) => {
      let msg = "📊 *الإحصائيات:*\n";
      msg += `• إجمالي التحميلات: ${stats.total_downloads}\n`;
      msg += `• المساهمات المقبولة: ${stats.accepted_contributions}\n\n`;
      msg += "🎯 *التخصص الحالي:*\n";
      msg += `• الكلية: ${stats.current_college || "غير محدد"}\n`;
      msg += `• التخصص: ${stats.current_specialty || "غير محدد"}\n`;
      msg += `• المستوى: ${stats.current_level || "غير محدد"}`;
      return msg;
    },
    btn_my_contributions: "📋 مساهماتي",
    btn_my_downloads: "📥 آخر تحميلاتي",
    btn_change_major: "🔄 تغيير التخصص",
    btn_back: "🔙 رجوع",
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
    next_page: "➡️ التالي",
    prev_page: "⬅️ السابق",
  },

  // ====== رسائل عامة ======
  common: {
    loading: "⏳ جارٍ التحميل...",
    error: "⚠️ حدث خطأ. حاول مرة أخرى لاحقاً.",
    file_sent: "✅ تم إرسال الملف بنجاح!",
    mockup_notice:
      "ℹ️ *وضع التجربة (Mockup)*\nهذه النسخة تجريبية ببيانات وهمية. عند الانتقال للإنتاج ستتوفر بيانات حقيقية.",
  },
} as const;

// نصوص بوت الإدارة
export const ADMIN_TEXTS = {
  // ====== شاشة A1: AdminLogin ======
  login: {
    welcome:
      "🛡 *بوت الإدارة - جامعة العلوم والتكنولوجيا*\n\n" +
      "مرحباً بك! للوصول إلى لوحة الإدارة، يجب التحقق من هويتك.\n\n" +
      "أرسل الآن معرّف المسؤول (Admin ID) المخصص لك من المسؤول المركزي.",
    not_authorized:
      "❌ *غير مصرّح*\n\nمعرّفك غير موجود في قائمة المسؤولين. تواصل مع المسؤول المركزي للحصول على صلاحية.",
    success: (adminName: string, role: string) =>
      `✅ *تم تسجيل الدخول بنجاح!*\n\nمرحباً ${adminName}\nالدور: ${role}`,
  },

  // ====== شاشة A2: AdminDashboard ======
  dashboard: {
    title: (adminName: string) =>
      `🛡 *لوحة الإدارة*\n\nمرحباً *${adminName}* — اختر الإجراء المطلوب:`,
    btn_pending: "📥 المساهمات المعلقة",
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
    title: (count: number) => `📥 *المساهمات المعلقة (${count})*\n\nاختر مساهمة للمراجعة:`,
    empty: "✅ *لا توجد مساهمات معلقة حالياً*\n\nكل المساهمات تمت مراجعتها.",
  },

  // ====== شاشة A4: ReviewContribution ======
  review: {
    title: (contributionId: number, fileName: string, subjectName: string, userName: string) =>
      `📥 *مراجعة مساهمة #${contributionId}*\n\n` +
      `📎 الملف: \`${fileName}\`\n` +
      `📚 المادة: ${subjectName}\n` +
      `👤 المساهم: ${userName}\n\n` +
      "اختر الإجراء:",
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
    done: (reason: string) => `✅ تم رفض المساهمة.\nالسبب: ${reason}`,
  },

  // ====== شاشة A5: FilesMgmt ======
  files_mgmt: {
    title: "📁 *إدارة الملفات*\n\nاختر الإجراء:",
    btn_upload: "📤 رفع ملف",
    btn_browse: "📂 استعراض الملفات",
  },

  // ====== شاشة A5a: UploadWizard ======
  upload_wizard: {
    start: "📤 *معالج رفع الملفات*\n\nاختر الكلية:",
    select_major: "📚 اختر التخصص:",
    select_level: "📊 اختر المستوى:",
    select_semester: "📅 اختر الفصل:",
    select_subject: "📖 اختر المادة:",
    select_type: "🏷 اختر تصنيف الملف:",
    confirm: (file_name: string, subject_name: string, type_label: string) =>
      `✅ *تأكيد الرفع*\n\n` +
      `📎 الملف: \`${file_name}\`\n` +
      `📚 المادة: ${subject_name}\n` +
      `🏷 التصنيف: ${type_label}\n\n` +
      "أرسل الملف الآن للتأكيد (في وضع التجربة سيتم محاكاة الرفع).",
    success: "✅ *تم رفع الملف بنجاح!*\n\nالملف متاح الآن للطلاب.",
  },

  // ====== شاشة A6: SubjectsMgmt ======
  subjects_mgmt: {
    title: "📖 *إدارة المواد*\n\nاختر الإجراء:",
    btn_add: "➕ إضافة مادة",
    btn_edit: "✏️ تعديل/حذف مادة",
    add_prompt: "📝 أرسل اسم المادة الجديدة (في وضع التجربة فقط):",
    add_done: (name: string) => `✅ تمت إضافة المادة: *${name}* (محاكاة)`,
  },

  // ====== شاشة A7: Broadcast ======
  broadcast: {
    title: "📢 *التعميم*\n\nاختر نطاق التعميم:",
    btn_all: "🌍 للكل",
    btn_college: "🏛 لكلية",
    btn_major: "📚 لتخصص",
    btn_level: "📊 لمستوى",
    prompt_text: "📝 أرسل نص التعميم الآن:",
    sent: (count: number) => `✅ *تم إرسال التعميم*\n\nعدد المستلمين: ${count} (محاكاة)`,
  },

  // ====== شاشة A8: ManageAdmins ======
  manage_admins: {
    title: "👥 *إدارة المسؤولين*\n\nاختر الإجراء:",
    btn_add: "➕ إضافة مسؤول",
    btn_list: "📋 قائمة المسؤولين",
    list_header: "📋 *قائمة المسؤولين (محاكاة):*",
  },

  // ====== شاشة A9: Statistics ======
  statistics: {
    title: "📊 *الإحصائيات العامة*\n\n",
    content: (stats: {
      total_users: number;
      total_files: number;
      total_contributions: number;
      pending_contributions: number;
      total_downloads: number;
      total_broadcasts: number;
    }) =>
      `👥 إجمالي المستخدمين: ${stats.total_users}\n` +
      `📁 إجمالي الملفات: ${stats.total_files}\n` +
      `📥 إجمالي المساهمات: ${stats.total_contributions}\n` +
      `⏳ المساهمات المعلقة: ${stats.pending_contributions}\n` +
      `⬇️ إجمالي التحميلات: ${stats.total_downloads}\n` +
      `📢 إجمالي التعميمات: ${stats.total_broadcasts}`,
    refresh: "🔄 تحديث",
  },

  // ====== شاشة A10: CustomizeTexts ======
  customize: {
    title: "⚙️ *تخصيص النصوص*\n\nاختر الشاشة لتخصيصها:",
    btn_main_menu: "🏠 القائمة الرئيسية",
    btn_choose_college: "🏛 اختيار الكلية",
    btn_subject_menu: "📖 قائمة المادة",
    edit_prompt: (current: string) => `✏️ *النص الحالي:*\n\n${current}\n\nأرسل النص الجديد:`,
    saved: "✅ تم حفظ النص المخصص (محاكاة).",
    reset: "↩️ تم استعادة النص الافتراضي (محاكاة).",
  },

  // ====== شاشة A11: LeaderboardUpdate ======
  leaderboard_update: {
    title: "🏆 *تحديث لوحة الشرف*\n\nاختر النطاق:",
    btn_global: "🌍 لوحة عالمية",
    btn_college: "🏛 لوحة كلية",
    btn_specialty: "📚 لوحة تخصص",
    refresh_done: "✅ تم تحديث لوحة الشرف (محاكاة).",
  },

  // ====== أزرار التنقل ======
  navigation: {
    back_to_dashboard: "🔙 لوحة الإدارة",
    back_to_pending: "🔙 المساهمات",
    back_to_review: "🔙 المراجعة",
  },
} as const;
