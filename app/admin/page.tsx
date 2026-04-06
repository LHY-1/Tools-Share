import { Suspense } from 'react';
import AdminPage from '../components/AdminPage';

export default function AdminRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">加载中...</div>}>
      <AdminPage />
    </Suspense>
  );
}
