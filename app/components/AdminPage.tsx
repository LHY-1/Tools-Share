'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tool, CreateToolInput } from '@/app/types';
import { Trash2, Edit2, Plus, Eye, EyeOff, GripVertical } from './Icons';
import Link from 'next/link';
import Image from 'next/image';

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

export default function AdminPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  const [formData, setFormData] = useState<CreateToolInput>({
    name: '',
    description: '',
    category: DEFAULT_CATEGORIES[0],
    imageUrl: '',
    downloadLink: '',
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { tools: initialTools, categories: initialCategories } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { tools: [], categories: DEFAULT_CATEGORIES };
    }
    
    const saved = localStorage.getItem('tools');
    const savedCategories = localStorage.getItem('categories');
    
    let tools: Tool[] = [];
    let cats = DEFAULT_CATEGORIES;
    
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

  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [categories, setCategories] = useState<string[]>(initialCategories);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tools', JSON.stringify(tools));
    }
  }, [tools]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('categories', JSON.stringify(categories));
    }
  }, [categories]);

  const handleAddOrUpdate = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert('请填写工具名称和说明');
      return;
    }

    if (editingId) {
      setTools(
        tools.map((t) =>
          t.id === editingId
            ? { ...t, ...formData, updatedAt: new Date() }
            : t
        )
      );
      setEditingId(null);
    } else {
      const newTool: Tool = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: tools.length,
      };
      setTools([...tools, newTool]);
    }

    setFormData({
      name: '',
      description: '',
      category: categories[0],
      imageUrl: '',
      downloadLink: '',
    });
    setShowForm(false);
  };

  const handleEdit = (tool: Tool) => {
    setFormData({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      imageUrl: tool.imageUrl,
      downloadLink: tool.downloadLink,
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
          t.category === categoryToDelete
            ? { ...t, category: newCategories[0] }
            : t
        )
      );
    }
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
                  onClick={() => setShowForm(true)}
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
                        <span className="inline-block mt-1 px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-full">
                          {tool.category}
                        </span>
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
                        category: categories[0],
                        imageUrl: '',
                        downloadLink: '',
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
                      工具说明 *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入工具说明"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      分类
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
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
                    <input
                      type="url"
                      value={formData.downloadLink}
                      onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/download"
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
                          category: categories[0],
                          imageUrl: '',
                          downloadLink: '',
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

