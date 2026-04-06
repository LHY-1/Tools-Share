/**
 * 模式判断工具
 * 
 * - cloud 模式：正式域名访问，数据存 Redis + Vercel Blob
 * - local 模式：localhost / 局域网访问，数据存 IndexedDB
 */

export type DataMode = 'local' | 'cloud';

/**
 * 判断当前运行模式
 * 
 * localhost / 127.0.0.1 / 局域网 IP → local
 * 其他（正式域名）→ cloud
 */
export function getDataMode(): DataMode {
  if (typeof window === 'undefined') {
    // SSR 时无法判断，默认 cloud
    return 'cloud';
  }
  
  const hostname = window.location.hostname;
  
  // localhost 相关
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }
  
  // 局域网 IP (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  const lanIpPattern = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
  if (lanIpPattern.test(hostname)) {
    return 'local';
  }
  
  // 其他情况视为 cloud 模式
  return 'cloud';
}

/**
 * 是否为本地模式
 */
export function isLocalMode(): boolean {
  return getDataMode() === 'local';
}

/**
 * 是否为云端模式
 */
export function isCloudMode(): boolean {
  return getDataMode() === 'cloud';
}
