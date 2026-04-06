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
 * - 用图片本身做模糊 + 暗化背景（毛玻璃效果）
 * - 图片居中，保持原比例
 * - 无图片时显示首字母占位
 *
 * src 类型处理：
 * - __local_image:<id>  → LocalImage 组件解析 IndexedDB
 * - data: / blob:        → 直接原样使用
 * - http: / https:        → 解析 ?bg=rgb(...) 取边缘颜色（兼容旧参数），背景仍用模糊
 * - 其他（相对路径等）  → 直接原样使用
 */
export function SmartBgImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-video',
  imgClassName = '',
}: SmartBgImageProps) {
  const [bgColor, setBgColor] = useState<string>('#1e293b'); // 深色默认，避免白边
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    if (!src) {
      setDisplaySrc('');
      setBgColor('#1e293b');
      return;
    }

    // __local_image:<id> → LocalImage 解析 IndexedDB
    if (src.startsWith('__local_image:')) {
      setDisplaySrc(src);
      setBgColor('#1e293b');
      return;
    }

    // data: / blob: → 原样保留
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setDisplaySrc(src);
      setBgColor('#1e293b');
      return;
    }

    // http: / https: → 解析 ?bg= 参数（兼容旧格式）
    if (src.startsWith('http:') || src.startsWith('https:')) {
      try {
        const url = new URL(src);
        const bg = url.searchParams.get('bg');
        setBgColor(bg ? decodeURIComponent(bg) : '#1e293b');
        setDisplaySrc(url.origin + url.pathname);
      } catch {
        setDisplaySrc(src);
        setBgColor('#1e293b');
      }
      return;
    }

    // 其他 → 原样使用
    setDisplaySrc(src);
    setBgColor('#1e293b');
  }, [src]);

  const showBg = Boolean(displaySrc);

  return (
    <div
      className={`relative ${aspectRatio} overflow-hidden ${className}`}
    >
      {/* 毛玻璃模糊背景 */}
      {showBg && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundColor: bgColor,
          }}
        >
          {displaySrc.startsWith('__local_image:') ? (
            <LocalImage
              src={displaySrc}
              alt=""
              className="w-full h-full object-cover blur-xl scale-110 opacity-60"
            />
          ) : (
            <img
              src={displaySrc}
              alt=""
              className="w-full h-full object-cover blur-xl scale-110 opacity-60"
              onLoad={() => setIsLoaded(true)}
            />
          )}
        </div>
      )}

      {/* 主图：居中、保持比例 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {showBg ? (
          displaySrc.startsWith('__local_image:') ? (
            <LocalImage
              src={displaySrc}
              alt={alt ?? ''}
              className={`max-w-full max-h-full object-contain ${imgClassName}`}
            />
          ) : (
            <img
              src={displaySrc}
              alt={alt ?? ''}
              className={`max-w-full max-h-full object-contain ${imgClassName}`}
            />
          )
        ) : (
          /* 无图片占位 */
          <span className="text-slate-400 text-4xl font-bold select-none">
            {alt?.[0] ?? '?'}
          </span>
        )}
      </div>
    </div>
  );
}
