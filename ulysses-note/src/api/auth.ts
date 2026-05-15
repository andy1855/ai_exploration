import { api } from './client';

export interface AuthUser {
  userId: number;
  target: string;
  nickname: string;
  token: string;
}

export interface LoginLog {
  id: number;
  target: string;
  method: 'password' | 'email_code' | 'phone_code';
  ip: string | null;
  user_agent: string | null;
  success: number;
  fail_reason: string | null;
  created_at: number;
}

export const authApi = {
  sendCode: (target: string, purpose: 'register' | 'login') =>
    api.post<{ ok: boolean; devCode?: string }>('/auth/send-code', { target, purpose }),

  register: (data: { target: string; code: string; password?: string; nickname?: string }) =>
    api.post<AuthUser>('/auth/register', data),

  login: (data: { target: string; method: 'password' | 'email_code' | 'phone_code'; code?: string; password?: string }) =>
    api.post<AuthUser>('/auth/login', data),

  me: () => api.get<{ id: number; email: string | null; phone: string | null; nickname: string | null; created_at: number }>('/auth/me'),

  changePassword: (oldPassword: string | undefined, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', { oldPassword, newPassword }),

  getLogs: (page = 1, limit = 20) =>
    api.get<{ logs: LoginLog[]; total: number; page: number; limit: number }>(`/logs?page=${page}&limit=${limit}`),
};
