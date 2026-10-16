import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  className?: string;
}

export const DATE_FILTER_OPTIONS = [
  'Todas as Datas',
  'Hoje',
  'Amanhã',
  'Esta semana',
  'Semana passada',
  'Próxima semana',
  'Este mês',
  'Mês passado',
  'Este ano',
  'Atrasadas',
  'Vencendo em Breve'
];

export function DateFilterSelect({ value, onChange, isDarkMode, className = '' }: DateFilterSelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-10 pl-9 pr-8 rounded-xl text-xs font-bold appearance-none outline-none border transition-all ${
          value !== 'Todas as Datas'
            ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20'
            : isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-600'
            : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600 shadow-sm'
        }`}
      >
        {DATE_FILTER_OPTIONS.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${value !== 'Todas as Datas' ? 'text-white' : 'text-slate-400'}`}>
        <Calendar size={16} />
      </div>
      <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${value !== 'Todas as Datas' ? 'text-white' : 'text-slate-400'}`}>
        <ChevronDown size={16} />
      </div>
    </div>
  );
}
