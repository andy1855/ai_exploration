/**
 * 检测当前浏览器/设备信息，用于登录日志记录
 */
export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform ?? '';
  const vendor = navigator.vendor ?? '';

  // 检测浏览器
  let browser = 'Unknown';
  if (ua.includes('Edg/') || ua.includes('Edge/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  // 提取浏览器版本
  const versionMatch = ua.match(new RegExp(`${browser}[/\\s](\\d+(?:\\.\\d+)+)`));
  const version = versionMatch ? versionMatch[1].split('.')[0] : '?';
  const browserLabel = `${browser} ${version}`;

  // 检测操作系统
  let os = 'Unknown';
  if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // 设备类型
  let deviceType = 'desktop';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';

  const device = {
    browser: browserLabel,
    os,
    platform,
    type: deviceType,
  };

  return JSON.stringify(device);
}
