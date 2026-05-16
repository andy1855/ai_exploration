const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('lemon-token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (res.ok) {
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, text.length > 300 ? `响应格式异常: ${text.slice(0, 300)}…` : `响应格式异常: ${text}`);
    }
  }
  let errorMsg = `请求失败 (${res.status})`;
  if (text) {
    try {
      const body = JSON.parse(text) as { error?: string };
      if (body?.error) errorMsg = body.error;
    } catch {
      errorMsg = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    }
  }
  throw new ApiError(res.status, errorMsg);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
