import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLocalDate(dateStr: string | null | undefined) {
  if (!dateStr) return 'N/A';
  if (typeof dateStr !== 'string') return 'N/A';
  
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR');
}

export function parseLocalDate(dateStr: string | null | undefined) {
  if (!dateStr) return new Date();
  if (typeof dateStr !== 'string') return new Date();
  
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(dateStr);
  
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
