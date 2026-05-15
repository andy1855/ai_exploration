const ALLOWED = /^[a-zA-Z0-9_\u4e00-\u9fff]+$/;
const HAS_CJK = /[\u4e00-\u9fff]/;
const BAD_FIRST = /^[0-9_]/;

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: false, error: '用户名不能为空' };
  if (!ALLOWED.test(s)) {
    return { ok: false, error: '仅支持中文、字母、数字、下划线，不能包含其他符号' };
  }
  if (BAD_FIRST.test(s)) {
    return { ok: false, error: '不能以数字或下划线开头' };
  }
  const hasCjk = HAS_CJK.test(s);
  const len = [...s].length;
  if (hasCjk && len > 10) {
    return { ok: false, error: '含中文时不超过 10 个字' };
  }
  if (!hasCjk && len > 20) {
    return { ok: false, error: '纯英文用户名不超过 20 个字符' };
  }
  return { ok: true, value: s };
}
