'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TaskTemplate, 
  DEFAULT_TEMPLATES, 
  getLocalTemplates, 
  saveLocalTemplates, 
  fetchTemplatesFromSupabase, 
  createSupabaseTemplate, 
  deleteSupabaseTemplate 
} from '@/lib/taskTemplates';

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTemplates = useCallback(async () => {
    setIsLoading(true);
    // First read local templates so UI loads instantly
    const local = getLocalTemplates();
    
    // Try to sync with Supabase
    const remote = await fetchTemplatesFromSupabase();
    if (remote && remote.length > 0) {
      // Merge remote with default templates
      const defaultIds = new Set(DEFAULT_TEMPLATES.map(t => t.id));
      const customLocal = local.filter(t => !defaultIds.has(t.id));
      
      // Combine defaults + remote + any local-only custom ones not in remote
      const remoteIds = new Set(remote.map(r => r.id));
      const combined = [
        ...DEFAULT_TEMPLATES,
        ...remote,
        ...customLocal.filter(l => !remoteIds.has(l.id))
      ];
      setTemplates(combined);
      saveLocalTemplates(combined);
    } else {
      setTemplates(local);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const addTemplate = async (newTplData: {
    name: string;
    title: string;
    description: string;
    priority?: string;
    taskType?: string;
    assigneeIds?: string[];
    assigneeNames?: string[];
  }): Promise<TaskTemplate> => {
    const newTemplateObj: TaskTemplate = {
      id: `tpl-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newTplData.name || newTplData.title || 'Modelo sem Nome',
      title: newTplData.title,
      description: newTplData.description,
      priority: newTplData.priority || 'Média',
      taskType: newTplData.taskType || 'Outros',
      assigneeIds: newTplData.assigneeIds || [],
      assigneeNames: newTplData.assigneeNames || [],
      createdAt: new Date().toISOString(),
      isDefault: false
    };

    // Save to Supabase (if table exists)
    const supabaseCreated = await createSupabaseTemplate(newTplData);
    const finalTemplate = supabaseCreated || newTemplateObj;

    // Update local state and local storage
    setTemplates(prev => {
      const updated = [finalTemplate, ...prev];
      saveLocalTemplates(updated);
      return updated;
    });

    return finalTemplate;
  };

  const removeTemplate = async (id: string) => {
    // Cannot remove default templates
    if (id.startsWith('tpl-weekly') || id.startsWith('tpl-monthly') || id.startsWith('tpl-preventive') || id.startsWith('tpl-stock-transfer')) {
      return false;
    }

    await deleteSupabaseTemplate(id);

    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveLocalTemplates(updated);
      return updated;
    });

    return true;
  };

  const restoreDefaults = () => {
    setTemplates(DEFAULT_TEMPLATES);
    saveLocalTemplates(DEFAULT_TEMPLATES);
  };

  return {
    templates,
    isLoading,
    addTemplate,
    removeTemplate,
    restoreDefaults,
    refreshTemplates
  };
}
