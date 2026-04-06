'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tool, StoredTool, CreateToolInput, toTool } from '@/app/types';
import { Trash2, Edit2, Plus, Eye, EyeOff, GripVertical, Upload, Download, CheckCircle, AlertCircle } from './Icons';
import Link from 'next/link';
import Image from 'next/image';
import { loadTools, saveTools, saveCategories, loadCategories } from '@/app/lib/db';
import { exportAllData, importData, type ImportResult } from '@/app/lib/export-import';
import { materializeToolImagesToCloud, LocalImage } from '@/app/lib/image-utils';

const DEFAULT_CATEGORIES = ['开发工具', '设计工具', '工作效率', '文档管理', '其他工具'];

export default function AdminPage() {
  const searchParams = useSearchParams();
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
    screenshots: [],
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  // 图片上传
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setFormData((prev) => ({ ...prev, imageUrl: base64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSnapshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setFormData((prev) => ({ ...prev, screenshotLink: base64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 导入结果提示
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function initLoad() {
      try {
        let loadedTools: StoredTool[] = [];
        try {
          const all = await loadTools<StoredTool>();
          // 过滤掉特殊记录（如 __categories__）
          loadedTools = all.filter(t => t.id && !t.id.startsWith('__'));
        } catch (e) {
          console.warn('IndexedDB 加载失败:', e);
        }

        if (loadedTools.length === 0) {
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tools');
            if (saved) {
              loadedTools = JSON.parse(saved);
              await saveTools(loadedTools);
            }
          }
        }

        const mapped = loadedTools.map((tool) => ({
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

        setTools(mapped.map((t) => toTool(t)));

        // 从 IndexedDB 加载分类
        const savedCategories = await loadCategories();
        if (savedCategories && savedCategories.length > 0) {
          setCategories(savedCategories);
        }
      } catch (error) {
        console.error('初始化加载失败:', error);
      }
      setIsLoading(false);
    }

    initLoad();
  }, []);

  // 从详情页跳转过来时自动打开编辑
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || tools.length === 0) return;
    const tool = tools.find((t) => t.id === editId);
    if (!tool) return;
    setEditingId(editId);
    setFormData({
      name: tool.name,
      description: tool.description ?? '',
      categories: tool.categories ?? [DEFAULT_CATEGORIES[0]],
      imageUrl: tool.imageUrl ?? '',
      downloadLinks: tool.downloadLinks ?? [],
      downloadLinkLabels: tool.downloadLinkLabels ?? [],
      screenshotLink: tool.screenshotLink ?? '',
      screenshots: tool.screenshots ?? [],
    });
    setShowForm(true);
    // 清理 URL 参数
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams, tools]);

  useEffect(() => {
    if (typeof window !== 'undefined' && tools.length > 0) {
      saveTools(tools as unknown as StoredTool[]).catch(console.error);
      try {
        localStorage.setItem('tools', JSON.stringify(tools));
      } catch (e) {
        console.warn('localStorage 已满，数据已保存到 IndexedDB');
      }
    }
  }, [tools]);

  useEffect(() => {
    if (categories.length > 0) {
      saveCategories(categories).catch(console.error);
    }
  }, [categories]);

  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string>('');

  /**
   * 同步到云端：
   * 1. 遍历每个工具的每个图片字段
   * 2. __local_image:<id> → 读 IndexedDB → 上传 Blob → blob URL
   * 3. 外链 URL → 下载 → 上传 Blob → blob URL
   * 4. Blob URL → 跳过（已是云端）
   * 5. 任意一张图失败 → 整工具同步失败
   * 6. 最终写入 Redis 的 JSON 里图片字段全是 Blob URL
   * 7. 同步成功后把 Blob URL 写回本地 IndexedDB，下次同步不再重复上传
   */
  const handleSyncToCloud = async () => {
    setCloudLoading(true);
    setCloudStatus('');
    try {
      const storedTools = await loadTools<StoredTool>();
      const syncedTools: StoredTool[] = [];
      let processedCount = 0;

      for (const tool of storedTools) {
        setCloudStatus(`正在同步工具 "${tool.name}" 的图片...`);

        const { tool: synced, results } = await materializeToolImagesToCloud(tool, (msg) => {
          setCloudStatus(msg);
        });

        const failures = results.filter((r) => !r.success);
        if (failures.length > 0) {
          const msgs = failures.map((f) => f.error).join('; ');
          throw new Error(`工具 "${tool.name}" 图片同步失败: ${msgs}`);
        }

        syncedTools.push(synced);
        processedCount++;
      }

      setCloudStatus(`正在写入云端数据库...`);
      const data = JSON.stringify(syncedTools);
      const res = await fetch('/api/cloud/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tools-data', value: data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '保存失败');

      // ── 关键：把 Blob URL 写回本地 IndexedDB ──────────────────────────────
      // 同步后工具数据里的图片字段已全是 Blob URL（不再有 __local_image:*）
      // 下次同步时 isBlobUrl() 检测到 Blob URL → 直接跳过，不重复上传
      setCloudStatus(`正在回写本地数据...`);
      await saveTools(syncedTools);
      setTools(syncedTools as Tool[]);

      setCloudStatus(`✓ 已同步 ${processedCount} 个工具到云端（本地已回写）`);
    } catch (err: any) {
      setCloudStatus(`✗ 同步失败: ${err.message}`);
    } finally {
      setCloudLoading(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!confirm('从云端恢复会覆盖本地数据，确定继续？')) return;
    setCloudLoading(true);
    setCloudStatus('');
    try {
      const res = await fetch('/api/cloud/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tools-data' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '加载失败');

      // 新 API 返回 { tools: [...] }，load API 已做 gzip 解压
      const storedTools: StoredTool[] = Array.isArray(result.tools) ? result.tools : [];
      if (storedTools.length === 0) {
        throw new Error('云端暂无数据');
      }

      // 确保每条数据有 id，没有则跳过
      const validTools = storedTools.filter((t: StoredTool) => {
        if (!t?.id) {
          console.warn('云端数据缺少 id，已跳过:', t);
          return false;
        }
        return true;
      });
      if (validTools.length === 0) {
        throw new Error('云端数据中没有有效的工具记录');
      }

      await saveTools(validTools);
      const mapped = validTools.map((tool) => ({
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
      setTools(mapped.map((t) => toTool(t)));
      setCloudStatus(`✓ 已从云端恢复 ${validTools.length} 个工具`);
    } catch (err: any) {
      setCloudStatus(`✗ 恢复失败: ${err.message}`);
    } finally {
      setCloudLoading(false);
    }
  };

  // ─── 导出 ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      await exportAllData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`导出失败: ${msg}`);
    }
  };

  // ─── 导入 ───────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await importData(file);
      setImportResult(result);
      if (result.success) {
        // 刷新列表
        const loaded = await loadTools<StoredTool>();
        const mapped = loaded.map((tool) => ({
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
        setTools(mapped.map((t) => toTool(t)));
      }
    } catch (err) {
      setImportResult({ success: false, toolsImported: 0, imagesImported: 0, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddOrUpdate = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert('请填写工具名称和简介');
      return;
    }

    setIsSaving(true);
    setSaveStatus('正在处理图片...');

    try {
      // ── 本地保存：直接存 URL，不阻塞 ──────────────────────────────────────
      // 外链 URL / Blob URL / __local_image:<id> → 原样存 IndexedDB
      // 同步到云端时才做图片实化（__local_image → Blob URL，外链 → Blob URL）
      const normalizedData = {
        ...formData,
        imageUrl: formData.imageUrl ?? '',
        screenshotLink: formData.screenshotLink ?? '',
        screenshots: formData.screenshots ?? [],
        categories: formData.categories.length ? formData.categories : [DEFAULT_CATEGORIES[0]],
        downloadLinks: formData.downloadLinks || [],
        downloadLinkLabels: formData.downloadLinkLabels || [],
      };

      setSaveStatus('正在保存...');

      if (editingId) {
        const existingTool = tools.find((t) => t.id === editingId);
        const updated = tools.map((t) =>
          t.id === editingId
            ? {
                ...t,
                ...normalizedData,
                fullDescription: existingTool?.fullDescription || '',
                features: existingTool?.features || [],
                screenshots: existingTool?.screenshots || [],
                usage: existingTool?.usage || '',
                updatedAt: new Date(),
              }
            : t
        );
        setTools(updated);
        // 立即持久化，不依赖 useEffect
        await saveTools(updated as unknown as StoredTool[]);
        try {
          localStorage.setItem('tools', JSON.stringify(updated));
        } catch {
          // localStorage 满，无所谓，IndexedDB 已有
        }
        setEditingId(null);
      } else {
        const newTool: Tool = {
          id: Date.now().toString(),
          ...normalizedData,
          createdAt: new Date(),
          updatedAt: new Date(),
          order: tools.length,
        };
        const updated = [...tools, newTool];
        setTools(updated);
        await saveTools(updated as unknown as StoredTool[]);
        try {
          localStorage.setItem('tools', JSON.stringify(updated));
        } catch {
          // localStorage 满，无所谓，IndexedDB 已有
        }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`保存失败: ${msg}`);
    } finally {
      setSaveStatus('');
      setIsSaving(false);
    }
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
    if (!newCategory.trim()) { alert('请输入分类名称'); return; }
    if (categories.includes(newCategory.trim())) { alert('分类已存在'); return; }
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
    setShowCategoryForm(false);
  };

  const handleEditCategory = (index: number) => {
    setEditingCategoryId(index);
    setEditingCategoryName(categories[index]);
  };

  const handleUpdateCategory = () => {
    if (!editingCategoryName.trim()) { alert('请输入分类名称'); return; }
    if (editingCategoryId !== null) {
      const newCategories = [...categories];
      newCategories[editingCategoryId] = editingCategoryName.trim();
      setCategories(newCategories);
      setEditingCategoryId(null);
      setEditingCategoryName('');
    }
  };

  const handleDeleteCategory = (index: number) => {
    if (categories.length <= 1) { alert('至少需要保留一个分类'); return; }
    if (confirm('确定要删除这个分类吗？所有属于这个分类的工具将被移动到默认分类。')) {
      const categoryToDelete = categories[index];
      const newCategories = categories.filter((_, i) => i !== index);
      setCategories(newCategories);
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
      const nextCategories = prev.categories.includes(category) ? prev.categories : [...prev.categories, category];
      return { ...prev, categories: nextCategories };
    });
  };

  const handleRemoveToolCategory = (index: number) => {
    setFormData((prev) => ({ ...prev, categories: prev.categories.filter((_, i) => i !== index) }));
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

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const draggedIndex = tools.findIndex((t) => t.id === draggedId);
    const targetIndex = tools.findIndex((t) => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newTools = [...tools];
    const [draggedTool] = newTools.splice(draggedIndex, 1);
    newTools.splice(targetIndex, 0, draggedTool);
    newTools.forEach((tool, index) => { tool.order = index; });
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
            <div className="flex items-center gap-3">
              {/* 数据迁移按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  导出数据
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <Upload className="w-4 h-4" />
                  导入数据
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="h-6 w-px bg-slate-300 mx-1" />
                <button
                  onClick={handleSyncToCloud}
                  disabled={cloudLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <Upload className="w-4 h-4" />
                  {cloudLoading ? '同步中...' : '同步到云端'}
                </button>
                <button
                  onClick={handleRestoreFromCloud}
                  disabled={cloudLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  {cloudLoading ? '恢复中...' : '从云端恢复'}
                </button>
              </div>
              {cloudStatus && (
                <div className={`text-sm font-medium ${cloudStatus.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                  {cloudStatus}
                </div>
              )}
              <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors font-medium">
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 导入结果提示 */}
      {importResult && (
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 ${importResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            importResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            {importResult.success
              ? <CheckCircle className="w-5 h-5 shrink-0" />
              : <AlertCircle className="w-5 h-5 shrink-0" />
            }
            <div>
              <p className="font-semibold">
                {importResult.success
                  ? `导入成功！导入了 ${importResult.toolsImported} 个工具和 ${importResult.imagesImported} 张图片`
                  : `导入失败: ${importResult.error}`
                }
              </p>
              {importResult.success && (
                <p className="text-sm mt-1 opacity-70">
                  现有数据已全部替换为导入数据。
                </p>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="ml-auto text-current opacity-60 hover:opacity-100 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 工具列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  工具列表 {tools.length > 0 && <span className="text-sm font-normal text-slate-500 ml-2">({tools.length})</span>}
                </h2>
                <button
                  onClick={() => { setShowForm(true); setEditingId(null); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  添加工具
                </button>
              </div>

              <div className="space-y-3">
                {tools.map((tool) => (
                  <Link key={tool.id} href={`/tools/${tool.id}?admin=true`} className="block">
                    <div
                      draggable
                      onDragStart={(e) => { e.preventDefault(); handleDragStart(tool.id); }}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(tool.id)}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors group cursor-pointer"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                      <LocalImage
                        src={tool.imageUrl}
                        alt={tool.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{tool.name}</h3>
                        <p className="text-sm text-slate-600 line-clamp-1">{tool.description}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {tool.categories?.map((cat) => (
                            <span key={cat} className="inline-block px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-full">{cat}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(tool); }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(tool.id); }}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
                {tools.length === 0 && !isLoading && (
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
                {isLoading && (
                  <div className="text-center py-12 text-slate-400">加载中...</div>
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
                <button onClick={() => setShowCategoryForm(true)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
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
                          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(); if (e.key === 'Escape') { setEditingCategoryId(null); setEditingCategoryName(''); } }}
                        />
                        <button onClick={handleUpdateCategory} className="p-1 text-green-600 hover:text-green-700">✓</button>
                        <button onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-900">{category}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditCategory(index)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDeleteCategory(index)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
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
                <button onClick={() => setShowPreview(!showPreview)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">{showPreview ? '预览已启用' : '预览已禁用'}</p>
            </div>

            {/* 数据迁移说明 */}
            <div className="bg-gradient-to-br from-purple-50 to-emerald-50 rounded-xl border border-purple-100 p-5">
              <h3 className="text-base font-semibold text-slate-900 mb-2">数据迁移</h3>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li>• <strong>导出</strong>：下载包含工具和本地图片的 ZIP 文件</li>
                <li>• <strong>导入</strong>：用导出的 ZIP 恢复数据到新环境</li>
                <li>• 公网图片只保存 URL，不打包</li>
                <li>• 本地上传图片和快照会一起导出</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 添加/编辑工具表单 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-slate-900">{editingId ? '编辑工具' : '添加工具'}</h3>
                  <button
                    onClick={() => { setShowForm(false); setEditingId(null); setFormData({ name: '', description: '', categories: [categories[0]], imageUrl: '', downloadLinks: [], screenshotLink: '' }); }}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAddOrUpdate(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">工具名称 *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入工具名称" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">工具简介 *</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入工具简介" rows={3} required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.categories.map((category, idx) => (
                        <span key={`${category}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
                          {category}
                          <button type="button" onClick={() => handleRemoveToolCategory(idx)} className="text-blue-500 hover:text-blue-700">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select value={newToolCategory} onChange={(e) => setNewToolCategory(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">选择分类</option>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                      <button type="button" onClick={() => { handleAddToolCategory(newToolCategory); setNewToolCategory(''); }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">添加</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">封面图</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={(formData.imageUrl || '').startsWith('data:') ? '' : formData.imageUrl}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/image.png" />
                      <button type="button" onClick={() => imageFileInputRef.current?.click()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
                        本地上传
                      </button>
                      <input ref={imageFileInputRef} type="file" accept="image/*"
                        onChange={handleImageUpload} className="hidden" />
                    </div>
                    {(formData.imageUrl || '').startsWith('data:') && (
                      <p className="text-xs text-green-600 mt-1">✓ 已选择本地图片</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">下载链接</label>
                    <div className="space-y-2 mb-3">
                      {formData.downloadLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                          <input type="text" value={formData.downloadLinkLabels?.[idx] || ''}
                            onChange={(e) => handleUpdateDownloadLinkLabel(idx, e.target.value)}
                            className="w-28 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`版本 ${idx + 1}`} />
                          <input type="url" value={link} onChange={(e) => handleUpdateDownloadLink(idx, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                          <button type="button" onClick={() => handleRemoveDownloadLink(idx)} className="text-red-600 hover:text-red-700 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <input type="text" value={newDownloadLinkLabel} onChange={(e) => setNewDownloadLinkLabel(e.target.value)}
                        className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="版本标签" />
                      <input type="url" value={newDownloadLink} onChange={(e) => setNewDownloadLink(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/download" />
                      <button type="button" onClick={handleAddDownloadLink}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">添加</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">快照链接</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={(formData.screenshotLink || '').startsWith('data:') ? '' : formData.screenshotLink || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, screenshotLink: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/screenshot.png" />
                      <button type="button" onClick={() => snapshotFileInputRef.current?.click()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
                        本地上传
                      </button>
                      <input ref={snapshotFileInputRef} type="file" accept="image/*"
                        onChange={handleSnapshotUpload} className="hidden" />
                    </div>
                    {(formData.screenshotLink || '').startsWith('data:') && (
                      <p className="text-xs text-green-600 mt-1">✓ 已选择本地图片</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button type="submit" disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2">
                      {isSaving ? (
                        <>
                          <span className="animate-spin">⟳</span>
                          {saveStatus || '保存中...'}
                        </>
                      ) : editingId ? '更新' : '添加'}
                    </button>
                    <button type="button" disabled={isSaving}
                      onClick={() => { setShowForm(false); setEditingId(null); setFormData({ name: '', description: '', categories: [categories[0]], imageUrl: '', downloadLinks: [], screenshotLink: '' }); }}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 rounded-lg transition-colors font-medium">
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
                  <button onClick={() => { setShowCategoryForm(false); setNewCategory(''); }}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">分类名称</label>
                    <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入分类名称" required />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">添加</button>
                    <button type="button" onClick={() => { setShowCategoryForm(false); setNewCategory(''); }}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium">取消</button>
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
