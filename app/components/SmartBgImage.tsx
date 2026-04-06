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
    console.log('[SmartBgImage] src:', src, '| displaySrc:', displaySrc);
    if (!src) {
      setDisplaySrc('');
      setBgColor('#f1f5f9');
      return;
    }

    // __local_image:<id> 本地引用：直接保留原值
    if (src.startsWith('__local_image:')) {
      console.log('[SmartBgImage] local image path');
      setDisplaySrc(src);
      setBgColor('#f1f5f9');
      return;
    }

    // 标准 URL：解析 ?bg=rgb(...) 并去掉 query
    try {
      const url = new URL(src);
      const bg = url.searchParams.get('bg');
      setBgColor(bg ? decodeURIComponent(bg) : '#f1f5f9');
      setDisplaySrc(url.origin + url.pathname);
      console.log('[SmartBgImage] URL path:', url.origin + url.pathname);
    } catch {
      // data: URL 等非标准格式
      console.log('[SmartBgImage] fallback (data URL or other)');
      setDisplaySrc(src);
      setBgColor('#f1f5f9');
    }
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
