'use client';

import { use } from 'react';
import ToolDetail from '@/app/components/ToolDetail';

export default function ToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ToolDetail toolId={id} />;
}
