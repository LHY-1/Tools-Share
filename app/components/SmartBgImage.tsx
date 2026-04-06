'use client';

import { useState, useEffect } from 'react';
import { LocalImage } from '../lib/image-utils';

interface SmartBgImageProps {
  src?: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;
  imgClassName?: string;
}

/**
 * 智能背景图片组件
 * - 从 URL query 参数 (?bg=rgb(...)) 读取边缘颜色作为背景
 * - 图片居中，保持原比例
 * - 无颜色参数时使用默认灰色
 *
 * src 类型处理：
 * - __local_image:<id>  → LocalImage 组件解析 IndexedDB
 * - data: / blob:        → 直接原样使用（无 bg 参数）
 * - http: / https:        → 解析 ?bg=rgb(...) 取背景色，pathname 作 src
 * - 其他（相对路径等）  → 直接原样使用
 */
export function SmartBgImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-video',
  imgClassName = '',
}: SmartBgImageProps) {
  const [bgColor, setBgColor] = useState<string>('#f1f5f9');
  const [displaySrc, setDisplaySrc] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setBgColor('#f1f5f9');
      return;
    }

    // __local_image:<id> → LocalImage 解析 IndexedDB
    if (src.startsWith('__local_image:')) {
      setDisplaySrc(src);
      setBgColor('#f1f5f9');
      return;
    }

    // data: / blob: → 原样保留，不解析 URL（new URL() 会把 origin 变成 "null"）
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setDisplaySrc(src);
      setBgColor('#f1f5f9');
      return;
    }

    // http: / https: → 正常解析 ?bg= 参数
    if (src.startsWith('http:') || src.startsWith('https:')) {
      try {
        const url = new URL(src);
        const bg = url.searchParams.get('bg');
        setBgColor(bg ? decodeURIComponent(bg) : '#f1f5f9');
        setDisplaySrc(url.origin + url.pathname);
      } catch {
        // URL 解析失败则原样保留
        setDisplaySrc(src);
        setBgColor('#f1f5f9');
      }
      return;
    }

    // 其他（相对路径等）→ 原样使用
    setDisplaySrc(src);
    setBgColor('#f1f5f9');
  }, [src]);

  // displaySrc 为空时不渲染任何 <img>
  if (!displaySrc) {
    return (
      <div className={`${aspectRatio} bg-slate-100 flex items-center justify-center ${className}`}>
        <span className="text-slate-400 text-4xl font-bold">{alt?.[0] ?? '?'}</span>
      </div>
    );
  }

  return (
    <div
      className={`${aspectRatio} overflow-hidden flex items-center justify-center transition-colors duration-500 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {displaySrc.startsWith('__local_image:') ? (
        <LocalImage
          src={displaySrc}
          alt={alt ?? ''}
          className={`max-w-full max-h-full object-contain transition-transform duration-300 ${imgClassName}`}
        />
      ) : (
        <img
          src={displaySrc}
          alt={alt ?? ''}
          className={`max-w-full max-h-full object-contain transition-transform duration-300 ${imgClassName}`}
        />
      )}
    </div>
  );
}
