'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, ChevronLeft } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { loadTools } from '@/app/lib/db';
import { toTool } from '@/app/types';
import type { Tool } from '@/app/types';

/**
 * 公开工具详情页（只读）
 *
 * 数据来源：Redis 云端（通过 /api/cloud/load）
 * 图片：Blob URL（直接 <img src>）
 *
 * 无任何本地存储依赖（IndexedDB / localStorage / __local_image:* / data:image/*）
 */
export default function ToolDetail({ toolId }: { toolId: string }) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const [isFromAdmin, setIsFromAdmin] = useState(false);

  useEffect(() => {
    loadFromLocal();
    // 判断来源：只有从 /admin 页面来的才显示编辑按钮
    if (typeof window !== 'undefined') {
      setIsFromAdmin(document.referrer.includes('/admin'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  async function loadFromLocal() {
    setLoading(true);
    setLoadError(null);
    const raw = await loadTools();
    const allTools = (raw as import('@/app/types').StoredTool[]).map(toTool);
    const found = allTools.find((t) => t.id === toolId);
    if (!found) {
      setLoadError('未找到该工具');
      setLoading(false);
      return;
    }
    setTool(found);
    setLoading(false);
  }

  function openLightbox(src: string) {
    setLightboxImage(src);
    setLightboxOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
            <div className="h-64 bg-slate-200 rounded animate-pulse mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !tool) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-lg mb-4">{loadError ?? '工具不存在'}</p>
          <button
            onClick={loadFromLocal}
            className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 mr-3"
          >
            重试
          </button>
          <Link href="/">
            <button className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300">
              返回首页
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-slate-300"
            onClick={() => setLightboxOpen(false)}
          >
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="大图"
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
          {isFromAdmin && (
            <Link href={`/admin?edit=${tool.id}`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                管理编辑
              </button>
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* 封面图 */}
          {tool.imageUrl ? (
            <div className="aspect-video bg-slate-100 overflow-hidden cursor-zoom-in" onClick={() => openLightbox(tool.imageUrl!)}>
              <img
                src={tool.imageUrl}
                alt={tool.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <span className="text-slate-400 text-6xl font-bold">{tool.name[0]}</span>
            </div>
          )}

          <div className="p-6 md:p-8">
            {/* 标题 + 分类 */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{tool.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(tool.categories ?? []).map((cat) => (
                    <span key={cat} className="text-sm bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-6">{tool.description}</p>

            {/* 下载按钮 */}
            {(tool.downloadLinks ?? []).length > 0 && (
              <div className="flex flex-wrap gap-3 mb-8">
                {tool.downloadLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {tool.downloadLinkLabels?.[i] ?? '下载'}
                  </a>
                ))}
              </div>
            )}

            {/* 快照：全宽显示，无点击放大 */}
            {tool.screenshotLink && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">快照</h2>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <img 
                    src={tool.screenshotLink} 
                    alt="网站快照" 
                    className="w-full h-auto" 
                  />
                </div>
              </div>
            )}

            {/* 详细介绍（无详细介绍时显示快照占位） */}
            {tool.fullDescription ? (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-900">详细介绍</h2>
                  <Link href={`/admin?edit=${tool.id}`}>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      编辑
                    </button>
                  </Link>
                </div>
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {tool.fullDescription}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              /* 无详细介绍时，快照充当内容（已在上方显示），这里显示提示 */
              <div className="mb-8 p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-slate-400 text-sm mb-2">暂无详细介绍</p>
                <Link href={`/admin?edit=${tool.id}`}>
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    添加详细介绍
                  </button>
                </Link>
              </div>
            )}

            {/* 截图：保持纵横比，点击放大 */}
            {(tool.screenshots ?? []).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">截图</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(tool.screenshots ?? []).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 overflow-hidden cursor-zoom-in"
                      onClick={() => openLightbox(s)}
                    >
                      <img 
                        src={s} 
                        alt={tool.screenshotLabels?.[i] || `截图 ${i + 1}`} 
                        className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300" 
                      />
                      {tool.screenshotLabels?.[i] && (
                        <p className="text-xs text-slate-500 p-2 bg-slate-50">{tool.screenshotLabels[i]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
