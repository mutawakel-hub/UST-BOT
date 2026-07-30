// ============================================
// 🗃️ Student State — حالة مستخدم الطالب
// ============================================

import { SessionStore, TTL } from "../shared/session";

// ============================================
// UserState — حالة مستخدم الطالب
// ============================================
export interface DownloadHistoryEntry {
  file_name: string;
  subject_name: string;
  date: string;
}

export interface ContributionEntry {
  id: number;
  file_name: string;
  subject_name: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
}

export interface UserState {
  telegram_id: number;
  username?: string;
  first_name?: string;
  is_registered: boolean;
  current_college_id?: number;
  current_specialty_id?: number;
  current_level?: number;
  total_downloads: number;
  accepted_contributions: number;
  recent_downloads: DownloadHistoryEntry[];
  my_contributions: ContributionEntry[];
  // المسار القصير للإحسان (من شاشة المادة - 5 خطوات)
  awaiting_contribution_for_subject?: number;
  awaiting_contribution_type?: string;
  awaiting_contribution_step?: "file" | "title" | "description" | "confirm";
  awaiting_contribution_title?: string;
  awaiting_contribution_description?: string;
  awaiting_contribution_file_id?: string;
  awaiting_contribution_file_name?: string;
  awaiting_contribution_file_size?: number;
  awaiting_contribution_file_size_bytes?: number;
  awaiting_contribution_file_mime?: string;
  // المسار الكامل للإحسان (من القائمة الرئيسية - 5 خطوات)
  contribution_main_context?: {
    college_id?: number;
    specialty_id?: number;
    subject_id?: number;
    content_type?: string;
  };
  contribution_main_step?:
    | "type"
    | "college"
    | "specialty"
    | "subject"
    | "file"
    | "title"
    | "description"
    | "confirm";
  contribution_main_title?: string;
  contribution_main_description?: string;
  contribution_main_file_id?: string;
  contribution_main_file_name?: string;
  contribution_main_file_size?: number;
  contribution_main_file_size_bytes?: number;
  contribution_main_file_mime?: string;
  // التسجيل الإلزامي
  registration_step?: "college" | "specialty" | "level";
  registration_context?: { college_id?: number; specialty_id?: number };
  awaiting_search?: boolean;
  last_file_id?: string;
}

// ============================================
// SessionStore — يُهيّأ في createStudentBot
// ============================================
let sessionStore: SessionStore<UserState>;

export function initSessionStore(sessionsKv: KVNamespace): void {
  sessionStore = new SessionStore<UserState>(sessionsKv, "student", TTL.SESSION_DEFAULT);
}

// ============================================
// Helpers
// ============================================
export function createDefaultState(telegramId: number, firstName?: string, username?: string): UserState {
  return {
    telegram_id: telegramId,
    first_name: firstName,
    username,
    is_registered: false,
    total_downloads: 0,
    accepted_contributions: 0,
    recent_downloads: [],
    my_contributions: [],
  };
}

export async function getUserState(
  telegramId: number,
  firstName?: string,
  username?: string
): Promise<UserState> {
  const cached = await sessionStore.get(telegramId);
  if (cached) {
    let changed = false;
    if (firstName && cached.first_name !== firstName) {
      cached.first_name = firstName;
      changed = true;
    }
    if (username && cached.username !== username) {
      cached.username = username;
      changed = true;
    }
    if (changed) {
      await sessionStore.set(telegramId, cached, TTL.SESSION_DEFAULT);
    }
    return cached;
  }

  const fresh = createDefaultState(telegramId, firstName, username);
  await sessionStore.set(telegramId, fresh, TTL.SESSION_DEFAULT);
  return fresh;
}

export async function saveUserState(state: UserState): Promise<void> {
  await sessionStore.set(state.telegram_id, state, TTL.SESSION_DEFAULT);
}

export async function updateUserState(
  telegramId: number,
  patch: Partial<UserState>
): Promise<UserState | null> {
  return await sessionStore.update(telegramId, patch, TTL.SESSION_DEFAULT);
}
