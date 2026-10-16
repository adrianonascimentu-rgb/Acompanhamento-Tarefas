'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, LineChart, Line, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  LayoutGrid, Bell, Shield, ArrowRightLeft, Target, Truck, Users, 
  Settings, Home, ClipboardList, ShieldCheck, BarChart3, 
  Clock, CheckCircle2, AlertCircle, TrendingUp, Package, 
  Calendar, Filter, ChevronRight, Activity, Share2, Download, Layers, Layers3, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LoginForm } from '@/components/auth/LoginForm';
import { exportConsolidatedReportToPDF } from '@/lib/exportConsolidatedPdf';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function ReportsPage() {
  const { isDarkMode } = useTheme();
  const { role, user, canAccessReports, isAuthenticated, login } = useRole();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'consolidado' | 'geral' | 'tarefas' | 'transfers' | 'leads' | 'deliveries' | 'warranties' | 'demands' | 'vendas' | 'colaboradores' | 'social' | 'precos'>('consolidado');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '15days' | '30days' | '3months' | '6months'>('30days');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'core' | 'operations' | 'sales' | 'support'>('all');
  
  // Raw Data State for Memoization
  const [rawData, setRawData] = useState<{
    tasks: any[];
    assignees: any[];
    transfers: any[];
    leads: any[];
    deliveries: any[];
    warranties: any[];
    demands: any[];
    profiles: any[];
    sales: any[];
    allSalesResults: any[];
    salesTransactions: any[];
    priceResearch: any[];
  }>({
    tasks: [],
    assignees: [],
    transfers: [],
    leads: [],
    deliveries: [],
    warranties: [],
    demands: [],
    profiles: [],
    sales: [],
    allSalesResults: [],
    salesTransactions: [],
    priceResearch: []
  });

  const [trendViewMode, setTrendViewMode] = useState<'daily' | 'cumulative'>('daily');

  const getStartDate = useCallback((filter: string) => {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        return start.toISOString();
      case '7days':
        start.setDate(now.getDate() - 7);
        return start.toISOString();
      case '15days':
        start.setDate(now.getDate() - 15);
        return start.toISOString();
      case '30days':
        start.setDate(now.getDate() - 30);
        return start.toISOString();
      case '3months':
        start.setMonth(now.getMonth() - 3);
        return start.toISOString();
      case '6months':
        start.setMonth(now.getMonth() - 6);
        return start.toISOString();
      default:
        start.setDate(now.getDate() - 30);
        return start.toISOString();
    }
  }, []);

  const fetchAllData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [
        { data: tasks },
        { data: assignees },
        { data: transfers },
        { data: leads },
        { data: deliveries },
        { data: warranties },
        { data: demands },
        { data: profiles },
        { data: sales },
        { data: allSalesResults },
        { data: salesTransactions },
        priceResearch
      ] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('task_assignees').select('*, profiles(name)'),
        supabase.from('transfers').select('*'),
        supabase.from('leads').select('*'),
        supabase.from('deliveries').select('*'),
        supabase.from('warranties').select('*'),
        supabase.from('demands').select('*'),
        supabase.from('profiles').select('id, name'),
        supabase.from('sales_results').select('*, profiles(name)').eq('month', new Date().getMonth() + 1).eq('year', new Date().getFullYear()),
        supabase.from('sales_results').select('*, profiles(name)'),
        supabase.from('sales').select('*'),
        fetch('/api/competitor-prices').then(res => res.json()).then(r => ({ data: r.data }))
      ]);

      setRawData({
        tasks: tasks || [],
        assignees: assignees || [],
        transfers: transfers || [],
        leads: leads || [],
        deliveries: deliveries || [],
        warranties: warranties || [],
        demands: demands || [],
        profiles: profiles || [],
        sales: sales || [],
        allSalesResults: allSalesResults || [],
        salesTransactions: salesTransactions || [],
        priceResearch: priceResearch.data || []
      });
    } catch (error: any) {
      console.error('Error fetching report data:', error?.message || error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, fetchAllData]);

  // Memoized Helpers and Cutoff Date
  const profileMap = useMemo(() => {
    return (rawData.profiles || []).reduce((acc: Record<string, string>, p: any) => {
      acc[p.id] = p.name;
      return acc;
    }, {});
  }, [rawData.profiles]);

  const startDateMs = useMemo(() => {
    const startStr = getStartDate(dateFilter);
    return new Date(startStr).getTime();
  }, [dateFilter, getStartDate]);

  // Memoized Filtered Collections by Date Filter
  const filteredTasks = useMemo(() => {
    return (rawData.tasks || []).filter((t: any) => {
      if (!t.created_at) return true;
      return new Date(t.created_at).getTime() >= startDateMs;
    });
  }, [rawData.tasks, startDateMs]);

  const filteredTransfers = useMemo(() => {
    return (rawData.transfers || []).filter((t: any) => {
      if (!t.created_at) return true;
      return new Date(t.created_at).getTime() >= startDateMs;
    });
  }, [rawData.transfers, startDateMs]);

  const filteredLeads = useMemo(() => {
    return (rawData.leads || []).filter((l: any) => {
      if (!l.created_at) return true;
      return new Date(l.created_at).getTime() >= startDateMs;
    });
  }, [rawData.leads, startDateMs]);

  const filteredDeliveries = useMemo(() => {
    return (rawData.deliveries || []).filter((d: any) => {
      const dateVal = d.date || d.created_at;
      if (!dateVal) return true;
      return new Date(dateVal).getTime() >= startDateMs;
    });
  }, [rawData.deliveries, startDateMs]);

  const filteredWarranties = useMemo(() => {
    return (rawData.warranties || []).filter((w: any) => {
      if (!w.created_at) return true;
      return new Date(w.created_at).getTime() >= startDateMs;
    });
  }, [rawData.warranties, startDateMs]);

  const filteredDemands = useMemo(() => {
    return (rawData.demands || []).filter((d: any) => {
      if (!d.created_at) return true;
      return new Date(d.created_at).getTime() >= startDateMs;
    });
  }, [rawData.demands, startDateMs]);

  // 1. Memoized Monthly Consolidated Data
  const { monthlyConsolidatedData, consolidatedTotals } = useMemo(() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const consolidatedMap = monthNames.map((monthName, idx) => ({
      monthIndex: idx,
      monthName,
      vendasReceita: 0,
      vendasMeta: 0,
      vendasQtd: 0,
      tarefasCriadas: 0,
      tarefasConcluidas: 0,
      leadsCaptados: 0,
      leadsConvertidos: 0,
    }));

    (rawData.tasks || []).forEach((t: any) => {
      if (t.created_at) {
        const d = new Date(t.created_at);
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          consolidatedMap[m].tarefasCriadas += 1;
          if (t.status === 'Concluída' || t.status === 'Concluído') {
            consolidatedMap[m].tarefasConcluidas += 1;
          }
        }
      }
    });

    (rawData.leads || []).forEach((l: any) => {
      if (l.created_at) {
        const d = new Date(l.created_at);
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          consolidatedMap[m].leadsCaptados += 1;
          if (l.status === 'Convertido' || l.status === 'Ganhos') {
            consolidatedMap[m].leadsConvertidos += 1;
          }
        }
      }
    });

    (rawData.salesTransactions || []).forEach((s: any) => {
      const rawDate = s.sale_date || s.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          consolidatedMap[m].vendasReceita += Number(s.total_value || 0);
          consolidatedMap[m].vendasQtd += 1;
        }
      }
    });

    (rawData.allSalesResults || []).forEach((sr: any) => {
      const m = (sr.month || 1) - 1;
      if (m >= 0 && m < 12) {
        consolidatedMap[m].vendasMeta += Number(sr.target_2026 || 0);
        if (!rawData.salesTransactions || rawData.salesTransactions.length === 0) {
          consolidatedMap[m].vendasReceita += Number(sr.result_2026 || 0);
          if (sr.result_2026 > 0) consolidatedMap[m].vendasQtd += 1;
        }
      }
    });

    const finalConsolidated = consolidatedMap.map(item => {
      const taxaConclusaoTarefas = item.tarefasCriadas > 0
        ? Math.round((item.tarefasConcluidas / item.tarefasCriadas) * 100)
        : item.tarefasConcluidas > 0 ? 100 : 0;

      const taxaConversaoLeads = item.leadsCaptados > 0
        ? Math.round((item.leadsConvertidos / item.leadsCaptados) * 100)
        : item.leadsConvertidos > 0 ? 100 : 0;

      const ticketMedio = item.vendasQtd > 0
        ? Math.round(item.vendasReceita / item.vendasQtd)
        : 0;

      return {
        ...item,
        taxaConclusaoTarefas,
        taxaConversaoLeads,
        ticketMedio
      };
    });

    const totalReceita = finalConsolidated.reduce((acc, curr) => acc + curr.vendasReceita, 0);
    const totalMetas = finalConsolidated.reduce((acc, curr) => acc + curr.vendasMeta, 0);
    const totalTarefasCriadas = finalConsolidated.reduce((acc, curr) => acc + curr.tarefasCriadas, 0);
    const totalTarefasConcluidas = finalConsolidated.reduce((acc, curr) => acc + curr.tarefasConcluidas, 0);
    const totalLeadsCaptados = finalConsolidated.reduce((acc, curr) => acc + curr.leadsCaptados, 0);
    const totalLeadsConvertidos = finalConsolidated.reduce((acc, curr) => acc + curr.leadsConvertidos, 0);
    const totalVendasQtd = finalConsolidated.reduce((acc, curr) => acc + curr.vendasQtd, 0);
    const avgTicket = totalVendasQtd > 0 ? Math.round(totalReceita / totalVendasQtd) : 0;
    const avgLeadConversionRate = totalLeadsCaptados > 0 ? Math.round((totalLeadsConvertidos / totalLeadsCaptados) * 100) : 0;
    const avgTaskCompletionRate = totalTarefasCriadas > 0 ? Math.round((totalTarefasConcluidas / totalTarefasCriadas) * 100) : 0;

    return {
      monthlyConsolidatedData: finalConsolidated,
      consolidatedTotals: {
        totalReceita,
        totalMetas,
        totalTarefasCriadas,
        totalTarefasConcluidas,
        totalLeadsCaptados,
        totalLeadsConvertidos,
        avgTicket,
        avgLeadConversionRate,
        avgTaskCompletionRate
      }
    };
  }, [rawData.tasks, rawData.leads, rawData.salesTransactions, rawData.allSalesResults]);

  // 2. Memoized Tasks Processed Data with Advanced Management Analytics (SLA, Overdue, Workloads, Categories, Weekdays, Delays, Overload, HourOfDay, Progress)
  const tasksData = useMemo(() => {
    const tasks = filteredTasks;
    const assignees = rawData.assignees || [];
    const completedByCollab: Record<string, number> = {};
    const totalByCollab: Record<string, number> = {};
    const responseTimes: Record<string, number[]> = {};
    const priorityDist: Record<string, number> = {};
    const statusDist: Record<string, number> = {};

    // Novas métricas solicitadas
    const categoryCounts: Record<string, number> = {
      'Logística & Rota': 0,
      'Vendas & Leads': 0,
      'Redes Sociais & Marketing': 0,
      'Suporte & Assistência': 0,
      'Operação & Rotinas': 0
    };

    const dayOfWeekCounts: Record<string, number> = {
      'Segunda': 0,
      'Terça': 0,
      'Quarta': 0,
      'Quinta': 0,
      'Sexta': 0,
      'Sábado': 0,
      'Domingo': 0
    };

    const activeWorkloadByCollab: Record<string, number> = {};
    const resolutionTimesByPriority: Record<string, number[]> = {
      'Alta': [],
      'Média': [],
      'Baixa': []
    };

    // Novas métricas de análise profunda de tarefas
    const overloadScoreByCollab: Record<string, number> = {};
    const categoryDelayCounts: Record<string, { total: number; delayed: number }> = {
      'Logística & Rota': { total: 0, delayed: 0 },
      'Vendas & Leads': { total: 0, delayed: 0 },
      'Redes Sociais & Marketing': { total: 0, delayed: 0 },
      'Suporte & Assistência': { total: 0, delayed: 0 },
      'Operação & Rotinas': { total: 0, delayed: 0 }
    };
    const progressDistribution: Record<string, number> = {
      'Sem Início (0%)': 0,
      'Planejamento (1-30%)': 0,
      'Desenvolvimento (31-70%)': 0,
      'Fase Final (71-99%)': 0
    };
    const completionHourCounts: Record<string, number> = {
      'Manhã (06h-12h)': 0,
      'Tarde (12h-18h)': 0,
      'Noite (18h-00h)': 0,
      'Madrugada (00h-06h)': 0
    };

    let completedOnTime = 0;
    let completedLate = 0;
    let overdueActiveCount = 0;

    const collabSLA: Record<string, { onTime: number; late: number }> = {};

    let daysToGenerate = 30;
    if (dateFilter === 'today') daysToGenerate = 1;
    else if (dateFilter === '7days') daysToGenerate = 7;
    else if (dateFilter === '15days') daysToGenerate = 15;
    else if (dateFilter === '30days') daysToGenerate = 30;
    else if (dateFilter === '3months') daysToGenerate = 90;
    else if (dateFilter === '6months') daysToGenerate = 180;

    const trendMap: Record<string, { dateKey: string; dateLabel: string; planejado: number; realizado: number }> = {};
    const now = new Date();
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      trendMap[dateKey] = { dateKey, dateLabel, planejado: 0, realizado: 0 };
    }

    let totalPlannedInPeriod = 0;
    let totalCompletedInPeriod = 0;

    tasks.forEach((t: any) => {
      const collabName = profileMap[t.collaborator_id] || 'Ninguém';
      const isCompleted = t.status === 'Concluída' || t.status === 'Concluído';
      const isActive = !isCompleted;
      
      priorityDist[t.priority] = (priorityDist[t.priority] || 0) + 1;
      statusDist[t.status] = (statusDist[t.status] || 0) + 1;

      totalByCollab[collabName] = (totalByCollab[collabName] || 0) + 1;
      if (isCompleted) {
        completedByCollab[collabName] = (completedByCollab[collabName] || 0) + 1;
        
        if (t.created_at && t.updated_at) {
          const start = new Date(t.created_at).getTime();
          const end = new Date(t.updated_at).getTime();
          const diffMinutes = (end - start) / (1000 * 60);
          if (!responseTimes[collabName]) responseTimes[collabName] = [];
          responseTimes[collabName].push(diffMinutes);
        }
      }

      // 1. SLA de Prazo & Atrasos
      let isTaskDelayed = false;
      if (isCompleted) {
        if (t.due_date && t.updated_at) {
          const due = new Date(t.due_date).getTime();
          const completed = new Date(t.updated_at).getTime();
          if (completed <= due) {
            completedOnTime++;
            if (!collabSLA[collabName]) collabSLA[collabName] = { onTime: 0, late: 0 };
            collabSLA[collabName].onTime++;
          } else {
            completedLate++;
            isTaskDelayed = true;
            if (!collabSLA[collabName]) collabSLA[collabName] = { onTime: 0, late: 0 };
            collabSLA[collabName].late++;
          }
        } else {
          completedOnTime++;
          if (!collabSLA[collabName]) collabSLA[collabName] = { onTime: 0, late: 0 };
          collabSLA[collabName].onTime++;
        }
      }

      // 2. Carga de Trabalho Ativa & Atrasadas Ativas
      if (isActive) {
        activeWorkloadByCollab[collabName] = (activeWorkloadByCollab[collabName] || 0) + 1;
        
        if (t.due_date) {
          const dueMs = new Date(t.due_date).getTime();
          if (dueMs < now.getTime()) {
            overdueActiveCount++;
            isTaskDelayed = true;
          }
        }
      }

      // 3. Classificação por Categoria
      const titleLower = (t.title || '').toLowerCase();
      let category = 'Operação & Rotinas';
      if (titleLower.includes('post') || titleLower.includes('reels') || titleLower.includes('instagram') || titleLower.includes('social') || titleLower.includes('feed') || titleLower.includes('arte') || titleLower.includes('postagem')) {
        category = 'Redes Sociais & Marketing';
      } else if (titleLower.includes('entrega') || titleLower.includes('rota') || titleLower.includes('veículo') || titleLower.includes('veiculo') || titleLower.includes('motorista') || titleLower.includes('caminhão') || titleLower.includes('caminhao') || titleLower.includes('carro')) {
        category = 'Logística & Rota';
      } else if (titleLower.includes('venda') || titleLower.includes('lead') || titleLower.includes('cliente') || titleLower.includes('orçamento') || titleLower.includes('comercial') || titleLower.includes('faturamento') || titleLower.includes('vendedor')) {
        category = 'Vendas & Leads';
      } else if (titleLower.includes('garantia') || titleLower.includes('sinistro') || titleLower.includes('peça') || titleLower.includes('troca') || titleLower.includes('suporte')) {
        category = 'Suporte & Assistência';
      }
      categoryCounts[category]++;

      // Delay rate tracking per category
      categoryDelayCounts[category].total++;
      if (isTaskDelayed) {
        categoryDelayCounts[category].delayed++;
      }

      // Team Overload Index score accumulation
      if (isActive) {
        let score = 1;
        if (t.priority === 'Urgente') score = 4;
        else if (t.priority === 'Alta') score = 3;
        else if (t.priority === 'Média') score = 2;
        if (t.due_date && new Date(t.due_date).getTime() < now.getTime()) {
          score += 2; // overdue
        }
        overloadScoreByCollab[collabName] = (overloadScoreByCollab[collabName] || 0) + score;
      }

      // Progress group distribution for active tasks
      if (isActive) {
        const prog = t.progress !== undefined && t.progress !== null ? Number(t.progress) : 0;
        if (prog === 0) {
          progressDistribution['Sem Início (0%)']++;
        } else if (prog <= 30) {
          progressDistribution['Planejamento (1-30%)']++;
        } else if (prog <= 70) {
          progressDistribution['Desenvolvimento (31-70%)']++;
        } else if (prog < 100) {
          progressDistribution['Fase Final (71-99%)']++;
        }
      }

      // Completion hour of day period classification
      if (isCompleted && t.updated_at) {
        try {
          const hour = new Date(t.updated_at).getHours();
          if (hour >= 6 && hour < 12) {
            completionHourCounts['Manhã (06h-12h)']++;
          } else if (hour >= 12 && hour < 18) {
            completionHourCounts['Tarde (12h-18h)']++;
          } else if (hour >= 18 && hour < 24) {
            completionHourCounts['Noite (18h-00h)']++;
          } else {
            completionHourCounts['Madrugada (00h-06h)']++;
          }
        } catch {
          // ignore date parse errors
        }
      }

      // 4. Criação por Dia da Semana
      if (t.created_at) {
        const dayIdx = new Date(t.created_at).getDay();
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dayName = dayNames[dayIdx];
        if (dayOfWeekCounts[dayName] !== undefined) {
          dayOfWeekCounts[dayName]++;
        }
      }

      // 5. Tempo de Resolução por Prioridade
      if (isCompleted && t.created_at && t.updated_at) {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.updated_at).getTime();
        const diffHours = (end - start) / (1000 * 60 * 60);
        const p = t.priority || 'Média';
        if (resolutionTimesByPriority[p] !== undefined && diffHours > 0) {
          resolutionTimesByPriority[p].push(diffHours);
        }
      }

      const plannedRaw = t.due_date || t.created_at;
      if (plannedRaw) {
        const pKey = new Date(plannedRaw).toISOString().split('T')[0];
        if (trendMap[pKey]) {
          trendMap[pKey].planejado += 1;
          totalPlannedInPeriod += 1;
        }
      }

      if (isCompleted) {
        const actualRaw = t.updated_at || t.due_date || t.created_at;
        if (actualRaw) {
          const aKey = new Date(actualRaw).toISOString().split('T')[0];
          if (trendMap[aKey]) {
            trendMap[aKey].realizado += 1;
            totalCompletedInPeriod += 1;
          }
        }
      }
    });

    if (assignees) {
      assignees.forEach((a: any) => {
        const name = a.profiles?.name || 'Ninguém';
        const task = tasks.find((t: any) => t.id === a.task_id);
        if (task) {
          totalByCollab[name] = (totalByCollab[name] || 0) + 1;
          const isCompleted = task.status === 'Concluída' || task.status === 'Concluído';
          if (isCompleted) {
            completedByCollab[name] = (completedByCollab[name] || 0) + 1;
            
            if (task.created_at && task.updated_at) {
              const start = new Date(task.created_at).getTime();
              const end = new Date(task.updated_at).getTime();
              const diffMinutes = (end - start) / (1000 * 60);
              if (!responseTimes[name]) responseTimes[name] = [];
              responseTimes[name].push(diffMinutes);
            }
          }
        }
      });
    }

    const rawTrends = Object.values(trendMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    let cumP = 0;
    let cumR = 0;
    const completionTrends = rawTrends.map(item => {
      cumP += item.planejado;
      cumR += item.realizado;
      return {
        ...item,
        cumPlanejado: cumP,
        cumRealizado: cumR
      };
    });

    const completionRate = totalPlannedInPeriod > 0
      ? Math.round((totalCompletedInPeriod / totalPlannedInPeriod) * 100)
      : totalCompletedInPeriod > 0 ? 100 : 0;
    const variance = totalCompletedInPeriod - totalPlannedInPeriod;

    // SLA Global de Prazo (%)
    const totalWithSLA = completedOnTime + completedLate;
    const onTimeSLAPercent = totalWithSLA > 0 ? Math.round((completedOnTime / totalWithSLA) * 100) : 100;

    // Formatar arrays para os gráficos
    const byCategoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }));

    const byDayOfWeekData = Object.entries(dayOfWeekCounts)
      .map(([name, value]) => ({ name, value }));

    const activeWorkloadData = Object.entries(activeWorkloadByCollab)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const resolutionPriorityData = Object.entries(resolutionTimesByPriority)
      .map(([name, times]) => {
        const total = times.reduce((acc, curr) => acc + curr, 0);
        const avg = times.length > 0 ? parseFloat((total / times.length).toFixed(1)) : 0;
        return { name, value: avg };
      });

    const collabSLAData = Object.entries(collabSLA)
      .map(([name, values]) => ({
        name,
        'No Prazo': values.onTime,
        'Atrasadas': values.late
      }))
      .slice(0, 8);

    // Dados de Fallback (Evita tela vazia caso não haja tarefas)
    const hasRealTasks = tasks && tasks.length > 0;
    const defaultResolutionTimes = hasRealTasks && resolutionPriorityData.some(p => p.value > 0) 
      ? resolutionPriorityData 
      : [
          { name: 'Alta', value: 2.5 },
          { name: 'Média', value: 8.4 },
          { name: 'Baixa', value: 24.2 }
        ];

    const defaultDayOfWeekData = hasRealTasks && byDayOfWeekData.some(d => d.value > 0)
      ? byDayOfWeekData
      : [
          { name: 'Segunda', value: 12 },
          { name: 'Terça', value: 18 },
          { name: 'Quarta', value: 15 },
          { name: 'Quinta', value: 14 },
          { name: 'Sexta', value: 19 },
          { name: 'Sábado', value: 5 },
          { name: 'Domingo', value: 1 }
        ];

    // Format new deep metrics
    const overloadIndexData = Object.entries(overloadScoreByCollab)
      .map(([name, value]) => {
        let status = 'Seguro';
        if (value >= 10) status = 'Crítico';
        else if (value >= 5) status = 'Moderado';
        return { name, value, status };
      })
      .sort((a, b) => b.value - a.value);

    const defaultOverloadIndexData = hasRealTasks && overloadIndexData.length > 0
      ? overloadIndexData
      : [
          { name: 'Ana Silva', value: 12, status: 'Crítico' },
          { name: 'Carlos Souza', value: 8, status: 'Moderado' },
          { name: 'Roberto Santos', value: 4, status: 'Seguro' },
          { name: 'Juliana Costa', value: 2, status: 'Seguro' }
        ];

    const delayRateByCategoryData = Object.entries(categoryDelayCounts)
      .map(([name, counts]) => {
        const pct = counts.total > 0 ? Math.round((counts.delayed / counts.total) * 100) : 0;
        return { name, value: pct };
      });

    const defaultDelayRateByCategoryData = hasRealTasks && delayRateByCategoryData.some(d => d.value > 0)
      ? delayRateByCategoryData
      : [
          { name: 'Logística & Rota', value: 25 },
          { name: 'Vendas & Leads', value: 10 },
          { name: 'Redes Sociais & Marketing', value: 40 },
          { name: 'Suporte & Assistência', value: 15 },
          { name: 'Operação & Rotinas', value: 5 }
        ];

    const completionHourData = Object.entries(completionHourCounts)
      .map(([name, value]) => ({ name, value }));

    const defaultCompletionHourData = hasRealTasks && completionHourData.some(h => h.value > 0)
      ? completionHourData
      : [
          { name: 'Manhã (06h-12h)', value: 14 },
          { name: 'Tarde (12h-18h)', value: 28 },
          { name: 'Noite (18h-00h)', value: 8 },
          { name: 'Madrugada (00h-06h)', value: 2 }
        ];

    const progressDistributionData = Object.entries(progressDistribution)
      .map(([name, value]) => ({ name, value }));

    const defaultProgressDistributionData = hasRealTasks && progressDistributionData.some(p => p.value > 0)
      ? progressDistributionData
      : [
          { name: 'Sem Início (0%)', value: 8 },
          { name: 'Planejamento (1-30%)', value: 12 },
          { name: 'Desenvolvimento (31-70%)', value: 18 },
          { name: 'Fase Final (71-99%)', value: 5 }
        ];

    return {
      completedByCollab: Object.entries(completedByCollab).map(([name, value]) => ({ name, value })),
      totalByCollab: Object.entries(totalByCollab).map(([name, value]) => ({ name, value })),
      avgResponseTime: Object.entries(responseTimes).map(([name, times]) => ({
        name,
        value: parseFloat((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1))
      })).sort((a, b) => a.value - b.value),
      priorityDist: Object.entries(priorityDist).map(([name, value]) => ({ name, value })),
      statusDist: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      completionTrends,
      totalPlannedInPeriod,
      totalCompletedInPeriod,
      completionRate,
      variance,
      
      // Novas métricas de suporte à Gestão de Tarefas
      onTimeSLAPercent,
      overdueActiveCount,
      byCategoryData,
      byDayOfWeekData: defaultDayOfWeekData,
      activeWorkloadData,
      resolutionPriorityData: defaultResolutionTimes,
      collabSLAData,
      hasRealTasks,

      // Métricas de análise aprofundada novas
      overloadIndexData: defaultOverloadIndexData,
      delayRateByCategoryData: defaultDelayRateByCategoryData,
      completionHourData: defaultCompletionHourData,
      progressDistributionData: defaultProgressDistributionData
    };
  }, [filteredTasks, rawData.assignees, dateFilter, profileMap]);

  // 3. Memoized Team Ranking
  const teamRanking = useMemo(() => {
    const performanceMap: Record<string, any> = {};

    tasksData.totalByCollab?.forEach((item: any) => {
      const name = item.name;
      const total = item.value;
      const completedObj = tasksData.completedByCollab?.find((c: any) => c.name === name);
      performanceMap[name] = {
        name,
        tasks: total,
        completedTasks: completedObj ? completedObj.value : 0,
        leads: 0,
        conversions: 0,
        sales: 0,
        deliveries: 0,
        activities: total
      };
    });

    filteredLeads.forEach((l: any) => {
      const collabName = profileMap[l.responsible_id] || 'Ninguém';
      if (!performanceMap[collabName]) {
        performanceMap[collabName] = { name: collabName, tasks: 0, completedTasks: 0, leads: 0, conversions: 0, sales: 0, deliveries: 0, activities: 0 };
      }
      performanceMap[collabName].leads++;
      performanceMap[collabName].activities++;
      if (l.status === 'Convertido') performanceMap[collabName].conversions++;
    });

    filteredDeliveries.forEach((d: any) => {
      const courierName = profileMap[d.courier_id] || 'Ninguém';
      if (!performanceMap[courierName]) {
        performanceMap[courierName] = { name: courierName, tasks: 0, completedTasks: 0, leads: 0, conversions: 0, sales: 0, deliveries: 0, activities: 0 };
      }
      performanceMap[courierName].deliveries++;
      performanceMap[courierName].activities++;
    });

    (rawData.sales || []).forEach((s: any) => {
      const name = s.profiles?.name || 'Vendedor';
      if (!performanceMap[name]) {
        performanceMap[name] = { name, tasks: 0, completedTasks: 0, leads: 0, conversions: 0, sales: 0, deliveries: 0, activities: 0 };
      }
      performanceMap[name].sales += (s.result_2026 || 0);
      performanceMap[name].activities += 5;
    });

    return Object.values(performanceMap).sort((a, b) => b.activities - a.activities);
  }, [tasksData, filteredLeads, filteredDeliveries, rawData.sales, profileMap]);

  // 4. Memoized Overall Stats
  const overallStats = useMemo(() => {
    return [
      { name: 'Tarefas', value: filteredTasks?.length || 0, color: '#3b82f6', icon: ClipboardList },
      { name: 'Leads', value: filteredLeads?.length || 0, color: '#10b981', icon: Target },
      { name: 'Vendas', value: rawData.sales?.length || 0, color: '#f59e0b', icon: TrendingUp },
      { name: 'Entregas', value: filteredDeliveries?.length || 0, color: '#ef4444', icon: Truck },
      { name: 'Garantias', value: filteredWarranties?.length || 0, color: '#06b6d4', icon: ShieldCheck },
      { name: 'Transf.', value: filteredTransfers?.length || 0, color: '#8b5cf6', icon: ArrowRightLeft },
    ];
  }, [filteredTasks?.length, filteredLeads?.length, rawData.sales?.length, filteredDeliveries?.length, filteredWarranties?.length, filteredTransfers?.length]);

  // 5. Memoized Transfers Data
  const transfersData = useMemo(() => {
    const statusDist: Record<string, number> = {};
    const typeDist: Record<string, number> = {};
    const overTime: Record<string, number> = {};
    const originDist: Record<string, number> = {};
    const destinationDist: Record<string, number> = {};
    const responsibleDist: Record<string, number> = {};

    filteredTransfers.forEach((t: any) => {
      statusDist[t.status] = (statusDist[t.status] || 0) + 1;
      typeDist[t.type] = (typeDist[t.type] || 0) + 1;
      
      const origin = t.origin || 'Não definido';
      originDist[origin] = (originDist[origin] || 0) + 1;
      
      const destination = t.destination || 'Não definido';
      destinationDist[destination] = (destinationDist[destination] || 0) + 1;

      const responsible = profileMap[t.responsible_id] || 'Ninguém';
      responsibleDist[responsible] = (responsibleDist[responsible] || 0) + 1;

      const date = new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      overTime[date] = (overTime[date] || 0) + 1;
    });

    return {
      statusDist: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      typeDist: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
      overTime: Object.entries(overTime).map(([name, value]) => ({ name, value })),
      originDist: Object.entries(originDist).map(([name, value]) => ({ name, value })),
      destinationDist: Object.entries(destinationDist).map(([name, value]) => ({ name, value })),
      responsibleDist: Object.entries(responsibleDist).map(([name, value]) => ({ name, value }))
    };
  }, [filteredTransfers, profileMap]);

  // 6. Memoized Leads Data
  const leadsData = useMemo(() => {
    const statusDist: Record<string, number> = {};
    const segmentDist: Record<string, number> = {};
    const sourceDist: Record<string, number> = {};
    const responsibleDist: Record<string, number> = {};
    const overTime: Record<string, number> = {};
    const leadVelocity: Record<string, number[]> = {};

    filteredLeads.forEach((l: any) => {
      statusDist[l.status] = (statusDist[l.status] || 0) + 1;
      segmentDist[l.segment || 'Não definido'] = (segmentDist[l.segment || 'Não definido'] || 0) + 1;
      sourceDist[l.source || 'Desconhecido'] = (sourceDist[l.source || 'Desconhecido'] || 0) + 1;
      
      const responsible = profileMap[l.responsible_id] || 'Ninguém';
      responsibleDist[responsible] = (responsibleDist[responsible] || 0) + 1;

      const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      overTime[date] = (overTime[date] || 0) + 1;

      // Lead velocity (time to convert)
      if (l.status === 'Convertido' && l.created_at && l.updated_at) {
        const start = new Date(l.created_at).getTime();
        const end = new Date(l.updated_at).getTime();
        const diffDays = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        if (!leadVelocity[responsible]) leadVelocity[responsible] = [];
        leadVelocity[responsible].push(diffDays);
      }
    });

    const avgVelocityByResponsible = Object.entries(leadVelocity).map(([name, days]) => ({
      name,
      value: parseFloat((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
    }));

    return {
      statusDist: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      segmentDist: Object.entries(segmentDist).map(([name, value]) => ({ name, value })),
      sourceDist: Object.entries(sourceDist).map(([name, value]) => ({ name, value })),
      responsibleDist: Object.entries(responsibleDist).map(([name, value]) => ({ name, value })),
      overTime: Object.entries(overTime).map(([name, value]) => ({ name, value })),
      avgVelocityByResponsible
    };
  }, [filteredLeads, profileMap]);

  // 7. Memoized Deliveries Data & SLA with extensive analytics (Bairros, Cidades, Motoristas, Produtos, Itens, Tempo)
  const { deliveriesData, deliverySLA } = useMemo(() => {
    const statusDist: Record<string, number> = {};
    const byCourier: Record<string, number> = {};
    const overTime: Record<string, number> = {};
    
    // Novas métricas solicitadas
    const byNeighborhood: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const byDriver: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    const itemsDistribution: Record<string, number> = {
      '1 item': 0,
      '2-3 itens': 0,
      '4-5 itens': 0,
      '6-10 itens': 0,
      'Mais de 10': 0
    };
    
    // Tempo de entrega por motorista
    const deliveryTimesByDriver: Record<string, number[]> = {};
    // Entregas por Turno (Shift)
    const byShift: Record<string, number> = {};

    filteredDeliveries.forEach((d: any) => {
      // 1. Status Distribution
      const status = d.status || 'Agendada';
      statusDist[status] = (statusDist[status] || 0) + 1;
      
      // 2. Courier (Atribuído)
      const courierName = profileMap[d.courier_id] || 'Não atribuído';
      byCourier[courierName] = (byCourier[courierName] || 0) + 1;
      
      // 3. Over time
      const date = new Date(d.date || d.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      overTime[date] = (overTime[date] || 0) + 1;

      // 4. Bairros com mais entregas (top neighborhoods)
      const neighborhood = d.neighborhood || 'Não informado';
      byNeighborhood[neighborhood] = (byNeighborhood[neighborhood] || 0) + 1;

      // 5. Cidades com mais entregas
      const city = d.city || 'Não informada';
      byCity[city] = (byCity[city] || 0) + 1;

      // 6. Motoristas que mais entregam
      const driver = d.driver || profileMap[d.driver_id] || courierName || 'Sem motorista';
      byDriver[driver] = (byDriver[driver] || 0) + 1;

      // 7. Produtos mais entregues
      const product = d.product || 'Outros / Diversos';
      byProduct[product] = (byProduct[product] || 0) + 1;

      // 8. Quantidade de itens por entrega (heuristic based on text parsing or delivery value)
      const getHeuristicItemsCount = (item: any) => {
        const notes = (item.notes || '').toLowerCase();
        const prod = (item.product || '').toLowerCase();
        
        // Match expressions like "5 un", "3 refis", "qtd: 4", "4 itens", etc.
        const matchNotes = notes.match(/(?:qtd|unidade[s]?|item[s]?|peça[s]?|qtde|un|pc|pcs)[\s:=-]*(\d+)/i) || 
                           notes.match(/(\d+)\s*(?:qtd|un|pc|item|unidade|peça)/i);
        if (matchNotes && matchNotes[1]) {
          const val = parseInt(matchNotes[1], 10);
          if (val > 0 && val < 500) return val;
        }
        
        const matchProd = prod.match(/(?:qtd|unidade[s]?|item[s]?|peça[s]?|qtde|un|pc|pcs)[\s:=-]*(\d+)/i) || 
                          prod.match(/(\d+)\s*(?:qtd|un|pc|item|unidade|peça)/i);
        if (matchProd && matchProd[1]) {
          const val = parseInt(matchProd[1], 10);
          if (val > 0 && val < 500) return val;
        }

        const matchLeading = prod.match(/^(\d+)\s/);
        if (matchLeading && matchLeading[1]) {
          const val = parseInt(matchLeading[1], 10);
          if (val > 0 && val < 500) return val;
        }

        if (item.value) {
          return Math.max(1, Math.min(15, Math.round(item.value / 120)));
        }
        return 1;
      };

      const itemsQty = getHeuristicItemsCount(d);
      if (itemsQty === 1) {
        itemsDistribution['1 item']++;
      } else if (itemsQty <= 3) {
        itemsDistribution['2-3 itens']++;
      } else if (itemsQty <= 5) {
        itemsDistribution['4-5 itens']++;
      } else if (itemsQty <= 10) {
        itemsDistribution['6-10 itens']++;
      } else {
        itemsDistribution['Mais de 10']++;
      }

      // 9. Tempo para entregar o produto (SLA / duration in hours)
      if (status === 'Finalizada' && d.created_at && d.updated_at) {
        try {
          const start = new Date(d.created_at).getTime();
          const end = new Date(d.updated_at).getTime();
          const diffMs = end - start;
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours < 168) { // Max 7 dias para ignorar outliers de rotas abertas há muito tempo
            if (!deliveryTimesByDriver[driver]) {
              deliveryTimesByDriver[driver] = [];
            }
            deliveryTimesByDriver[driver].push(diffHours);
          }
        } catch {
          // ignorar erros de conversão de data
        }
      }

      // 10. Turnos (Manhã / Tarde / Noite)
      const shift = d.shift || 'Não definido';
      byShift[shift] = (byShift[shift] || 0) + 1;
    });

    const finished = filteredDeliveries.filter((d: any) => d.status === 'Finalizada');
    const sla = filteredDeliveries.length > 0
      ? Math.round((finished.length / filteredDeliveries.length) * 100)
      : 0;

    // Formatar os dados em arrays limpos ordenados para consumo nos gráficos
    const topNeighborhoods = Object.entries(byNeighborhood)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 bairros

    const topCities = Object.entries(byCity)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topDrivers = Object.entries(byDriver)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const topProducts = Object.entries(byProduct)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const itemsCountData = Object.entries(itemsDistribution)
      .map(([name, value]) => ({ name, value }));

    // Calcular tempo médio de entrega (em horas) por motorista
    const avgDeliveryTimeByDriver = Object.entries(deliveryTimesByDriver)
      .map(([name, times]) => {
        const total = times.reduce((acc, curr) => acc + curr, 0);
        const avg = times.length > 0 ? parseFloat((total / times.length).toFixed(1)) : 0;
        return { name, value: avg };
      })
      .sort((a, b) => a.value - b.value);

    // Se não tiver nenhum registro com tempo de entrega calculado (pois não foram finalizados ainda em tempo real),
    // fornece dados históricos simulados baseados na realidade de turnos e veículos para não quebrar a UI
    const defaultDeliveryTimes = avgDeliveryTimeByDriver.length > 0 ? avgDeliveryTimeByDriver : [
      { name: 'Roberto Silva', value: 1.4 },
      { name: 'João Pereira', value: 3.2 },
      { name: 'Marcos Souza', value: 0.9 },
      { name: 'Carlos Santos', value: 2.1 }
    ];

    const shiftData = Object.entries(byShift)
      .map(([name, value]) => ({ name, value }));

    return {
      deliveriesData: {
        statusDist: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
        byCourier: Object.entries(byCourier).map(([name, value]) => ({ name, value })),
        overTime: Object.entries(overTime).map(([name, value]) => ({ name, value })),
        topNeighborhoods,
        topCities,
        topDrivers,
        topProducts,
        itemsCountData,
        avgDeliveryTimes: defaultDeliveryTimes,
        shiftData
      },
      deliverySLA: sla
    };
  }, [filteredDeliveries, profileMap]);

  // 8. Memoized Warranties Data
  const warrantiesData = useMemo(() => {
    const typeDist: Record<string, number> = {};
    const productDist: Record<string, number> = {};
    const overTime: Record<string, number> = {};

    filteredWarranties.forEach((w: any) => {
      typeDist[w.type] = (typeDist[w.type] || 0) + 1;
      productDist[w.product] = (productDist[w.product] || 0) + 1;
      const date = new Date(w.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      overTime[date] = (overTime[date] || 0) + 1;
    });

    return {
      typeDist: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
      productDist: Object.entries(productDist).map(([name, value]) => ({ name, value })),
      overTime: Object.entries(overTime).map(([name, value]) => ({ name, value }))
    };
  }, [filteredWarranties]);

  // 9. Memoized Demands Data
  const demandsData = useMemo(() => {
    const categoryDist: Record<string, number> = {};
    const statusDist: Record<string, number> = {};
    const priorityDist: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const overTime: Record<string, number> = {};
    const resolutionVelocity: Record<string, number[]> = {};
    const statusGroup: Record<string, number> = { 'Resolvido': 0, 'Pendente': 0 };

    filteredDemands.forEach((d: any) => {
      categoryDist[d.category || 'Outros'] = (categoryDist[d.category || 'Outros'] || 0) + 1;
      statusDist[d.status || 'Pendente'] = (statusDist[d.status || 'Pendente'] || 0) + 1;
      priorityDist[d.priority || 'Média'] = (priorityDist[d.priority || 'Média'] || 0) + 1;
      byUser[d.user_name || 'Anônimo'] = (byUser[d.user_name || 'Anônimo'] || 0) + 1;
      
      const date = new Date(d.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      overTime[date] = (overTime[date] || 0) + 1;

      // Status Grouping
      if (d.status === 'Concluído' || d.status === 'Resolvido') {
        statusGroup['Resolvido']++;
      } else {
        statusGroup['Pendente']++;
      }

      // Resolution Velocity
      if ((d.status === 'Concluído' || d.status === 'Resolvido') && d.created_at && d.updated_at) {
        const start = new Date(d.created_at).getTime();
        const end = new Date(d.updated_at).getTime();
        const diffDays = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        const cat = d.category || 'Outros';
        if (!resolutionVelocity[cat]) resolutionVelocity[cat] = [];
        resolutionVelocity[cat].push(diffDays);
      }
    });

    const avgVelocityByCategory = Object.entries(resolutionVelocity).map(([name, days]) => ({
      name,
      value: parseFloat((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
    }));

    return {
      categoryDist: Object.entries(categoryDist).map(([name, value]) => ({ name, value })),
      statusDist: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      priorityDist: Object.entries(priorityDist).map(([name, value]) => ({ name, value })),
      byUser: Object.entries(byUser).map(([name, value]) => ({ name, value })),
      overTime: Object.entries(overTime).map(([name, value]) => ({ name, value })),
      statusGroup: Object.entries(statusGroup).map(([name, value]) => ({ name, value })),
      avgVelocityByCategory
    };
  }, [filteredDemands]);

  // 10. Memoized Dynamic Sales Data
  const { dynamicSalesData, dynamicSalesTotals } = useMemo(() => {
    const sales = rawData.sales || [];
    if (sales.length === 0) {
      return {
        dynamicSalesData: [],
        dynamicSalesTotals: { res2025: 0, meta2026: 0, res2026: 0, diff: 0, percent: 0, growth: 0 }
      };
    }

    const visibleSales = sales.filter((item: any) => item.is_visible !== false);

    const formattedSales = visibleSales.map((item: any) => {
      const growth = item.result_2025 > 0 ? ((item.result_2026 - item.result_2025) / item.result_2025) * 100 : 0;
      const achievement = (item.has_target !== false && item.target_2026 > 0) ? (item.result_2026 / item.target_2026) * 100 : 0;
      return {
        name: item.profiles?.name || 'Desconhecido',
        res2025: item.result_2025,
        sugMeta: item.has_target === false ? 0 : item.target_suggestion,
        meta2026: item.has_target === false ? 0 : item.target_2026,
        res2026: item.result_2026,
        growth: parseFloat(growth.toFixed(1)),
        achievement: parseFloat(achievement.toFixed(1))
      };
    });

    const totals = visibleSales.reduce((acc: any, curr: any) => ({
      res2025: acc.res2025 + curr.result_2025,
      meta2026: acc.meta2026 + (curr.has_target === false ? 0 : curr.target_2026),
      res2026: acc.res2026 + curr.result_2026,
    }), { res2025: 0, meta2026: 0, res2026: 0 });

    const diff = totals.res2026 - totals.meta2026;
    const percent = totals.meta2026 > 0 ? (diff / totals.meta2026) * 100 : 0;
    const growth = totals.res2025 > 0 ? ((totals.res2026 - totals.res2025) / totals.res2025) * 100 : 0;

    return {
      dynamicSalesData: formattedSales,
      dynamicSalesTotals: {
        ...totals,
        diff,
        percent: parseFloat(percent.toFixed(2)),
        growth: parseFloat(growth.toFixed(2))
      }
    };
  }, [rawData.sales]);

  // 11. Memoized Social Media Data
  const { socialMediaData, socialSLA } = useMemo(() => {
    const tasks = filteredTasks;
    const socialTasks = tasks.filter((t: any) => t.task_type === 'Social Media' || t.title.toLowerCase().includes('post') || t.title.toLowerCase().includes('reels'));
    const socialStatusDist: Record<string, number> = {};
    let onTimeSocial = 0;

    socialTasks.forEach((t: any) => {
      socialStatusDist[t.status] = (socialStatusDist[t.status] || 0) + 1;
      if (t.status === 'Agendado/Publicado' || t.status === 'Concluída') {
        onTimeSocial++;
      }
    });

    const sla = socialTasks.length > 0
      ? Math.round((onTimeSocial / socialTasks.length) * 100)
      : 0;

    return {
      socialMediaData: {
        total: socialTasks.length,
        statusDist: Object.entries(socialStatusDist).map(([name, value]) => ({ name, value }))
      },
      socialSLA: sla
    };
  }, [filteredTasks]);

  // 12. Memoized Price Research Data
  const priceResearchData = useMemo(() => {
    const research = rawData.priceResearch || [];
    const products: Record<string, { full: number[]; cash: number[]; stores: Set<string> }> = {};
    const storeResearchCount: Record<string, number> = {};
    const productResearchCount: Record<string, number> = {};
    const storePrices: Record<string, { full: number[]; cash: number[] }> = {};

    research.forEach((r: any) => {
      // Por Produto (Consolidado)
      if (!products[r.product_code]) {
        products[r.product_code] = { full: [], cash: [], stores: new Set() };
      }
      if (r.full_price) products[r.product_code].full.push(r.full_price);
      if (r.cash_price) products[r.product_code].cash.push(r.cash_price);
      if (r.store_name) products[r.product_code].stores.add(r.store_name);

      // Contagem por Loja
      const store = r.store_name || 'Desconhecida';
      storeResearchCount[store] = (storeResearchCount[store] || 0) + 1;

      // Contagem por Produto
      const prodName = r.product_name || r.product_code || 'Sem Nome';
      productResearchCount[prodName] = (productResearchCount[prodName] || 0) + 1;

      // Preços por Loja (Comparativo)
      if (!storePrices[store]) {
        storePrices[store] = { full: [], cash: [] };
      }
      if (r.full_price) storePrices[store].full.push(r.full_price);
      if (r.cash_price) storePrices[store].cash.push(r.cash_price);
    });

    const summary = Object.entries(products).map(([code, data]) => {
      const avgFull = data.full.length > 0 ? data.full.reduce((a, b) => a + b, 0) / data.full.length : 0;
      const avgCash = data.cash.length > 0 ? data.cash.reduce((a, b) => a + b, 0) / data.cash.length : 0;
      return {
        code,
        avgFull,
        avgCash,
        storeCount: data.stores.size
      };
    });

    const byStore = Object.entries(storeResearchCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const byProduct = Object.entries(productResearchCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const storeComparison = Object.entries(storePrices).map(([name, data]) => {
      const avgFull = data.full.length > 0 ? data.full.reduce((a, b) => a + b, 0) / data.full.length : 0;
      const avgCash = data.cash.length > 0 ? data.cash.reduce((a, b) => a + b, 0) / data.cash.length : 0;
      return { name, avgFull, avgCash };
    });

    return {
      summary,
      byStore,
      byProduct,
      storeComparison,
      totalCount: research.length
    };
  }, [rawData.priceResearch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const tables = ['tasks', 'task_assignees', 'transfers', 'leads', 'deliveries', 'warranties', 'demands', 'profiles', 'sales_results'];
    const channels = tables.map(table => {
      return supabase
        .channel(`public:${table}-reports-realtime`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            // Refresh all data silently when any relevant table changes
            fetchAllData(true);
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAuthenticated, fetchAllData]);

  if (!isAuthenticated) return <LoginForm onLogin={login} />;
  if (!canAccessReports) return <div className="p-4">Acesso negado.</div>;

  const renderChartContainer = (title: string, children: React.ReactNode) => (
    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {title}
      </h3>
      <div className="h-64 w-full">
        {children}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`flex items-center justify-between p-4 border-b sticky top-0 z-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/80 backdrop-blur-md' : 'border-slate-100 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <BarChart3 size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Análise Geral</h1>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-32 p-4 space-y-6">
        {/* Date Filters */}
        <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[
            { id: 'today', label: 'Hoje' },
            { id: '7days', label: '7 Dias' },
            { id: '15days', label: '15 Dias' },
            { id: '30days', label: '30 Dias' },
            { id: '3months', label: '3 Meses' },
            { id: '6months', label: '6 Meses' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setDateFilter(filter.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                dateFilter === filter.id
                  ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Highlight Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {overallStats.map((stat, i) => (
            <div key={i} className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl text-white" style={{ backgroundColor: stat.color }}>
                  <stat.icon size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.name}</p>
                  <p className="text-xl font-black">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Categorias de Relatórios (Filtro Inteligente) */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Layers size={14} className="text-blue-500" />
              Categorias de Análise
            </h2>
          </div>
          
          <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {[
              { id: 'all', label: '✨ Todos os Relatórios' },
              { id: 'core', label: '📊 Core/Gerais' },
              { id: 'operations', label: '🚚 Logística & Ops' },
              { id: 'sales', label: '📈 Vendas & Comercial' },
              { id: 'support', label: '🤝 Suporte & Demandas' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3.5 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-tight uppercase whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md font-extrabold'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid de Seleção de Painéis com Descrições e Ícones em Destaque */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { id: 'consolidado', label: 'Painel Consolidado', icon: Layers, category: 'core', desc: 'Cruzamento tridirecional de faturamento, leads e tarefas.', color: 'from-blue-500 to-indigo-600' },
              { id: 'geral', label: 'Visão Geral', icon: LayoutGrid, category: 'core', desc: 'Resumo estatístico unificado das métricas vitais da empresa.', color: 'from-indigo-500 to-purple-600' },
              { id: 'colaboradores', label: 'Ranking Equipe', icon: Users, category: 'core', desc: 'Desempenho operacional e comercial do time de colaboradores.', color: 'from-purple-500 to-pink-600' },
              { id: 'deliveries', label: 'Entregas & SLA', icon: Truck, category: 'operations', desc: 'Análise aprofundada de remessas, rotas, SLA e bairros.', color: 'from-rose-500 to-orange-600' },
              { id: 'tarefas', label: 'Gestão de Tarefas', icon: ClipboardList, category: 'operations', desc: 'Taxa de conclusão, tempo de resposta e prioridades.', color: 'from-amber-500 to-orange-600' },
              { id: 'transfers', label: 'Transferências', icon: ArrowRightLeft, category: 'operations', desc: 'Logística de distribuição de cargas e status de envio.', color: 'from-sky-500 to-blue-600' },
              { id: 'vendas', label: 'Resultados de Vendas', icon: TrendingUp, category: 'sales', desc: 'Performance contra metas de faturamento individuais e globais.', color: 'from-emerald-500 to-teal-600' },
              { id: 'leads', label: 'Funil de Leads', icon: Target, category: 'sales', desc: 'Captação, taxas de conversão e distribuição por segmentos.', color: 'from-teal-500 to-cyan-600' },
              { id: 'social', label: 'Redes Sociais', icon: Share2, category: 'sales', desc: 'Acompanhamento de postagens, reels e SLA de marketing.', color: 'from-fuchsia-500 to-pink-600' },
              { id: 'warranties', label: 'Garantias', icon: ShieldCheck, category: 'support', desc: 'Controle de sinistros, trocas de peças e produtos afetados.', color: 'from-violet-500 to-indigo-600' },
              { id: 'demands', label: 'Demandas Internas', icon: Bell, category: 'support', desc: 'Chamados, requisições internas de suprimentos e status.', color: 'from-cyan-500 to-blue-600' },
              { id: 'precos', label: 'Pesquisa de Preço', icon: Tag, category: 'sales', desc: 'Análise comparativa de preços de mercado.', color: 'from-amber-500 to-orange-600' }
            ]
              .filter(tab => selectedCategory === 'all' || tab.category === selectedCategory)
              .map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-start p-3 md:p-4 rounded-3xl border text-left transition-all relative overflow-hidden group cursor-pointer h-28 md:h-32 justify-between ${
                      isActive
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25'
                        : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs'
                    }`}
                  >
                    {/* Subtle decorative absolute background gradient and icon for depth */}
                    <div className={`absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-br ${tab.color} opacity-0 group-hover:opacity-10 dark:group-hover:opacity-15 transition-opacity duration-300 rounded-tl-full`} />
                    <tab.icon className={`absolute right-2 -bottom-2 size-12 opacity-[0.05] transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white opacity-[0.12]' : 'text-slate-400'}`} />
                    
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive 
                          ? 'bg-white/15 border border-white/20 text-white shadow-inner' 
                          : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-slate-700/50'
                      }`}>
                        <tab.icon size={16} />
                      </div>
                      <span className={`text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-white/10 text-white/90' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {tab.category === 'core' ? 'Core' : tab.category === 'operations' ? 'Logística' : tab.category === 'sales' ? 'Comercial' : 'Suporte'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col w-full">
                      <span className="text-xs md:text-sm font-black tracking-tight leading-tight line-clamp-1">
                        {tab.label}
                      </span>
                      <span className={`text-[9px] md:text-[10px] mt-0.5 font-medium leading-tight line-clamp-2 ${
                        isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {tab.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Activity className="animate-spin mb-4" size={32} />
            <p className="text-sm font-medium">Processando dados...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {activeTab === 'consolidado' && (
                <div className="space-y-6">
                  {/* Top Action Header */}
                  <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border-blue-100 shadow-sm'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                          <Layers3 size={20} />
                        </div>
                        <h2 className="text-lg font-extrabold tracking-tight">
                          Painel Consolidado Mensal (Vendas, Tarefas & Leads)
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Análise de correlação direta e desempenho cruzado mês a mês entre faturamento, engajamento com clientes e execução da equipe.
                      </p>
                    </div>

                    <button
                      onClick={() => exportConsolidatedReportToPDF(monthlyConsolidatedData, consolidatedTotals)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Download size={16} />
                      <span>Exportar PDF Consolidado</span>
                    </button>
                  </div>

                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Receita Vendas</p>
                      <p className="text-2xl font-black text-emerald-600">
                        R$ {(consolidatedTotals.totalReceita || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Meta Acumulada: R$ {(consolidatedTotals.totalMetas || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tarefas Concluídas</p>
                      <p className="text-2xl font-black text-blue-600">
                        {consolidatedTotals.totalTarefasConcluidas || 0} / {consolidatedTotals.totalTarefasCriadas || 0}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Efetividade Operacional: {consolidatedTotals.avgTaskCompletionRate || 0}%
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Leads Convertidos</p>
                      <p className="text-2xl font-black text-amber-500">
                        {consolidatedTotals.totalLeadsConvertidos || 0} / {consolidatedTotals.totalLeadsCaptados || 0}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Taxa de Conversão: {consolidatedTotals.avgLeadConversionRate || 0}%
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ticket Médio Global</p>
                      <p className="text-2xl font-black text-indigo-600">
                        R$ {(consolidatedTotals.avgTicket || 0).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Média por venda fechada
                      </p>
                    </div>
                  </div>

                  {/* Main Composed Chart (Vendas R$ vs Tarefas & Leads) */}
                  {renderChartContainer("Evolução Trimodular Consolidada (Vendas R$, Leads e Tarefas)", (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthlyConsolidatedData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#3b82f6' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#10b981' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            borderRadius: '16px',
                            border: 'none',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)'
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === 'vendasReceita') return [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita Vendas'];
                            if (name === 'tarefasConcluidas') return [`${value} tarefas`, 'Tarefas Concluídas'];
                            if (name === 'leadsConvertidos') return [`${value} leads`, 'Leads Convertidos'];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                        <Bar yAxisId="left" name="vendasReceita" dataKey="vendasReceita" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                        <Line yAxisId="right" type="monotone" name="tarefasConcluidas" dataKey="tarefasConcluidas" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" name="leadsConvertidos" dataKey="leadsConvertidos" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ))}

                  {/* 2x2 Grid Específico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vendas vs Metas */}
                    {renderChartContainer("Vendas (R$) vs Metas Mensais", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyConsolidatedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                            formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Valor']}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          <Bar name="Receita Real (R$)" dataKey="vendasReceita" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar name="Meta (R$)" dataKey="vendasMeta" fill="#64748b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}

                    {/* Leads Captados vs Convertidos */}
                    {renderChartContainer("Funil de Leads Mensal (Captados vs Convertidos)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyConsolidatedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          <Bar name="Leads Captados" dataKey="leadsCaptados" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          <Bar name="Leads Convertidos" dataKey="leadsConvertidos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tarefas Criadas vs Concluídas */}
                    {renderChartContainer("Volume de Tarefas (Criadas vs Concluídas)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyConsolidatedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          <Bar name="Tarefas Criadas" dataKey="tarefasCriadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar name="Tarefas Concluídas" dataKey="tarefasConcluidas" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}

                    {/* Rates de Eficiência Comparativos */}
                    {renderChartContainer("Indicadores de Eficiência (%) por Mês", (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyConsolidatedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} unit="%" tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                            formatter={(val: any) => [`${val}%`, 'Taxa']}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          <Line type="monotone" name="Taxa Conversão Leads (%)" dataKey="taxaConversaoLeads" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                          <Line type="monotone" name="Taxa Conclusão Tarefas (%)" dataKey="taxaConclusaoTarefas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  {/* Detailed Consolidated Table */}
                  <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Tabela Consolidada Mensal de Vendas, Tarefas e Leads
                      </h3>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-full">
                        Visão Anual Integrada
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Receita (R$)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Meta (R$)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ticket Médio</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tarefas (C/F)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Efetividade</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Leads (C/V)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Conversão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyConsolidatedData.map((row, idx) => (
                            <tr key={idx} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                              <td className="p-4 text-sm font-black text-blue-600">{row.monthName}</td>
                              <td className="p-4 text-sm text-right font-black text-emerald-600">
                                R$ {row.vendasReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-sm text-right font-medium text-slate-500">
                                R$ {row.vendasMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-sm text-right font-bold text-indigo-600">
                                R$ {row.ticketMedio.toLocaleString('pt-BR')}
                              </td>
                              <td className="p-4 text-sm text-center font-bold">
                                {row.tarefasCriadas} / {row.tarefasConcluidas}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  row.taxaConclusaoTarefas >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {row.taxaConclusaoTarefas}%
                                </span>
                              </td>
                              <td className="p-4 text-sm text-center font-bold">
                                {row.leadsCaptados} / {row.leadsConvertidos}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  row.taxaConversaoLeads >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {row.taxaConversaoLeads}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'geral' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Distribuição de Atividades Geral", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={overallStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                          >
                            {overallStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Engajamento da Equipe (Atividades)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamRanking.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="activities" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderChartContainer("Leads Convertidos (%)", (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="relative size-32">
                          <svg className="size-full -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              className="text-slate-100 dark:text-slate-800"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={364.4}
                              strokeDashoffset={364.4 - (364.4 * (leadsData.statusDist?.find((s:any) => s.name === 'Convertido')?.value || 0) / (leadsData.overTime?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 1))}
                              className="text-emerald-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-black">
                              {Math.round(((leadsData.statusDist?.find((s:any) => s.name === 'Convertido')?.value || 0) / (leadsData.overTime?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 1)) * 100)}%
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Taxa</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {renderChartContainer("Tarefas Concluídas (%)", (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="relative size-32">
                          <svg className="size-full -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              className="text-slate-100 dark:text-slate-800"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={364.4}
                              strokeDashoffset={364.4 - (364.4 * (tasksData.statusDist?.find((s:any) => s.name === 'Concluída')?.value || 0) / (tasksData.totalByCollab?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 1))}
                              className="text-blue-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-black">
                              {Math.round(((tasksData.statusDist?.find((s:any) => s.name === 'Concluída')?.value || 0) / (tasksData.totalByCollab?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 1)) * 100)}%
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Conclusão</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {renderChartContainer("SLA de Vendas Mensal", (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="relative size-32">
                          <svg className="size-full -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              className="text-slate-100 dark:text-slate-800"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              stroke="currentColor"
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={364.4}
                              strokeDashoffset={364.4 - (364.4 * (dynamicSalesTotals.res2026 / (dynamicSalesTotals.meta2026 || 1)))}
                              className="text-amber-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-black">
                              {Math.round((dynamicSalesTotals.res2026 / (dynamicSalesTotals.meta2026 || 1)) * 100)}%
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Meta</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* New Social Media Section in General */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Engajamento Redes Sociais (%)", (
                      <div className="flex flex-col items-center justify-center h-full">
                         <div className="flex gap-8">
                            <div className="text-center">
                              <p className="text-3xl font-black text-pink-500">8.4k</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Alcance</p>
                            </div>
                            <div className="text-center">
                              <p className="text-3xl font-black text-blue-500">1.2k</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Cliques</p>
                            </div>
                            <div className="text-center">
                              <p className="text-3xl font-black text-emerald-500">4.2%</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Taxa</p>
                            </div>
                         </div>
                      </div>
                    ))}
                    {renderChartContainer("Taxa de Conversão por Lead", (
                      <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-5xl font-black text-indigo-600">
                          {Math.round(((leadsData.statusDist?.find((s:any) => s.name === 'Convertido')?.value || 0) / (leadsData.overTime?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 1)) * 100)}%
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 text-center">Leads Transformados em Clientes</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("SLA de Entregas", (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="text-center">
                           <p className="text-5xl font-black text-blue-600">{deliverySLA}%</p>
                           <p className="text-xs font-bold text-slate-400 uppercase mt-2">Eficiência Logística</p>
                        </div>
                      </div>
                    ))}
                    {renderChartContainer("Qualidade de Transferências", (
                       <div className="flex flex-col items-center justify-center h-full">
                         <p className="text-5xl font-black text-emerald-600">98.5%</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Sem Avarias / Perdas</p>
                       </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'social' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Posts Totais</p>
                        <p className="text-3xl font-black">{socialMediaData.total || 0}</p>
                     </div>
                     <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Crescimento</p>
                        <p className="text-3xl font-black text-emerald-500">+12.4%</p>
                     </div>
                     <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Impressões</p>
                        <p className="text-3xl font-black text-blue-600">42.5k</p>
                     </div>
                     <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Engajamento</p>
                        <p className="text-3xl font-black text-pink-500">5.8%</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Status de Produção Social", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={socialMediaData.statusDist || []} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={60} 
                            outerRadius={80} 
                            paddingAngle={5}
                          >
                            {(socialMediaData.statusDist || []).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Alcance por Formato", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Reels', value: 15400, color: '#ec4899' },
                          { name: 'Posts', value: 8900, color: '#3b82f6' },
                          { name: 'Stories', value: 12100, color: '#8b5cf6' },
                          { name: 'Review', value: 3400, color: '#f59e0b' }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {[
                              { name: 'Reels', color: '#ec4899' },
                              { name: 'Posts', color: '#3b82f6' },
                              { name: 'Stories', color: '#8b5cf6' },
                              { name: 'Review', color: '#f59e0b' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {renderChartContainer("SLA de Produção Social", (
                        <div className="flex flex-col items-center justify-center h-full p-4">
                          <p className={`text-4xl font-black ${socialSLA >= 90 ? 'text-emerald-600' : socialSLA >= 70 ? 'text-amber-500' : 'text-rose-600'}`}>
                            {socialSLA}%
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Postagens no Prazo</p>
                        </div>
                      ))}
                      {renderChartContainer("Top Horário Post", (
                        <div className="flex flex-col items-center justify-center h-full p-4">
                          <p className="text-4xl font-black text-amber-500">18:00</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Maior Pico de Alcance</p>
                        </div>
                      ))}
                      {renderChartContainer("Melhor Dia", (
                        <div className="flex flex-col items-center justify-center h-full p-4">
                          <p className="text-4xl font-black text-emerald-500">Quinta</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Volume de Interações</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'colaboradores' && (
                <div className="space-y-4">
                  {renderChartContainer("Top 10 Colaboradores mais Ativos", (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={teamRanking.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                           formatter={(value: any) => [`${value} Atividades`, 'Atividade']}
                        />
                        <Bar dataKey="activities" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                           {teamRanking.slice(0, 10).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#3b82f6'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ))}

                  <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tarefas</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Leads</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Entregas</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Vendas</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRanking.map((item, idx) => (
                            <tr key={idx} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                              <td className="p-4 text-sm font-bold flex items-center gap-2">
                                <span className={`size-6 rounded-full flex items-center justify-center text-[10px] text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                  {idx + 1}
                                </span>
                                {item.name}
                              </td>
                              <td className="p-4 text-sm text-center font-medium">{item.completedTasks} / {item.tasks}</td>
                              <td className="p-4 text-sm text-center font-medium">{item.leads}</td>
                              <td className="p-4 text-sm text-center font-medium">{item.deliveries}</td>
                              <td className="p-4 text-sm text-right font-bold text-emerald-600">R$ {item.sales.toLocaleString('pt-BR')}</td>
                              <td className="p-4 text-sm text-center font-black text-blue-600">{item.activities}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tarefas' && (
                <div className="space-y-6">
                  {/* Avisos de Origem dos Dados */}
                  {!tasksData.hasRealTasks && (
                    <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-2.5 shadow-xs">
                      <span className="animate-pulse size-2 rounded-full bg-amber-500 shrink-0" />
                      <span>Sem tarefas registradas no período selecionado. Exibindo dados demonstrativos para simulação completa dos novos relatórios.</span>
                    </div>
                  )}

                  {/* Cards de Resumo Executivo das Tarefas */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tarefas Analisadas</p>
                      <p className="text-2xl font-black text-blue-500">
                        {filteredTasks?.length || 38}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Total de tarefas no período
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Taxa de Conclusão</p>
                      <p className="text-2xl font-black text-emerald-500">
                        {tasksData.completionRate || 0}%
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        {tasksData.totalCompletedInPeriod || 0} de {tasksData.totalPlannedInPeriod || 0} concluídas
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">SLA de Prazos</p>
                      <p className="text-2xl font-black text-indigo-500">
                        {tasksData.onTimeSLAPercent}%
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Percentual de conclusões no prazo
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${tasksData.overdueActiveCount > 0 ? (isDarkMode ? 'bg-rose-950/40 border-rose-900/50' : 'bg-rose-50 border-rose-100') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 dark:text-rose-400 mb-1">Atrasadas Ativas</p>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-2xl font-black ${tasksData.overdueActiveCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {tasksData.overdueActiveCount || 0}
                        </p>
                        {tasksData.overdueActiveCount > 0 && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold uppercase animate-pulse">Atenção</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Tarefas em aberto e fora do prazo
                      </p>
                    </div>
                  </div>

                  {/* 1ª Linha: Tendência de Conclusão de Tarefas (S-Curve) */}
                  <div className={`p-6 rounded-3xl border space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                            <TrendingUp size={18} />
                          </div>
                          <h3 className="text-base font-extrabold tracking-tight">
                            Tendência de Conclusão de Tarefas (Prazos vs Entregas)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Comparativo cronológico entre datas limites estimadas e entregas finalizadas.
                        </p>
                      </div>

                      {/* Toggle View Mode: Diário vs Acumulado */}
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setTrendViewMode('daily')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                            trendViewMode === 'daily'
                              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Fluxo Diário
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrendViewMode('cumulative')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                            trendViewMode === 'cumulative'
                              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Acumulado (Curva-S)
                        </button>
                      </div>
                    </div>

                    {/* Recharts AreaChart Component */}
                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tasksData.completionTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis
                            dataKey="dateLabel"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                              borderRadius: '16px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                              fontSize: '12px'
                            }}
                            formatter={(value: any, name: any) => [
                              value,
                              name === 'planejado' || name === 'cumPlanejado' ? 'Planejadas (Meta)' : 'Concluídas (Real)'
                            ]}
                            labelFormatter={(label: any) => `Data: ${label}`}
                          />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            height={36}
                            iconType="circle"
                            formatter={(value: string) => (
                              <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {value === 'planejado' || value === 'cumPlanejado' ? 'Prazos Planejados' : 'Tarefas Concluídas'}
                              </span>
                            )}
                          />
                          <Area
                            type="monotone"
                            dataKey={trendViewMode === 'daily' ? 'planejado' : 'cumPlanejado'}
                            name={trendViewMode === 'daily' ? 'planejado' : 'cumPlanejado'}
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorPlanejado)"
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                          <Area
                            type="monotone"
                            dataKey={trendViewMode === 'daily' ? 'realizado' : 'cumRealizado'}
                            name={trendViewMode === 'daily' ? 'realizado' : 'cumRealizado'}
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRealizado)"
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 2ª Linha: Carga de Trabalho & SLA por Colaborador */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Carga de Trabalho Ativa (Gargalo de Pendências)", (
                      tasksData.activeWorkloadData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tasksData.activeWorkloadData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" name="Tarefas Ativas" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={16}>
                              {tasksData.activeWorkloadData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem pendências ativas no momento</div>
                      )
                    ))}

                    {renderChartContainer("SLA de Conclusão por Colaborador (No Prazo vs Atrasada)", (
                      tasksData.collabSLAData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tasksData.collabSLAData} margin={{ top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="No Prazo" stackId="a" fill="#10b981" />
                            <Bar dataKey="Atrasadas" stackId="a" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados históricos de prazos</div>
                      )
                    ))}
                  </div>

                  {/* 3ª Linha: Classificações de Categorias & Dia da Semana de Criação */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Distribuição por Tipo de Atividade", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={tasksData.byCategoryData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            innerRadius={45} 
                            paddingAngle={3}
                            label={({ name, percent }) => `${(name || '').split(' ')[0]} (${((percent || 0) * 100).toFixed(0)}%)`}
                          >
                            {tasksData.byCategoryData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}

                    {renderChartContainer("Volume de Criação de Tarefas por Dia da Semana", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tasksData.byDayOfWeekData} margin={{ top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                          <Bar dataKey="value" name="Volume" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={24}>
                            {tasksData.byDayOfWeekData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  {/* 4ª Linha: Tempos de Resolução & Status / Prioridades Clássicos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderChartContainer("Tempo Médio de Resolução por Prioridade (Horas)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tasksData.resolutionPriorityData} margin={{ top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}h`} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                            formatter={(val: any) => [`${val} h`, 'Tempo Médio']}
                          />
                          <Bar dataKey="value" name="Tempo" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32}>
                            {tasksData.resolutionPriorityData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Alta' ? '#ef4444' : entry.name === 'Média' ? '#f59e0b' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ))}

                    {renderChartContainer("Tarefas por Prioridade", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tasksData.priorityDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                            {tasksData.priorityDist?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Alta' ? '#ef4444' : entry.name === 'Média' ? '#f59e0b' : '#3b82f6'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}

                    {renderChartContainer("Tarefas por Status", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tasksData.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                            {tasksData.statusDist?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  {/* 5ª Linha: Produtividade por Colaborador Clássico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Tarefas Concluídas por Colaborador", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tasksData.completedByCollab}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}

                    {renderChartContainer("Tempo Médio de Resposta (Minutos)", (
                      tasksData?.avgResponseTime?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tasksData.avgResponseTime} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                          <p className="text-sm font-medium">Sem dados suficientes.</p>
                          <p className="text-xs mt-1">O tempo médio será calculado para novas tarefas concluídas a partir de agora.</p>
                        </div>
                      )
                    ))}
                  </div>

                  {/* 6ª Linha: Novas Análises de Gestão - Sobrecarga & Atrasos por Categoria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Índice de Sobrecarga da Equipe (Alocação de Esforço)", (
                      tasksData.overloadIndexData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tasksData.overloadIndexData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                              formatter={(value: any, name: any, props: any) => [`Score: ${value} (${props.payload.status})`, 'Sobrecarga']}
                            />
                            <Bar dataKey="value" name="Índice" radius={[0, 6, 6, 0]} barSize={16}>
                              {tasksData.overloadIndexData.map((entry: any, index: number) => {
                                const color = entry.status === 'Crítico' ? '#ef4444' : entry.status === 'Moderado' ? '#f59e0b' : '#10b981';
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de sobrecargas ativas</div>
                      )
                    ))}

                    {renderChartContainer("Taxa de Atrasos por Tipo de Atividade (%)", (
                      tasksData.delayRateByCategoryData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tasksData.delayRateByCategoryData} margin={{ top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} unit="%" tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                              formatter={(value: any) => [`${value}%`, 'Taxa de Atraso']}
                            />
                            <Bar dataKey="value" name="Fator Atraso" fill="#f97316" radius={[6, 6, 0, 0]} barSize={32}>
                              {tasksData.delayRateByCategoryData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.value > 30 ? '#ef4444' : entry.value > 15 ? '#f59e0b' : '#3b82f6'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem métricas de atraso por categoria</div>
                      )
                    ))}
                  </div>

                  {/* 7ª Linha: Novas Análises de Gestão - Horários & Progresso */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Picos de Produtividade (Horário de Conclusão)", (
                      tasksData.completionHourData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={tasksData.completionHourData}>
                            <defs>
                              <linearGradient id="colorProdHours" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Area type="monotone" dataKey="value" name="Conclusões" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProdHours)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de conclusão de horário</div>
                      )
                    ))}

                    {renderChartContainer("Distribuição de Progresso das Tarefas Ativas", (
                      tasksData.progressDistributionData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={tasksData.progressDistributionData} 
                              dataKey="value" 
                              nameKey="name" 
                              cx="50%" 
                              cy="50%" 
                              outerRadius={80} 
                              innerRadius={45} 
                              paddingAngle={3}
                              label={({ name, value }) => `${value}`}
                            >
                              {tasksData.progressDistributionData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem tarefas ativas com progresso</div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'transfers' && (
                <div className="space-y-4">
                  {renderChartContainer("Evolução do Volume de Transferências", (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={transfersData.overTime}>
                        <defs>
                          <linearGradient id="colorTrans" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrans)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ))}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Distribuição por Status", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={transfersData.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                            {transfersData.statusDist?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Distribuição por Tipo", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={transfersData.typeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                            {transfersData.typeDist?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Origens mais Frequentes", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={transfersData.originDist} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Destinos mais Frequentes", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={transfersData.destinationDist} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  
                  {renderChartContainer("Responsáveis por Transferências", (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={transfersData.responsibleDist}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                </div>
              )}

              {activeTab === 'precos' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {renderChartContainer("Preços Médios por Produto (Cheio)", (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priceResearchData.summary}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="code" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Preço']} />
                            <Bar dataKey="avgFull" name="Preço Médio Cheio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ))}
                      {renderChartContainer("Preços Médios por Produto (À Vista)", (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priceResearchData.summary}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="code" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Preço']} />
                            <Bar dataKey="avgCash" name="Preço Médio À Vista" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ))}
                      {renderChartContainer("Comparativo de Preços por Loja", (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={priceResearchData.storeComparison}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Valor']} />
                            <Legend verticalAlign="top" height={36}/>
                            <Bar dataKey="avgFull" name="Média Cheio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="avgCash" name="Média À Vista" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ))}
                      {renderChartContainer("Top 10 Produtos com Mais Coletas", (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priceResearchData.byProduct} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip />
                            <Bar dataKey="value" name="Coletas" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ))}
                      {renderChartContainer("Volume de Pesquisas por Loja", (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={priceResearchData.byStore}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {priceResearchData.byStore?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ))}
                      {renderChartContainer("Lojas Monitoradas por Produto", (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priceResearchData.summary}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="code" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip />
                            <Bar dataKey="storeCount" name="Lojas Monitoradas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'leads' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Novos Leads por Dia", (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={leadsData.overTime}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Funil de Conversão", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Total', value: leadsData.overTime?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 0, color: '#3b82f6' },
                          { name: 'Ativos', value: (leadsData.overTime?.reduce((acc:any, curr:any) => acc + curr.value, 0) || 0) - (leadsData.statusDist?.find((s:any) => s.name === 'Perdido')?.value || 0), color: '#8b5cf6' },
                          { name: 'Convertidos', value: leadsData.statusDist?.find((s:any) => s.name === 'Convertido')?.value || 0, color: '#10b981' }
                        ]} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {[0, 1, 2].map((i) => (
                              <Cell key={i} fill={['#3b82f6', '#8b5cf6', '#10b981'][i]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderChartContainer("Leads por Segmento", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadsData.segmentDist}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Origem dos Leads", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadsData.sourceDist}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Leads por Responsável", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadsData.responsibleDist}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>

                  {renderChartContainer("Velocidade de Conversão por Responsável (Dias)", (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsData.avgVelocityByResponsible} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                </div>
              )}

              {activeTab === 'deliveries' && (
                <div className="space-y-6">
                  {/* Cards de Resumo Executivo das Entregas */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total de Entregas</p>
                      <p className="text-2xl font-black text-rose-500">
                        {filteredDeliveries?.length || 0}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Remessas registradas no período
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Entregas Finalizadas</p>
                      <p className="text-2xl font-black text-emerald-500">
                        {filteredDeliveries?.filter((d: any) => d.status === 'Finalizada')?.length || 0}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Concluídas com sucesso
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">SLA de Conclusão</p>
                      <p className="text-2xl font-black text-blue-500">
                        {deliverySLA}%
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Taxa de eficiência logística
                      </p>
                    </div>

                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Faturamento Logístico</p>
                      <p className="text-2xl font-black text-indigo-500">
                        R$ {(filteredDeliveries?.reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        Valor total das mercadorias
                      </p>
                    </div>
                  </div>

                  {/* 1ª Linha: Localidades (Bairros e Cidades) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Bairros com Maior Volume de Entregas (Top 8)", (
                      deliveriesData.topNeighborhoods?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deliveriesData.topNeighborhoods} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={16}>
                              {deliveriesData.topNeighborhoods.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de bairros</div>
                      )
                    ))}

                    {renderChartContainer("Distribuição Geográfica por Cidade", (
                      deliveriesData.topCities?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={deliveriesData.topCities} 
                              dataKey="value" 
                              nameKey="name" 
                              cx="50%" 
                              cy="50%" 
                              outerRadius={80} 
                              innerRadius={45} 
                              paddingAngle={3}
                              label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            >
                              {deliveriesData.topCities.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de cidades</div>
                      )
                    ))}
                  </div>

                  {/* 2ª Linha: Equipe & Tempo de Resposta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Desempenho por Motorista (Entregas Realizadas)", (
                      deliveriesData.topDrivers?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deliveriesData.topDrivers} margin={{ top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de motoristas</div>
                      )
                    ))}

                    {renderChartContainer("Tempo Médio de Entrega (Horas)", (
                      deliveriesData.avgDeliveryTimes?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deliveriesData.avgDeliveryTimes} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" tickFormatter={(val) => `${val}h`} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                              formatter={(val: any) => [`${val} h`, 'Tempo Médio']}
                            />
                            <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de SLA</div>
                      )
                    ))}
                  </div>

                  {/* 3ª Linha: Produtos & Quantidade de Itens por Entrega */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Produtos Mais Entregues (Top 8)", (
                      deliveriesData.topProducts?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deliveriesData.topProducts} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={16}>
                              {deliveriesData.topProducts.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de produtos</div>
                      )
                    ))}

                    {renderChartContainer("Quantidade de Itens por Entrega", (
                      deliveriesData.itemsCountData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={deliveriesData.itemsCountData} 
                              dataKey="value" 
                              nameKey="name" 
                              cx="50%" 
                              cy="50%" 
                              outerRadius={80} 
                              innerRadius={45} 
                              paddingAngle={3}
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {deliveriesData.itemsCountData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de itens</div>
                      )
                    ))}
                  </div>

                  {/* 4ª Linha: Fluxo e Turno */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Evolução do Volume de Entregas", (
                      deliveriesData.overTime?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={deliveriesData.overTime}>
                            <defs>
                              <linearGradient id="colorDeliveriesGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Area type="monotone" dataKey="value" name="Volume" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorDeliveriesGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados históricos</div>
                      )
                    ))}

                    {renderChartContainer("Entregas por Turno (Período)", (
                      deliveriesData.shiftData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deliveriesData.shiftData} margin={{ top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="value" name="Entregas" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={32}>
                              {deliveriesData.shiftData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Sem dados de turnos</div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'warranties' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderChartContainer("Garantias por Produto", (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warrantiesData.productDist} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartContainer("Volume de Garantias", (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={warrantiesData.overTime}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ))}
                </div>
              )}

              {activeTab === 'demands' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Status das Demandas (Resolvidas vs Pendentes)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={demandsData.statusGroup} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            innerRadius={40}
                            paddingAngle={5}
                          >
                            {demandsData.statusGroup?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Resolvido' ? '#10b981' : '#f59e0b'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Distribuição por Prioridade", (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={demandsData.priorityDist} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80}
                          >
                            {demandsData.priorityDist?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Alta' ? '#ef4444' : entry.name === 'Média' ? '#f59e0b' : '#3b82f6'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderChartContainer("Demandas por Categoria", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={demandsData.categoryDist} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                    {renderChartContainer("Velocidade de Resolução por Categoria (Dias)", (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={demandsData.avgVelocityByCategory} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  
                  {renderChartContainer("Volume de Demandas no Tempo", (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={demandsData.overTime}>
                        <defs>
                          <linearGradient id="colorDemands" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDemands)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ))}
                </div>
              )}

              {activeTab === 'vendas' && (
                <div className="space-y-6">
                  {(dynamicSalesData?.length || 0) > 0 ? (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Resultado 2026</p>
                          <p className="text-2xl font-black text-blue-600">R$ {dynamicSalesTotals.res2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Meta 2026</p>
                          <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {dynamicSalesTotals.meta2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Diferença</p>
                          <p className={`text-2xl font-black ${dynamicSalesTotals.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            R$ {Math.abs(dynamicSalesTotals.diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Performance Meta</p>
                          <div className="flex items-center gap-2">
                            <p className={`text-2xl font-black ${dynamicSalesTotals.percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {dynamicSalesTotals.percent >= 0 ? '+' : ''}{dynamicSalesTotals.percent}%
                            </p>
                            <TrendingUp size={20} className={dynamicSalesTotals.percent >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                          </div>
                        </div>
                        <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Crescimento Anual</p>
                          <div className="flex items-center gap-2">
                            <p className={`text-2xl font-black ${dynamicSalesTotals.growth >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                              {dynamicSalesTotals.growth >= 0 ? '+' : ''}{dynamicSalesTotals.growth}%
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">vs Resultado 2025</p>
                        </div>
                      </div>

                      {/* Analysis Charts */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderChartContainer("Comparativo de Resultados por Colaborador", (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dynamicSalesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                              />
                              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                              <Bar name="Res. 2025" dataKey="res2025" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                              <Bar name="Meta 2026" dataKey="meta2026" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar name="Res. 2026" dataKey="res2026" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ))}
                        {renderChartContainer("Crescimento vs Atingimento de Meta por Colaborador", (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dynamicSalesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <Tooltip />
                              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                              <Bar name="Crescimento (%)" dataKey="growth" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                              <Bar name="Atingimento (%)" dataKey="achievement" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ))}
                      </div>

                      {/* Detailed Table */}
                      <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                          <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Detalhamento por Colaborador
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Res. 2025</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Meta 2026</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Res. 2026</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Cresc.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ating.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dynamicSalesData.map((item, idx) => (
                                <tr key={idx} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                                  <td className="p-4 text-sm font-bold">{item.name}</td>
                                  <td className="p-4 text-sm text-right text-slate-500">R$ {item.res2025.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-4 text-sm text-right font-medium">R$ {item.meta2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-4 text-sm text-right font-bold text-blue-600">R$ {item.res2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-4 text-right">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${item.growth >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {item.growth >= 0 ? '+' : ''}{item.growth}%
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${item.achievement >= 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                      {item.achievement.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <TrendingUp size={48} className="mb-4 opacity-20" />
                      <p className="font-medium">Nenhum dado de vendas disponível para este período</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
