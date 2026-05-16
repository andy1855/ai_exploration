/** MySQL 中统一存储的时间戳字符串：yyyy-MM-dd HH:mm:ss.SSS */

const RE =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{1,3})$/;

export function formatDbTimestamp(d: Date = new Date()): string {
  const z = (n: number, w: number) => String(Math.trunc(n)).padStart(w, '0');
  const Y = d.getFullYear();
  const M = z(d.getMonth() + 1, 2);
  const D = z(d.getDate(), 2);
  const h = z(d.getHours(), 2);
  const m = z(d.getMinutes(), 2);
  const s = z(d.getSeconds(), 2);
  const ms = z(d.getMilliseconds(), 3);
  return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`;
}

export function msToDbTimestamp(ms: number): string {
  return formatDbTimestamp(new Date(ms));
}

/** 将库内字符串（或历史 BIGINT 毫秒数字）转为毫秒，供 API 返回前端 */
export function dbTimeToMs(v: string | number | Date | null | undefined): number {
  if (v == null || v === '') return Date.now();
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim();
  const m = RE.exec(s);
  if (m) {
    const [, Y, Mo, D, h, mi, se, msPart] = m;
    const milli = Number(String(msPart).padEnd(3, '0').slice(0, 3));
    return new Date(+Y, +Mo - 1, +D, +h, +mi, +se, milli).getTime();
  }
  const isoTry = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(isoTry) ? Date.now() : isoTry;
}
