'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import ToolDetail from '@/app/components/ToolDetail';

export default function ToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';
  
  console.log('ToolPage received id:', id, 'isAdmin:', isAdmin);
  return <ToolDetail toolId={id} isAdmin={isAdmin} />;
}
