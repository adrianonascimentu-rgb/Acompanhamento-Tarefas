'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface CompletionFeedbackProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export const CompletionFeedback: React.FC<CompletionFeedbackProps> = ({ isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none rounded-xl bg-emerald-500/10 backdrop-blur-[1px]"
        >
          {/* Main Success Ring */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
            className="bg-white dark:bg-slate-900 size-16 rounded-full shadow-2xl flex items-center justify-center border-4 border-emerald-500"
          >
            <CheckCircle2 size={32} className="text-emerald-500" />
          </motion.div>

          {/* Particles/Sparkles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{ 
                scale: [0, 1, 0], 
                x: Math.cos(i * 60 * (Math.PI / 180)) * 60,
                y: Math.sin(i * 60 * (Math.PI / 180)) * 60,
              }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="absolute text-amber-400"
            >
              <Sparkles size={16} fill="currentColor" />
            </motion.div>
          ))}

          {/* Success Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 1, 0], y: -40 }}
            transition={{ duration: 1.5, delay: 0.3 }}
            className="absolute flex flex-col items-center gap-1"
          >
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest whitespace-nowrap">
              Tarefa Concluída!
            </span>
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-amber-500 font-black text-lg drop-shadow-md"
            >
              +100 XP
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
