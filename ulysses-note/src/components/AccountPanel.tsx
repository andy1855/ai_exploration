import { useState } from 'react';
import { X, User, Mail, Lock, Hash, Copy, Check, Send, Clock, Eye, EyeOff, Pencil } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';

interface Props {
  onClose: () => void;
}

type Section = 'main' | 'change-email' | 'change-password';

export function AccountPanel({ onClose }: Props) {
  const { userId, target, nickname, login } = useAuthStore();
  const [section, setSection] = useState<Section>('main');

  // Nickname
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState(nickname ?? '');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  // Copy ID
  const [copied, setCopied] = useState(false);
  const displayId = String(userId ?? 0).padStart(6, '0');

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailDevCode, setEmailDevCode] = useState('');

  // Change password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  function startEmailCountdown() {
    setEmailCountdown(60);
    const t = setInterval(() => {
      setEmailCountdown((n) => { if (n <= 1) { clearInterval(t); return 0; } return n - 1; });
    }, 1000);
  }

  async function handleSaveNickname() {
    if (!nicknameValue.trim()) return;
    setNicknameSaving(true);
    setNicknameError('');
    try {
      const res = await authApi.updateProfile(nicknameValue.trim());
      // Update auth store
      const token = localStorage.getItem('ulysses-token') ?? '';
      login({ userId: userId!, target: target!, nickname: res.nickname, token });
      setEditingNickname(false);
    } catch (e) {
      setNicknameError(e instanceof ApiError ? e.message : '保存失败');
    } finally {
      setNicknameSaving(false);
    }
  }

  async function handleSendEmailCode() {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('请输入有效邮箱');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      const res = await authApi.sendCode(newEmail, 'register');
      setEmailCodeSent(true);
      startEmailCountdown();
      if (res.devCode) setEmailDevCode(`开发模式验证码：${res.devCode}`);
    } catch (e) {
      setEmailError(e instanceof ApiError ? e.message : '发送失败');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleChangeEmail() {
    if (!emailCode) { setEmailError('请输入验证码'); return; }
    setEmailLoading(true);
    setEmailError('');
    try {
      await authApi.changeEmail(newEmail, emailCode);
      const token = localStorage.getItem('ulysses-token') ?? '';
      login({ userId: userId!, target: newEmail, nickname: nickname!, token });
      setSection('main');
    } catch (e) {
      setEmailError(e instanceof ApiError ? e.message : '更改失败');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { setPwdError('密码至少 6 位'); return; }
    setPwdLoading(true);
    setPwdError('');
    try {
      await authApi.changePassword(oldPassword || undefined, newPassword);
      setPwdSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => { setPwdSuccess(false); setSection('main'); }, 1500);
    } catch (e) {
      setPwdError(e instanceof ApiError ? e.message : '修改失败');
    } finally {
      setPwdLoading(false);
    }
  }

  function copyId() {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isEmail = (s: string | null) => s && s.includes('@');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <User size={16} />
            <h3>账户信息</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ── Main section ── */}
        {section === 'main' && (
          <div className="modal-body account-body">
            {/* User ID */}
            <div className="account-row">
              <div className="account-row-label">
                <Hash size={14} />
                <span>用户 ID</span>
              </div>
              <div className="account-row-value">
                <span className="account-id">{displayId}</span>
                <button className="account-copy-btn" onClick={copyId} title="复制">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Nickname */}
            <div className="account-row">
              <div className="account-row-label">
                <User size={14} />
                <span>用户名</span>
              </div>
              <div className="account-row-value">
                {editingNickname ? (
                  <div className="account-edit-row">
                    <input
                      className="account-edit-input"
                      value={nicknameValue}
                      maxLength={30}
                      autoFocus
                      onChange={(e) => setNicknameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNickname();
                        if (e.key === 'Escape') { setEditingNickname(false); setNicknameValue(nickname ?? ''); }
                      }}
                    />
                    <button
                      className="account-save-btn"
                      onClick={handleSaveNickname}
                      disabled={nicknameSaving}
                    >
                      {nicknameSaving ? '…' : '保存'}
                    </button>
                    <button className="account-cancel-btn" onClick={() => { setEditingNickname(false); setNicknameValue(nickname ?? ''); }}>取消</button>
                  </div>
                ) : (
                  <>
                    <span className="account-value-text">{nickname}</span>
                    <button className="account-action-icon" onClick={() => setEditingNickname(true)} title="修改">
                      <Pencil size={13} />
                    </button>
                  </>
                )}
              </div>
              {nicknameError && <p className="account-field-error">{nicknameError}</p>}
            </div>

            {/* Email */}
            <div className="account-row">
              <div className="account-row-label">
                <Mail size={14} />
                <span>邮箱</span>
              </div>
              <div className="account-row-value">
                {isEmail(target) ? (
                  <>
                    <span className="account-value-text">{target}</span>
                    <button className="account-link-btn" onClick={() => setSection('change-email')}>更改</button>
                  </>
                ) : (
                  <button className="account-link-btn" onClick={() => setSection('change-email')}>绑定邮箱</button>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="account-row">
              <div className="account-row-label">
                <Lock size={14} />
                <span>登录密码</span>
              </div>
              <div className="account-row-value">
                <button className="account-link-btn" onClick={() => setSection('change-password')}>
                  {isEmail(target) ? '修改密码' : '设置密码'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Change email section ── */}
        {section === 'change-email' && (
          <div className="modal-body account-body">
            <button className="account-back-btn" onClick={() => { setSection('main'); setEmailError(''); setEmailDevCode(''); setEmailCode(''); setNewEmail(''); setEmailCodeSent(false); }}>
              ← 返回
            </button>
            <h4 className="account-sub-title">{isEmail(target) ? '更改邮箱' : '绑定邮箱'}</h4>
            {isEmail(target) && <p className="account-sub-desc">当前邮箱：{target}</p>}

            <div className="auth-field" style={{ marginTop: 16 }}>
              <label className="auth-label"><Mail size={13} />新邮箱地址</label>
              <input
                className="auth-input"
                type="email"
                placeholder="请输入新邮箱"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label"><Hash size={13} />验证码</label>
              <div className="auth-code-row">
                <input
                  className="auth-input auth-code-input"
                  type="text"
                  placeholder="6 位验证码"
                  value={emailCode}
                  maxLength={6}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  className="send-code-btn"
                  onClick={handleSendEmailCode}
                  disabled={emailLoading || emailCountdown > 0}
                >
                  {emailCountdown > 0 ? <><Clock size={12} />{emailCountdown}s</> : <><Send size={12} />发送</>}
                </button>
              </div>
              {emailDevCode && <p className="dev-code-hint">{emailDevCode}</p>}
            </div>

            {emailError && <p className="auth-error">{emailError}</p>}

            <button
              className="auth-submit-btn"
              style={{ marginTop: 8 }}
              onClick={handleChangeEmail}
              disabled={emailLoading}
            >
              {emailLoading ? '处理中...' : '确认更改'}
            </button>
          </div>
        )}

        {/* ── Change password section ── */}
        {section === 'change-password' && (
          <div className="modal-body account-body">
            <button className="account-back-btn" onClick={() => { setSection('main'); setPwdError(''); setPwdSuccess(false); }}>
              ← 返回
            </button>
            <h4 className="account-sub-title">设置登录密码</h4>
            <p className="account-sub-desc">设置密码后，可以使用密码直接登录。</p>

            <div className="auth-field" style={{ marginTop: 16 }}>
              <label className="auth-label"><Lock size={13} />当前密码（如已设置）</label>
              <div className="auth-pwd-row">
                <input
                  className="auth-input"
                  type={showOld ? 'text' : 'password'}
                  placeholder="没有则留空"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <button className="pwd-toggle" onClick={() => setShowOld(!showOld)}>
                  {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label"><Lock size={13} />新密码（至少 6 位）</label>
              <div className="auth-pwd-row">
                <input
                  className="auth-input"
                  type={showNew ? 'text' : 'password'}
                  placeholder="请输入新密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button className="pwd-toggle" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {pwdError && <p className="auth-error">{pwdError}</p>}
            {pwdSuccess && <p className="account-success">密码设置成功！</p>}

            <button
              className="auth-submit-btn"
              style={{ marginTop: 8 }}
              onClick={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? '处理中...' : '保存密码'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
