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
    const columns = options.columns || "*";
    let path = `/rest/v1/${table}?select=${columns}`;

    if (options.filter) path += `&${options.filter}`;
    if (options.order) path += `&order=${options.order}`;
    if (options.limit) path += `&limit=${options.limit}`;

    const resp = await fetch(`${this.url}${path}`, {
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase SELECT error: ${err}`);
    }

    const data = await resp.json();
    return options.single ? data[0] : data;
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
    return Array.isArray(result) ? result[0] : result;
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
// دوال مساعدة: بناء الفلاتر
// ============================================
export function eq(column: string, value: any): string {
  return `${column}=eq.${typeof value === "string" ? value : JSON.stringify(value)}`;
}

export function neq(column: string, value: any): string {
  return `${column}=neq.${typeof value === "string" ? value : JSON.stringify(value)}`;
}

export function inList(column: string, values: any[]): string {
  const formatted = values.map((v) => `"${v}"`).join(",");
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
export async function getPendingContributionsCount(
  client: SupabaseClient,
  collegeId: number,
  specialtyId: number,
  level: number
): Promise<number> {
  // في الإنتاج: نحتاج JOIN مع subjects للفلترة بالنطاق
  // مؤقتاً: نعد كل المساهمات المعلقة
  const result = await client.select<{ id: number }>("contributions", {
    columns: "id",
    filter: "status=eq.pending",
  });
  return Array.isArray(result) ? result.length : 0;
}
