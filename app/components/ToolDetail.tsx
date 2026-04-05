'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Tool } from '@/app/types';
import Link from 'next/link';
import { Download, ChevronLeft, Edit2, Plus, Trash2 } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { loadTools, saveTools, migrateFromLocalStorage } from '@/app/lib/db';

interface StoredTool {
  id: string;
  name: string;
  description: string;
  category?: string;
  categories?: string[];
  imageUrl: string;
  downloadLink?: string;
  downloadLinks?: string[];
  downloadLinkLabels?: string[];
  createdAt: string;
  updatedAt: string;
  order?: number;
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
  screenshotLink?: string;
}

export default function ToolDetail({ toolId, isAdmin = false }: { toolId: string; isAdmin?: boolean }) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editData, setEditData] = useState({
    fullDescription: '',
    features: [] as string[],
    screenshots: [] as string[],
    usage: '',
    categories: [] as string[],
    downloadLinks: [] as string[],
    downloadLinkLabels: [] as string[],
    screenshotLink: '',
    newFeature: '',
    newScreenshot: '',
    newCategory: '',
    newDownloadLink: '',
    newDownloadLinkLabel: '',
  });

  useEffect(() => {
    async function loadTool() {
      try {
        let tools: StoredTool[] = [];
        
        // 优先从 IndexedDB 加载
        try {
          tools = await loadTools<StoredTool>();
        } catch (e) {
          console.warn('IndexedDB 加载失败，尝试从 localStorage 迁移:', e);
        }
        
        // 如果 IndexedDB 为空，尝试从 localStorage 迁移
        if (tools.length === 0) {
          const saved = localStorage.getItem('tools');
          if (saved) {
            tools = JSON.parse(saved);
            // 迁移到 IndexedDB
            await saveTools(tools);
            console.log(`从 localStorage 迁移了 ${tools.length} 个工具到 IndexedDB`);
          }
        }
        
        const found = tools.find((t) => t.id === toolId);
        if (found) {
          const toolData: Tool = {
            ...found,
            categories: found.categories || (found.category ? [found.category] : []),
            downloadLinks: found.downloadLinks || (found.downloadLink ? [found.downloadLink] : []),
            createdAt: new Date(found.createdAt),
            updatedAt: new Date(found.updatedAt),
          };
          setTool(toolData);
          setEditData({
            fullDescription: toolData.fullDescription || '',
            features: toolData.features || [],
            screenshots: toolData.screenshots || [],
            usage: toolData.usage || '',
            categories: toolData.categories,
            downloadLinks: toolData.downloadLinks,
            downloadLinkLabels: toolData.downloadLinkLabels || [],
            screenshotLink: toolData.screenshotLink || '',
            newFeature: '',
            newScreenshot: '',
            newCategory: '',
            newDownloadLink: '',
            newDownloadLinkLabel: '',
          });
        }
      } catch (error) {
        console.error('Error loading tool:', error);
      }
      setLoading(false);
    }
    
    loadTool();
  }, [toolId]);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);

  // 处理本地上传快照图片
  const handleSnapshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setEditData({ ...editData, screenshotLink: base64String });
      };
      reader.readAsDataURL(file);
    }
    // 重置 input，允许重复选择同一文件
    e.target.value = '';
  };

  const handleInsertScreenshotToIntro = () => {
    if (!screenshotPreview) return;

    setEditData((prev) => ({
      ...prev,
      screenshots: [...prev.screenshots, screenshotPreview],
    }));
    setScreenshotPreview(null);
    setScreenshotUrl('');
  };

  const handleGenerateScreenshot = async () => {
    if (!screenshotUrl.trim()) {
      alert('请输入网址');
      return;
    }

    setScreenshotLoading(true);
    setScreenshotError(null);
    setScreenshotPreview(null);

    try {
      const response = await fetch('/api/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: screenshotUrl,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMsg = '截图失败';
        if (contentType?.includes('application/json')) {
          try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
          } catch {
            errorMsg = `HTTP ${response.status}: 截图失败`;
          }
        } else {
          errorMsg = `HTTP ${response.status}: 截图失败`;
        }
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      setScreenshotPreview(dataUrl);
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : '截图失败');
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      let tools: StoredTool[] = [];
      
      // 从 IndexedDB 加载所有工具
      try {
        tools = await loadTools<StoredTool>();
      } catch (e) {
        // IndexedDB 加载失败，尝试从 localStorage
        const saved = localStorage.getItem('tools');
        if (saved) {
          tools = JSON.parse(saved);
        }
      }
      
      const index = tools.findIndex((t) => t.id === toolId);
      if (index !== -1) {
        tools[index] = {
          ...tools[index],
          fullDescription: editData.fullDescription,
          features: editData.features,
          screenshots: editData.screenshots,
          usage: editData.usage,
          categories: editData.categories,
          downloadLinks: editData.downloadLinks,
          downloadLinkLabels: editData.downloadLinkLabels,
          screenshotLink: editData.screenshotLink,
          updatedAt: new Date().toISOString(),
        };
        
        // 保存到 IndexedDB（配额更大）
        await saveTools(tools);
        
        // 同步到 localStorage（保持兼容性，但允许失败）
        try {
          localStorage.setItem('tools', JSON.stringify(tools));
        } catch (e) {
          console.warn('localStorage 已满，数据已保存到 IndexedDB');
        }
        
        setTool({
          ...tool,
          fullDescription: editData.fullDescription,
          features: editData.features,
          screenshots: editData.screenshots,
          usage: editData.usage,
          categories: editData.categories,
          downloadLinks: editData.downloadLinks,
          downloadLinkLabels: editData.downloadLinkLabels,
          screenshotLink: editData.screenshotLink,
          updatedAt: new Date(),
        });
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving tool:', error);
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

  const addCategory = () => {
    if (editData.newCategory.trim() && !editData.categories.includes(editData.newCategory.trim())) {
      setEditData({
        ...editData,
        categories: [...editData.categories, editData.newCategory.trim()],
        newCategory: '',
      });
    }
  };

  const removeCategory = (index: number) => {
    setEditData({
      ...editData,
      categories: editData.categories.filter((_, i) => i !== index),
    });
  };

  const addDownloadLink = () => {
    if (editData.newDownloadLink.trim()) {
      setEditData({
        ...editData,
        downloadLinks: [...editData.downloadLinks, editData.newDownloadLink.trim()],
        downloadLinkLabels: [...editData.downloadLinkLabels, editData.newDownloadLinkLabel.trim() || `版本 ${editData.downloadLinks.length + 1}`],
        newDownloadLink: '',
        newDownloadLinkLabel: '',
      });
    }
  };

  const removeDownloadLink = (index: number) => {
    setEditData({
      ...editData,
      downloadLinks: editData.downloadLinks.filter((_, i) => i !== index),
      downloadLinkLabels: editData.downloadLinkLabels.filter((_, i) => i !== index),
    });
  };

  const updateDownloadLinkLabel = (index: number, label: string) => {
    const newLabels = [...(editData.downloadLinkLabels || [])];
    newLabels[index] = label;
    setEditData({
      ...editData,
      downloadLinkLabels: newLabels,
    });
  };

  const updateDownloadLink = (index: number, link: string) => {
    const newLinks = [...editData.downloadLinks];
    newLinks[index] = link;
    setEditData({
      ...editData,
      downloadLinks: newLinks,
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
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            返回
          </button>
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
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          img: ({ node, ...props }) => (
                            <img {...props} className="rounded-lg max-w-full h-auto" />
                          ),
                        }}
                      >
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
                分类
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {editData.categories.map((category, idx) => (
                  <span key={category} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
                    {category}
                    <button
                      type="button"
                      onClick={() => removeCategory(idx)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editData.newCategory}
                  onChange={(e) => setEditData({ ...editData, newCategory: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入分类，按Enter添加"
                />
                <button
                  onClick={addCategory}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  添加分类
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                下载链接
              </label>
              <div className="space-y-2 mb-4">
                {editData.downloadLinks.map((downloadLink, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                    <input
                      type="text"
                      value={editData.downloadLinkLabels?.[idx] || ''}
                      onChange={(e) => updateDownloadLinkLabel(idx, e.target.value)}
                      className="w-28 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={`版本 ${idx + 1}`}
                    />
                    <input
                      type="url"
                      value={downloadLink}
                      onChange={(e) => updateDownloadLink(idx, e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeDownloadLink(idx)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={editData.newDownloadLinkLabel}
                  onChange={(e) => setEditData({ ...editData, newDownloadLinkLabel: e.target.value })}
                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="版本标签"
                />
                <input
                  type="url"
                  value={editData.newDownloadLink}
                  onChange={(e) => setEditData({ ...editData, newDownloadLink: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addDownloadLink()}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入下载链接"
                />
                <button
                  onClick={addDownloadLink}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
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

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">快照链接（大图展示）</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={editData.screenshotLink?.startsWith('data:') ? '' : editData.screenshotLink}
                    onChange={(e) => setEditData({ ...editData, screenshotLink: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/screenshot.png"
                  />
                  <button
                    type="button"
                    onClick={() => snapshotFileInputRef.current?.click()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                  >
                    本地上传
                  </button>
                  <input
                    ref={snapshotFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSnapshotUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">填写后会在页面顶部显示大图快照</p>
                {editData.screenshotLink && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                    <img src={editData.screenshotLink} alt="快照预览" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
                <p className="text-sm font-semibold text-slate-900 mb-3">生成网页快照</p>
                <p className="text-xs text-slate-500 mb-3">输入网页地址，生成PNG截图后可以添加到截图库中。</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">网页地址</label>
                    <input
                      type="url"
                      value={screenshotUrl}
                      onChange={(e) => setScreenshotUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleGenerateScreenshot}
                      disabled={screenshotLoading}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors font-medium"
                    >
                      {screenshotLoading ? '生成中...' : '生成快照'}
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertScreenshotToIntro}
                      disabled={!screenshotPreview}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 text-slate-800 rounded-lg transition-colors font-medium"
                    >
                      添加到截图库
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (screenshotPreview) {
                          setEditData({ ...editData, screenshotLink: screenshotPreview });
                          setScreenshotPreview(null);
                          setScreenshotUrl('');
                        }
                      }}
                      disabled={!screenshotPreview}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium"
                    >
                      设为快照
                    </button>
                  </div>
                  {screenshotError && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                      {screenshotError}
                    </div>
                  )}
                  {screenshotPreview && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <img src={screenshotPreview} alt="网页快照预览" className="w-full h-48 object-cover" />
                    </div>
                  )}
                </div>
              </div>

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
                </div>
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
                {tool.categories && tool.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {tool.categories.map((category) => (
                      <span key={category} className="text-sm px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                        {category}
                      </span>
                    ))}
                  </div>
                )}

                {/* 获取工具按钮 - 悬停显示下拉菜单 */}
                {tool.downloadLinks && tool.downloadLinks.length > 0 && (
                  <div className="mb-8 relative">
                    <div
                      onMouseEnter={() => {
                        if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
                        setShowVersionDropdown(true);
                      }}
                      onMouseLeave={() => {
                        dropdownTimeoutRef.current = setTimeout(() => setShowVersionDropdown(false), 200);
                      }}
                    >
                      <button
                        className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-lg shadow-lg hover:shadow-xl"
                      >
                        <Download className="w-6 h-6" />
                        获取工具
                        <span className="ml-1 text-sm">▼</span>
                      </button>
                      {showVersionDropdown && (
                        <div
                          className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-10 py-2"
                          onMouseEnter={() => {
                            if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
                          }}
                          onMouseLeave={() => {
                            dropdownTimeoutRef.current = setTimeout(() => setShowVersionDropdown(false), 200);
                          }}
                        >
                          <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">选择版本</div>
                          {tool.downloadLinks.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                            >
                              {tool.downloadLinkLabels?.[idx] || `版本 ${idx + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 完整介绍 */}
                <div className="prose prose-slate max-w-none mb-8">
                  <div className="prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-code:bg-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-a:text-blue-600 prose-a:hover:text-blue-700">
                    {tool.fullDescription ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          img: ({ node, ...props }) => (
                            <img
                              {...props}
                              className="rounded-lg max-w-full h-auto"
                            />
                          ),
                        }}
                      >
                        {tool.fullDescription}
                      </ReactMarkdown>
                    ) : tool.screenshotLink ? null : (
                      <p className="text-slate-500 italic">暂无详细介绍</p>
                    )}
                  </div>
                </div>

                {/* 使用说明 */}
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

                {/* 功能特性 */}
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

                {/* 快照 - 大图，点击可放大 */}
                {tool.screenshotLink && (
                  <div className="mb-8 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <img
                      src={tool.screenshotLink}
                      alt="网页快照"
                      className="w-full h-auto cursor-zoom-in"
                      onClick={() => {
                        setLightboxImage(tool.screenshotLink!);
                        setLightboxOpen(true);
                      }}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                )}

                {/* 截图 - 点击可放大 */}
                {tool.screenshots && tool.screenshots.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">截图</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tool.screenshots.map((screenshot, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                        >
                          <img
                            src={screenshot}
                            alt={`截图 ${idx + 1}`}
                            className="w-full h-auto cursor-zoom-in"
                            onClick={() => {
                              setLightboxImage(screenshot);
                              setLightboxOpen(true);
                            }}
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      ))}
                    </div>
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

      {/* Lightbox 模态框 */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={lightboxImage}
            alt="放大查看"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
            onClick={() => setLightboxOpen(false)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
