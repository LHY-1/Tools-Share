'use client';

import { useState, useEffect } from 'react';
import { Tool, CreateToolInput } from '@/app/types';
import { Trash2, Edit2, Plus, Eye, EyeOff, GripVertical } from './Icons';
import Link from 'next/link';
import Image from 'next/image';
import { loadTools, saveTools } from '@/app/lib/db';

const DEFAULT_CATEGORIES = ['开发工具', '设计工具', '工作效率', '文档管理', '其他工具'];

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
  screenshotLink?: string;
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
  createdAt: string;
  updatedAt: string;
  order?: number;
}

export default function AdminPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [newDownloadLink, setNewDownloadLink] = useState('');
  const [newDownloadLinkLabel, setNewDownloadLinkLabel] = useState('');
  const [newToolCategory, setNewToolCategory] = useState('');
  
  const [formData, setFormData] = useState<CreateToolInput>({
    name: '',
    description: '',
    categories: [DEFAULT_CATEGORIES[0]],
    imageUrl: '',
    downloadLinks: [],
    downloadLinkLabels: [],
    screenshotLink: '',
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化加载 - 从 IndexedDB 或 localStorage
  useEffect(() => {
    async function initLoad() {
      try {
        // 优先从 IndexedDB 加载
        let loadedTools: StoredTool[] = [];
        try {
          loadedTools = await loadTools<StoredTool>();
        } catch (e) {
          console.warn('IndexedDB 加载失败:', e);
        }
        
        // 如果 IndexedDB 为空，尝试从 localStorage
        if (loadedTools.length === 0) {
          const saved = localStorage.getItem('tools');
          if (saved) {
            loadedTools = JSON.parse(saved);
            // 迁移到 IndexedDB
            await saveTools(loadedTools);
          }
        }
        
        const tools = loadedTools.map((tool) => ({
          ...tool,
          createdAt: new Date(tool.createdAt),
          updatedAt: new Date(tool.updatedAt),
          categories: tool.categories || (tool.category ? [tool.category] : [DEFAULT_CATEGORIES[0]]),
          downloadLinks: tool.downloadLinks || (tool.downloadLink ? [tool.downloadLink] : []),
          screenshotLink: tool.screenshotLink || '',
          fullDescription: tool.fullDescription || '',
          features: tool.features || [],
          screenshots: tool.screenshots || [],
          usage: tool.usage || '',
        }));
        
        setTools(tools);
        
        // 加载分类
        const savedCategories = localStorage.getItem('categories');
        if (savedCategories) {
          try {
            setCategories(JSON.parse(savedCategories));
          } catch (e) {
            console.error('加载分类失败:', e);
          }
        }
      } catch (error) {
        console.error('初始化加载失败:', error);
      }
      setIsLoading(false);
    }
    
    initLoad();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && tools.length > 0) {
      // 保存到 IndexedDB（配额更大）
      saveTools(tools as unknown as StoredTool[]).catch(console.error);
      // 同步到 localStorage（保持兼容性，但允许失败）
      try {
        localStorage.setItem('tools', JSON.stringify(tools));
      } catch (e) {
        console.warn('localStorage 已满，数据已保存到 IndexedDB');
      }
    }
  }, [tools]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('categories', JSON.stringify(categories));
    }
  }, [categories]);

  const handleAddOrUpdate = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert('请填写工具名称和简介');
      return;
    }

    const normalizedData = {
      ...formData,
      categories: formData.categories.length ? formData.categories : [DEFAULT_CATEGORIES[0]],
      downloadLinks: formData.downloadLinks || [],
      downloadLinkLabels: formData.downloadLinkLabels || [],
    };

    if (editingId) {
      // 保留原有的详细数据（fullDescription, features, screenshots, usage）
      const existingTool = tools.find((t) => t.id === editingId);
      setTools(
        tools.map((t) =>
          t.id === editingId
            ? { ...t, ...normalizedData, 
                fullDescription: existingTool?.fullDescription || '',
                features: existingTool?.features || [],
                screenshots: existingTool?.screenshots || [],
                usage: existingTool?.usage || '',
                updatedAt: new Date() }
            : t
        )
      );
      setEditingId(null);
    } else {
      const newTool: Tool = {
        id: Date.now().toString(),
        ...normalizedData,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: tools.length,
      };
      setTools([...tools, newTool]);
    }

    setFormData({
      name: '',
      description: '',
      categories: [categories[0]],
      imageUrl: '',
      downloadLinks: [],
      downloadLinkLabels: [],
      screenshotLink: '',
    });
    setShowForm(false);
  };

  const handleEdit = (tool: Tool) => {
    setFormData({
      name: tool.name,
      description: tool.description,
      categories: tool.categories,
      imageUrl: tool.imageUrl,
      downloadLinks: tool.downloadLinks,
      downloadLinkLabels: tool.downloadLinkLabels || [],
      screenshotLink: tool.screenshotLink || '',
    });
    setEditingId(tool.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个工具吗？')) {
      setTools(tools.filter((t) => t.id !== id));
    }
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      alert('请输入分类名称');
      return;
    }
    if (categories.includes(newCategory.trim())) {
      alert('分类已存在');
      return;
    }
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
    setShowCategoryForm(false);
  };

  const handleEditCategory = (index: number) => {
    setEditingCategoryId(index);
    setEditingCategoryName(categories[index]);
  };

  const handleUpdateCategory = () => {
    if (!editingCategoryName.trim()) {
      alert('请输入分类名称');
      return;
    }
    if (editingCategoryId !== null) {
      const newCategories = [...categories];
      newCategories[editingCategoryId] = editingCategoryName.trim();
      setCategories(newCategories);
      setEditingCategoryId(null);
      setEditingCategoryName('');
    }
  };

  const handleDeleteCategory = (index: number) => {
    if (categories.length <= 1) {
      alert('至少需要保留一个分类');
      return;
    }
    if (confirm('确定要删除这个分类吗？所有属于这个分类的工具将被移动到默认分类。')) {
      const categoryToDelete = categories[index];
      const newCategories = categories.filter((_, i) => i !== index);
      setCategories(newCategories);
      
      // 将被删除分类的工具移动到第一个分类
      setTools(
        tools.map((t) =>
          t.categories?.includes(categoryToDelete)
            ? { ...t, categories: t.categories?.filter((c) => c !== categoryToDelete) || [] }
            : t
        )
      );
    }
  };

  const handleAddToolCategory = (category: string) => {
    if (!category.trim()) return;
    setFormData((prev) => {
      const nextCategories = prev.categories.includes(category)
        ? prev.categories
        : [...prev.categories, category];
      return { ...prev, categories: nextCategories };
    });
  };

  const handleRemoveToolCategory = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  };

  const handleAddDownloadLink = () => {
    if (!newDownloadLink.trim()) return;
    setFormData((prev) => ({
      ...prev,
      downloadLinks: [...prev.downloadLinks, newDownloadLink.trim()],
      downloadLinkLabels: [...(prev.downloadLinkLabels || []), newDownloadLinkLabel.trim() || `版本 ${prev.downloadLinks.length + 1}`],
    }));
    setNewDownloadLink('');
    setNewDownloadLinkLabel('');
  };

  const handleRemoveDownloadLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      downloadLinks: prev.downloadLinks.filter((_, i) => i !== index),
      downloadLinkLabels: prev.downloadLinkLabels?.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateDownloadLinkLabel = (index: number, label: string) => {
    setFormData((prev) => {
      const newLabels = [...(prev.downloadLinkLabels || [])];
      newLabels[index] = label;
      return { ...prev, downloadLinkLabels: newLabels };
    });
  };

  const handleUpdateDownloadLink = (index: number, link: string) => {
    setFormData((prev) => {
      const newLinks = [...prev.downloadLinks];
      newLinks[index] = link;
      return { ...prev, downloadLinks: newLinks };
    });
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = tools.findIndex((t) => t.id === draggedId);
    const targetIndex = tools.findIndex((t) => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTools = [...tools];
    const [draggedTool] = newTools.splice(draggedIndex, 1);
    newTools.splice(targetIndex, 0, draggedTool);

    // 更新 order
    newTools.forEach((tool, index) => {
      tool.order = index;
    });

    setTools(newTools);
    setDraggedId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">管理工具</h1>
              <p className="text-slate-600 text-sm mt-0.5">添加、编辑和组织您的工具收藏</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors font-medium"
            >
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 工具列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">工具列表</h2>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditingId(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  添加工具
                </button>
              </div>

              <div className="space-y-3">
                {tools.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.id}?admin=true`}
                    className="block"
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.preventDefault(); // 防止拖拽时触发链接
                        handleDragStart(tool.id);
                      }}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(tool.id)}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors group cursor-pointer"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                      <img
                        src={tool.imageUrl || '/placeholder.png'}
                        alt={tool.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{tool.name}</h3>
                        <p className="text-sm text-slate-600 line-clamp-1">{tool.description}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                      {tool.categories?.map((cat) => (
                        <span key={cat} className="inline-block px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-full">
                          {cat}
                        </span>
                      ))}
                    </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(tool);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(tool.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
                {tools.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <p>还没有添加任何工具</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      添加第一个工具
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 分类管理 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">分类管理</h3>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {categories.map((category, index) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    {editingCategoryId === index ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateCategory();
                            if (e.key === 'Escape') {
                              setEditingCategoryId(null);
                              setEditingCategoryName('');
                            }
                          }}
                        />
                        <button
                          onClick={handleUpdateCategory}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName('');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-900">{category}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditCategory(index)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(index)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 预览切换 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">预览模式</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {showPreview ? '预览已启用' : '预览已禁用'}
              </p>
            </div>


          </div>
        </div>

        {/* 添加/编辑工具表单 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {editingId ? '编辑工具' : '添加工具'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setFormData({
                        name: '',
                        description: '',
                        categories: [categories[0]],
                        imageUrl: '',
                        downloadLinks: [],
                        screenshotLink: '',
                      });
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddOrUpdate();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      工具名称 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入工具名称"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      工具简介 *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入工具简介"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      分类
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.categories.map((category, idx) => (
                        <span key={`${category}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
                          {category}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                categories: prev.categories.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={newToolCategory}
                        onChange={(e) => setNewToolCategory(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">选择分类</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          handleAddToolCategory(newToolCategory);
                          setNewToolCategory('');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        添加分类
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      图片链接
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/image.png"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      下载链接
                    </label>
                    <div className="space-y-2 mb-3">
                      {formData.downloadLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                          <input
                            type="text"
                            value={formData.downloadLinkLabels?.[idx] || ''}
                            onChange={(e) => handleUpdateDownloadLinkLabel(idx, e.target.value)}
                            className="w-28 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`版本 ${idx + 1}`}
                          />
                          <input
                            type="url"
                            value={link}
                            onChange={(e) => handleUpdateDownloadLink(idx, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDownloadLink(idx)}
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
                        value={newDownloadLinkLabel}
                        onChange={(e) => setNewDownloadLinkLabel(e.target.value)}
                        className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="版本标签"
                      />
                      <input
                        type="url"
                        value={newDownloadLink}
                        onChange={(e) => setNewDownloadLink(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/download"
                      />
                      <button
                        type="button"
                        onClick={handleAddDownloadLink}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        添加
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      快照链接
                    </label>
                    <input
                      type="url"
                      value={formData.screenshotLink}
                      onChange={(e) => setFormData({ ...formData, screenshotLink: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/screenshot.png"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {editingId ? '更新' : '添加'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setFormData({
                          name: '',
                          description: '',
                          categories: [categories[0]],
                          imageUrl: '',
                          downloadLinks: [],
                          screenshotLink: '',
                        });
                      }}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* 添加分类表单 */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-slate-900">添加分类</h3>
                  <button
                    onClick={() => {
                      setShowCategoryForm(false);
                      setNewCategory('');
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddCategory();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      分类名称
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入分类名称"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      添加
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false);
                        setNewCategory('');
                      }}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

