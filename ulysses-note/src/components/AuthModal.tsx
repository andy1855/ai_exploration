import { useState, useRef } from 'react';
import { ListMusic, Mail, Lock, Hash, Eye, EyeOff, Send, LogIn, UserPlus, Clock, Shield } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth';
import type { LoginLog } from '../api/auth';
import { ApiError } from '../api/client';

type Tab = 'login' | 'register';
type LoginMethod = 'code' | 'password';

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function AuthPage() {
  const login = useAuthStore((s) => s.login);
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('code');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState<{ code: string; hint: string } | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCountdown() {
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(countdownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (!isEmail(email)) { setError('请输入有效的邮箱地址'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.sendCode(email, tab === 'login' ? 'login' : 'register');
      setCodeSent(true);
      startCountdown();
      if (res.devCode) {
        setDevCode({ code: res.devCode, hint: res.devHint ?? '邮件服务未配置，当前验证码' });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '发送失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    if (!isEmail(email)) { setError('请输入有效的邮箱地址'); return; }

    if (tab === 'register') {
      if (!codeSent || !code) { setError('请先获取并填写验证码'); return; }
      setLoading(true);
      try {
        const user = await authApi.register({ target: email, code, password: password || undefined, rememberMe });
        login(user);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '注册失败');
      } finally {
        setLoading(false);
      }
    } else {
      if (loginMethod === 'code') {
        if (!codeSent || !code) { setError('请先获取并填写验证码'); return; }
        setLoading(true);
        try {
          const user = await authApi.login({ target: email, method: 'email_code', code, rememberMe });
          login(user);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : '登录失败');
        } finally {
          setLoading(false);
        }
      } else {
        if (!password) { setError('请输入密码'); return; }
        setLoading(true);
        try {
          const user = await authApi.login({ target: email, method: 'password', password, rememberMe });
          login(user);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : '登录失败');
        } finally {
          setLoading(false);
        }
      }
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
    setCode('');
    setCodeSent(false);
    setDevCode(null);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <ListMusic size={28} />
          <span>Ulysses Note</span>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>
            <LogIn size={14} />登录
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>
            <UserPlus size={14} />注册
          </button>
        </div>

        <div className="auth-form">
          {/* Email input */}
          <div className="auth-field">
            <label className="auth-label">
              <Mail size={13} />邮箱
            </label>
            <input
              className="auth-input"
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          {/* Login method toggle (login only) */}
          {tab === 'login' && (
            <div className="auth-method-toggle">
              <button
                className={`method-btn ${loginMethod === 'code' ? 'active' : ''}`}
                onClick={() => setLoginMethod('code')}
              >
                <Hash size={12} />验证码登录
              </button>
              <button
                className={`method-btn ${loginMethod === 'password' ? 'active' : ''}`}
                onClick={() => setLoginMethod('password')}
              >
                <Lock size={12} />密码登录
              </button>
            </div>
          )}

          {/* Verification code */}
          {(tab === 'register' || loginMethod === 'code') && (
            <div className="auth-field">
              <label className="auth-label">
                <Hash size={13} />验证码
              </label>
              <div className="auth-code-row">
                <input
                  className="auth-input auth-code-input"
                  type="text"
                  placeholder="6 位验证码"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
                <button
                  className="send-code-btn"
                  onClick={handleSendCode}
                  disabled={loading || countdown > 0 || !isEmail(email)}
                >
                  {countdown > 0 ? (
                    <><Clock size={12} />{countdown}s</>
                  ) : (
                    <><Send size={12} />发送</>
                  )}
                </button>
              </div>
              {devCode && (
                <p className="dev-code-hint">
                  <span className="dev-code-label">{devCode.hint}：</span>
                  <span className="dev-code-value">{devCode.code}</span>
                </p>
              )}
            </div>
          )}

          {/* Password */}
          {(tab === 'register' || loginMethod === 'password') && (
            <div className="auth-field">
              <label className="auth-label">
                <Lock size={13} />
                {tab === 'register' ? '密码（可选）' : '密码'}
              </label>
              <div className="auth-pwd-row">
                <input
                  className="auth-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder={tab === 'register' ? '设置登录密码（可跳过）' : '请输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
                <button className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Remember me */}
          <label className="auth-remember-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>30 天内免登录</span>
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="auth-submit-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '处理中...' : tab === 'login' ? '登录' : '注册'}
          </button>
        </div>

        <p className="auth-footer">
          <Shield size={11} />
          数据存储于服务器，密码加密保存
        </p>
      </div>
    </div>
  );
}

// ─── Login Logs Panel ────────────────────────────────────────
interface LogsPanelProps {
  onClose: () => void;
}

const METHOD_LABEL: Record<string, string> = {
  password: '密码',
  email_code: '邮箱验证码',
};

export function LoginLogsPanel({ onClose }: LogsPanelProps) {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useState(() => {
    authApi.getLogs(1)
      .then((r) => { setLogs(r.logs); setTotal(r.total); })
      .catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  });

  async function loadPage(p: number) {
    setLoading(true);
    try {
      const r = await authApi.getLogs(p);
      setLogs(r.logs);
      setTotal(r.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Shield size={16} />
            <h3>登录记录</h3>
            <span className="logs-total">共 {total} 条</span>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body logs-body">
          {loading && <p className="logs-loading">加载中...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && logs.length === 0 && <p className="logs-empty">暂无登录记录</p>}
          {logs.map((log) => (
            <div key={log.id} className={`log-item ${log.success ? 'success' : 'fail'}`}>
              <div className="log-main">
                <span className={`log-status ${log.success ? 'ok' : 'err'}`}>
                  {log.success ? '✓' : '✗'}
                </span>
                <span className="log-method">{METHOD_LABEL[log.method] ?? log.method}</span>
                <span className="log-target">{log.target}</span>
              </div>
              <div className="log-meta">
                <span>{log.ip ?? '—'}</span>
                <span>{new Date(log.created_at * 1000).toLocaleString('zh-CN')}</span>
              </div>
              {log.fail_reason && <div className="log-fail-reason">{log.fail_reason}</div>}
            </div>
          ))}
          {total > 20 && (
            <div className="logs-pager">
              <button disabled={page === 1} onClick={() => loadPage(page - 1)}>上一页</button>
              <span>{page} / {Math.ceil(total / 20)}</span>
              <button disabled={page >= Math.ceil(total / 20)} onClick={() => loadPage(page + 1)}>下一页</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
