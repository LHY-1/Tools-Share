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

export function SmartBgImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-video',
  imgClassName = '',
}: SmartBgImageProps) {
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    if (!src) {
      setDisplaySrc('');
      setBgColor('#ffffff');
      return;
    }

    if (src.startsWith('__local_image:')) {
      setDisplaySrc(src);
      setBgColor('#ffffff');
      return;
    }

    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setDisplaySrc(src);
      setBgColor('#ffffff');
      return;
    }

    if (src.startsWith('http:') || src.startsWith('https:')) {
      try {
        const url = new URL(src);
        const bg = url.searchParams.get('bg');
        setBgColor(bg ? decodeURIComponent(bg) : '#ffffff');
        setDisplaySrc(url.origin + url.pathname);
      } catch {
        setDisplaySrc(src);
        setBgColor('#ffffff');
      }
      return;
    }

    setDisplaySrc(src);
    setBgColor('#ffffff');
  }, [src]);

  const showBg = Boolean(displaySrc);

  return (
    <div
      className={`relative ${aspectRatio} overflow-hidden ${className}`}
    >
      {showBg && (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: bgColor }}
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
          <span className="text-slate-400 text-4xl font-bold select-none">
            {alt?.[0] ?? '?'}
          </span>
        )}
      </div>
    </div>
  );
}
