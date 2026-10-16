import { supabase } from '@/lib/supabase';

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente' | string;
  taskType: 'Estoque' | 'Outros' | string;
  assigneeIds?: string[];
  assigneeNames?: string[];
  createdAt: string;
  isDefault?: boolean;
}

export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-weekly-inventory',
    name: 'Conferência Semanal de Estoque (Weekly Inventory Check)',
    title: 'Conferência Semanal de Estoque',
    description: 'Realizar contagem física e auditagem de itens de alto giro no estoque. Verificar discrepâncias com o sistema e registrar relatórios de avarias.',
    priority: 'Média',
    taskType: 'Estoque',
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: 'tpl-monthly-sales',
    name: 'Relatório Mensal de Vendas',
    title: 'Relatório Mensal de Vendas e Desempenho',
    description: 'Compilar totais de vendas do mês, ranking de vendedores, metas alcançadas e principais solicitações de clientes.',
    priority: 'Alta',
    taskType: 'Outros',
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: 'tpl-preventive-maintenance',
    name: 'Manutenção Preventiva de Equipamentos',
    title: 'Manutenção Preventiva de Equipamentos',
    description: 'Verificar funcionamento das impressoras de etiquetas, coletores de dados, balanças e terminais de caixa.',
    priority: 'Média',
    taskType: 'Outros',
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: 'tpl-stock-transfer-audit',
    name: 'Vistoria e Conferência de Transferências',
    title: 'Vistoria e Conferência de Transferências de Estoque',
    description: 'Conferir volumes e notas fiscais de transferência recebidos ou expedidos, garantindo o correto lançamento no sistema.',
    priority: 'Alta',
    taskType: 'Estoque',
    createdAt: new Date().toISOString(),
    isDefault: true
  }
];

const LOCAL_STORAGE_KEY = 'task_templates_v2';

export function getLocalTemplates(): TaskTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    return parsed;
  } catch (err) {
    console.warn('Error reading task templates from localStorage:', err);
    return DEFAULT_TEMPLATES;
  }
}

export function saveLocalTemplates(templates: TaskTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.warn('Error saving task templates to localStorage:', err);
  }
}

export async function fetchTemplatesFromSupabase(): Promise<TaskTemplate[] | null> {
  try {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        // Table task_templates does not exist on Supabase
        return null;
      }
      console.warn('Supabase task_templates query error:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((item: any) => ({
      id: item.id,
      name: item.name || item.title || 'Modelo sem Nome',
      title: item.title || '',
      description: item.description || '',
      priority: item.priority || 'Média',
      taskType: item.task_type || item.taskType || 'Outros',
      assigneeIds: item.assignee_ids || item.assigneeIds || [],
      assigneeNames: item.assignee_names || item.assigneeNames || [],
      createdAt: item.created_at || new Date().toISOString(),
      isDefault: item.is_default || false
    }));
  } catch (err) {
    console.warn('Error fetching task templates from Supabase:', err);
    return null;
  }
}

export async function createSupabaseTemplate(template: {
  name: string;
  title: string;
  description: string;
  priority?: string;
  taskType?: string;
  assigneeIds?: string[];
  assigneeNames?: string[];
}): Promise<TaskTemplate | null> {
  try {
    const payload = {
      name: template.name,
      title: template.title,
      description: template.description,
      priority: template.priority || 'Média',
      task_type: template.taskType || 'Outros',
      assignee_ids: template.assigneeIds || [],
      assignee_names: template.assigneeNames || [],
      is_default: false,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('task_templates')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Could not insert template into Supabase task_templates table:', error.message);
      return null;
    }

    if (data) {
      return {
        id: data.id,
        name: data.name,
        title: data.title,
        description: data.description,
        priority: data.priority,
        taskType: data.task_type,
        assigneeIds: data.assignee_ids,
        assigneeNames: data.assignee_names,
        createdAt: data.created_at,
        isDefault: data.is_default
      };
    }
    return null;
  } catch (err) {
    console.warn('Error creating template in Supabase:', err);
    return null;
  }
}

export async function deleteSupabaseTemplate(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Could not delete template from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting template from Supabase:', err);
    return false;
  }
}
