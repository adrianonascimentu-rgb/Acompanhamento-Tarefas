import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { NotificationManager } from '@/components/NotificationManager';
import { ClientProviders } from '@/components/ClientProviders';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { TopTruckBanner } from '@/components/TopTruckBanner';
import { FloatingDirectoriaBulletin } from '@/components/FloatingDirectoriaBulletin';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'AgenteX',
  description: 'Plataforma completa de gestão com CRM, Social Media, Entregas e Automação de Tarefas.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AgenteX',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'AgenteX',
    description: 'Plataforma completa de gestão com CRM, Social Media, Entregas e Automação de Tarefas.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} h-full`}>
      <body className="bg-slate-50/70 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased min-h-screen text-sm font-sans selection:bg-blue-500/15 selection:text-blue-600" suppressHydrationWarning>
        <ClientProviders>
          <PWAInstallBanner />
          <NotificationManager />
          <Sidebar />
          <div className="md:pl-64 min-h-screen flex flex-col pb-24 md:pb-0 transition-[padding] duration-200">
            <TopTruckBanner />
            {children}
          </div>
          <FloatingDirectoriaBulletin />
          <BottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}
