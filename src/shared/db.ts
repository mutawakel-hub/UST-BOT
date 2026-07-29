// ============================================
// 🗄️ Supabase Client for Cloudflare Workers
// ============================================
// عميل خفيف لـ Supabase REST API (PostgREST)
// يعمل في بيئة Cloudflare Workers بدون مكتبات إضافية
// ============================================

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// ============================================
// عميل Supabase الأساسي
// ============================================
export class SupabaseClient {
  private url: string;
  private key: string;

  constructor(env: SupabaseEnv) {
    this.url = env.SUPABASE_URL;
    this.key = env.SUPABASE_SERVICE_KEY;
  }

  // ============================================
  // استعلام SELECT
  // ============================================
  // ملاحظات:
  //   - الفلاتر يتم تمريرها كما هي (يجب أن تكون URL-encoded من caller)
  //     استخدم الدوال المساعدة eq/neq/inList أدناه—they تُرمّز تلقائياً
  //   - single: true → يضبط Accept: application/vnd.pgrst.object+json
  //     ويرجع كائناً واحداً (أو null لو لا نتائج بدل 406)
  //   - columns: لا تُرمّز (PostgREST يقبل الفواصل كما هي)
  // ============================================
  async select<T = any>(
    table: string,
    options: {
      columns?: string;
      filter?: string;
      order?: string;
      limit?: number;
      single?: boolean;
    } = {}
  ): Promise<T | T[]> {
    // PostgREST يقبل columns بفواصل عادية بدون encoding
    // encodeURIComponent يحوّل ',' إلى '%2C' مما يكسر بعض الاستعلامات
    const columns = options.columns || "*";
    let path = `/rest/v1/${table}?select=${columns}`;

    if (options.filter) path += `&${options.filter}`;
    if (options.order) path += `&order=${options.order}`;
    if (options.limit) path += `&limit=${options.limit}`;
    if (options.single) path += `&limit=1`;

    const headers = this.getHeaders();
    if (options.single) {
      // PostgREST: يستخدم header Accept خاص لـ single-object mode
      headers["Accept"] = "application/vnd.pgrst.object+json";
      // Prefer: count=exact يضمن إرجاع 406 (وليس 200 فارغ) لو لا نتائج
      headers["Prefer"] = "count=exact";
    }

    // LOG: اطبع الـ URL الكامل للتشخيص
    const fullUrl = `${this.url}${path}`;
    console.log(`📤 [DB] SELECT ${table}: ${fullUrl.substring(0, 200)}`);

    const resp = await fetch(fullUrl, { headers });

    console.log(`📊 [DB] Response status: ${resp.status}`);

    // في single mode، 406 يعني "لا نتائج" — نُرجع null بدل رمي خطأ
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`❌ [DB] SELECT error ${resp.status}: ${errText.substring(0, 300)}`);
      if (options.single && (resp.status === 406 || resp.status === 400)) {
        return null as T;
      }
      throw new Error(`Supabase SELECT error: ${errText}`);
    }

    // single mode: قد تُرجع body فارغ أو كائن واحد
    if (options.single) {
      const text = await resp.text();
      if (!text) return null as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null as T;
      }
    }

    const data = await resp.json();
    console.log(`✅ [DB] SELECT ${table} returned ${Array.isArray(data) ? data.length : 1} rows`);
    return data as T[];
  }

  // ============================================
  // إدراج INSERT
  // ============================================
  async insert<T = any>(table: string, data: any): Promise<T> {
    const resp = await fetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Prefer": "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase INSERT error: ${err}`);
    }

    const result = await resp.json();
    return (Array.isArray(result) ? result[0] : result) as T;
  }

  // ============================================
  // تحديث UPDATE
  // ============================================
  async update<T = any>(
    table: string,
    data: any,
    filter: string
  ): Promise<T[]> {
    const resp = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: {
        ...this.getHeaders(),
        "Prefer": "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase UPDATE error: ${err}`);
    }

    return resp.json();
  }

  // ============================================
  // حذف DELETE
  // ============================================
  async delete(table: string, filter: string): Promise<void> {
    const resp = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase DELETE error: ${err}`);
    }
  }

  // ============================================
  // استدعاء Function (RPC)
  // ============================================
  async rpc<T = any>(functionName: string, params: any): Promise<T> {
    const resp = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase RPC error: ${err}`);
    }

    return resp.json();
  }

  // ============================================
  // الـ Headers
  // ============================================
  private getHeaders(): Record<string, string> {
    return {
      "apikey": this.key,
      "Authorization": `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
  }
}

// ============================================
// دوال مساعدة: بناء الفلاتر (URL-encoded)
// ============================================
// ملاحظة مهمة: هذه الدوال تُرمّز القيم تلقائياً لـ URL
// لذا لا داعي لاستدعاء encodeURIComponent من caller.
// مثال: eq("name", "أحمد") → "name=eq.%D8%A3%D8%AD%D9%85%D8%AF"
// ============================================
export function eq(column: string, value: any): string {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return `${column}=eq.${encodeURIComponent(v)}`;
}

export function neq(column: string, value: any): string {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return `${column}=neq.${encodeURIComponent(v)}`;
}

export function inList(column: string, values: any[]): string {
  const formatted = values.map((v) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return encodeURIComponent(`"${s}"`);
  }).join(",");
  return `${column}=in.(${formatted})`;
}

export function order(column: string, ascending = true): string {
  return `${column}.${ascending ? "asc" : "desc"}`;
}

// ============================================
// دوال خاصة بالتطبيق
// ============================================

// تسجيل طالب جديد (أو تحديث بياناته)
export async function registerStudent(
  client: SupabaseClient,
  telegramId: number,
  firstName: string,
  username: string | undefined,
  collegeId: number,
  specialtyId: number,
  level: number
): Promise<void> {
  await client.rpc("register_student", {
    p_telegram_id: telegramId,
    p_first_name: firstName,
    p_username: username || null,
    p_college_id: collegeId,
    p_specialty_id: specialtyId,
    p_level: level,
  });
}

// التحقق من تسجيل الطالب
export async function isStudentRegistered(
  client: SupabaseClient,
  telegramId: number
): Promise<boolean> {
  const result = await client.select<{ telegram_id: number }>("students", {
    columns: "telegram_id",
    filter: eq("telegram_id", telegramId),
    limit: 1,
  });
  return Array.isArray(result) && result.length > 0;
}

// الحصول على بيانات الطالب
export async function getStudent(
  client: SupabaseClient,
  telegramId: number
): Promise<any | null> {
  const result = await client.select("students", {
    filter: eq("telegram_id", telegramId),
    single: true,
  });
  return result || null;
}

// الحصول على مستلمي التعميم
export async function getBroadcastRecipients(
  client: SupabaseClient,
  scopeType: string,
  collegeId?: number,
  specialtyId?: number,
  level?: number
): Promise<number[]> {
  const result = await client.rpc("get_broadcast_recipients", {
    p_scope_type: scopeType,
    p_college_id: collegeId || null,
    p_specialty_id: specialtyId || null,
    p_level: level || null,
  });
  // النتيجة: array of { telegram_id: number }
  if (Array.isArray(result)) {
    return result.map((r: any) => r.telegram_id);
  }
  return [];
}

// الحصول على عدد المساهمات المعلقة لمسؤول مستوى
// ============================================
// يستخدم RPC function `count_pending_for_scope` الذرّي
// Function معرّفة في db/schema.sql
// تستخدم JOIN داخلي بين contributions و subjects للفلترة بالنطاق
// ============================================
export async function getPendingContributionsCount(
  client: SupabaseClient,
  collegeId: number,
  specialtyId: number,
  level: number
): Promise<number> {
  try {
    const result = await client.rpc("count_pending_for_scope", {
      p_college_id: collegeId,
      p_specialty_id: specialtyId,
      p_level: level,
    });
    return Number(result) || 0;
  } catch (e) {
    console.error("getPendingContributionsCount RPC failed:", e);
    // Fallback: عدّ كامل المساهمات المعلقة (بدون فلترة بالنطاق)
    try {
      const all = await client.select<{ id: number }>("contributions", {
        columns: "id",
        filter: "status=eq.pending",
      });
      return Array.isArray(all) ? all.length : 0;
    } catch (e2) {
      console.error("Fallback also failed:", e2);
      return 0;
    }
  }
}

// ============================================
// دوال المحتوى (Content)
// ============================================

// الحصول على محتوى مادة حسب التصنيف
export async function getContentForSubject(
  client: SupabaseClient,
  subjectId: number,
  contentType: string
): Promise<any[]> {
  const result = await client.select("content", {
    columns: "id,title,file_name,file_size_mb,telegram_message_id,telegram_file_id,is_starred,download_count,added_at",
    filter: `subject_id=eq.${subjectId}&content_type_id=eq.${contentType}&is_active=eq.true`,
    order: "is_starred.desc,download_count.desc",
  });
  return Array.isArray(result) ? result : [];
}

// الحصول على محتوى بالمعرف
export async function getContentById(
  client: SupabaseClient,
  contentId: number
): Promise<any | null> {
  const result = await client.select("content", {
    filter: `id=eq.${contentId}`,
    single: true,
  });
  return result || null;
}

// تحديث عدّاد التحميلات
// ============================================
// يستخدم RPC function `increment_download` الذرّي (atomic)
// يحل مشكلة race condition في SELECT-then-UPDATE
// Function معرّفة في db/schema.sql
// ============================================
export async function incrementDownloadCount(
  client: SupabaseClient,
  contentId: number
): Promise<void> {
  try {
    await client.rpc("increment_download", { p_content_id: contentId });
  } catch (e) {
    // تجاهل أخطاء عداد التحميل — لا يجب أن تفشل تجربة المستخدم بسببها
    console.error("incrementDownloadCount error (ignored):", e);
  }
}

// ============================================
// دوال قنوات اللجان (Committee Channels)
// ============================================

export async function getCommitteeChannelsFromDB(
  client: SupabaseClient,
  options?: {
    scope_type?: string;
    college_id?: number;
    specialty_id?: number;
    level_num?: number;
  }
): Promise<any[]> {
  let filter = "is_active=eq.true";
  if (options?.scope_type) filter += `&scope_type=eq.${options.scope_type}`;
  if (options?.college_id) filter += `&college_id=eq.${options.college_id}`;
  if (options?.specialty_id) filter += `&specialty_id=eq.${options.specialty_id}`;
  if (options?.level_num) filter += `&level_num=eq.${options.level_num}`;

  const result = await client.select("committee_channels", {
    columns: "id,scope_type,college_id,specialty_id,level_num,channel_url,display_name",
    filter,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال الإشعارات (Student Notifications)
// ============================================

export async function getStudentNotifications(
  client: SupabaseClient,
  telegramId: number,
  unreadOnly = false
): Promise<any[]> {
  let filter = `student_telegram_id=eq.${telegramId}`;
  if (unreadOnly) filter += "&is_read=eq.false";

  const result = await client.select("student_notifications", {
    columns: "id,notification_type,title,body,is_read,created_at",
    filter,
    order: "created_at.desc",
    limit: 20,
  });
  return Array.isArray(result) ? result : [];
}

export async function getUnreadNotificationsCount(
  client: SupabaseClient,
  telegramId: number
): Promise<number> {
  const result = await client.select("student_notifications", {
    columns: "id",
    filter: `student_telegram_id=eq.${telegramId}&is_read=eq.false`,
  });
  return Array.isArray(result) ? result.length : 0;
}

export async function markNotificationsRead(
  client: SupabaseClient,
  telegramId: number
): Promise<void> {
  await client.update("student_notifications", {
    is_read: true,
  }, `student_telegram_id=eq.${telegramId}&is_read=eq.false`);
}

// ============================================
// دوال لوحة الشرف (Leaderboard)
// ============================================

export async function getTopContributorsFromDB(
  client: SupabaseClient,
  limit = 10
): Promise<any[]> {
  const result = await client.select("students", {
    columns: "telegram_id,first_name,total_points,accepted_contributions,current_college_id,current_specialty_id",
    filter: "is_blocked=eq.false",
    order: "total_points.desc",
    limit,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال المساهمات (Contributions)
// ============================================

export async function getStudentContributions(
  client: SupabaseClient,
  telegramId: number
): Promise<any[]> {
  const result = await client.select("contributions", {
    columns: "id,file_name,description,status,reject_reason,created_at,subject_id,content_type_id",
    filter: `user_telegram_id=eq.${telegramId}`,
    order: "created_at.desc",
    limit: 20,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال التحميلات (Downloads)
// ============================================

export async function logDownload(
  client: SupabaseClient,
  studentTelegramId: number,
  contentId: number
): Promise<void> {
  try {
    await client.insert("downloads", {
      student_telegram_id: studentTelegramId,
      content_id: contentId,
    });
  } catch (e) {
    // تجاهل الأخطاء (قد لا يكون الطالب مسجلاً في students)
  }
}

export async function getRecentDownloads(
  client: SupabaseClient,
  telegramId: number,
  limit = 5
): Promise<any[]> {
  const result = await client.select("downloads", {
    columns: "id,content_id,downloaded_at",
    filter: `student_telegram_id=eq.${telegramId}`,
    order: "downloaded_at.desc",
    limit,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال التعميمات (Broadcasts)
// ============================================

export async function logBroadcast(
  client: SupabaseClient,
  data: {
    sender_telegram_id: number;
    sender_position_id?: string;
    scope_type: string;
    scope_college_id?: number;
    scope_specialty_id?: number;
    scope_level?: number;
    content_type: string;
    text_content?: string;
    media_file_id?: string;
    sent_count: number;
  }
): Promise<void> {
  try {
    await client.insert("broadcasts", {
      ...data,
      status: "completed",
    });
  } catch (e) {
    // تجاهل
  }
}
