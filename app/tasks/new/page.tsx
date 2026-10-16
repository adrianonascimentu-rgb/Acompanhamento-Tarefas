import React, { Suspense } from 'react';
import CreateTaskForm from '@/components/tasks/CreateTaskForm';

export const dynamic = 'force-dynamic';

export default function CreateTaskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <CreateTaskForm />
    </Suspense>
  );
}
