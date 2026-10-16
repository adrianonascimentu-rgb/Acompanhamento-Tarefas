'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Check, 
  Database, 
  AlertCircle, 
  Target, 
  Truck, 
  ArrowRightLeft, 
  ShieldCheck, 
  ChevronRight,
  Save,
  RefreshCw,
  Lock,
  LayoutGrid,
  ArrowLeft,
  BarChart3,
  MessageCircle,
  TrendingUp,
  Share2,
  Mail,
  Server,
  Key,
  ExternalLink,
  Copy,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Zap,
  Info,
  Activity,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCcw,
  Eye,
  Terminal,
  AlertTriangle,
  MapPin,
  BookOpen,
  Download,
  Webhook,
  Globe,
  Radio,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole, DEFAULT_ADMIN_USER } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { OPTIMIZED_RLS_FIX_SQL } from '@/lib/rlsOptimization';
import { generateUserManualPDF } from '@/lib/generateManualPdf';
import WhatsAppWebhookDocs from '@/components/whatsapp/WhatsAppWebhookDocs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: roleLoading, login, user } = useRole();
  const { isDarkMode } = useTheme();
  
  const [permissions, setPermissions] = useState<Record<string, string[]>>({
    leads: ['admin'],
    social_media: ['admin'],
    whatsapp: ['admin'],
    deliveries: ['admin', 'entregador'],
    transfers: ['admin', 'estoque'],
    warranties: ['admin', 'vendedor'],
    sales: ['admin', 'vendedor'],
    reports: ['admin']
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationSql, setMigrationSql] = useState<string | null>(null);
  const [activeSmtpTab, setActiveSmtpTab] = useState<'resend' | 'sendgrid' | 'brevo'>('resend');
  const [activeTab, setActiveTab] = useState<'modules' | 'integrations' | 'saas' | 'logs' | 'warranties'>('modules');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Warranty Error Codes state
  const [warrantyErrorCodes, setWarrantyErrorCodes] = useState<{ id: string; label: string }[]>([]);
  const [isFetchingErrorCodes, setIsFetchingErrorCodes] = useState(false);
  const [newErrorCodeLabel, setNewErrorCodeLabel] = useState('');
  const [isCreatingErrorCode, setIsCreatingErrorCode] = useState(false);

  const fetchWarrantyErrorCodes = async () => {
    setIsFetchingErrorCodes(true);
    try {
      const { data, error } = await supabase.from('warranty_error_codes').select('*').order('label', { ascending: true });
      if (!error && data) {
        setWarrantyErrorCodes(data);
      }
    } catch (e) {
      console.warn('warranty_error_codes table not created yet.');
    } finally {
      setIsFetchingErrorCodes(false);
    }
  };

  const handleCreateErrorCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newErrorCodeLabel.trim()) return;
    setIsCreatingErrorCode(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', authUser?.id).single();
      
      const { error } = await supabase.from('warranty_error_codes').insert([{ 
        label: newErrorCodeLabel.trim(),
        company_id: profile?.company_id
      }]);

      if (error) {
        alert(`Erro ao criar código: ${error.message}.`);
      } else {
        setNewErrorCodeLabel('');
        fetchWarrantyErrorCodes();
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsCreatingErrorCode(false);
    }
  };

  const handleDeleteErrorCode = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este código de erro?')) return;
    try {
      const { error } = await supabase.from('warranty_error_codes').delete().eq('id', id);
      if (error) throw error;
      fetchWarrantyErrorCodes();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Email Audit Logs state
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'recovery' | 'email'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasServiceRole, setHasServiceRole] = useState(true);

  // Multi-Tenant SaaS State
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [copiedMultiTenantSql, setCopiedMultiTenantSql] = useState(false);

  const fetchCompanies = async () => {
    setIsFetchingCompanies(true);
    try {
      const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setCompaniesList(data);
      }
    } catch (e) {
      console.warn('Companies table not created yet or RLS restricted.');
    } finally {
      setIsFetchingCompanies(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsCreatingCompany(true);
    try {
      const { error } = await supabase.from('companies').insert([{ name: newCompanyName.trim(), cnpj: newCompanyCnpj.trim() || null }]);
      if (error) {
        alert(`Erro ao criar empresa: ${error.message}. Certifique-se que a tabela 'companies' foi criada no Supabase.`);
      } else {
        alert('Empresa cadastrada com sucesso!');
        setNewCompanyName('');
        setNewCompanyCnpj('');
        fetchCompanies();
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchEmailLogs = async () => {
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const res = await fetch(`/api/admin/email-logs?filter=${logFilter}&limit=100`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.logs)) {
        setEmailLogs(data.logs);
        setHasServiceRole(data.serviceRoleConfigured);
      } else {
        setLogsError(data?.error || 'Não foi possível carregar os logs de auditoria.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar logs de e-mail:', err);
      setLogsError('Falha ao conectar à API de logs de auditoria.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCompanies();
    if (activeTab === 'warranties') {
      fetchWarrantyErrorCodes();
    }
    if (activeTab === 'logs') {
      fetchEmailLogs();
    }

    // Real-time subscription
    const channel = supabase
      .channel('public:system_settings-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [isTestingMaps, setIsTestingMaps] = useState(false);
  const [mapsTestResult, setMapsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['module_permissions', 'GOOGLE_MAPS_PLATFORM_KEY']);
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        data.forEach(item => {
          if (item.key === 'module_permissions' && item.value) {
            const val = item.value;
            Object.keys(val).forEach(key => {
              if (!val[key].includes('admin')) {
                val[key].push('admin');
              }
            });
            setPermissions(val);
          } else if (item.key === 'GOOGLE_MAPS_PLATFORM_KEY') {
            if (typeof item.value === 'string') {
              setGoogleMapsKey(item.value);
            } else if (item.value?.key) {
              setGoogleMapsKey(item.value.key);
            }
          }
        });
      }
    } catch (err: any) {
      if (err.code === '42P17' || err?.message?.includes('infinite recursion')) {
        setError('Erro 42P17 (Recursão RLS): As políticas RLS do seu Supabase estão em loop. Copie o "Script SQL SaaS" abaixo e execute no SQL Editor do Supabase para corrigir.');
        setIsLoading(false);
        return;
      }
      const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError' || err instanceof TypeError;
      if (isNetworkError) {
        console.warn('Aviso: Falha de conexão ao carregar configurações do sistema (offline).');
      } else {
        console.error('Error fetching settings:', err);
      }
      if (err.code === '42P01') {
        setError('A tabela system_settings não existe no banco de dados.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (module: string, role: string) => {
    if (role === 'admin') return; // Cannot toggle admin
    setPermissions(prev => {
      const current = prev[module] || [];
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [module]: updated };
    });
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'module_permissions', value: permissions });

      if (error) throw error;
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveGoogleMapsKey = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'GOOGLE_MAPS_PLATFORM_KEY', value: googleMapsKey });

      if (error) throw error;
      
      // Also update localStorage for client components
      if (typeof window !== 'undefined') {
        localStorage.setItem('GOOGLE_MAPS_PLATFORM_KEY', googleMapsKey);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving Google Maps key:', err);
      setError(err.message || 'Erro ao salvar chave do Google Maps.');
    } finally {
      setIsSaving(false);
    }
  };

  const testGoogleMapsKey = async () => {
    if (!googleMapsKey.trim()) {
      setMapsTestResult({ success: false, message: 'Insira uma chave para testar.' });
      return;
    }
    setIsTestingMaps(true);
    setMapsTestResult(null);
    try {
      // Test request to Google Maps Geocoding API or Maps JavaScript API status
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Sao+Paulo&key=${googleMapsKey.trim()}`);
      const data = await res.json();
      
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        setMapsTestResult({ success: true, message: 'Chave validada com sucesso! Conexão com Google Maps estabelecida.' });
      } else if (data.status === 'REQUEST_DENIED') {
        setMapsTestResult({ success: false, message: `Erro na Chave (REQUEST_DENIED): ${data.error_message || 'Verifique se a Geocoding API está ativada.'}` });
      } else {
        setMapsTestResult({ success: false, message: `Status da API: ${data.status}` });
      }
    } catch (err: any) {
      setMapsTestResult({ success: false, message: 'Falha ao conectar com o servidor do Google Maps.' });
    } finally {
      setIsTestingMaps(false);
    }
  };

  const runMigration = async () => {
    setIsMigrating(true);
    try {
      const sql = `DO $$ 
BEGIN
    -- Tabela de Configurações do Sistema
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        CREATE TABLE system_settings (
            key TEXT PRIMARY KEY,
            value JSONB DEFAULT '{}'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        -- Desabilita RLS para facilitar a configuração inicial
        ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
    END IF;

    -- Colunas de Permissões na tabela profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigned_to') THEN
        ALTER TABLE tasks ADD COLUMN assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_deliveries') THEN
        ALTER TABLE profiles ADD COLUMN can_access_deliveries BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_transfers') THEN
        ALTER TABLE profiles ADD COLUMN can_access_transfers BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_warranties') THEN
        ALTER TABLE profiles ADD COLUMN can_access_warranties BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_reports') THEN
        ALTER TABLE profiles ADD COLUMN can_access_reports BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_whatsapp') THEN
        ALTER TABLE profiles ADD COLUMN can_access_whatsapp BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_social_media') THEN
        ALTER TABLE profiles ADD COLUMN can_access_social_media BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_sales') THEN
        ALTER TABLE profiles ADD COLUMN can_access_sales BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='receives_leads') THEN
        ALTER TABLE profiles ADD COLUMN receives_leads BOOLEAN DEFAULT true;
    END IF;

    -- Tabela de Códigos de Erro de Garantia
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warranty_error_codes') THEN
        CREATE TABLE warranty_error_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            label TEXT NOT NULL,
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(label, company_id)
        );
        -- Ativar RLS
        ALTER TABLE warranty_error_codes ENABLE ROW LEVEL SECURITY;
        -- Política RLS para filtragem por empresa
        CREATE POLICY "Filtro por empresa em warranty_error_codes" ON warranty_error_codes
            FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';

    -- Remover a restrição de tipo para permitir novos cargos (vendedor, entregador, etc)
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;
END $$;`;
      
      setMigrationSql(sql);
      setError('Copie o SQL abaixo e execute manualmente no SQL Editor do Supabase.');
    } catch (err) {
      console.error('Migration error:', err);
      setError('Erro ao gerar SQL de migração.');
    } finally {
      setIsMigrating(false);
    }
  };

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!roleLoading && !isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl border shadow-xl text-center space-y-5 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
            <Lock size={30} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Acesso Restrito a Administradores</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              O painel de configurações avançadas do sistema requer permissão de administrador.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/"
              className={`w-full py-3 px-4 rounded-xl border text-xs font-bold transition-all text-center ${
                isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-white text-slate-500 hover:text-blue-600 shadow-sm'}`}
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações de Módulos</h1>
              <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie o acesso aos módulos do sistema por cargo.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateUserManualPDF}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer text-xs"
              title="Baixar Manual do Aplicativo em PDF"
            >
              <BookOpen size={16} />
              <span>Manual em PDF</span>
            </button>

            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="hidden sm:flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70 text-xs"
            >
              {isSaving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Salvar Alterações
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex items-center gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          {[
            { id: 'modules', label: 'Módulos', icon: LayoutGrid },
            { id: 'integrations', label: 'Integrações', icon: Webhook },
            { id: 'warranties', label: 'Garantias', icon: ShieldCheck },
            { id: 'saas', label: 'Multi-Tenant', icon: Server },
            { id: 'logs', label: 'Logs', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600'}`}
          >
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">{error}</p>
              {migrationSql && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs opacity-80">Copie o código abaixo e cole no SQL Editor do seu painel Supabase:</p>
                  <div className={`p-3 rounded-lg font-mono text-[10px] break-all border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                    {migrationSql}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(migrationSql);
                      alert('SQL Copiado!');
                    }}
                    className="px-4 py-2 bg-slate-800 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Copiar Código SQL
                  </button>
                </div>
              )}
            </div>
            {!migrationSql && (
              <button 
                onClick={runMigration}
                disabled={isMigrating}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isMigrating ? 'Corrigindo...' : 'Corrigir Agora'}
              </button>
            )}
          </motion.div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-8">
            {/* Google Maps API Key Configuration Card */}
            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="font-bold">Google Maps Platform Key</h2>
                <p className="text-xs text-slate-500">Configure e teste a chave de API utilizada nos mapas interativos e rotas</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                GOOGLE_MAPS_PLATFORM_KEY
              </label>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={googleMapsKey}
                  onChange={(e) => setGoogleMapsKey(e.target.value)}
                  placeholder="Ex: AIzaSy..."
                  className={`flex-1 h-12 px-4 rounded-xl border outline-none font-mono text-sm transition-all focus:ring-2 focus:ring-blue-600/20 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={testGoogleMapsKey}
                  disabled={isTestingMaps}
                  className={`px-5 h-12 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  } disabled:opacity-50`}
                >
                  {isTestingMaps ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Activity size={16} className="text-blue-500" />
                  )}
                  Testar Chave
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                A chave é salva diretamente na tabela <code className="font-mono bg-slate-500/10 px-1 py-0.5 rounded">system_settings</code> do Supabase e aplicada instantaneamente no Painel do Gestor.
              </p>
            </div>

            {mapsTestResult && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                  mapsTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}
              >
                {mapsTestResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{mapsTestResult.message}</span>
              </motion.div>
            )}
          </div>

          <div className={`p-4 border-t flex justify-end items-center ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <button
              onClick={saveGoogleMapsKey}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70"
            >
              {isSaving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Salvar Chave no Supabase
            </button>
          </div>
        </div>

        {/* Webhooks do Sistema & Integração de Redes Sociais Card */}
        <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                <Webhook size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">Webhooks & Integrações de Redes Sociais</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Endpoint Ativo
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  URLs e tokens para integração com Meta (Instagram, Facebook Ads/Leads), WhatsApp Business, TikTok e outros provedores
                </p>
              </div>
            </div>

            <Link
              href="/social-media"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              <Share2 size={14} className="text-sky-500" />
              <span>Ver Módulo Redes Sociais</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="p-6 space-y-6">
            {/* 1. Webhook Principal de Redes Sociais (Meta, Instagram, TikTok, LinkedIn) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Share2 size={15} className="text-pink-500" />
                    <span>URL do Webhook (Redes Sociais & Leads)</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Utilize esta URL no Meta for Developers (Instagram / Facebook Lead Ads) ou provedores parceiros.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-500">
                  GET & POST
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border font-mono text-xs overflow-x-auto select-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-sky-400' : 'bg-slate-50 border-slate-200 text-sky-700'
                }`}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/social-media/webhook` : '/api/social-media/webhook'}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    copyToClipboard(`${origin}/api/social-media/webhook`, 'social_media_webhook');
                  }}
                  className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all shrink-0 active:scale-95 cursor-pointer ${
                    copiedKey === 'social_media_webhook'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                >
                  {copiedKey === 'social_media_webhook' ? (
                    <>
                      <Check size={16} />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copiar Webhook</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Webhook WhatsApp Cloud API */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <MessageCircle size={15} className="text-emerald-500" />
                    <span>URL do Webhook (WhatsApp Business API)</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Endpoint para recebimento de mensagens e status de entrega no Meta Graph API.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-500">
                  GET & POST
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border font-mono text-xs overflow-x-auto select-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                }`}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    copyToClipboard(`${origin}/api/whatsapp/webhook`, 'whatsapp_webhook');
                  }}
                  className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all shrink-0 active:scale-95 cursor-pointer ${
                    copiedKey === 'whatsapp_webhook'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                >
                  {copiedKey === 'whatsapp_webhook' ? (
                    <>
                      <Check size={16} />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copiar Webhook</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Token de Verificação e Informações de Handshake */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Guia Rápido de Configuração (Meta / Facebook / Instagram / WhatsApp)
                  </h4>
                  <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Callback URL:</strong> Cole uma das URLs acima no painel de desenvolvedores do provedor.
                    </li>
                    <li>
                      <strong>Verify Token (Token de Verificação):</strong> Configure a variável <code className="font-mono text-sky-500 bg-sky-500/10 px-1 py-0.5 rounded">WHATSAPP_VERIFY_TOKEN</code> ou <code className="font-mono text-sky-500 bg-sky-500/10 px-1 py-0.5 rounded">SOCIAL_MEDIA_VERIFY_TOKEN</code>.
                    </li>
                    <li>
                      <strong>Validação Automática:</strong> O endpoint responde automaticamente com o handshake <code className="font-mono text-slate-400">hub.challenge</code> exigido pela Meta na ativação.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Componente Dedicado de Documentação do Webhook WhatsApp Cloud API */}
        <WhatsAppWebhookDocs isDarkMode={isDarkMode} />
      </div>
    )}

        {/* Multi-Tenant SaaS Tab */}
        {activeTab === 'saas' && (
          <div className="space-y-8">
            {/* Multi-Tenant SaaS (Empresas & RLS) Card */}
            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                <Server size={20} />
              </div>
              <div>
                <h2 className="font-bold">Arquitetura SaaS Multi-Tenant</h2>
                <p className="text-xs text-slate-500">Isolamento seguro de dados por empresa (Tenants) com Supabase RLS</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(OPTIMIZED_RLS_FIX_SQL);
                setCopiedMultiTenantSql(true);
                setTimeout(() => setCopiedMultiTenantSql(false), 3000);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-purple-600/20 active:scale-95"
            >
              <Copy size={16} />
              {copiedMultiTenantSql ? 'SQL Anti-Recursão Copiado!' : 'Copiar Script SQL RLS Anti-Recursão'}
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs space-y-2">
              <p className="font-bold flex items-center gap-2 text-sm">
                <Sparkles size={16} />
                Como funciona o Multi-Tenant com RLS no Supabase:
              </p>
              <p>
                1. <b>Tabela Matriz:</b> A tabela <code className="bg-purple-500/20 px-1 py-0.5 rounded">companies</code> armazena as empresas assinantes do SaaS.
              </p>
              <p>
                2. <b>Carimbo de Tenant:</b> Todas as tabelas operacionais possuem a coluna <code className="bg-purple-500/20 px-1 py-0.5 rounded">company_id</code> relacionando os dados à empresa.
              </p>
              <p>
                3. <b>Filtro Invisível na Nuvem:</b> As políticas RLS filtram automaticamente os dados onde <code className="bg-purple-500/20 px-1 py-0.5 rounded">company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())</code>, garantindo isolamento total entre empresas sem mudar as rotas do Next.js.
              </p>
            </div>

            {/* Cadastro de Nova Empresa */}
            <form onSubmit={handleCreateCompany} className="p-4 rounded-2xl border space-y-4 bg-slate-500/5 border-slate-500/10">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Cadastrar Nova Empresa (Tenant)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Logística Express Ltda"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className={`w-full h-10 px-3 rounded-xl border outline-none text-xs ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CNPJ (Opcional)</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={newCompanyCnpj}
                    onChange={(e) => setNewCompanyCnpj(e.target.value)}
                    className={`w-full h-10 px-3 rounded-xl border outline-none text-xs ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingCompany}
                  className="px-5 h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreatingCompany ? 'Cadastrando...' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>

            {/* Lista de Empresas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Empresas Cadastradas ({companiesList.length})</h3>
                <button type="button" onClick={fetchCompanies} className="text-xs text-purple-500 hover:underline flex items-center gap-1 font-bold">
                  <RefreshCw size={12} className={isFetchingCompanies ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>

              {companiesList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {companiesList.map((comp) => (
                    <div key={comp.id} className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <p className="font-bold text-sm">{comp.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{comp.cnpj || 'Sem CNPJ'} • Status: {comp.subscription_status || 'active'}</p>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-lg">
                        Tenant Ativo
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Nenhuma empresa encontrada na tabela <code className="font-mono">companies</code>. Verifique se o script SQL foi executado no Supabase.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

        {/* Permissions / Modules Tab */}
        {activeTab === 'modules' && (
          <div className="space-y-8">
            {/* Permissions Table */}
            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Shield size={20} />
            </div>
            <h2 className="font-bold">Matriz de Acesso</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Módulo</th>
                  {['Admin', 'Gerente', 'Vendedor', 'Estoque', 'Entregador', 'Colaborador'].map(role => (
                    <th key={role} className="p-6 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { id: 'leads', label: 'Leads', icon: Target, desc: 'Gestão de leads e funil de vendas' },
                  { id: 'social_media', label: 'Redes Sociais', icon: Share2, label2: 'Redes Sociais', desc: 'Gestão de posts e tráfego pago' },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Central de atendimento e mensagens' },
                  { id: 'deliveries', label: 'Entregas', icon: Truck, desc: 'Logística e rastreamento de entregas' },
                  { id: 'transfers', label: 'Transferências', icon: ArrowRightLeft, desc: 'Movimentação de estoque entre lojas' },
                  { id: 'warranties', label: 'Garantias', icon: ShieldCheck, desc: 'Pós-venda e suporte técnico' },
                  { id: 'sales', label: 'Vendas', icon: TrendingUp, desc: 'Resultados e ranking de vendedores' },
                  { id: 'reports', label: 'Relatórios', icon: BarChart3, desc: 'Análise de dados e indicadores' }
                ].map(mod => (
                  <tr key={mod.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          <mod.icon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{mod.label}</p>
                          <p className="text-[10px] text-slate-500">{mod.desc}</p>
                        </div>
                      </div>
                    </td>
                    {['admin', 'gerente', 'vendedor', 'estoque', 'entregador', 'user'].map(role => (
                      <td key={role} className="p-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(mod.id, role)}
                          disabled={role === 'admin'}
                          className={`size-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                            permissions[mod.id]?.includes(role)
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                              : isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'
                          } ${role === 'admin' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
                        >
                          {permissions[mod.id]?.includes(role) ? (
                            <Check size={20} />
                          ) : (
                            <div className="size-2 rounded-full bg-current opacity-20" />
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Sub-table Save Button Container */}
          <div className={`p-4 border-t flex justify-end items-center ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70"
            >
              {isSaving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Database size={18} />
              )}
              Salvar Permissões no Supabase
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className={`p-6 rounded-3xl border flex items-start gap-4 ${isDarkMode ? 'bg-blue-900/10 border-blue-900/20' : 'bg-blue-50 border-blue-100'}`}>
          <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
            <LayoutGrid size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-blue-600">Como funcionam as permissões?</h3>
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              As permissões configuradas aqui definem quais módulos aparecem na barra lateral para cada cargo. 
              Ao cadastrar um novo colaborador, ele receberá esses acessos por padrão, mas você ainda poderá 
              personalizar o acesso individualmente na página de edição do colaborador.
            </p>
          </div>
        </div>
      </div>
    )}

        {/* Warranty Error Codes Tab Content */}
        {activeTab === 'warranties' && (
          <div className="space-y-6">
            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold">Códigos de Erro (Garantia)</h2>
                    <p className="text-xs text-slate-500">Gerencie rótulos personalizados para defeitos frequentes em garantias</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={handleCreateErrorCode} className="flex gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tela Quebrada, Oxidação, Placa Curta..."
                    value={newErrorCodeLabel}
                    onChange={(e) => setNewErrorCodeLabel(e.target.value)}
                    className={`flex-1 h-12 px-4 rounded-xl border outline-none font-bold text-sm transition-all focus:ring-2 focus:ring-blue-600/20 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isCreatingErrorCode}
                    className="px-6 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreatingErrorCode ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                    Adicionar
                  </button>
                </form>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Códigos Cadastrados</h3>
                  {isFetchingErrorCodes ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw size={24} className="text-blue-600 animate-spin" />
                    </div>
                  ) : warrantyErrorCodes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {warrantyErrorCodes.map((code) => (
                        <div 
                          key={code.id}
                          className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                            isDarkMode ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <span className="font-bold text-sm">{code.label}</span>
                          <button
                            onClick={() => handleDeleteErrorCode(code.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-8 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center space-y-2 ${
                      isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
                    }`}>
                      <AlertCircle className="text-slate-400" size={24} />
                      <p className="text-sm font-bold text-slate-500">Nenhum código cadastrado</p>
                      <p className="text-xs text-slate-400">Adicione rótulos para melhorar o detalhamento dos seus relatórios de garantia.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-8">
            {/* Custom SMTP Configuration Guide Section */}
            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20">
                <Mail size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">Servidor SMTP de E-mail (Supabase)</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Altamente Recomendado
                  </span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Substitua o servidor de envio padrão para evitar bloqueios no envio de e-mails de recuperação de senha.
                </p>
              </div>
            </div>

            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <span>Abrir Supabase</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="p-6 space-y-6">
            {/* Why Custom SMTP is Crucial Alert */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200/80 text-amber-800'}`}>
              <AlertCircle size={20} className="shrink-0 text-amber-500 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-amber-600 dark:text-amber-400">Por que configurar um SMTP externo (Resend ou SendGrid)?</p>
                <p className="leading-relaxed opacity-90">
                  O Supabase possui um servidor de e-mail gratuito integrado com <strong>limite estrito de apenas 3 a 4 envios por hora</strong> (erro <code>over_email_send_rate_limit</code>) e reputação compartilhada que frequentemente direciona mensagens para a caixa de Spam.
                </p>
                <p className="leading-relaxed opacity-90 font-medium">
                  Configurando um provedor profissional (como o <strong>Resend</strong> com 3.000 envios grátis/mês), seus e-mails de redefinição de senha chegam na Caixa de Entrada em menos de 2 segundos, sem falhas nem limites de taxa.
                </p>
              </div>
            </div>

            {/* Provider Selector Tabs */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                Selecione o Provedor de SMTP para ver as credenciais:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSmtpTab('resend')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    activeSmtpTab === 'resend'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-md ring-2 ring-blue-600/20'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Sparkles size={16} className="text-amber-500" />
                      <span>Resend</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-70">3.000 e-mails/mês gratuitos • Configuração em 2 min</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSmtpTab('sendgrid')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeSmtpTab === 'sendgrid'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-md ring-2 ring-blue-600/20'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Server size={16} />
                      <span>SendGrid</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Popular
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-70">100 e-mails/dia gratuitos • Alta entregabilidade</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSmtpTab('brevo')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeSmtpTab === 'brevo'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-md ring-2 ring-blue-600/20'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Zap size={16} />
                      <span>Brevo (Sendinblue)</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      300/dia
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-70">300 e-mails/dia gratuitos • Servidor na Europa</p>
                </button>
              </div>
            </div>

            {/* Provider Configuration Cards */}
            {activeSmtpTab === 'resend' && (
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border space-y-4 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500"></span>
                      <h4 className="font-bold text-sm">Dados de Conexão SMTP para o Resend</h4>
                    </div>
                    <a 
                      href="https://resend.com/signup" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Criar conta grátis no Resend.com
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Host SMTP</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">smtp.resend.com</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('smtp.resend.com', 'resend-host')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'resend-host' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Porta</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">465 (SSL) ou 587 (TLS)</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('465', 'resend-port')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'resend-port' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Usuário (User)</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">resend</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('resend', 'resend-user')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'resend-user' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Senha (Password)</span>
                        <span className="text-slate-500 font-medium">Sua API Key do Resend (ex: <code>re_123...</code>)</span>
                      </div>
                      <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Gerar API Key"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl text-xs space-y-1 border ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <p className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Info size={14} className="text-blue-500" />
                      E-mail do Remetente (Sender Email):
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Para testes rápidos, use <code>onboarding@resend.dev</code>. Para produção, adicione e verifique seu próprio domínio no Resend (ex: <code>nao-responda@suaempresa.com.br</code>).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSmtpTab === 'sendgrid' && (
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border space-y-4 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-blue-500"></span>
                      <h4 className="font-bold text-sm">Dados de Conexão SMTP para o SendGrid</h4>
                    </div>
                    <a 
                      href="https://signup.sendgrid.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Criar conta no SendGrid
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Host SMTP</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">smtp.sendgrid.net</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('smtp.sendgrid.net', 'sg-host')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'sg-host' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Porta</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">587</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('587', 'sg-port')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'sg-port' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Usuário (User)</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">apikey</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('apikey', 'sg-user')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'sg-user' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Senha (Password)</span>
                        <span className="text-slate-500 font-medium">Sua API Key com permissão <em>Full Access</em></span>
                      </div>
                      <a
                        href="https://app.sendgrid.com/settings/api_keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Gerar API Key"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl text-xs space-y-1 border ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <p className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Info size={14} className="text-blue-500" />
                      E-mail do Remetente (Sender Email):
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      O e-mail remetente precisa estar verificado no painel do SendGrid em <strong>Settings $\rightarrow$ Sender Authentication</strong> (Single Sender Verification).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSmtpTab === 'brevo' && (
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border space-y-4 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-purple-500"></span>
                      <h4 className="font-bold text-sm">Dados de Conexão SMTP para o Brevo</h4>
                    </div>
                    <a 
                      href="https://onboarding.brevo.com/account/register" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Criar conta no Brevo
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Host SMTP</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">smtp-relay.brevo.com</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('smtp-relay.brevo.com', 'brevo-host')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'brevo-host' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Porta</span>
                        <code className="font-mono font-bold text-slate-800 dark:text-slate-200">587</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard('587', 'brevo-port')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copiar"
                      >
                        {copiedKey === 'brevo-port' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Usuário (User)</span>
                        <span className="text-slate-500 font-medium">Seu e-mail cadastrado no Brevo</span>
                      </div>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Senha (Password)</span>
                        <span className="text-slate-500 font-medium">Chave SMTP gerada no painel do Brevo</span>
                      </div>
                      <a
                        href="https://app.brevo.com/settings/keys/smtp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Gerar Chave SMTP"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Step-by-Step Integration Guide */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Guia Passo a Passo: Integrando Resend ou SendGrid ao Supabase
                </h4>
                <span className="text-[11px] font-semibold text-slate-400">
                  Melhora a entregabilidade para 100% e remove o limite padrão de 3 e-mails/hora
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'}`}>
                  <div className="size-6 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center text-xs">
                    1
                  </div>
                  <h5 className="font-bold">Obtenha sua API Key</h5>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    Crie sua conta no <strong>Resend</strong> ou <strong>SendGrid</strong>, gere uma chave de API com permissão total e copie o token gerado.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'}`}>
                  <div className="size-6 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center text-xs">
                    2
                  </div>
                  <h5 className="font-bold">Valide o Remetente (SPF/DKIM)</h5>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    No provedor, adicione seu domínio ou valide seu e-mail remetente (ex: <code>contato@suaempresa.com.br</code>) para evitar que caia em spam.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'}`}>
                  <div className="size-6 rounded-lg bg-purple-600 text-white font-black flex items-center justify-center text-xs">
                    3
                  </div>
                  <h5 className="font-bold">Ative no Supabase</h5>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    No Supabase, vá em <strong>Project Settings $\rightarrow$ Authentication $\rightarrow$ SMTP Settings</strong>, ative o <strong>Custom SMTP</strong> e salve as credenciais.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'}`}>
                  <div className="size-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-xs">
                    4
                  </div>
                  <h5 className="font-bold">Preencha o .env & Teste</h5>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    Cole as variáveis no seu arquivo <code>.env.local</code> e dispare um teste de recuperação de senha para monitorar nos logs abaixo.
                  </p>
                </div>
              </div>

              {/* Environment Variables Template Box */}
              <div className={`p-5 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-white border-slate-800'}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-blue-400" />
                    <span className="font-bold text-xs text-white">
                      Placeholders de Variáveis de Ambiente (Adicionar no seu <code>.env.local</code>)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(
`# ==========================================
# Configurações de Conexão Supabase
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_supabase_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_supabase_service_role_key_aqui

# ==========================================
# Provedor SMTP / E-mails Transacionais
# ==========================================
# Escolha 'resend' ou 'sendgrid'
SMTP_PROVIDER=${activeSmtpTab}

# Configuração para ${activeSmtpTab === 'resend' ? 'Resend' : activeSmtpTab === 'sendgrid' ? 'SendGrid' : 'Brevo'}
SMTP_HOST=${activeSmtpTab === 'resend' ? 'smtp.resend.com' : activeSmtpTab === 'sendgrid' ? 'smtp.sendgrid.net' : 'smtp-relay.brevo.com'}
SMTP_PORT=${activeSmtpTab === 'resend' ? '465' : '587'}
SMTP_USER=${activeSmtpTab === 'resend' ? 'resend' : activeSmtpTab === 'sendgrid' ? 'apikey' : 'seu_email@dominio.com'}
SMTP_PASS=${activeSmtpTab === 'resend' ? 're_sua_api_key_resend_aqui' : activeSmtpTab === 'sendgrid' ? 'SG.sua_api_key_sendgrid_aqui' : 'sua_smtp_key_brevo'}
SMTP_SENDER_EMAIL=contato@suaempresa.com.br
SMTP_SENDER_NAME="Minha Empresa"`, 'env-template')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                  >
                    {copiedKey === 'env-template' ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span>Copiado para a área de transferência!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar Modelo .env ({activeSmtpTab.toUpperCase()})</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`# ==========================================
# Configurações de Conexão Supabase
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_supabase_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_supabase_service_role_key_aqui

# ==========================================
# Provedor SMTP / E-mails Transacionais
# ==========================================
SMTP_PROVIDER=${activeSmtpTab}
SMTP_HOST=${activeSmtpTab === 'resend' ? 'smtp.resend.com' : activeSmtpTab === 'sendgrid' ? 'smtp.sendgrid.net' : 'smtp-relay.brevo.com'}
SMTP_PORT=${activeSmtpTab === 'resend' ? '465' : '587'}
SMTP_USER=${activeSmtpTab === 'resend' ? 'resend' : activeSmtpTab === 'sendgrid' ? 'apikey' : 'seu_email@dominio.com'}
SMTP_PASS=${activeSmtpTab === 'resend' ? 're_sua_api_key_resend_aqui' : activeSmtpTab === 'sendgrid' ? 'SG.sua_api_key_sendgrid_aqui' : 'sua_smtp_key_brevo'}
SMTP_SENDER_EMAIL=contato@suaempresa.com.br
SMTP_SENDER_NAME="Minha Empresa"`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Email Audit Logs Viewer Section (audit_log_entries) */}
        <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
                <Activity size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">Logs de Envio de E-mails e Auditoria</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    auth.audit_log_entries
                  </span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Monitore em tempo real as tentativas de envio de e-mails de recuperação de senha e eventos de autenticação.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchEmailLogs}
                disabled={isLoadingLogs}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                } disabled:opacity-50`}
              >
                <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} />
                <span>Atualizar Logs</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Service Role Status Banner */}
            {!hasServiceRole ? (
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <AlertTriangle size={20} className="shrink-0 text-amber-500 mt-0.5" />
                <div className="text-xs space-y-1.5 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-bold text-sm text-amber-600 dark:text-amber-400">
                      Chave Administrativa (SUPABASE_SERVICE_ROLE_KEY) não detectada
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Modo Fallback Ativo
                    </span>
                  </div>
                  <p className="leading-relaxed opacity-90">
                    Sem a chave <code>SUPABASE_SERVICE_ROLE_KEY</code> configurada no ambiente do servidor, o sistema não consegue executar <code>client.auth.admin.createUser</code> e <code>client.auth.admin.updateUserById</code>. Os novos colaboradores são salvos apenas na tabela <code>profiles</code>, mas não aparecem na aba <strong>Authentication</strong> do Supabase nem conseguem redefinir senhas por e-mail.
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <a
                      href="https://supabase.com/dashboard/project/_/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      <span>Obter service_role no Supabase API Settings</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span>SUPABASE_SERVICE_ROLE_KEY ativa</span>
                  <span className="font-normal opacity-80 text-[11px]">— Comandos administrativos de Auth (createUser, updateUserById) habilitados</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
            )}

            {/* Filters and Search Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit">
                <button
                  type="button"
                  onClick={() => setLogFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    logFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Todos os Logs
                </button>

                <button
                  type="button"
                  onClick={() => setLogFilter('recovery')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'recovery'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Key size={12} />
                  <span>Recuperação de Senha</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLogFilter('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'email'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Mail size={12} />
                  <span>Disparos de E-mail</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por e-mail, evento ou IP..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className={`w-full h-10 pl-9 pr-3 rounded-xl text-xs border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            {/* Error / Warnings */}
            {logsError && (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Aviso sobre logs de auditoria:</p>
                  <p>{logsError}</p>
                </div>
              </div>
            )}

            {/* Logs Table / List */}
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
              {isLoadingLogs ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <div className="size-7 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Carregando logs de auditoria do Supabase...</p>
                </div>
              ) : (() => {
                const filtered = emailLogs.filter(log => {
                  if (!logSearch.trim()) return true;
                  const query = logSearch.toLowerCase();
                  return (
                    log.email?.toLowerCase().includes(query) ||
                    log.action?.toLowerCase().includes(query) ||
                    log.ip_address?.toLowerCase().includes(query) ||
                    JSON.stringify(log.payload)?.toLowerCase().includes(query)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-2">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <FileText size={24} />
                      </div>
                      <p className="font-bold text-sm">Nenhum log encontrado</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {logSearch 
                          ? 'Nenhum registro corresponde aos termos da busca digitada.'
                          : 'Ainda não foram registrados eventos nesta categoria na tabela auth.audit_log_entries. Ao solicitar redefinições de senha, os eventos aparecerão aqui automaticamente.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={isDarkMode ? 'bg-slate-900/80 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Data e Hora</th>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Ação / Evento</th>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Destinatário (E-mail)</th>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Endereço IP</th>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-center">Status</th>
                          <th className="p-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.map((log) => {
                          const isExpanded = expandedLogId === log.id;
                          const formattedDate = new Date(log.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          });

                          return (
                            <React.Fragment key={log.id}>
                              <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'}`}>
                                <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                  {formattedDate}
                                </td>

                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5">
                                    {log.isRecovery ? (
                                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        Password Recovery
                                      </span>
                                    ) : log.isEmailEvent ? (
                                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        Email Event
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
                                        {log.action}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                                  {log.email}
                                </td>

                                <td className="p-3.5 font-mono text-[11px] text-slate-500">
                                  {log.ip_address}
                                </td>

                                <td className="p-3.5 text-center">
                                  {log.status === 'delivered' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 size={11} />
                                      Disparado
                                    </span>
                                  ) : log.status === 'failed' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                      <AlertCircle size={11} />
                                      Falha
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-500">
                                      Registrado
                                    </span>
                                  )}
                                </td>

                                <td className="p-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                                    title="Ver payload JSON"
                                  >
                                    {isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded JSON Payload Drawer */}
                              {isExpanded && (
                                <tr className={isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50/80'}>
                                  <td colSpan={6} className="p-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                          <Terminal size={12} />
                                          Payload Bruto do Evento (auth.audit_log_entries)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(JSON.stringify(log.payload, null, 2), `payload-${log.id}`)}
                                          className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                                        >
                                          {copiedKey === `payload-${log.id}` ? (
                                            <>
                                              <Check size={12} className="text-emerald-500" />
                                              Copiado!
                                            </>
                                          ) : (
                                            <>
                                              <Copy size={12} />
                                              Copiar JSON
                                            </>
                                          )}
                                        </button>
                                      </div>
                                      <pre className={`p-3 rounded-xl font-mono text-[10px] overflow-x-auto border ${
                                        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                                      }`}>
                                        {JSON.stringify(log.payload, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    )}

        {/* Mobile Save Button */}
        <div className="sm:hidden pt-4">
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70"
          >
            {isSaving ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 z-50 whitespace-nowrap"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <Check size={20} />
            </div>
            Configurações salvas com sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
