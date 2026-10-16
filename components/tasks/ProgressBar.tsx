'use client';
import React, { useRef } from 'react';
import { motion } from 'motion/react';

interface Props {
  progress: number;
  onUpdate: (progress: number) => void;
  isDarkMode: boolean;
  className?: string;
}

export const ProgressBar = ({ progress, onUpdate, isDarkMode, className = "w-full h-2.5" }: Props) => {
  const barRef = useRef<HTMLDivElement>(null);

  const handleInteraction = (clientX: number) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    onUpdate(percentage);
  };

  return (
    <div 
      ref={barRef}
      className={`${className} rounded-full overflow-hidden cursor-pointer relative ${isDarkMode ? 'bg-slate-800 ring-1 ring-inset ring-slate-700/50' : 'bg-slate-100 ring-1 ring-inset ring-slate-200/50'} shadow-inner`}
      onMouseDown={(e) => handleInteraction(e.clientX)}
      onMouseMove={(e) => e.buttons === 1 && handleInteraction(e.clientX)}
      onTouchMove={(e) => handleInteraction(e.touches[0].clientX)}
    >
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className={`h-full relative ${
          progress === 100 
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
            : progress > 75
            ? 'bg-gradient-to-r from-blue-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
            : progress > 25
            ? 'bg-gradient-to-r from-sky-400 to-blue-500 shadow-[0_0_8px_rgba(56,187,248,0.3)]'
            : 'bg-gradient-to-r from-slate-400 to-sky-400'
        }`} 
      >
        <div className="absolute inset-0 bg-white/20 animate-pulse" />
      </motion.div>
      
      {/* Visual Segments Overlay */}
      <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none opacity-40">
        {[25, 50, 75].map(step => (
          <div key={step} className={`w-0.5 h-1.5 rounded-full ${progress >= step ? 'bg-white' : (isDarkMode ? 'bg-slate-600' : 'bg-slate-300')} z-10`} />
        ))}
      </div>
    </div>
  );
};
