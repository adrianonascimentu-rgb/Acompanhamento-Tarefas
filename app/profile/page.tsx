'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/hooks/useRole';

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useRole();

  useEffect(() => {
    if (!isLoading) {
      if (user?.id) {
        router.replace(`/collaborators/${user.id}`);
      } else {
        router.replace('/');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
