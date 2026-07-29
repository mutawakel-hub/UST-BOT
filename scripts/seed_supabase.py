"""
زرع البيانات الأولية في Supabase عبر REST API
ينقل كل البيانات الوهمية إلى Supabase ليصبح الباك إند حقيقياً
"""
import json
import urllib.request
import urllib.parse

SUPABASE_URL = "https://gksivmyyfobnocjpnplf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc2l2bXl5Zm9ibm9janBucGxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE5MDUyMiwiZXhwIjoyMTAwNzY2NTIyfQ.eiAnGNzugXaHccPdx6Xnr2QRCrHAL-e0myyRqKc9IUw"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def supabase_insert(table, data):
    """إدراج في جدول Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status == 201
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "duplicate" in err.lower() or "23505" in err:
            return True  # Already exists
        print(f"  ❌ {table}: {err[:100]}")
        return False

def supabase_select(table, columns="*", filter_str=None, limit=None):
    """قراءة من جدول Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={columns}"
    if filter_str:
        url += f"&{filter_str}"
    if limit:
        url += f"&limit={limit}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("🌱 بدء زرع البيانات الأولية في Supabase...")
print()

# ============================================
# 1. زرع المحتوى (content)
# ============================================
print("📄 زرع المحتوى (content)...")

# message_id للملف التجريبي المرفوع في كل قناة
STORAGE_MESSAGE_IDS = {1: 4, 5: 2}  # كلية الطب=4, كلية الحاسبات=2

content_data = [
    {"id": 1, "subject_id": 101, "content_type_id": "book_theory", "title": "مقدمة في تقنية المعلومات - المقرر النظري",
     "file_name": "intro_it_theory.pdf", "file_size_mb": 4.2,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": True, "download_count": 142, "academic_year": "2025-2026"},
    {"id": 2, "subject_id": 101, "content_type_id": "book_practical", "title": "مقدمة في تقنية المعلومات - دليل العملي",
     "file_name": "intro_it_practical.pdf", "file_size_mb": 1.8,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": False, "download_count": 67, "academic_year": "2025-2026"},
    {"id": 3, "subject_id": 101, "content_type_id": "exam", "title": "اختبار منتصف الفصل 1445",
     "file_name": "intro_it_midterm.pdf", "file_size_mb": 0.5,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": False, "download_count": 234, "academic_year": "2025-2026"},
    {"id": 4, "subject_id": 102, "content_type_id": "book_theory", "title": "برمجة Python - المقرر النظري",
     "file_name": "python_theory.pdf", "file_size_mb": 5.1,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": True, "download_count": 312, "academic_year": "2025-2026"},
    {"id": 5, "subject_id": 102, "content_type_id": "summary", "title": "ملخص Python شامل",
     "file_name": "python_summary.pdf", "file_size_mb": 0.9,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": False, "download_count": 156, "academic_year": "2025-2026"},
    {"id": 6, "subject_id": 108, "content_type_id": "book_theory", "title": "قواعد البيانات (1) - المقرر",
     "file_name": "db_theory.pdf", "file_size_mb": 3.8,
     "telegram_message_id": STORAGE_MESSAGE_IDS[5],
     "telegram_file_id": "BQACAgQAAyEGAATeKAPyAAMCamf27c_B9s_Wt6oiZM5wkq2J9U",
     "added_by_position_id": "college_admin_5", "added_by_telegram_id": 1000002,
     "is_starred": True, "download_count": 198, "academic_year": "2025-2026"},
    {"id": 7, "subject_id": 301, "content_type_id": "book_theory", "title": "مقدمة في الطب - المقرر النظري",
     "file_name": "med_intro.pdf", "file_size_mb": 5.5,
     "telegram_message_id": STORAGE_MESSAGE_IDS[1],
     "telegram_file_id": "BQACAgQAAyEGAAMBBo8vyAADBGpn9uxqRyi-dZUPKcq0Aaaf_W",
     "added_by_position_id": "college_admin_1", "added_by_telegram_id": 1000005,
     "is_starred": True, "download_count": 89, "academic_year": "2025-2026"},
    {"id": 8, "subject_id": 301, "content_type_id": "exam", "title": "اختبار تشريحي - منتصف الفصل",
     "file_name": "anatomy_midterm.pdf", "file_size_mb": 0.8,
     "telegram_message_id": STORAGE_MESSAGE_IDS[1],
     "telegram_file_id": "BQACAgQAAyEGAAMBBo8vyAADBGpn9uxqRyi-dZUPKcq0Aaaf_W",
     "added_by_position_id": "college_admin_1", "added_by_telegram_id": 1000005,
     "is_starred": False, "download_count": 145, "academic_year": "2025-2026"},
]

for item in content_data:
    supabase_insert("content", item)
print(f"  ✅ {len(content_data)} عنصر محتوى")

# ============================================
# 2. زرع قنوات اللجان (committee_channels)
# ============================================
print("📢 زرع قنوات اللجان (committee_channels)...")

channels_data = [
    {"id": 1, "scope_type": "central", "channel_url": "https://t.me/+ust_central_committee",
     "display_name": "📢 اللجنة العلمية المركزية", "is_active": True},
    {"id": 2, "scope_type": "college", "college_id": 1, "channel_url": "https://t.me/+YxwK3TvEr_01OWNk",
     "display_name": "🏛 قناة اللجنة العلمية - الطب والعلوم الصحية", "is_active": True},
    {"id": 3, "scope_type": "college", "college_id": 2, "channel_url": "https://t.me/+ust_2_committee",
     "display_name": "🏛 قناة اللجنة العلمية - طب الأسنان", "is_active": True},
    {"id": 4, "scope_type": "college", "college_id": 3, "channel_url": "https://t.me/+ust_3_committee",
     "display_name": "🏛 قناة اللجنة العلمية - الصيدلة", "is_active": True},
    {"id": 5, "scope_type": "college", "college_id": 4, "channel_url": "https://t.me/+ust_4_committee",
     "display_name": "🏛 قناة اللجنة العلمية - الهندسة", "is_active": True},
    {"id": 6, "scope_type": "college", "college_id": 5, "channel_url": "https://t.me/+2KIuPrVjbBMyNGQ0",
     "display_name": "🏛 قناة اللجنة العلمية - الحاسبات", "is_active": True},
    {"id": 7, "scope_type": "college", "college_id": 6, "channel_url": "https://t.me/+ust_6_committee",
     "display_name": "🏛 قناة اللجنة العلمية - العلوم الإدارية", "is_active": True},
    {"id": 8, "scope_type": "college", "college_id": 7, "channel_url": "https://t.me/+ust_7_committee",
     "display_name": "🏛 قناة اللجنة العلمية - العلوم الإنسانية", "is_active": True},
    {"id": 10, "scope_type": "specialty_level", "college_id": 5, "specialty_id": 16, "level_num": 1,
     "channel_url": "https://t.me/+ust_it_level1",
     "display_name": "📊 قناة اللجنة العلمية - تقنية معلومات (IT) - مستوى 1", "is_active": True},
]

for ch in channels_data:
    supabase_insert("committee_channels", ch)
print(f"  ✅ {len(channels_data)} قناة لجنة")

# ============================================
# 3. زرع المسؤولين (admin_users + position_holders)
# ============================================
print("👥 زرع المسؤولين (admin_users + position_holders)...")

admin_users = [
    {"telegram_id": 1000001, "first_name": "د. أحمد", "username": "ahmed_central"},
    {"telegram_id": 1000002, "first_name": "أ. سارة", "username": "sara_cs"},
    {"telegram_id": 1000003, "first_name": "م. خالد", "username": "khaled_it"},
    {"telegram_id": 1000004, "first_name": "أ. فاطمة", "username": "fatima_l1"},
    {"telegram_id": 1000005, "first_name": "د. محمد", "username": "mohammed_med"},
]

for u in admin_users:
    supabase_insert("admin_users", u)
print(f"  ✅ {len(admin_users)} مسؤول")

position_holders = [
    {"position_id": "central_chair", "user_telegram_id": 1000001, "assigned_at": "2026-01-01", "is_active": True},
    {"position_id": "college_admin_5", "user_telegram_id": 1000002, "assigned_at": "2026-01-05", "assigned_by": 1000001, "is_active": True},
    {"position_id": "college_admin_1", "user_telegram_id": 1000005, "assigned_at": "2026-01-06", "assigned_by": 1000001, "is_active": True},
    {"position_id": "college_admin_4", "user_telegram_id": 1000003, "assigned_at": "2026-02-01", "assigned_by": 1000001, "is_active": True},
    {"position_id": "level_rep_16_1", "user_telegram_id": 1000004, "assigned_at": "2026-02-15", "assigned_by": 1000002, "is_active": True},
]

for h in position_holders:
    supabase_insert("position_holders", h)
print(f"  ✅ {len(position_holders)} شاغل منصب")

# ============================================
# 4. زرع التكريم (contribution_honors)
# ============================================
print("🏆 زرع التكريم (contribution_honors)...")

honors_data = [
    {"id": 1, "student_telegram_id": 555111222, "honor_type": "top_contributor_specialty",
     "scope_college_id": 5, "scope_specialty_id": 16,
     "honor_title": "🏆 أبرز مساهم في تخصص IT - الفصل الأول 2025-2026",
     "honor_period": "الفصل الأول 2025-2026", "points_at_honor": 145, "bonus_points": 50,
     "status": "pending", "nominated_by_telegram_id": 1000004, "created_at": "2026-07-01"},
    {"id": 2, "student_telegram_id": 555333444, "honor_type": "top_contributor_specialty",
     "scope_college_id": 5, "scope_specialty_id": 16,
     "honor_title": "🏆 أبرز مساهم في تخصص IT - الفصل الأول 2025-2026",
     "honor_period": "الفصل الأول 2025-2026", "points_at_honor": 132, "bonus_points": 50,
     "status": "pending", "nominated_by_telegram_id": 1000004, "created_at": "2026-07-01"},
    {"id": 3, "student_telegram_id": 555555666, "honor_type": "top_contributor_college",
     "scope_college_id": 4,
     "honor_title": "🏆 أبرز مساهم في كلية الهندسة - الفصل الأول 2025-2026",
     "honor_period": "الفصل الأول 2025-2026", "points_at_honor": 110, "bonus_points": 30,
     "status": "approved", "approved_by_telegram_id": 1000001, "approved_at": "2026-07-10", "created_at": "2026-07-05"},
]

for h in honors_data:
    supabase_insert("contribution_honors", h)
print(f"  ✅ {len(honors_data)} تكريم")

# ============================================
# 5. زرع المساهمات المعلقة (contributions)
# ============================================
print("📥 زرع المساهمات المعلقة (contributions)...")

contributions_data = [
    {"id": 1001, "user_telegram_id": 1000002, "subject_id": 102, "content_type_id": "summary",
     "file_name": "ملخص Python شامل.pdf", "file_size_mb": 0.9,
     "description": "ملخص يغطي كل موضوعات Python في الفصل الأول",
     "status": "pending", "created_at": "2026-07-27T20:00:00Z"},
    {"id": 1002, "user_telegram_id": 1000002, "subject_id": 108, "content_type_id": "exam",
     "file_name": "نموذج اختبار قواعد بيانات.pdf", "file_size_mb": 0.6,
     "description": "نموذج اختبار من العام الماضي مع الحلول",
     "status": "pending", "created_at": "2026-07-27T18:00:00Z"},
    {"id": 1003, "user_telegram_id": 1000005, "subject_id": 301, "content_type_id": "summary",
     "file_name": "ملخص التشريح.pdf", "file_size_mb": 1.2,
     "description": "ملخص شامل للتشريح البشري",
     "status": "pending", "created_at": "2026-07-26T12:00:00Z"},
]

for c in contributions_data:
    # نحتاج admin_users أولاً
    supabase_insert("admin_users", {"telegram_id": c["user_telegram_id"], "first_name": "طالب مساهم"})
    supabase_insert("contributions", c)
print(f"  ✅ {len(contributions_data)} مساهمة معلّقة")

# ============================================
# 6. زرع الطلاب + الاشتراكات (for broadcast testing)
# ============================================
print("👥 زرع الطلاب + الاشتراكات...")

FIRST_NAMES = [
    "أحمد", "محمد", "عبدالله", "يوسف", "خالد", "عمر", "سعد", "فهد", "إبراهيم", "ناصر",
    "سارة", "فاطمة", "نورة", "ريم", "هند", "مها", "لمى", "دلال", "أمل", "ابتسام",
]
LAST_NAMES = ["العولقي", "الحداد", "الشريف", "الكثيري", "باوزير", "الجندي", "السقاف", "العزي",
              "الحبشي", "الأهدل", "المخلافي", "الزرقة", "بامحمود", "الصبري", "الحيمد"]

distribution = [
    {"college_id": 5, "specialty_id": 16, "count": 25},
    {"college_id": 5, "specialty_id": 18, "count": 12},
    {"college_id": 5, "specialty_id": 19, "count": 10},
    {"college_id": 4, "specialty_id": 10, "count": 8},
    {"college_id": 4, "specialty_id": 12, "count": 7},
    {"college_id": 1, "specialty_id": 1, "count": 8},
    {"college_id": 2, "specialty_id": 5, "count": 6},
    {"college_id": 3, "specialty_id": 6, "count": 8},
    {"college_id": 6, "specialty_id": 23, "count": 9},
    {"college_id": 7, "specialty_id": 28, "count": 7},
]

student_id = 600000000
name_idx = 0
students_count = 0
for dist in distribution:
    for i in range(dist["count"]):
        fn = FIRST_NAMES[name_idx % len(FIRST_NAMES)]
        ln = LAST_NAMES[(name_idx * 3) % len(LAST_NAMES)]
        level = (i % 4) + 1
        points = (i * 7) % 50
        accepted = (i * 3) % 8

        # إدراج الطالب
        supabase_insert("students", {
            "telegram_id": student_id,
            "first_name": f"{fn} {ln}",
            "current_college_id": dist["college_id"],
            "current_specialty_id": dist["specialty_id"],
            "current_level": level,
            "total_points": points,
            "accepted_contributions": accepted,
        })

        # إدراج الاشتراك
        supabase_insert("student_subscriptions", {
            "student_telegram_id": student_id,
            "scope_type": "level",
            "scope_college_id": dist["college_id"],
            "scope_specialty_id": dist["specialty_id"],
            "scope_level": level,
            "is_active": True,
        })

        student_id += 1
        name_idx += 1
        students_count += 1

print(f"  ✅ {students_count} طالب + اشتراكات")

# ============================================
# التحقق النهائي
# ============================================
print()
print("📊 التحقق النهائي:")
tables = ["content", "committee_channels", "admin_users", "position_holders",
          "contributions", "contribution_honors", "students", "student_subscriptions"]
for t in tables:
    try:
        data = supabase_select(t, "id", limit=1)
        count_url = f"{SUPABASE_URL}/rest/v1/{t}?select=id"
        req = urllib.request.Request(count_url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp:
            all_data = json.loads(resp.read().decode())
        print(f"  ✅ {t}: {len(all_data)} سجلات")
    except Exception as e:
        print(f"  ❌ {t}: {e}")

print()
print("🎉 تم زرع جميع البيانات الأولية في Supabase!")
