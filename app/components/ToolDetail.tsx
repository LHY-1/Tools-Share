'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, ChevronLeft } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { fetchCloudTools, normalizeCloudTool } from '@/app/lib/cloud-tools';
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

  useEffect(() => {
    loadFromCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  async function loadFromCloud() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchCloudTools();
    if (!result) {
      setLoadError('无法连接云端，请检查网络');
      setLoading(false);
      return;
    }
    const found = result.data.find((t) => t.id === toolId);
    if (!found) {
      setLoadError('未找到该工具');
      setLoading(false);
      return;
    }
    setTool(normalizeCloudTool(found));
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
            onClick={loadFromCloud}
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
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

            {/* 快照图 */}
            {(tool.screenshotLink || (tool.screenshots ?? []).length > 0) && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">截图</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tool.screenshotLink && (
                    <div
                      className="rounded-xl border border-slate-200 overflow-hidden cursor-zoom-in"
                      onClick={() => openLightbox(tool.screenshotLink!)}
                    >
                      <img src={tool.screenshotLink} alt="截图" className="w-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  {(tool.screenshots ?? []).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 overflow-hidden cursor-zoom-in"
                      onClick={() => openLightbox(s)}
                    >
                      <img src={s} alt={`截图 ${i + 1}`} className="w-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 特性 */}
            {(tool.features ?? []).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">特性</h2>
                <ul className="space-y-2">
                  {(tool.features ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-600">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 使用说明 */}
            {tool.usage && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">使用说明</h2>
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {tool.usage}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* 完整描述 */}
            {tool.fullDescription && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">详细介绍</h2>
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {tool.fullDescription}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
