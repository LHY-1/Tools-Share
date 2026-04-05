'use client';

import { useState, useEffect } from 'react';
import { Tool } from '@/app/types';
import Link from 'next/link';
import { Download, ChevronLeft, Edit2, Plus, Trash2 } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
}

export default function ToolDetail({ toolId, isAdmin = false }: { toolId: string; isAdmin?: boolean }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [screenshotImages, setScreenshotImages] = useState<string[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [editData, setEditData] = useState({
    fullDescription: '',
    features: [] as string[],
    screenshots: [] as string[],
    usage: '',
    newFeature: '',
    newScreenshot: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('tools');
    
    if (saved) {
      try {
        const tools: StoredTool[] = JSON.parse(saved);
        const found = tools.find((t) => t.id === toolId);
        if (found) {
          const toolData = {
            ...found,
            createdAt: new Date(found.createdAt),
            updatedAt: new Date(found.updatedAt),
          };
          setTool(toolData);
          setEditData({
            fullDescription: toolData.fullDescription || '',
            features: toolData.features || [],
            screenshots: toolData.screenshots || [],
            usage: toolData.usage || '',
            newFeature: '',
            newScreenshot: '',
          });
        }
      } catch (error) {
        console.error('Error loading tool:', error);
      }
    }
    setLoading(false);
  }, [toolId]);

  const handleSaveEdit = () => {
    const saved = localStorage.getItem('tools');
    if (saved && tool) {
      try {
        const tools = JSON.parse(saved);
        const index = tools.findIndex((t: StoredTool) => t.id === toolId);
        if (index !== -1) {
          tools[index] = {
            ...tools[index],
            fullDescription: editData.fullDescription,
            features: editData.features,
            screenshots: editData.screenshots,
            usage: editData.usage,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem('tools', JSON.stringify(tools));
          setTool({
            ...tool,
            fullDescription: editData.fullDescription,
            features: editData.features,
            screenshots: editData.screenshots,
            usage: editData.usage,
            updatedAt: new Date(),
          });
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Error saving tool:', error);
      }
    }
  };

  const addFeature = () => {
    if (editData.newFeature.trim()) {
      setEditData({
        ...editData,
        features: [...editData.features, editData.newFeature.trim()],
        newFeature: '',
      });
    }
  };

  const removeFeature = (index: number) => {
    setEditData({
      ...editData,
      features: editData.features.filter((_, i) => i !== index),
    });
  };

  const addScreenshot = () => {
    if (editData.newScreenshot.trim()) {
      setEditData({
        ...editData,
        screenshots: [...editData.screenshots, editData.newScreenshot.trim()],
        newScreenshot: '',
      });
    }
  };

  const removeScreenshot = (index: number) => {
    setEditData({
      ...editData,
      screenshots: editData.screenshots.filter((_, i) => i !== index),
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setEditData({
          ...editData,
          screenshots: [...editData.screenshots, base64String],
          newScreenshot: '',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScrapeImages = async () => {
    if (!scrapeUrl.trim()) {
      setScrapeError('请输入网址');
      return;
    }

    setScraping(true);
    setScrapeError('');
    setScreenshotImages([]);

    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '截图失败');
      }

      if (data.success && data.image) {
        setScreenshotImages([data.image]);
        setScrapeError(data.note || '');
      } else {
        throw new Error('截图失败');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      setScrapeError(error instanceof Error ? error.message : '截图失败，请稍后重试');
      setScreenshotImages([]);
    } finally {
      setScraping(false);
    }
  };

  const addScrapedImage = (imageUrl: string) => {
    setEditData({
      ...editData,
      screenshots: [...editData.screenshots, imageUrl],
    });
    setScreenshotImages(screenshotImages.filter((img) => img !== imageUrl));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">加载中...</p>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-slate-600 mb-4">工具不存在</p>
        <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ChevronLeft className="w-5 h-5" />
            返回
          </Link>
          {isAdmin && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              {isEditing ? '取消编辑' : '编辑此页'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isEditing ? (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">编辑官网内容</h2>

            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                完整介绍 (支持 Markdown)
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-2">编辑</p>
                  <textarea
                    value={editData.fullDescription}
                    onChange={(e) => setEditData({ ...editData, fullDescription: e.target.value })}
                    maxLength={1000}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] font-mono text-sm"
                    placeholder="支持 Markdown 格式&#10;# 标题&#10;**粗体**&#10;- 列表&#10;`代码`"
                  />
                  <p className="text-xs text-slate-500 mt-2">{editData.fullDescription.length}/1000</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">预览</p>
                  <div className="px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 min-h-[200px] prose prose-sm prose-slate max-w-none overflow-auto">
                    {editData.fullDescription ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editData.fullDescription}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-slate-400 italic">预览展示</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                功能特性
              </label>
              <div className="space-y-2 mb-4">
                {editData.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <span className="text-slate-700">{feature}</span>
                    <button
                      onClick={() => removeFeature(idx)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editData.newFeature}
                  onChange={(e) => setEditData({ ...editData, newFeature: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入功能特性，按Enter添加"
                />
                <button
                  onClick={addFeature}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                使用说明 (支持 Markdown)
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-2">编辑</p>
                  <textarea
                    value={editData.usage}
                    onChange={(e) => setEditData({ ...editData, usage: e.target.value })}
                    maxLength={1000}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] font-mono text-sm"
                    placeholder="支持 Markdown 格式&#10;1. 步骤1&#10;2. 步骤2&#10;`代码示例`"
                  />
                  <p className="text-xs text-slate-500 mt-2">{editData.usage.length}/1000</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">预览</p>
                  <div className="px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 min-h-[200px] prose prose-sm prose-slate max-w-none overflow-auto">
                    {editData.usage ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editData.usage}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-slate-400 italic">预览展示</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                截图
              </label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {editData.screenshots.map((screenshot, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={screenshot}
                      alt={`截图 ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E失败%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <button
                      onClick={() => removeScreenshot(idx)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={editData.newScreenshot}
                    onChange={(e) => setEditData({ ...editData, newScreenshot: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addScreenshot()}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入图片链接，按Enter添加"
                  />
                  <button
                    onClick={addScreenshot}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    链接
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="px-3 py-2 text-slate-600 text-sm whitespace-nowrap">本地上传</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleScrapeImages()}
                    placeholder="输入网址，获取网站快照"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleScrapeImages}
                    disabled={scraping}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {scraping ? '获取中...' : '获取快照'}
                  </button>
                </div>
                {scrapeError && (
                  <p className="text-sm text-red-600">{scrapeError}</p>
                )}
              </div>

              {screenshotImages.length > 0 && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-semibold text-slate-900 mb-3">
                    网站快照已生成，点击添加
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {screenshotImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => addScrapedImage(img)}
                        className="relative group cursor-pointer"
                      >
                        <img
                          src={img}
                          alt={`爬取的图片 ${idx + 1}`}
                          className="w-full h-24 object-cover rounded border border-purple-300 hover:border-purple-600 transition-all"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3e8ff" width="100" height="100"/%3E%3C/svg%3E';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t pt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                保存官网内容
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-6 py-3 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded-lg font-semibold transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="w-full h-96 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center overflow-hidden">
                {tool.imageUrl ? (
                  <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-8xl">📦</span>
                )}
              </div>

              <div className="p-8 sm:p-12">
                <h1 className="text-4xl font-bold text-slate-900 mb-3">{tool.name}</h1>
                <p className="text-slate-600 mb-6">
                  分类: <span className="font-semibold text-slate-900">{tool.category}</span>
                </p>

                <div className="prose prose-slate max-w-none mb-8">
                  <div className="prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-code:bg-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-a:text-blue-600 prose-a:hover:text-blue-700">
                    {tool.fullDescription ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {tool.fullDescription}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-slate-500 italic">暂无详细介绍</p>
                    )}
                  </div>
                </div>

                {tool.features && tool.features.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">功能特性</h2>
                    <ul className="space-y-3">
                      {tool.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-slate-700">
                          <span className="text-blue-600 font-bold mt-1">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tool.usage && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">使用说明</h2>
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 prose prose-slate prose-code:bg-white prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-a:text-blue-600 prose-a:hover:text-blue-700 max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {tool.usage}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {tool.screenshots && tool.screenshots.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">截图</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {tool.screenshots.map((screenshot, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                          <img
                            src={screenshot}
                            alt={`截图 ${idx + 1}`}
                            className="w-full h-64 object-cover hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tool.downloadLink && (
                  <div className="mb-8">
                    <a
                      href={tool.downloadLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-lg shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-6 h-6" />
                      获取工具
                    </a>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-6 text-sm text-slate-600">
                  <p>创建于: {new Date(tool.createdAt).toLocaleDateString()}</p>
                  <p>更新于: {new Date(tool.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
