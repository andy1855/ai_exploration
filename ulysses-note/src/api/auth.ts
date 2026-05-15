import { api } from './client';

export interface AuthUser {
  userId: number;
  target: string;
  nickname: string;
  token: string;
  expiresAt?: number;
}

export interface LoginLog {
  id: number;
  user_id: number;
  target: string;
  method: string;
  ip: string | null;
  success: number;
  fail_reason: string | null;
  created_at: number;
}

export const authApi = {
  sendCode: (target: string, purpose: 'register' | 'login') =>
    api.post<{ ok: boolean; devCode?: string; devHint?: string }>('/auth/send-code', { target, purpose }),

  register: (data: { target: string; code: string; password?: string; rememberMe?: boolean }) =>
    api.post<AuthUser>('/auth/register', data),

  login: (data: { target: string; method: string; code?: string; password?: string; rememberMe?: boolean }) =>
    api.post<AuthUser>('/auth/login', data),

  getLogs: (page = 1) =>
    api.get<{ logs: LoginLog[]; total: number }>(`/auth/logs?page=${page}`),

  updateProfile: (nickname: string) =>
    api.put<{ nickname: string }>('/auth/profile', { nickname }),

  changeEmail: (newEmail: string, code: string) =>
    api.post<{ ok: boolean }>('/auth/change-email', { newEmail, code }),

  changePassword: (oldPassword: string | undefined, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', { oldPassword, newPassword }),
};
