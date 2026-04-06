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
    if (!src) {
      setDisplaySrc('');
      setBgColor('#f1f5f9');
      return;
    }

    // 从 URL query 参数解析颜色：?bg=rgb(r,g,b)
    try {
      const url = new URL(src);
      const bg = url.searchParams.get('bg');
      if (bg) {
        setBgColor(decodeURIComponent(bg));
      } else {
        setBgColor('#f1f5f9');
      }
      // 去掉 query 参数，避免影响图片 src
      setDisplaySrc(url.origin + url.pathname);
    } catch {
      // 非标准 URL（如 data:, __local_image:），直接用原值
      setDisplaySrc(src);
      setBgColor('#f1f5f9');
    }
  }, [src]);

  if (!displaySrc && !src) {
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
