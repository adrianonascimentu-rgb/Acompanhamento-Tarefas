'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Save, Users, TrendingUp, Shield, CheckCircle2, 
  AlertCircle, Search, User, X, Plus, Trash2, Edit2, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SalesAdminPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { role, user, isAdmin, isAuthenticated, login } = useRole();
  const [activeTab, setActiveTab] = useState<'data' | 'permissions'>('data');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [salesEntries, setSalesEntries] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Permissions State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles for permissions and collaborator list
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      
      if (profilesData) {
        setProfiles(profilesData);
        setCollaborators(profilesData.filter(p => p.type === 'vendedor' || p.can_access_sales === true));
      }

      // Fetch existing sales entries for the selected period
      const { data: salesData } = await supabase
        .from('sales_results')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      const entries: Record<string, any> = {};
      salesData?.forEach(item => {
        entries[item.collaborator_id] = {
          id: item.id,
          result_2025: item.result_2025,
          target_suggestion: item.target_suggestion,
          target_2026: item.target_2026,
          result_2026: item.result_2026
        };
      });
      setSalesEntries(entries);

    } catch (error: any) {
      console.error('Error fetching admin data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin, fetchData]);

  const handleInputChange = (collabId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSalesEntries(prev => ({
      ...prev,
      [collabId]: {
        ...(prev[collabId] || {}),
        [field]: numValue
      }
    }));
  };

  const saveSalesData = async () => {
    try {
      setSaving(true);
      const updates = Object.entries(salesEntries).map(([collabId, data]) => ({
        id: data.id || crypto.randomUUID(),
        collaborator_id: collabId,
        month: selectedMonth,
        year: selectedYear,
        result_2025: data.result_2025 || 0,
        target_suggestion: data.target_suggestion || 0,
        target_2026: data.target_2026 || 0,
        result_2026: data.result_2026 || 0
      }));

      const { error } = await supabase
        .from('sales_results')
        .upsert(updates, { onConflict: 'collaborator_id, month, year' });

      if (error) throw error;
      alert('Dados salvos com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error saving sales data:', error);
      alert('Erro ao salvar os dados: ' + (error?.message || error));
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (profileId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ can_access_sales: !currentStatus })
        .eq('id', profileId);

      if (error) throw error;
      
      setProfiles(prev => prev.map(p => 
        p.id === profileId ? { ...p, can_access_sales: !currentStatus } : p
      ));
    } catch (error) {
      console.error('Error toggling permission:', error);
    }
  };

  if (!isAuthenticated) return <LoginForm onLogin={login} />;
  if (!isAdmin) return <div className="p-4">Acesso negado. Apenas administradores podem acessar esta página.</div>;

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`flex items-center justify-between p-4 border-b sticky top-0 z-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/80 backdrop-blur-md' : 'border-slate-100 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Gestão de Vendas</h1>
        </div>
        <button 
          onClick={saveSalesData}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
        >
          {saving ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
          Salvar
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-32 p-4 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'data'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TrendingUp size={14} />
            Lançamentos
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'permissions'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Shield size={14} />
            Permissões
          </button>
        </div>

        {activeTab === 'data' ? (
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 bg-transparent border-none text-xs font-bold uppercase tracking-wider p-2 outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="flex-1 bg-transparent border-none text-xs font-bold uppercase tracking-wider p-2 outline-none"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Activity className="animate-spin text-emerald-600" size={32} />
              </div>
            ) : (
              <div className="space-y-4">
                {collaborators.length === 0 ? (
                  <div className={`p-10 text-center rounded-3xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                    <Users className="mx-auto mb-3 opacity-20" size={40} />
                    <p className="text-sm font-medium">Nenhum colaborador (vendedor/gerente) encontrado.</p>
                  </div>
                ) : (
                  collaborators.map((collab) => (
                    <div key={collab.id} className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold">
                          {collab.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{collab.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{collab.role}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Resultado 2025</label>
                          <input 
                            type="number"
                            value={salesEntries[collab.id]?.result_2025 || ''}
                            onChange={(e) => handleInputChange(collab.id, 'result_2025', e.target.value)}
                            placeholder="0.00"
                            className={`w-full p-3 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:border-emerald-500 transition-colors`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Sugestão Meta</label>
                          <input 
                            type="number"
                            value={salesEntries[collab.id]?.target_suggestion || ''}
                            onChange={(e) => handleInputChange(collab.id, 'target_suggestion', e.target.value)}
                            placeholder="0.00"
                            className={`w-full p-3 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:border-emerald-500 transition-colors`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Meta 2026</label>
                          <input 
                            type="number"
                            value={salesEntries[collab.id]?.target_2026 || ''}
                            onChange={(e) => handleInputChange(collab.id, 'target_2026', e.target.value)}
                            placeholder="0.00"
                            className={`w-full p-3 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:border-emerald-500 transition-colors`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Resultado 2026</label>
                          <input 
                            type="number"
                            value={salesEntries[collab.id]?.result_2026 || ''}
                            onChange={(e) => handleInputChange(collab.id, 'result_2026', e.target.value)}
                            placeholder="0.00"
                            className={`w-full p-3 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:border-emerald-500 transition-colors`}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className={`flex items-center gap-3 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <Search size={18} className="text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar colaborador..."
                className="flex-1 bg-transparent border-none text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              {filteredProfiles.map((profile) => (
                <div key={profile.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-full flex items-center justify-center font-bold ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {profile.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{profile.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">{profile.role}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => togglePermission(profile.id, profile.can_access_sales)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      profile.can_access_sales
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {profile.can_access_sales ? 'Com Acesso' : 'Sem Acesso'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
