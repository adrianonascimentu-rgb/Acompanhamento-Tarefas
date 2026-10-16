'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export type Role = 'admin' | 'vendedor' | 'user' | 'gerente' | 'estoque' | 'entregador' | 'supervisor';

export const DEFAULT_ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Administrador',
  type: 'admin',
  role: 'admin',
  status: 'Ativo'
};

interface RoleContextType {
  role: any;
  user: any | null;
  isAdmin: boolean;
  canAccessLeads: boolean;
  canAccessSocialMedia: boolean;
  canAccessWhatsapp: boolean;
  canAccessDeliveries: boolean;
  canAccessTransfers: boolean;
  canAccessWarranties: boolean;
  canAccessReports: boolean;
  canAccessSales: boolean;
  canAccessDemands: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (roleOrUserData: any, userData?: any) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('app_user_session');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  const fetchPermissions = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'module_permissions')
        .single();
      
      if (data?.value) {
        setPermissions(data.value);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const refreshUser = async () => {
    setIsLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        let profile: any = null;
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          profile = profileData;
        } catch (profileErr) {
          console.warn('Error fetching profile for authUser:', profileErr);
        }

        const emailPrefix = authUser.email ? authUser.email.split('@')[0] : '';
        const formattedEmailName = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : '';
        const resolvedName = 
          profile?.name || 
          profile?.full_name || 
          authUser.user_metadata?.name || 
          authUser.user_metadata?.full_name || 
          formattedEmailName || 
          'Usuário';

        const resolvedRole = (
          profile?.type || 
          profile?.role || 
          authUser.user_metadata?.role || 
          authUser.user_metadata?.type || 
          'user'
        ).toLowerCase();

        const enrichedUser = { 
          ...authUser, 
          ...(profile || {}),
          id: authUser.id,
          name: resolvedName,
          type: resolvedRole,
          role: resolvedRole
        };

        setUser(enrichedUser);
        try {
          localStorage.setItem('app_user_session', JSON.stringify(enrichedUser));
        } catch {}
      } else {
        // Check local storage backup session
        try {
          const savedSession = localStorage.getItem('app_user_session');
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.id) {
              setUser(parsed);
              setIsLoading(false);
              return;
            }
          }
        } catch {}

        setUser(null);
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
    refreshUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        refreshUser();
      } else if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem('app_user_session');
        } catch {}
        setUser(null);
        setIsLoading(false);
      } else {
        try {
          const savedSession = localStorage.getItem('app_user_session');
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.id) {
              setUser(parsed);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (roleOrUserData: any, userData?: any) => {
    const finalData = userData || roleOrUserData;
    if (finalData) {
      const emailPrefix = finalData.email ? finalData.email.split('@')[0] : '';
      const formattedEmailName = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : '';
      const resolvedName = 
        finalData.name || 
        finalData.full_name || 
        finalData.user_metadata?.name || 
        finalData.user_metadata?.full_name || 
        formattedEmailName || 
        'Usuário';

      const resolvedRole = (finalData.role || finalData.type || (typeof roleOrUserData === 'string' ? roleOrUserData : 'user')).toLowerCase();

      const enrichedUser = {
        ...finalData,
        name: resolvedName,
        type: resolvedRole,
        role: resolvedRole
      };
      setUser(enrichedUser);
      try {
        localStorage.setItem('app_user_session', JSON.stringify(enrichedUser));
      } catch {}
    } else {
      setUser(roleOrUserData);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('app_user_session');
    } catch {}
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
  };

  const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const userEmail = (user?.email || '').trim().toLowerCase();
  const role = (user?.type || user?.role || 'user').toLowerCase();
  const isAdmin = 
    role === 'admin' || 
    (!!ownerEmail && userEmail === ownerEmail);
  
  const hasPermission = (module: string) => {
    if (isAdmin) return true;
    const currentRole = role?.toLowerCase();
    if (!currentRole) return false;
    
    // Check user-specific column if available
    const userAccessKey = `can_access_${module}`;
    if (user && user[userAccessKey] === true) return true;
    
    // Check role-based permissions from system settings
    const modulePermissions = permissions[module] || [];
    return modulePermissions.map(r => r.toLowerCase()).includes(currentRole);
  };

  const value = {
    role,
    user,
    isAdmin,
    canAccessLeads: hasPermission('leads'),
    canAccessSocialMedia: hasPermission('social_media'),
    canAccessWhatsapp: hasPermission('whatsapp'),
    canAccessDeliveries: hasPermission('deliveries'),
    canAccessTransfers: hasPermission('transfers'),
    canAccessWarranties: hasPermission('warranties'),
    canAccessReports: hasPermission('reports'),
    canAccessSales: hasPermission('sales'),
    canAccessDemands: hasPermission('demands'),
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
