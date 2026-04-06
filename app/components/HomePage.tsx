'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from './Icons';
import { loadToolsByMode } from '@/app/lib/data';
import { getDataMode } from '@/app/lib/mode';
import { LocalImage } from '@/app/lib/image-utils';
import { toTool } from '@/app/types';
import type { Tool, StoredTool } from '@/app/types';

const DEFAULT_CATEGORIES = ['开发工具', '设计工具', '工作效率', '文档管理', '其他工具'];

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<'local' | 'cloud'>('local');

  useEffect(() => {
    setMounted(true);
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    
    const mode = getDataMode();
    setDataMode(mode);
    console.log(`[HomePage] Mode: ${mode}`);
    
    try {
      const loadedTools = await loadToolsByMode();
      // 过滤掉特殊记录（如 __categories__）
      const validTools = loadedTools.filter(t => t.id && !t.id.startsWith('__'));
      
      if (validTools.length === 0) {
        setTools([]);
        setCategories([...DEFAULT_CATEGORIES]);
        setLoading(false);
        return;
      }
      
      setTools(validTools);
      
      // 收集所有分类
      const cats = new Set<string>(DEFAULT_CATEGORIES);
      for (const t of validTools) {
        for (const c of t.categories ?? []) cats.add(c);
      }
      setCategories([...cats]);
    } catch (err) {
      console.error('[HomePage] Load error:', err);
      setLoadError(err instanceof Error ? err.message : '加载失败');
    }
    
    setLoading(false);
  }

  const selectedCategory = searchParams.get('category') || '';

  function handleCategoryChange(category: string) {
    const params = new URLSearchParams(searchParams);
    params.set('category', category);
    router.push(`/?${params.toString()}`);
  }

  const filteredTools = selectedCategory
    ? tools
        .filter((t) => t.categories?.includes(selectedCategory))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : tools.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">工具库</h1>
                <p className="text-slate-600 text-sm mt-0.5">发现高效工具，提升工作效率</p>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-56 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">工具库</h1>
              <p className="text-slate-600 text-sm mt-0.5">发现高效工具，提升工作效率</p>
            </div>
            <div className="flex items-center gap-3">
              {/* 刷新按钮 */}
              <button
                onClick={loadData}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="刷新"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <Link href="/admin">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
                  <Settings className="w-4 h-4" />
                  管理
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 分类标签 */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => handleCategoryChange('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-56 animate-pulse" />
            ))}
          </div>
        )}

        {/* 错误/空状态 */}
        {!loading && loadError && (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">{loadError}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !loadError && filteredTools.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 text-lg">
              {selectedCategory ? `暂无「${selectedCategory}」分类的工具` : '暂无工具'}
            </p>
            <Link href="/admin">
              <button className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700">
                去管理页发布第一个工具
              </button>
            </Link>
          </div>
        )}

        {/* 工具网格 */}
        {!loading && !loadError && filteredTools.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTools.map((tool) => (
              <Link key={tool.id} href={`/tools/${tool.id}`}>
                <div className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden cursor-pointer h-full flex flex-col">
                  {tool.imageUrl ? (
                    <div className="aspect-video bg-slate-100 overflow-hidden flex items-center justify-center">
                      <LocalImage
                        src={tool.imageUrl}
                        alt={tool.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-4xl font-bold">{tool.name?.[0] ?? '?'}</span>
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 line-clamp-1">
                      {tool.name}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2 flex-1">
                      {tool.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(tool.categories ?? []).slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
