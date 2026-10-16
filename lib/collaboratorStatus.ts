export function getInactiveCollaboratorIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('inactive_collaborator_ids');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCollaboratorStatusLocal(id: string, status: 'Ativo' | 'Inativo') {
  if (typeof window === 'undefined') return;
  try {
    const list = getInactiveCollaboratorIds();
    let updated: string[];
    if (status === 'Inativo') {
      updated = Array.from(new Set([...list, id]));
    } else {
      updated = list.filter(item => item !== id);
    }
    localStorage.setItem('inactive_collaborator_ids', JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving status to localStorage', e);
  }
}

export function applyStatusToProfiles<T extends { id: string; status?: string }>(profiles: T[]): T[] {
  const inactives = getInactiveCollaboratorIds();
  return profiles.map(profile => {
    if (inactives.includes(profile.id)) {
      return { ...profile, status: 'Inativo' };
    }
    return { ...profile, status: profile.status || 'Ativo' };
  });
}
