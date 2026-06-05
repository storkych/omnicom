'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/inbox' : '/login');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center text-slate-500">
      Загрузка…
    </div>
  );
}
