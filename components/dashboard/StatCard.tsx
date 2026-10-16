'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: string;
  href: string;
  isActive: boolean;
  isDarkMode?: boolean;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  icon: Icon, 
  href, 
  isActive 
}) => {
  return (
    <Link 
      href={href}
      className={`group flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border transition-all duration-150 text-left ${
        isActive 
          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500/80 ring-1 ring-blue-500/40 shadow-xs' 
          : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-950/60 dark:group-hover:text-blue-400 transition-colors">
          <Icon size={15} />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
          {label}
        </span>
      </div>
      <p className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none shrink-0 ml-2">
        {value}
      </p>
    </Link>
  );
};
