import { supabase } from '@/lib/supabase';

export interface TruckArrivalRecord {
  id: string;
  arrival_date: string; // ISO date or YYYY-MM-DD
  driver_name: string;
  assistant_name?: string;
  notes?: string;
  comments?: string; // Campo dedicado para comentários/ocorrências (mercadorias avariadas, faltas/sobras físicas, divergências de NF)
  created_at: string;
  created_by?: string;
  company_id?: string;
}

export interface TruckScheduleData {
  next_arrival_date: string | null; // Data do próximo carro (ex: "2026-10-05" ou "2026-10-05T10:00")
  last_arrival_date: string | null; // Data do último carro (ex: "2026-09-28")
  history: TruckArrivalRecord[];
  updated_at?: string;
  updated_by_name?: string;
}

const LOCAL_STORAGE_KEY = 'agentex_truck_schedule_v1';

export const DEFAULT_TRUCK_SCHEDULE: TruckScheduleData = {
  next_arrival_date: null,
  last_arrival_date: null,
  history: [],
  updated_at: new Date().toISOString()
};

export function getLocalTruckSchedule(): TruckScheduleData {
  if (typeof window === 'undefined') return DEFAULT_TRUCK_SCHEDULE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_TRUCK_SCHEDULE;
    const parsed = JSON.parse(raw);
    return {
      next_arrival_date: parsed.next_arrival_date || null,
      last_arrival_date: parsed.last_arrival_date || null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      updated_at: parsed.updated_at,
      updated_by_name: parsed.updated_by_name
    };
  } catch (e) {
    console.warn('Erro ao ler dados de caminhão do localStorage:', e);
    return DEFAULT_TRUCK_SCHEDULE;
  }
}

export function saveLocalTruckSchedule(data: TruckScheduleData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Erro ao salvar dados de caminhão no localStorage:', e);
  }
}

export async function fetchTruckSchedule(): Promise<TruckScheduleData> {
  const localData = getLocalTruckSchedule();

  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

  if (!isConfigured) {
    return localData;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'truck_replenishment_schedule')
      .maybeSingle();

    if (error) {
      if (error.code !== 'PGRST116' && error.code !== '42P01') {
        console.warn('Aviso ao buscar agenda do caminhão no Supabase:', error.message);
      }
      return localData;
    }

    if (data?.value) {
      const merged: TruckScheduleData = {
        next_arrival_date: data.value.next_arrival_date || null,
        last_arrival_date: data.value.last_arrival_date || null,
        history: Array.isArray(data.value.history) ? data.value.history : [],
        updated_at: data.value.updated_at,
        updated_by_name: data.value.updated_by_name
      };
      saveLocalTruckSchedule(merged);
      return merged;
    }

    return localData;
  } catch (err) {
    console.warn('Falha na requisição de agenda do caminhão:', err);
    return localData;
  }
}

export async function updateTruckSchedule(newData: {
  next_arrival_date?: string | null;
  last_arrival_date?: string | null;
  newRecord?: {
    arrival_date: string;
    driver_name: string;
    assistant_name?: string;
    notes?: string;
    comments?: string;
  };
  updateRecord?: {
    id: string;
    comments?: string;
    notes?: string;
    driver_name?: string;
    assistant_name?: string;
  };
  deletedRecordId?: string;
  updated_by_name?: string;
}): Promise<{ success: boolean; data: TruckScheduleData; message?: string }> {
  try {
    // 1. Obter estado atual
    const current = await fetchTruckSchedule();
    let updatedHistory = [...(current.history || [])];

    if (newData.deletedRecordId) {
      updatedHistory = updatedHistory.filter(h => h.id !== newData.deletedRecordId);
    }

    if (newData.updateRecord) {
      updatedHistory = updatedHistory.map(h => {
        if (h.id === newData.updateRecord?.id) {
          return {
            ...h,
            ...(newData.updateRecord.comments !== undefined ? { comments: newData.updateRecord.comments } : {}),
            ...(newData.updateRecord.notes !== undefined ? { notes: newData.updateRecord.notes } : {}),
            ...(newData.updateRecord.driver_name !== undefined ? { driver_name: newData.updateRecord.driver_name } : {}),
            ...(newData.updateRecord.assistant_name !== undefined ? { assistant_name: newData.updateRecord.assistant_name } : {}),
          };
        }
        return h;
      });
    }

    if (newData.newRecord) {
      const newEntry: TruckArrivalRecord = {
        id: `truck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        arrival_date: newData.newRecord.arrival_date,
        driver_name: newData.newRecord.driver_name,
        assistant_name: newData.newRecord.assistant_name || '',
        notes: newData.newRecord.notes || '',
        comments: newData.newRecord.comments || '',
        created_at: new Date().toISOString(),
        created_by: newData.updated_by_name || 'Usuário'
      };

      // Inserir ordenado por data decrescente
      updatedHistory = [newEntry, ...updatedHistory].sort((a, b) => 
        new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime()
      );
    }

    const nextDate = newData.next_arrival_date !== undefined ? newData.next_arrival_date : current.next_arrival_date;
    let lastDate = newData.last_arrival_date !== undefined ? newData.last_arrival_date : current.last_arrival_date;

    // Se inseriu um histórico novo e não especificou o lastDate manualmente, atualiza com a data mais recente do histórico
    if (newData.newRecord && (!lastDate || new Date(newData.newRecord.arrival_date).getTime() >= new Date(lastDate).getTime())) {
      lastDate = newData.newRecord.arrival_date;
    }

    const payload: TruckScheduleData = {
      next_arrival_date: nextDate,
      last_arrival_date: lastDate,
      history: updatedHistory,
      updated_at: new Date().toISOString(),
      updated_by_name: newData.updated_by_name || 'Gestão'
    };

    saveLocalTruckSchedule(payload);

    // 2. Salvar no Supabase
    const isConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

    if (isConfigured) {
      await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'truck_replenishment_schedule',
            value: payload,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );
    }

    return { success: true, data: payload };
  } catch (error: any) {
    console.error('Erro ao atualizar agenda de caminhão:', error);
    return { success: false, data: getLocalTruckSchedule(), message: error.message };
  }
}
