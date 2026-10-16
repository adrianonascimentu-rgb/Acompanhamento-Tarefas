'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { TrendingUp, Target, DollarSign, CheckCircle2 } from 'lucide-react';

interface GsapSalesProgressBarProps {
  currentRevenue: number;
  targetGoal: number;
  label?: string;
  subtitle?: string;
  isDarkMode?: boolean;
  showDetails?: boolean;
  barHeight?: string;
  colorScheme?: 'emerald' | 'blue' | 'purple' | 'amber';
  delay?: number;
}

export function GsapSalesProgressBar({
  currentRevenue,
  targetGoal,
  label,
  subtitle,
  isDarkMode = false,
  showDetails = true,
  barHeight = 'h-3',
  colorScheme = 'emerald',
  delay = 0.1,
}: GsapSalesProgressBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const revenueNumRef = useRef<HTMLSpanElement>(null);
  const targetNumRef = useRef<HTMLSpanElement>(null);
  const percentNumRef = useRef<HTMLSpanElement>(null);

  const percentage = targetGoal > 0 ? Math.min(100, Math.max(0, (currentRevenue / targetGoal) * 100)) : 0;
  const isGoalReached = targetGoal > 0 && currentRevenue >= targetGoal;

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // 1. Animate Progress Bar width from 0% to calculated percentage
      if (barRef.current) {
        gsap.fromTo(
          barRef.current,
          { width: '0%', opacity: 0 },
          {
            width: `${percentage}%`,
            opacity: 1,
            duration: 1.4,
            delay,
            ease: 'power3.out',
          }
        );
      }

      // 2. Animate Count-up for Revenue Number
      if (revenueNumRef.current) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: currentRevenue,
          duration: 1.4,
          delay,
          ease: 'power3.out',
          onUpdate: () => {
            if (revenueNumRef.current) {
              revenueNumRef.current.textContent = `R$ ${Math.round(obj.val).toLocaleString('pt-BR')}`;
            }
          },
        });
      }

      // 3. Animate Count-up for Target Goal Number
      if (targetNumRef.current) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: targetGoal,
          duration: 1.2,
          delay,
          ease: 'power3.out',
          onUpdate: () => {
            if (targetNumRef.current) {
              targetNumRef.current.textContent = `R$ ${Math.round(obj.val).toLocaleString('pt-BR')}`;
            }
          },
        });
      }

      // 4. Animate Percentage text count-up
      if (percentNumRef.current) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: percentage,
          duration: 1.4,
          delay,
          ease: 'power3.out',
          onUpdate: () => {
            if (percentNumRef.current) {
              percentNumRef.current.textContent = `${obj.val.toFixed(1)}%`;
            }
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [currentRevenue, targetGoal, percentage, delay]);

  const getColorClasses = () => {
    switch (colorScheme) {
      case 'blue':
        return {
          barBg: 'bg-gradient-to-r from-blue-600 to-cyan-500',
          glow: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
          badgeBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
          textColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'purple':
        return {
          barBg: 'bg-gradient-to-r from-purple-600 to-indigo-500',
          glow: 'shadow-[0_0_12px_rgba(147,51,234,0.6)]',
          badgeBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300',
          textColor: 'text-purple-600 dark:text-purple-400',
        };
      case 'amber':
        return {
          barBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
          glow: 'shadow-[0_0_12px_rgba(245,158,11,0.6)]',
          badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
          textColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'emerald':
      default:
        return {
          barBg: 'bg-gradient-to-r from-emerald-500 to-teal-400',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
          badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
          textColor: 'text-emerald-600 dark:text-emerald-400',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div ref={containerRef} className="w-full space-y-2.5">
      {/* Header Info */}
      {(label || showDetails) && (
        <div className="flex items-center justify-between gap-2">
          <div>
            {label && (
              <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {label}
              </h4>
            )}
            {subtitle && (
              <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              ref={percentNumRef}
              className={`px-2 py-0.5 rounded-full text-xs font-black tabular-nums ${colors.badgeBg}`}
            >
              0.0%
            </span>
            {isGoalReached && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} />
                Meta atingida!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar Container */}
      <div
        className={`w-full ${barHeight} rounded-full overflow-hidden relative ${
          isDarkMode ? 'bg-slate-800/90 border border-slate-700/50' : 'bg-slate-100 border border-slate-200/60'
        }`}
      >
        <div
          ref={barRef}
          className={`h-full rounded-full transition-none relative ${colors.barBg} ${colors.glow}`}
          style={{ width: '0%' }}
        >
          {/* Light shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse opacity-60" />
        </div>
      </div>

      {/* Details Row */}
      {showDetails && (
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Receita:</span>
            <span ref={revenueNumRef} className={`font-black tabular-nums ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              R$ 0
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Meta:</span>
            <span ref={targetNumRef} className="font-bold tabular-nums text-slate-600 dark:text-slate-300">
              R$ 0
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
