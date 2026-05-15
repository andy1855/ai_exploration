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
    const token = localStorage.getItem('ulysses-token');
    const raw = localStorage.getItem('ulysses-auth-user');
    const expiresAt = localStorage.getItem('ulysses-token-expires');

    if (token && raw) {
      // Check expiry if stored
      if (expiresAt && Date.now() > Number(expiresAt)) {
        localStorage.removeItem('ulysses-token');
        localStorage.removeItem('ulysses-token-expires');
        localStorage.removeItem('ulysses-auth-user');
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
    localStorage.setItem('ulysses-token', user.token);
    localStorage.setItem('ulysses-auth-user', JSON.stringify({
      userId: user.userId,
      target: user.target,
      nickname: user.nickname,
    }));
    if (user.expiresAt) {
      localStorage.setItem('ulysses-token-expires', String(user.expiresAt));
    } else {
      localStorage.removeItem('ulysses-token-expires');
    }
    set({ ...user, isLoggedIn: true });
  },

  logout() {
    localStorage.removeItem('ulysses-token');
    localStorage.removeItem('ulysses-token-expires');
    localStorage.removeItem('ulysses-auth-user');
    set({ userId: null, target: null, nickname: null, token: null, isLoggedIn: false });
  },
}));
