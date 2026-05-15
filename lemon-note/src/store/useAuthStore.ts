import { create } from 'zustand';

interface AuthState {
  userId: number | null;
  target: string | null;
  nickname: string | null;
  token: string | null;
  isLoggedIn: boolean;

  login: (user: { userId: number; target: string; nickname: string; token: string; expiresAt?: number }) => void;
  logout: () => void;
}

function loadAuth(): Pick<AuthState, 'userId' | 'target' | 'nickname' | 'token' | 'isLoggedIn'> {
  try {
    const token = localStorage.getItem('lemon-token');
    const raw = localStorage.getItem('lemon-auth-user');
    const expiresAt = localStorage.getItem('lemon-token-expires');

    if (token && raw) {
      // Check expiry if stored
      if (expiresAt && Date.now() > Number(expiresAt)) {
        localStorage.removeItem('lemon-token');
        localStorage.removeItem('lemon-token-expires');
        localStorage.removeItem('lemon-auth-user');
        return defaults();
      }
      const user = JSON.parse(raw);
      return { ...user, token, isLoggedIn: true };
    }
  } catch {}
  return defaults();
}

function defaults() {
  return { userId: null, target: null, nickname: null, token: null, isLoggedIn: false };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadAuth(),

  login(user) {
    localStorage.setItem('lemon-token', user.token);
    localStorage.setItem('lemon-auth-user', JSON.stringify({
      userId: user.userId,
      target: user.target,
      nickname: user.nickname,
    }));
    if (user.expiresAt) {
      localStorage.setItem('lemon-token-expires', String(user.expiresAt));
    } else {
      localStorage.removeItem('lemon-token-expires');
    }
    set({ ...user, isLoggedIn: true });
  },

  logout() {
    localStorage.removeItem('lemon-token');
    localStorage.removeItem('lemon-token-expires');
    localStorage.removeItem('lemon-auth-user');
    set({ userId: null, target: null, nickname: null, token: null, isLoggedIn: false });
  },
}));
