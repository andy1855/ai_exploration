/** 全文归一化用于比较（不去掉 haystack 首尾空白，避免误伤） */
export function normalizeComparable(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export function textIncludesQuery(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return normalizeComparable(haystack).includes(normalizeComparable(q));
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
