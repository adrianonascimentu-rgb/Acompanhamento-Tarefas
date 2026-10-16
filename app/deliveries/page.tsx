'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { ArrowLeft, Search, Plus, Truck, User, Calendar, MapPin, DollarSign, Clock, X, Check, Package, ChevronRight, Filter, TrendingUp, PieChart as PieIcon, Edit2, Trash2, AlertCircle, Phone, Database, List, Map as MapIcon, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { BottomNav } from '@/components/BottomNav';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { LoginForm } from '@/components/auth/LoginForm';
import { supabase, handleSupabaseAuthError } from '@/lib/supabase';
import { getTodayLocalDateString, formatLocalDate } from '@/lib/utils';
import { getNeighborhoodCoords } from '@/lib/neighborhoodCoords';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getCurrentPosition } from '@/lib/navigation';
import { DeliveryProductItemsInput } from '@/components/deliveries/DeliveryProductItemsInput';

const DeliveriesMap = dynamic(() => import('@/components/deliveries/DeliveriesMap').then(mod => mod.DeliveriesMap), { 
  ssr: false,
  loading: () => <div className="w-full h-[600px] bg-slate-100 dark:bg-slate-800 animate-pulse rounded-[2.5rem]" />
});

const LiveTrackerMap = dynamic(() => import('@/components/deliveries/LiveTrackerMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
});

const MOCK_DELIVERIES = [
  { id: 1, date: '2026-03-10', shift: 'Manhã', vehicle: 'Fiorino ABC-1234', driver: 'Roberto Silva', value: 1250.50, neighborhood: 'Centro', city: 'São Paulo', product: 'Kit Manutenção Industrial', status: 'Pendente', seller: 'Carlos Vendedor', notes: '', phone: '(11) 98765-4321', address: 'Av. Paulista, 1000', delivery_type: 'padrao', is_special: false },
  { id: 2, date: '2026-03-10', shift: 'Tarde', vehicle: 'Moto XYZ-9876', driver: 'Marcos Souza', value: 450.00, neighborhood: 'Jardins', city: 'São Paulo', product: 'Peças de Reposição', status: 'Em Andamento', seller: 'Mariana Vendas', notes: 'Entregar na portaria', phone: '(11) 91234-5678', address: 'Rua Augusta, 500', delivery_type: 'padrao', is_special: false },
  { id: 3, date: '2026-03-11', shift: 'Manhã', vehicle: 'Caminhão DFG-5544', driver: 'João Pereira', value: 5800.00, neighborhood: 'Itaim Bibi', city: 'São Paulo', product: 'Equipamento de Proteção', status: 'Finalizada', seller: 'Carlos Vendedor', notes: '', phone: '(11) 99999-8888', address: 'Av. Faria Lima, 2000', delivery_type: 'padrao', is_special: false },
];

const isSpecialDelivery = (d: any) => {
  if (!d) return false;
  return d.delivery_type === 'especial' || 
         d.is_special === true || 
         d.notes?.includes('[ESPECIAL]') || 
         d.product?.includes('[ESPECIAL]') ||
         d.notes?.toLowerCase().includes('entrega especial') ||
         d.notes?.toLowerCase().includes('retirada especial');
};

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DeliveriesContent />
    </Suspense>
  );
}

function DeliveriesContent() {
  const { role, user, isAdmin, canAccessDeliveries, isAuthenticated, isLoading: roleLoading, login } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast, showConfirm } = useUI();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isMockMode, setIsMockMode] = useState(false);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveriesEnabled, setDeliveriesEnabled] = useState(true);
  const [sellerFilter, setSellerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('day'); // day, week, month

  useEffect(() => {
    const status = searchParams?.get('status');
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ name: '', plate: '' });
  const [newDriverName, setNewDriverName] = useState('');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedTrackerId, setExpandedTrackerId] = useState<number | string | null>(null);
  const [activeTrackingId, setActiveTrackingId] = useState<number | string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: getTodayLocalDateString(),
    shift: 'Manhã',
    vehicle: '',
    driver: '',
    driver_id: '',
    value: '',
    cep: '',
    neighborhood: '',
    city: '',
    product: '',
    seller: '',
    notes: '',
    phone: '',
    address: '',
    delivery_type: 'padrao',
    is_special: false
  });

  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Função para buscar endereço pelo CEP (Correios / ViaCEP)
  const handleCepLookup = async (cepValue?: string) => {
    const rawCep = (cepValue !== undefined ? cepValue : formData.cep).replace(/\D/g, '');
    if (rawCep.length !== 8) {
      showToast('Digite um CEP válido com 8 dígitos.', 'warning');
      return;
    }

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      if (!response.ok) throw new Error('Falha ao consultar CEP');
      const data = await response.json();

      if (data.erro) {
        showToast('CEP não encontrado nos Correios.', 'error');
        return;
      }

      setFormData(prev => ({
        ...prev,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        address: data.logradouro ? `${data.logradouro}` : prev.address
      }));

      showToast(`Endereço localizado: ${data.bairro || ''} - ${data.localidade || ''}`, 'success');
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      showToast('Não foi possível buscar o CEP no momento.', 'error');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const [isFixingSchema, setIsFixingSchema] = useState(false);

  const availableVehicles = React.useMemo(() => {
    const busyVehicles = deliveries
      .filter(d => d.date === formData.date && d.shift === formData.shift && d.status !== 'Finalizada' && d.id !== editingId)
      .map(d => d.vehicle);
    
    return vehicles.map(v => ({
      ...v,
      isBusy: busyVehicles.includes(`${v.name} ${v.plate}`)
    }));
  }, [vehicles, deliveries, formData.date, formData.shift, editingId]);

  const fixSchema = async () => {
    if (missingColumns.length === 0 && missingTables.length === 0) return;
    setIsFixingSchema(true);
    try {
      let sql = '';
      
      if (missingTables.includes('drivers')) {
        sql += `
          CREATE TABLE IF NOT EXISTS drivers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            phone TEXT,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
          );
          ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Allow all on drivers" ON drivers;
          CREATE POLICY "Allow all on drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
          INSERT INTO drivers (name)
          SELECT name FROM profiles WHERE role ILIKE '%entrega%' OR type = 'entregador' ON CONFLICT DO NOTHING;
        `;
      }

      sql += missingColumns.map(col => {
        if (col === 'route') return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} JSONB DEFAULT '[]';`;
        if (col === 'lat' || col === 'lng') return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} DOUBLE PRECISION;`;
        return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} TEXT;`;
      }).join('\n') + '\nNOTIFY pgrst, \'reload schema\';';
      
      navigator.clipboard.writeText(sql);
      showToast('SQL copiado! Execute no SQL Editor do Supabase.', 'success');
    } catch (err: any) {
      console.error('Error fixing schema:', err);
      showToast('Execute o SQL manualmente no Supabase.', 'error');
    } finally {
      setIsFixingSchema(false);
    }
  };

  const isCaixa = user?.role && user.role.toLowerCase().includes('caixa');
  const isEntregas = user?.role && (user.role.toLowerCase().includes('entrega') || user.role.toLowerCase().includes('entregas'));
  const isEstoque = user?.role && user.role.toLowerCase().includes('estoque');
  const isEntregador = role === 'entregador' || isEntregas;
  
  const hasAccess = isAuthenticated && canAccessDeliveries;
  const canCreate = canAccessDeliveries;
  const canUpdateStatus = isAdmin || isEntregador || isCaixa;

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'deliveries_enabled')
          .single();
        
        if (error) {
          const isJwtExpired = error.code === 'PGRST303' || error.message?.includes('JWT expired');
          if (isJwtExpired) {
            await handleSupabaseAuthError(error);
          } else {
            const isMissingTable = error.message?.includes('schema cache') || error.message?.includes('Could not find the table');
            const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('TypeError');
            const isRecursionError = error.code === '42P17' || error.message?.includes('infinite recursion');
            if (error.code !== 'PGRST116' && error.code !== '42P01' && !isMissingTable && !isNetworkError && !isRecursionError) {
              console.warn('Aviso ao buscar configurações de entregas:', error.message || error);
            }
          }
        } else if (data) {
          setDeliveriesEnabled(data.value === true);
        }
      } catch (err: any) {
        const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError' || err instanceof TypeError;
        if (!isNetworkError) {
          console.warn('Aviso inesperado ao buscar configurações de entregas:', err);
        }
      }
    }

    async function fetchDeliveries() {
      try {
        const isConfigured = 
          process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

        if (!isConfigured) {
          setDeliveries(MOCK_DELIVERIES);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('deliveries')
          .select('*')
          .order('date', { ascending: false });
        
        if (error) {
          console.warn('Error fetching deliveries, using mock data:', error.message);
          if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
            setIsMockMode(true);
          }
          if (error.message?.includes('Could not find the') && error.message?.includes('column')) {
            const match = error.message.match(/the '(.+?)' column/);
            if (match && match[1]) {
              setMissingColumns(prev => [...new Set([...prev, match[1]])]);
            }
          }
          setDeliveries(MOCK_DELIVERIES);
        } else {
          setDeliveries(data || MOCK_DELIVERIES);
        }
      } catch (err) {
        console.error('Error in fetchDeliveries:', err);
        setDeliveries(MOCK_DELIVERIES);
      } finally {
        setLoading(false);
      }
    }

    async function fetchVehicles() {
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('name');
        
        if (!error && data) {
          setVehicles(data);
        } else {
          setVehicles([
            { id: '1', name: 'Fiorino', plate: 'ABC-1234' },
            { id: '2', name: 'Moto', plate: 'XYZ-9876' },
            { id: '3', name: 'Caminhão', plate: 'DFG-5544' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      }
    }

    if (isAuthenticated && hasAccess) {
      fetchSettings();
      fetchDeliveries();
      fetchSellers();
      fetchVehicles();
      fetchDrivers();
    }

    // Real-time subscription
    const tables = ['deliveries', 'vehicles', 'profiles', 'system_settings', 'drivers'];
    const channels = tables.map(table => {
      return supabase
        .channel(`public:${table}-deliveries-realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          if (table === 'deliveries') fetchDeliveries();
          if (table === 'vehicles') fetchVehicles();
          if (table === 'profiles') fetchSellers();
          if (table === 'drivers') fetchDrivers();
          if (table === 'system_settings') fetchSettings();
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAuthenticated, hasAccess]);

  const toggleDeliveries = async () => {
    if (!isAdmin) return;
    const newValue = !deliveriesEnabled;
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'deliveries_enabled', value: newValue });
      
      if (!error) {
        setDeliveriesEnabled(newValue);
      }
    } catch (err) {
      console.error('Error toggling deliveries:', err);
    }
  };

  async function fetchSellers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, type, role')
        .or('type.eq.vendedor,role.ilike.%vendedor%,type.eq.gerente,role.ilike.%gerente%,type.eq.administrador,role.ilike.%admin%');
      
      if (!error && data && data.length > 0) {
        setSellers(data);
      } else {
        // Fallback mock sellers
        setSellers([
          { id: '88888888-8888-8888-8888-888888888888', name: 'Carlos Vendedor' },
          { id: '99999999-9999-9999-9999-999999999999', name: 'Mariana Vendas' },
          { id: '77777777-7777-7777-7777-777777777777', name: 'Gerente Silva' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching sellers:', err);
    }
  }

  async function fetchDrivers() {
    try {
      let combinedDrivers: any[] = [];

      // 1. Fetch delivery drivers from profiles (where type = 'entregador' or role matches)
      const { data: profileDrivers, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, phone, type, role')
        .or('type.eq.entregador,role.ilike.%entrega%,role.ilike.%entregador%,role.ilike.%motorista%')
        .order('name');

      if (!profileError && profileDrivers && profileDrivers.length > 0) {
        combinedDrivers = profileDrivers.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          isProfile: true
        }));
      }

      // 2. Also fetch from drivers table if it exists
      const { data: tableDrivers, error: tableError } = await supabase
        .from('drivers')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (!tableError && tableDrivers && tableDrivers.length > 0) {
        tableDrivers.forEach(td => {
          const alreadyExists = combinedDrivers.some(
            cd => cd.name?.toLowerCase().trim() === td.name?.toLowerCase().trim()
          );
          if (!alreadyExists) {
            combinedDrivers.push({
              id: td.id,
              name: td.name,
              phone: td.phone,
              isProfile: false
            });
          }
        });
      }

      if (combinedDrivers.length > 0) {
        setDrivers(combinedDrivers);
      } else if (tableError || profileError) {
        const error = tableError || profileError;
        console.warn('Error fetching drivers:', error?.message);
        
        // Only use mock fallback if we are in mock mode OR table is really missing
        const isTableMissing = error?.code === '42P01' || error?.message?.includes('Could not find the table');
        if (isMockMode || isTableMissing) {
          if (isTableMissing && tableError) setMissingTables(prev => [...new Set([...prev, 'drivers'])]);
          
          setDrivers([
            { id: '11111111-1111-1111-1111-111111111111', name: 'Roberto Silva', isMock: true },
            { id: '22222222-2222-2222-2222-222222222222', name: 'João Pereira', isMock: true }
          ]);
        } else {
          setDrivers([]);
        }
      } else {
        setDrivers([]);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  }

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.name || !newVehicle.plate) return;
    
    setIsAddingVehicle(true);
    try {
      const payload = { 
        name: newVehicle.name, 
        plate: newVehicle.plate,
        company_id: user?.company_id || null
      };

      const { data, error } = await supabase
        .from('vehicles')
        .insert([payload])
        .select();
        
      if (!error && data) {
        setVehicles([...vehicles, data[0]]);
        setFormData({ ...formData, vehicle: `${data[0].name} ${data[0].plate}` });
        setShowVehicleModal(false);
        setNewVehicle({ name: '', plate: '' });
        showToast('Veículo cadastrado com sucesso!', 'success');
      } else {
        console.error('Supabase error inserting vehicle:', JSON.stringify(error, null, 2));
        
        if (isMockMode || error?.code === '42P01' || error?.message?.includes('Could not find the table')) {
          // Mock mode
          const mockVehicle = { id: Math.random().toString(), name: newVehicle.name, plate: newVehicle.plate };
          setVehicles([...vehicles, mockVehicle]);
          setFormData({ ...formData, vehicle: `${mockVehicle.name} ${mockVehicle.plate}` });
          setShowVehicleModal(false);
          setNewVehicle({ name: '', plate: '' });
          showToast('Veículo cadastrado com sucesso (Mock)!', 'success');
        } else {
          showToast('Erro ao cadastrar veículo. Verifique as permissões.', 'error');
        }
      }
    } catch (err) {
      console.error('Error adding vehicle:', err);
      showToast('Erro ao cadastrar veículo', 'error');
    } finally {
      setIsAddingVehicle(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName) return;
    
    setIsAddingDriver(true);
    try {
      const payload = { 
        name: newDriverName,
        active: true,
        company_id: user?.company_id || null
      };

      const { data, error } = await supabase
        .from('drivers')
        .insert([payload])
        .select();
        
      if (!error && data) {
        setDrivers([...drivers, data[0]]);
        setFormData({ 
          ...formData, 
          driver: data[0].name,
          driver_id: data[0].id 
        });
        setShowDriverModal(false);
        setNewDriverName('');
        showToast('Motorista cadastrado com sucesso!', 'success');
      } else {
        console.error('Supabase error inserting driver:', JSON.stringify(error, null, 2));
        
        if (isMockMode || error?.code === '42P01' || error?.message?.includes('Could not find the table')) {
          // Mock mode - use a valid UUID-like string if possible, or just a random one
          const mockId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          const mockDriver = { id: mockId, name: newDriverName, active: true, isMock: true };
          setDrivers([...drivers, mockDriver]);
          setFormData({ 
            ...formData, 
            driver: mockDriver.name,
            driver_id: mockDriver.id
          });
          setShowDriverModal(false);
          setNewDriverName('');
          showToast('Motorista cadastrado com sucesso (Modo Simulação)!', 'success');
        } else {
          showToast('Erro ao cadastrar motorista. Verifique as permissões.', 'error');
        }
      }
    } catch (err) {
      console.error('Error adding driver:', err);
      showToast('Erro ao cadastrar motorista', 'error');
    } finally {
      setIsAddingDriver(false);
    }
  };

  const handleStatusUpdate = async (id: number | string, newStatus: string) => {
    if (!canUpdateStatus) {
      showToast('Você não tem permissão para alterar o status da entrega.', 'error');
      return;
    }
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
        !isMockMode;

      const delivery = deliveries.find(d => d.id === id);
      let updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // If starting delivery, initialize route if empty
      if (newStatus === 'Em Andamento' && (!delivery.route || delivery.route.length === 0)) {
        // Use current lat/lng as starting point if available
        if (delivery.lat && delivery.lng) {
          updateData.route = [[delivery.lat, delivery.lng]];
        }
      }

      if (isConfigured) {
        let currentPayload = { ...updateData };
        let success = false;
        let retryCount = 0;
        let lastError = null;

        while (!success && retryCount < 5) {
          try {
            const { error } = await supabase
              .from('deliveries')
              .update(currentPayload)
              .eq('id', id);
            
            if (error) throw error;
            success = true;
          } catch (err: any) {
            lastError = err;
            if (err.message?.includes('Could not find the') && err.message?.includes('column')) {
              const match = err.message.match(/the '(.+?)' column/);
              const missingCol = match ? match[1] : null;
              if (missingCol) {
                setMissingColumns(prev => [...new Set([...prev, missingCol])]);
                delete (currentPayload as any)[missingCol];
                retryCount++;
                continue;
              }
            }
            throw err;
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
      }
      
      setDeliveries(deliveries.map(d => d.id === id ? { ...d, ...updateData } : d));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Erro ao atualizar status da entrega.');
    }
  };

  const recordCurrentPosition = useCallback(async (id: number | string) => {
    const delivery = deliveries.find(d => d.id === id);
    if (!delivery) return;

    try {
      const coords = await getCurrentPosition();
      const newLat = coords.lat;
      const newLng = coords.lng;
      
      const newRoute = [...(delivery.route || []), [newLat, newLng]];

      // Validação de proximidade com o destino (< 50m)
      const targetLat = delivery.destination_lat ?? delivery.lat;
      const targetLng = delivery.destination_lng ?? delivery.lng;
      let isWithin50m = false;
      let distMeters = 0;

      if (targetLat != null && targetLng != null && typeof newLat === 'number' && typeof newLng === 'number') {
        const R = 6371000;
        const dLat = (targetLat - newLat) * (Math.PI / 180);
        const dLon = (targetLng - newLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(newLat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distMeters = R * c;
        if (distMeters < 50) {
          isWithin50m = true;
        }
      }
      
      const updateData: any = {
        lat: newLat,
        lng: newLng,
        driver_lat: newLat,
        driver_lng: newLng,
        current_lat: newLat,
        current_lng: newLng,
        route: newRoute,
        updated_at: new Date().toISOString()
      };

      if (isWithin50m && delivery.status !== 'Finalizada') {
        updateData.status = 'Finalizada';
        updateData.auto_finalized = true;
        updateData.finalized_at = new Date().toISOString();
      }

      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
        !isMockMode;

      if (isConfigured) {
        let currentPayload = { ...updateData };
        let success = false;
        let retryCount = 0;
        let lastError = null;

        while (!success && retryCount < 5) {
          try {
            const { error } = await supabase
              .from('deliveries')
              .update(currentPayload)
              .eq('id', id);
            
            if (error) throw error;
            success = true;
          } catch (err: any) {
            lastError = err;
            if (err.message?.includes('Could not find the') && err.message?.includes('column')) {
              const match = err.message.match(/the '(.+?)' column/);
              const missingCol = match ? match[1] : null;
              if (missingCol) {
                setMissingColumns(prev => [...new Set([...prev, missingCol])]);
                delete (currentPayload as any)[missingCol];
                retryCount++;
                continue;
              }
            }
            throw err;
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
      }
      
      setDeliveries(deliveries.map(d => d.id === id ? { ...d, ...updateData } : d));
      if (isWithin50m) {
        showToast(`🎉 Destino alcançado (${Math.round(distMeters)}m < 50m)! Entrega finalizada automaticamente.`, 'success');
      } else {
        showToast('Posição atualizada!', 'success');
      }
    } catch (err: any) {
      console.error('Error recording position:', err);
      showToast(err.message || 'Erro ao obter sua localização.', 'error');
      
      // Se o erro for de permissão negada, para o rastreamento automático para não inundar o usuário com erros
      if (err.message?.includes('Permissão de GPS negada')) {
        setActiveTrackingId(null);
      }
    }
  }, [deliveries, isMockMode, showToast]);

  // Auto-tracking for drivers
  useEffect(() => {
    let interval: any;
    if (activeTrackingId) {
      // Record immediately
      recordCurrentPosition(activeTrackingId);
      // Then every 30 seconds
      interval = setInterval(() => {
        recordCurrentPosition(activeTrackingId);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [activeTrackingId, recordCurrentPosition]);

  const handleEdit = (delivery: any) => {
    // Tenta resolver o driver_id de forma segura
    // Se estivermos em modo real (isConfigured), só aceitamos IDs que existam na lista de motoristas do banco
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
      !isMockMode;

    const matchedDriver = drivers.find(d => d.id === delivery.driver_id || d.name === delivery.driver);
    
    // Se for modo real e não achou o motorista na lista oficial (ou se for ID de teste), limpa o ID para evitar erro de FK
    let resolvedDriverId = matchedDriver?.id || delivery.driver_id || '';
    if (isConfigured && resolvedDriverId) {
      const driverInfo = drivers.find(d => d.id === resolvedDriverId);
      const isMockId = resolvedDriverId.includes('11111111') || 
                      resolvedDriverId.includes('22222222') || 
                      driverInfo?.isMock === true;
      
      if (isMockId || !driverInfo) {
        resolvedDriverId = '';
      }
    }

    const isSpecial = isSpecialDelivery(delivery);

    setFormData({
      date: delivery.date,
      shift: delivery.shift,
      vehicle: delivery.vehicle,
      driver: delivery.driver,
      driver_id: resolvedDriverId,
      value: delivery.value.toString(),
      cep: delivery.cep || '',
      neighborhood: delivery.neighborhood,
      city: delivery.city,
      product: delivery.product,
      seller: delivery.seller || '',
      notes: delivery.notes || '',
      phone: delivery.phone || '',
      address: delivery.address || '',
      delivery_type: isSpecial ? 'especial' : 'padrao',
      is_special: isSpecial
    });
    setEditingId(delivery.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrega?')) return;
    
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (isConfigured) {
        const { error } = await supabase
          .from('deliveries')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
      }
      
      setDeliveries(deliveries.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting delivery:', err);
      alert('Erro ao excluir entrega.');
    }
  };

  const broadcastSpecialDeliveryNotification = async (delivery: any) => {
    try {
      const dateFormatted = formatLocalDate(delivery.date);
      const title = '⚠️ ENTREGA/RETIRADA ESPECIAL AGENDADA';
      const message = `Atenção: Entrega/Retirada Especial para o dia ${dateFormatted} (${delivery.shift}). Favor NÃO marcar nenhuma entrega para esta data!`;

      // 1. Notificar todos os perfis cadastrados no sistema
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name');

      if (profiles && profiles.length > 0) {
        const notificationsPayload = profiles.map(p => ({
          profile_id: p.id,
          title,
          message,
          type: 'warning',
          read: false,
          created_at: new Date().toISOString()
        }));

        await supabase.from('notifications').insert(notificationsPayload);
      }

      // 2. Disparar notificação Push para celulares/navegadores
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: message,
          url: `/deliveries?status=especial`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png'
        })
      }).catch(err => console.warn('Erro ao disparar push especial:', err));

      showToast(`Aviso emitido: Entrega Especial reservada para ${dateFormatted}!`, 'warning');
    } catch (e) {
      console.warn('Erro ao disparar notificações de entrega especial:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let deliveryData: any = null;
    let supabasePayload: any = null;
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
        !isMockMode;

      // Resolve initial coordinates using regional table or geocoding
      let initialLat = -7.1150;
      let initialLng = -34.8631;
      const regionalCoords = getNeighborhoodCoords(formData.neighborhood, formData.city);
      if (regionalCoords) {
        initialLat = regionalCoords[0];
        initialLng = regionalCoords[1];
      }

      // Try geocode if address is present
      if (formData.address && formData.address.trim().length > 3) {
        try {
          const geoRes = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address: formData.address,
              neighborhood: formData.neighborhood,
              city: formData.city,
              state: 'Paraíba'
            })
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.lat && geoData.lng) {
              initialLat = geoData.lat;
              initialLng = geoData.lng;
            }
          }
        } catch (e) {
          console.warn('Geocode error on submit:', e);
        }
      }

      // Sanitize driver_id: se estivermos salvando no banco real, garantimos que o ID existe na tabela de motoristas
      // Isso evita erros de chave estrangeira com dados de teste ou IDs obsoletos
      let sanitizedDriverId = formData.driver_id ? formData.driver_id.trim() : null;
      if (sanitizedDriverId === '' || sanitizedDriverId === '0') {
        sanitizedDriverId = null;
      }

      if (isConfigured && sanitizedDriverId) {
        // Verifica se é um formato UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(sanitizedDriverId);

        // Busca o motorista na lista local para verificar se é um ID real ou mock
        const driverInfo = drivers.find(d => d.id === sanitizedDriverId);
        const isMockId = sanitizedDriverId.includes('11111111') || 
                        sanitizedDriverId.includes('22222222') || 
                        driverInfo?.isMock === true;
        
        if (!isValidUUID || isMockId || !driverInfo) {
          sanitizedDriverId = null;
        }
      }

      const isSpecial = formData.delivery_type === 'especial' || formData.is_special === true;
      let notesWithMarker = formData.notes || '';
      if (isSpecial && !notesWithMarker.includes('[ESPECIAL]')) {
        notesWithMarker = `[ESPECIAL] ${notesWithMarker}`.trim();
      } else if (!isSpecial && notesWithMarker.includes('[ESPECIAL]')) {
        notesWithMarker = notesWithMarker.replace('[ESPECIAL]', '').trim();
      }

      deliveryData = {
        date: formData.date,
        shift: formData.shift,
        vehicle: formData.vehicle,
        driver: formData.driver,
        driver_id: sanitizedDriverId,
        value: parseFloat(formData.value) || 0,
        neighborhood: formData.neighborhood,
        city: formData.city,
        product: formData.product,
        seller: formData.seller,
        notes: notesWithMarker,
        phone: formData.phone,
        address: formData.address,
        status: 'Agendada',
        delivery_type: isSpecial ? 'especial' : 'padrao',
        is_special: isSpecial,
        destination_lat: initialLat,
        destination_lng: initialLng,
        lat: initialLat,
        lng: initialLng,
        route: [],
        updated_at: new Date().toISOString(),
        company_id: user?.company_id || null
      };

      supabasePayload = { ...deliveryData };

      if (isConfigured) {
        let currentPayload = { ...supabasePayload };
        let success = false;
        let retryCount = 0;
        let lastError = null;
        
        while (!success && retryCount < 10) {
          try {
            if (editingId) {
              const { data, error } = await supabase
                .from('deliveries')
                .update(currentPayload)
                .eq('id', editingId)
                .select();
              
              if (error) throw error;
              if (data) {
                // Merge the saved data with the original deliveryData so we don't lose dropped columns in the UI
                setDeliveries(deliveries.map(d => d.id === editingId ? { ...data[0], ...deliveryData } : d));
              }
            } else {
              const { data, error } = await supabase
                .from('deliveries')
                .insert([currentPayload])
                .select();
              
              if (error) throw error;
              if (data) {
                // Merge the saved data with the original deliveryData so we don't lose dropped columns in the UI
                setDeliveries([{ ...data[0], ...deliveryData }, ...deliveries]);
              }
            }
            success = true;
          } catch (err: any) {
            lastError = err;
            
            // Handle foreign key constraint error on driver_id (deliveries_driver_id_fkey or code 23503)
            const isDriverFkError = 
              err.message?.includes('deliveries_driver_id_fkey') || 
              (err.code === '23503' && (
                err.message?.includes('driver_id') || 
                err.details?.includes('driver_id') || 
                err.message?.includes('deliveries')
              ));

            if (isDriverFkError && currentPayload.driver_id) {
              console.warn('Foreign key violation on driver_id. Retrying with driver_id set to null...');
              currentPayload.driver_id = null;
              retryCount++;
              continue;
            }

            // Handle foreign key error on company_id
            if (err.code === '23503' && (err.message?.includes('company_id') || err.details?.includes('company_id')) && currentPayload.company_id) {
              console.warn('Foreign key violation on company_id. Retrying with company_id set to null...');
              currentPayload.company_id = null;
              retryCount++;
              continue;
            }

            // Handle missing column errors (PostgREST specific)
            if (err.message?.includes('Could not find the') && err.message?.includes('column')) {
              const match = err.message.match(/the '(.+?)' column/);
              const missingCol = match ? match[1] : null;
              if (missingCol) {
                setMissingColumns(prev => [...new Set([...prev, missingCol])]);
                delete (currentPayload as any)[missingCol];
                retryCount++;
                continue;
              }
            }

            // Handle Network Errors (Failed to fetch) - Transient connectivity issues
            const isNetworkError = err.message === 'Failed to fetch' || 
                                   err.message?.includes('Failed to fetch') || 
                                   err.name === 'TypeError';
            
            if (isNetworkError && retryCount < 5) {
              retryCount++;
              console.warn(`Tentativa ${retryCount} falhou (erro de rede). Tentando novamente em breve...`);
              await new Promise(resolve => setTimeout(resolve, 800 * retryCount));
              continue;
            }

            // If it's not a recoverable error, break and throw
            throw err;
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
      } else {
        // Mock mode
        if (editingId) {
          setDeliveries(deliveries.map(d => d.id === editingId ? { ...deliveryData, id: editingId } : d));
        } else {
          setDeliveries([{ ...deliveryData, id: Math.floor(Math.random() * 10000) }, ...deliveries]);
        }
      }
      
      if (isSpecial) {
        await broadcastSpecialDeliveryNotification(deliveryData);
      }

      setShowAddModal(false);
      setEditingId(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Ensure the newly created delivery is visible by resetting filter to 'all' or matching the date
      setPeriodFilter('all');
      
      // Reset form
      setFormData({
        date: getTodayLocalDateString(),
        shift: 'Manhã',
        vehicle: '',
        driver: '',
        driver_id: '',
        value: '',
        cep: '',
        neighborhood: '',
        city: '',
        product: '',
        seller: '',
        notes: '',
        phone: '',
        address: '',
        delivery_type: 'padrao',
        is_special: false
      });
    } catch (err: any) {
      console.error('Error saving delivery:', err.message);
      
      let errorMessage = 'Erro ao salvar entrega: ' + err.message;
      
      // Better message for "Failed to fetch"
      if (err.message === 'Failed to fetch' || err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMessage = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
      }

      if (err.code === '42P01' || err.message?.includes('Could not find the table')) {
        setIsMockMode(true);
        // If it's a table error, we can just save it to the local state (mock mode)
        if (editingId) {
          setDeliveries(deliveries.map(d => d.id === editingId ? { ...deliveryData, id: editingId } : d));
        } else {
          setDeliveries([{ ...deliveryData, id: Math.floor(Math.random() * 10000) }, ...deliveries]);
        }
        setShowAddModal(false);
        setEditingId(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setPeriodFilter('all');
        return;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleLoading || (loading && isAuthenticated && hasAccess)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  if (!hasAccess) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="p-4 bg-rose-50 rounded-full text-rose-600 mb-4">
          <Truck size={48} />
        </div>
        <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acesso Restrito</h1>
        <p className="text-slate-500 mt-2">Você não tem permissão para acessar o módulo de entregas.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para o Início
        </Link>
      </div>
    );
  }

  if (!deliveriesEnabled && !isAdmin && !isEntregador && !isEstoque) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="p-4 bg-amber-50 rounded-full text-amber-600 mb-4">
          <Clock size={48} />
        </div>
        <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Módulo Desativado</h1>
        <p className="text-slate-500 mt-2">O módulo de entregas está temporariamente desativado pelo administrador.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para o Início
        </Link>
      </div>
    );
  }

  const filteredDeliveries = deliveries.filter(d => {
    if (!d || !d.date) return false;
    const matchesSeller = sellerFilter === 'all' || d.seller === sellerFilter;
    const isSpecial = isSpecialDelivery(d);
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'especial' 
        ? isSpecial 
        : d.status === statusFilter;

    const parts = d.date.split('-');
    if (parts.length !== 3) return false;
    
    const [y, m, day_] = parts.map(Number);
    const deliveryDate = new Date(y, m - 1, day_);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let matchesPeriod = true;
    if (periodFilter === 'day') {
      matchesPeriod = deliveryDate.toDateString() === today.toDateString();
    } else if (periodFilter === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      matchesPeriod = deliveryDate.toDateString() === tomorrow.toDateString();
    } else if (periodFilter === 'week') {
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(today.getDate() - 7);
      matchesPeriod = deliveryDate >= oneWeekAgo;
    } else if (periodFilter === 'next_week') {
      const nextWeekStart = new Date(today);
      const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
      const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      nextWeekStart.setDate(today.getDate() + daysUntilNextMonday);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      matchesPeriod = deliveryDate >= nextWeekStart && deliveryDate <= nextWeekEnd;
    } else if (periodFilter === 'month') {
      matchesPeriod = deliveryDate.getMonth() === today.getMonth() && deliveryDate.getFullYear() === today.getFullYear();
    } else if (periodFilter === 'last_month') {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      matchesPeriod = deliveryDate.getMonth() === lastMonth.getMonth() && deliveryDate.getFullYear() === lastMonth.getFullYear();
    }

    return matchesSeller && matchesStatus && matchesPeriod;
  });

  // Calculate statistics
  const stats = {
    total: filteredDeliveries.length,
    agendada: filteredDeliveries.filter(d => d.status === 'Agendada').length,
    pendente: filteredDeliveries.filter(d => d.status === 'Pendente').length,
    emAndamento: filteredDeliveries.filter(d => d.status === 'Em Andamento').length,
    finalizada: filteredDeliveries.filter(d => d.status === 'Finalizada').length,
    especial: filteredDeliveries.filter(d => isSpecialDelivery(d)).length,
    totalValue: filteredDeliveries.reduce((acc, d) => acc + (parseFloat(d.value) || 0), 0)
  };

  const shiftData = [
    { name: 'Manhã', value: deliveries.filter(d => d.shift === 'Manhã').length },
    { name: 'Tarde', value: deliveries.filter(d => d.shift === 'Tarde').length }
  ];

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-lg font-bold leading-tight tracking-tight text-center">Gestão de Entregas</h2>
            {!deliveriesEnabled && isAdmin && (
              <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest">Desativado para usuários</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Seller Dropdown */}
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className={`p-2 rounded-full text-xs font-bold border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              <option value="all">Todos Vendedores</option>
              {sellers.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              {viewMode === 'list' ? <MapIcon size={20} /> : <List size={20} />}
            </button>
            <div className={`flex size-10 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
              <Search size={20} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-6">
          {/* Mock Mode Alert */}
          {isMockMode && (
            <div className={`p-4 rounded-3xl border flex items-start gap-3 transition-all ${isDarkMode ? 'bg-amber-900/20 border-amber-800/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold leading-tight">Banco de Dados não Configurado</h4>
                <p className="text-[10px] mt-1 opacity-80 leading-relaxed font-medium">
                  A tabela &quot;deliveries&quot; não foi encontrada no seu Supabase. O sistema está operando em <strong>Modo Simulação</strong>. 
                  Para salvar permanentemente, execute o SQL de migração no seu painel do Supabase.
                </p>
              </div>
            </div>
          )}

          {/* Missing Columns or Tables Alert */}
          {(missingColumns.length > 0 || missingTables.length > 0) && (
            <div className={`p-4 rounded-3xl border flex items-start gap-3 transition-all ${isDarkMode ? 'bg-rose-900/20 border-rose-800/50 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold leading-tight">Estrutura do Banco Pendente</h4>
                <p className="text-[10px] mt-1 opacity-80 leading-relaxed font-medium">
                  Identificamos que algumas tabelas ou colunas precisam ser criadas no Supabase: 
                  {missingTables.length > 0 && <span className="block mt-1">Tabelas: <strong>{missingTables.join(', ')}</strong></span>}
                  {missingColumns.length > 0 && <span className="block mt-1">Colunas: <strong>{missingColumns.join(', ')}</strong></span>}
                </p>
                <div className={`mt-2 p-2 rounded-lg font-mono text-[9px] max-h-32 overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-rose-400' : 'bg-white text-rose-600'}`}>
                  {missingTables.includes('drivers') && (
                    <div className="mb-2">
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
                    </div>
                  )}
                  {missingColumns.map(col => {
                    if (col === 'route') return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} JSONB DEFAULT '[]';\n`;
                    if (col === 'lat' || col === 'lng') return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} DOUBLE PRECISION;\n`;
                    return `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ${col} TEXT;\n`;
                  })}
                  {"\nNOTIFY pgrst, 'reload schema';"}
                </div>
                <button
                  onClick={fixSchema}
                  disabled={isFixingSchema}
                  className={`mt-3 px-4 py-2 rounded-xl text-xs font-bold transition-all w-full flex items-center justify-center gap-2 ${
                    isDarkMode 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50' 
                      : 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50'
                  }`}
                >
                  {isFixingSchema ? (
                    <div className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Database size={14} />
                  )}
                  {isFixingSchema ? 'Corrigindo...' : 'Tentar Corrigir Automaticamente'}
                </button>
              </div>
            </div>
          )}

          {/* Statistics Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Delivery Stats in a column */}
            <div className="grid grid-cols-1 gap-3">
              <div className={`p-2 md:p-3 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Truck size={14} />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                </div>
                <p className="text-lg font-black">{stats.total}</p>
                <p className="text-[8px] text-slate-500 font-medium">Entregas hoje</p>
              </div>
              {(isAdmin || (user?.role && user.role.toLowerCase().includes('gerente'))) && (
                <div className={`p-2 md:p-3 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <DollarSign size={14} />
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Valor</span>
                  </div>
                  <p className="text-base font-black text-emerald-600">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-[8px] text-slate-500 font-medium">Valor total da carga</p>
                </div>
              )}
            </div>
            
            {/* Status grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Agendadas', value: stats.agendada, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/20' },
                { label: 'Pendentes', value: stats.pendente, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                { label: 'Em Andamento', value: stats.emAndamento, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Finalizadas', value: stats.finalizada, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: '⭐ Especiais', value: stats.especial, color: 'text-amber-600 dark:text-amber-400 font-extrabold', bg: 'bg-amber-100/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' }
              ].map((item, i) => (
                <div key={i} className={`p-2 rounded-xl border text-center transition-all ${item.bg || (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}>
                    <p className={`text-base font-black ${item.color}`}>{item.value}</p>
                    <p className="text-[8px] text-slate-500 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="p-4 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Período de Entrega</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
                  {[
                    { id: 'all', label: 'Todo Período', icon: List },
                    { id: 'day', label: 'Hoje', icon: Clock },
                    { id: 'tomorrow', label: 'Amanhã', icon: Calendar },
                    { id: 'week', label: 'Esta Semana', icon: Calendar },
                    { id: 'next_week', label: 'Próxima Semana', icon: Calendar },
                    { id: 'month', label: 'Este Mês', icon: Calendar },
                    { id: 'last_month', label: 'Mês Passado', icon: Database },
                  ].map(p => {
                    const Icon = p.icon;
                    const isActive = periodFilter === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPeriodFilter(p.id)}
                        className={`flex items-center justify-center px-4 py-2.5 rounded-full border transition-all gap-2 whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-95'
                            : isDarkMode 
                              ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' 
                              : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                        <span className="text-xs font-bold">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status / Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                {[
                  { id: 'all', label: 'Todos os Status' },
                  { id: 'especial', label: '⭐ Especiais', count: stats.especial, isSpecial: true },
                  { id: 'Agendada', label: 'Agendadas' },
                  { id: 'Pendente', label: 'Pendentes' },
                  { id: 'Em Andamento', label: 'Em Andamento' },
                  { id: 'Finalizada', label: 'Finalizadas' }
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      statusFilter === st.id
                        ? st.isSpecial
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-white shadow-md'
                          : 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : st.isSpecial
                          ? isDarkMode ? 'bg-amber-950/40 border-amber-800/80 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                          : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{st.label}</span>
                    {st.isSpecial && stats.especial > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-black">
                        {stats.especial}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Deliveries List or Map */}
          {viewMode === 'map' ? (
            <DeliveriesMap deliveries={filteredDeliveries} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lista de Entregas</h3>
                <span className="text-[10px] font-bold text-blue-600 uppercase">{filteredDeliveries.length} registros</span>
              </div>
            {filteredDeliveries.length > 0 ? (
              filteredDeliveries.map((delivery, idx) => {
                const isSpecial = isSpecialDelivery(delivery);
                return (
                <motion.div
                  key={delivery.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 md:p-5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                    isSpecial
                      ? isDarkMode 
                        ? 'bg-gradient-to-br from-amber-950/70 via-slate-900 to-orange-950/50 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-2 ring-amber-400/30'
                        : 'bg-gradient-to-br from-amber-50/95 via-orange-50/70 to-rose-50/80 border-amber-500 shadow-[0_6px_30px_rgba(245,158,11,0.25)] ring-2 ring-amber-400/40'
                      : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  {/* Striking Special Delivery Banner */}
                  {isSpecial && (
                    <div className="mb-3 -mt-1 p-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white flex items-center justify-between shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                        <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={14} className="text-amber-200" />
                          Entrega / Retirada Especial
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-full border border-white/20">
                        ⚠️ Data Bloqueada
                      </span>
                    </div>
                  )}

                  {/* Warning Strip for Team */}
                  {isSpecial && (
                    <div className={`mb-3 p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      isDarkMode 
                        ? 'bg-amber-950/50 border-amber-800 text-amber-300' 
                        : 'bg-amber-100/90 border-amber-300 text-amber-900'
                    }`}>
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <span><strong>AVISO À EQUIPE:</strong> Não agendar entregas para o dia {formatLocalDate(delivery.date)} ({delivery.shift}).</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`size-9 md:size-10 rounded-xl flex items-center justify-center ${
                        isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <Truck size={18} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm md:text-base leading-tight">{delivery.driver}</h3>
                        <div className="flex items-center gap-4 mt-0.5">
                          <div className="flex items-center gap-1.5 ">
                            <Clock size={10} className="md:w-3 md:h-3" />
                            <p className="text-[10px] md:text-xs font-medium text-slate-500">{delivery.shift} • {formatLocalDate(delivery.date)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${
                        delivery.status === 'Agendada' ? 'bg-slate-100 text-slate-600' :
                        delivery.status === 'Pendente' ? 'bg-amber-100 text-amber-600' :
                        delivery.status === 'Em Andamento' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {delivery.status}
                      </span>
                      {(delivery.lat || delivery.status === 'Em Andamento') && (
                        <button 
                          onClick={() => setExpandedTrackerId(expandedTrackerId === delivery.id ? null : delivery.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                            expandedTrackerId === delivery.id
                              ? 'bg-slate-800 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <MapIcon size={12} />
                          {expandedTrackerId === delivery.id ? 'Fechar Mapa' : 'Ver Mapa'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {canUpdateStatus && (
                    <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4">
                      {['Pendente', 'Agendada', 'Em Andamento', 'Finalizada'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusUpdate(delivery.id, status)}
                          className={`px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold transition-all border ${
                            delivery.status === status
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                      {delivery.status === 'Em Andamento' && (
                        <>
                          <button
                            onClick={() => recordCurrentPosition(delivery.id)}
                            className={`px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                              isDarkMode ? 'bg-indigo-900/30 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                            }`}
                          >
                            <MapPin size={10} className="md:w-3 md:h-3" />
                            Marcar Posição
                          </button>
                          <button
                            onClick={() => setActiveTrackingId(activeTrackingId === delivery.id ? null : delivery.id)}
                            className={`px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                              activeTrackingId === delivery.id
                                ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse'
                                : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className={`size-1.5 rounded-full ${activeTrackingId === delivery.id ? 'bg-white' : 'bg-slate-400'}`} />
                            {activeTrackingId === delivery.id ? 'Transmitindo GPS...' : 'Transmitir GPS'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {expandedTrackerId === delivery.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mb-4">
                          <LiveTrackerMap 
                            lat={delivery.lat}
                            lng={delivery.lng}
                            route={delivery.route}
                            driverName={delivery.driver}
                            status={delivery.status}
                            address={delivery.address}
                            neighborhood={delivery.neighborhood}
                            city={delivery.city}
                          />
                          <p className="text-[9px] text-slate-400 mt-2 text-center italic">
                            * Localização atualizada em tempo real conforme o entregador registra sua posição.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className={`grid grid-cols-2 gap-y-3 gap-x-4 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                    {delivery.address ? (
                      <a 
                        href={`https://maps.google.com/?q=${encodeURIComponent(delivery.address + ', ' + delivery.neighborhood + ', ' + delivery.city)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 col-span-2 hover:opacity-80 transition-opacity"
                      >
                        <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0" />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} underline decoration-rose-500/30 underline-offset-2`}>
                          {delivery.address} - {delivery.neighborhood}, {delivery.city}
                        </span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 col-span-2">
                        <MapPin size={14} className="text-rose-500 shrink-0" />
                        <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{delivery.neighborhood}, {delivery.city}</span>
                      </div>
                    )}
                    
                    {delivery.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-blue-500 shrink-0" />
                        <span className="text-xs font-bold text-blue-600 truncate">{delivery.phone}</span>
                      </div>
                    )}
                    
                    {(isAdmin || (user?.role && user.role.toLowerCase().includes('gerente'))) && (
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-emerald-600">R$ {delivery.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 truncate">{delivery.vehicle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 truncate">{delivery.product}</span>
                    </div>
                    {delivery.notes && (
                      <div className="flex items-start gap-2 col-span-2">
                        <Edit2 size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-slate-500 italic leading-tight">{delivery.notes}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-600 truncate">Vend: {delivery.seller || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                    {canCreate && (
                      <button 
                        onClick={() => handleEdit(delivery)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(delivery.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          isDarkMode ? 'bg-rose-900/20 text-rose-400 hover:bg-rose-900/30' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    )}
                  </div>
                </motion.div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-500">
                <Truck size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhuma entrega encontrada.</p>
              </div>
            )}
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button for New Delivery */}
      {canCreate && (
        <motion.button 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setEditingId(null);
            setFormData({
              date: getTodayLocalDateString(),
              shift: 'Manhã',
              vehicle: '',
              driver: '',
              driver_id: '',
              value: '',
              cep: '',
              neighborhood: '',
              city: '',
              product: '',
              seller: '',
              notes: '',
              phone: '',
              address: '',
              delivery_type: 'padrao',
              is_special: false
            });
            setShowAddModal(true);
          }}
          className={`fixed bottom-24 md:bottom-8 right-4 z-40 flex items-center justify-center gap-2 px-6 h-14 rounded-full font-bold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)] transition-all border-4 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-slate-950' 
              : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-white'
          }`}
        >
          <div className="relative">
            <Plus size={24} />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-white rounded-full -z-10"
            />
          </div>
          <span className="text-sm tracking-tight">Nova Entrega</span>
        </motion.button>
      )}

      <BottomNav />

      {/* Add Delivery Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl transition-colors max-h-[90vh] overflow-y-auto ${
                isDarkMode ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{editingId ? 'Editar Entrega' : 'Nova Entrega'}</h3>
                    <p className="text-xs text-slate-500">{editingId ? 'Atualize os dados da logística' : 'Preencha os dados da logística'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de Entrega Selector */}
                <div className="p-3.5 rounded-2xl border-2 border-amber-300 dark:border-amber-700/70 bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                      <Sparkles size={14} className="text-amber-500" />
                      Tipo de Operação
                    </label>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      {formData.delivery_type === 'especial' ? '⭐ Especial' : 'Padrão'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, delivery_type: 'padrao', is_special: false })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                        formData.delivery_type !== 'especial'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-400' 
                            : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <Truck size={14} />
                      Entrega Padrão
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, delivery_type: 'especial', is_special: true })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${
                        formData.delivery_type === 'especial'
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 border-amber-400 text-white shadow-md ring-2 ring-amber-400/50'
                          : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-amber-400 hover:border-amber-600' 
                            : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      <Sparkles size={14} />
                      Entrega/Retirada Especial
                    </button>
                  </div>

                  {formData.delivery_type === 'especial' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800/80 flex items-start gap-2"
                    >
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Aviso Automático:</strong> Esta entrega terá <strong>destaque chamativo</strong> e exibirá um <strong>balão flutuante na página inicial</strong> e <strong>notificação para a equipe</strong> alertando para não marcarem entregas nesta data.
                      </span>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Data da Entrega</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm transition-all ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Turno</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select 
                        required
                        value={formData.shift}
                        onChange={(e) => setFormData({...formData, shift: e.target.value})}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm transition-all appearance-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <option value="Manhã">Manhã</option>
                        <option value="Tarde">Tarde</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Veículo</label>
                    <button 
                      type="button" 
                      onClick={() => setShowVehicleModal(true)}
                      className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600"
                    >
                      <Plus size={12} /> Novo
                    </button>
                  </div>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                      required
                      value={formData.vehicle}
                      onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
                      className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm transition-all appearance-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <option value="">Selecione um veículo</option>
                      {availableVehicles.map(v => {
                        const vehicleValue = `${v.name} ${v.plate}`;
                        return (
                          <option 
                            key={v.id} 
                            value={vehicleValue}
                          >
                            {v.name} - {v.plate}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Motorista</label>
                    <button 
                      type="button" 
                      onClick={() => setShowDriverModal(true)}
                      className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600"
                    >
                      <Plus size={12} /> Novo
                    </button>
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                      required
                      value={formData.driver}
                      onChange={(e) => {
                        const selectedDriver = drivers.find(d => d.name === e.target.value);
                        setFormData({
                          ...formData, 
                          driver: e.target.value,
                          driver_id: selectedDriver?.id || ''
                        });
                      }}
                      className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm transition-all appearance-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <option value="">Selecione o Motorista</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Valor da Venda</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                </div>

                {/* Campo de CEP com Busca Automática pelos Correios */}
                <div className="space-y-1.5 p-3.5 rounded-2xl border-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Search size={13} className="text-blue-600 dark:text-blue-400" />
                      Buscar Endereço pelo CEP (Correios)
                    </label>
                    <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-bold">Auto preenchimento</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400" size={16} />
                      <input 
                        type="text"
                        maxLength={9}
                        placeholder="Ex: 58000-000 ou 58051000"
                        value={formData.cep}
                        onChange={(e) => {
                          let val = e.target.value;
                          const digits = val.replace(/\D/g, '');
                          if (digits.length > 5) {
                            val = `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
                          } else {
                            val = digits;
                          }
                          setFormData({ ...formData, cep: val });
                          if (digits.length === 8) {
                            handleCepLookup(digits);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCepLookup();
                          }
                        }}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-semibold outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-900 border-blue-900 text-white focus:border-blue-400' 
                            : 'bg-white border-blue-200 text-slate-900 focus:border-blue-500 shadow-xs'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isLoadingCep}
                      onClick={() => handleCepLookup()}
                      className="px-4 h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                      title="Consultar CEP nos Correios"
                    >
                      {isLoadingCep ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Buscando...</span>
                        </>
                      ) : (
                        <>
                          <Search size={15} />
                          <span>Buscar CEP</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
                    Digite o CEP para preencher Bairro, Cidade e Rua automaticamente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Bairro</label>
                    <input 
                      required
                      type="text"
                      placeholder="Bairro"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cidade</label>
                    <input 
                      required
                      type="text"
                      placeholder="Cidade"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Endereço Completo</label>
                  <input 
                    type="text"
                    placeholder="Rua, Número, Complemento"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Telefone</label>
                  <input 
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Vendedor</label>
                  <select 
                    required
                    value={formData.seller}
                    onChange={(e) => setFormData({...formData, seller: e.target.value})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all appearance-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <option value="">Selecione o Vendedor</option>
                    {sellers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Campos Estruturados do Produto: Código, Descrição e Quantidade com busca automática no Catálogo */}
                <DeliveryProductItemsInput
                  isDarkMode={isDarkMode}
                  value={formData.product}
                  onChange={(combinedText, estimatedTotal) => {
                    setFormData(prev => ({
                      ...prev,
                      product: combinedText,
                      value: (!prev.value || prev.value === '' || prev.value === '0' || prev.value === '0.00') && estimatedTotal && estimatedTotal > 0
                        ? estimatedTotal.toFixed(2)
                        : prev.value
                    }));
                  }}
                  onApplyTotalValue={(total) => {
                    setFormData(prev => ({
                      ...prev,
                      value: total.toFixed(2)
                    }));
                    showToast(`Valor da venda atualizado para ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}!`, 'success');
                  }}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 ml-1">
                    <AlertCircle size={12} className="text-amber-500" />
                    <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Observações Importantes</label>
                  </div>
                  <textarea 
                    placeholder="Adicione aqui informações críticas para a entrega..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className={`w-full p-4 rounded-xl border-2 outline-none text-sm transition-all min-h-[80px] font-medium ${
                      isDarkMode 
                        ? 'bg-amber-900/10 border-amber-800/40 text-amber-200 placeholder:text-amber-900/50 focus:border-amber-600' 
                        : 'bg-amber-50 border-amber-100 text-amber-900 placeholder:text-amber-300 focus:border-amber-300'
                    }`}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-[2] py-4 rounded-2xl font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 ${
                      isSubmitting
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Entrega' : 'Salvar Entrega'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vehicle Modal */}
      <AnimatePresence>
        {showVehicleModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVehicleModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h2 className="text-xl font-black tracking-tight">Novo Veículo</h2>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Cadastre um novo veículo para as entregas.
                </p>
              </div>

              <form onSubmit={handleAddVehicle} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nome/Modelo</label>
                  <input 
                    required
                    type="text"
                    placeholder="ex: Fiorino"
                    value={newVehicle.name}
                    onChange={(e) => setNewVehicle({...newVehicle, name: e.target.value})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Placa</label>
                  <input 
                    required
                    type="text"
                    placeholder="ex: ABC-1234"
                    value={newVehicle.plate}
                    onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all uppercase ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowVehicleModal(false)}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isAddingVehicle}
                    className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 ${
                      isAddingVehicle
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isAddingVehicle ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showDriverModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDriverModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h2 className="text-xl font-black tracking-tight">Motorista Avulso</h2>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Cadastre um motorista eventual para esta entrega.
                </p>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nome Completo</label>
                  <input 
                    required
                    autoFocus
                    type="text"
                    placeholder="Nome do motorista"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border outline-none text-sm transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowDriverModal(false)}
                    className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isAddingDriver}
                    className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 ${
                      isAddingDriver
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isAddingDriver ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
    </div>
  );
}
