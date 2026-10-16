'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: (val: boolean) => void;
  location: string;
  updateLocation: (val: string) => void;
  mapsApiKey: string;
  updateMapsApiKey: (val: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [location, setLocation] = useState('Escritório Central');
  const [mapsApiKey, setMapsApiKey] = useState('');

  const toggleDarkMode = (val: boolean) => {
    setIsDarkMode(val);
    if (typeof window !== 'undefined') {
      if (val) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  };

  const updateLocation = (val: string) => {
    setLocation(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user-location', val);
    }
  };

  const updateMapsApiKey = (val: string) => {
    setMapsApiKey(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('GOOGLE_MAPS_PLATFORM_KEY', val);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const savedLocation = localStorage.getItem('user-location');
    const savedMapsKey = localStorage.getItem('GOOGLE_MAPS_PLATFORM_KEY');
    
    let isDark = false;
    if (savedTheme === 'dark') {
      isDark = true;
    } else if (savedTheme === 'light') {
      isDark = false;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDark = true;
    }

    if (isDark) {
      setTimeout(() => setIsDarkMode(true), 0);
      document.documentElement.classList.add('dark');
    } else {
      setTimeout(() => setIsDarkMode(false), 0);
      document.documentElement.classList.remove('dark');
    }

    if (savedLocation) {
      setTimeout(() => setLocation(savedLocation), 0);
    }
    if (savedMapsKey) {
      setTimeout(() => setMapsApiKey(savedMapsKey), 0);
    }

    // Listen for system preference changes
    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        toggleDarkMode(e.matches);
      }
    };
    matchMedia.addEventListener('change', handler);
    return () => matchMedia.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, location, updateLocation, mapsApiKey, updateMapsApiKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
