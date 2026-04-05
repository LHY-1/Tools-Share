'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tool } from '@/app/types';
import Link from 'next/link';
import { Settings } from './Icons';

const DEFAULT_CATEGORIES = ['开发工具', '设计工具', '工作效率', '文档管理', '其他工具'];

interface StoredTool {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  downloadLink: string;
  createdAt: string;
  updatedAt: string;
  order?: number;
}

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [mounted, setMounted] = useState(false);

  const { tools, categories } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { tools: [], categories: DEFAULT_CATEGORIES };
    }
    
    const saved = localStorage.getItem('tools');
    const savedCategories = localStorage.getItem('categories');
    
    let cats = DEFAULT_CATEGORIES;
    let tools: Tool[] = [];
    
    if (saved) {
      try {
        const parsed: StoredTool[] = JSON.parse(saved);
        tools = parsed.map((tool) => ({
          ...tool,
          createdAt: new Date(tool.createdAt),
          updatedAt: new Date(tool.updatedAt),
        }));
      } catch (error) {
        console.error('Error loading tools:', error);
      }
    }
    
    if (savedCategories) {
      try {
        cats = JSON.parse(savedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    }
    
    return { tools, categories: cats };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const filteredTools = selectedCategory
    ? tools
        .filter((tool) => tool.category === selectedCategory)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  // 服务端渲染时保持静默，避免 hydration 不匹配
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
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium">
                <Settings className="w-5 h-5" />
                管理
              </div>
            </div>
          </div>
        </header>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DEFAULT_CATEGORIES.map((category) => (
              <div
                key={category}
                className={`px-4 py-2 rounded-full font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-blue-100 text-blue-700 shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {category}
              </div>
            ))}
          </div>
        </nav>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4">
              <span className="text-6xl">📦</span>
            </div>
            <p className="text-slate-600 text-lg">加载中...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">工具库</h1>
              <p className="text-slate-600 text-sm mt-0.5">发现高效工具，提升工作效率</p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors font-medium"
            >
              <Settings className="w-5 h-5" />
              管理
            </Link>
          </div>
        </div>
      </header>

      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full font-medium transition-all whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-blue-100 text-blue-700 shadow-md'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="w-full h-40 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                  {tool.imageUrl ? (
                    <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">📦</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">{tool.name}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{tool.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4">
              <span className="text-6xl">📦</span>
            </div>
            <p className="text-slate-600 text-lg">该分类暂无工具</p>
            <p className="text-slate-500 text-sm mt-2">请在管理界面添加工具</p>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-600 text-sm">
            © 2024 工具库。所有内容本地存储。
          </p>
        </div>
      </footer>
    </main>
  );
}