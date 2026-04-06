'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LocalImage } from '../lib/image-utils';

interface SmartBgImageProps {
  src?: string;
  alt?: string;
  className?: string;
  aspectRatio?: string; // 如 'aspect-video' 或 'aspect-square'
  imgClassName?: string;
}

/**
 * 智能背景图片组件
 * - 从图片边缘采样颜色，作为背景填充色（仅限同源图片）
 * - 图片居中显示，保持原比例
 * - 外链图片使用渐变背景
 */
export function SmartBgImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-video',
  imgClassName = '',
}: SmartBgImageProps) {
  const [bgColor, setBgColor] = useState<string>('#f1f5f9'); // 默认 slate-100
  const [resolved, setResolved] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 解析图片 src（处理 __local_image: 引用）
  useEffect(() => {
    if (!src) {
      setResolved('');
      setImageLoaded(false);
      return;
    }
    setResolved(src);
    setImageLoaded(false);
  }, [src]);

  // 从图片边缘采样颜色（仅同源图片可用）
  const extractEdgeColor = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return '#f1f5f9';

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '#f1f5f9';

    // 小尺寸采样即可
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    try {
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      
      // 采样边缘像素（上下左右各取一行/列）
      const edgePixels: { r: number; g: number; b: number }[] = [];
      
      // 顶行
      const topRow = ctx.getImageData(0, 0, sampleSize, 1).data;
      for (let i = 0; i < topRow.length; i += 4) {
        edgePixels.push({ r: topRow[i], g: topRow[i + 1], b: topRow[i + 2] });
      }
      
      // 底行
      const bottomRow = ctx.getImageData(0, sampleSize - 1, sampleSize, 1).data;
      for (let i = 0; i < bottomRow.length; i += 4) {
        edgePixels.push({ r: bottomRow[i], g: bottomRow[i + 1], b: bottomRow[i + 2] });
      }
      
      // 左列
      const leftCol = ctx.getImageData(0, 0, 1, sampleSize).data;
      for (let i = 0; i < leftCol.length; i += 4) {
        edgePixels.push({ r: leftCol[i], g: leftCol[i + 1], b: leftCol[i + 2] });
      }
      
      // 右列
      const rightCol = ctx.getImageData(sampleSize - 1, 0, 1, sampleSize).data;
      for (let i = 0; i < rightCol.length; i += 4) {
        edgePixels.push({ r: rightCol[i], g: rightCol[i + 1], b: rightCol[i + 2] });
      }

      // 计算平均颜色
      const avg = edgePixels.reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 }
      );
      const count = edgePixels.length;
      const r = Math.round(avg.r / count);
      const g = Math.round(avg.g / count);
      const b = Math.round(avg.b / count);

      return `rgb(${r}, ${g}, ${b})`;
    } catch {
      // 跨域错误，返回默认颜色
      return '#f1f5f9';
    }
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    const img = e.currentTarget;
    try {
      const color = extractEdgeColor(img);
      setBgColor(color);
    } catch {
      // 跨域限制，保持默认背景
    }
  }, [extractEdgeColor]);

  // 判断是否是外链图片（无法采样颜色）
  const isExternal = resolved && (resolved.startsWith('http://') || resolved.startsWith('https://'));
  const useGradientBg = isExternal && !resolved.includes('cdn.vercel-storage.com');

  if (!resolved) {
    return (
      <div className={`${aspectRatio} bg-slate-100 flex items-center justify-center ${className}`}>
        <span className="text-slate-400 text-4xl font-bold">{alt?.[0] ?? '?'}</span>
      </div>
    );
  }

  return (
    <div 
      className={`${aspectRatio} overflow-hidden flex items-center justify-center transition-colors duration-500 ${className}`}
      style={{ 
        background: useGradientBg 
          ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)'
          : bgColor 
      }}
    >
      <canvas ref={canvasRef} className="hidden" />
      {resolved.startsWith('__local_image:') ? (
        <LocalImage
          src={resolved}
          alt={alt ?? ''}
          className={`max-w-full max-h-full object-contain transition-transform duration-300 ${imgClassName}`}
          onLoad={handleImageLoad}
        />
      ) : (
        <img
          src={resolved}
          alt={alt ?? ''}
          className={`max-w-full max-h-full object-contain transition-transform duration-300 ${imgClassName}`}
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
}
