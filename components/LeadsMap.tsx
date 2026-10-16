'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Building2, User, Info } from 'lucide-react';

// Fix for default marker icons in Leaflet with Next.js
// Using divIcon as a foolproof fallback that doesn't depend on external images
const createCustomMarker = (color: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
    <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const defaultMarker = createCustomMarker('#2563eb');
const contactMarker = createCustomMarker('#f59e0b');
const qualifiedMarker = createCustomMarker('#10b981');

interface MapViewProps {
  leads: any[];
  isDarkMode: boolean;
}

// Component to handle map centering, resizing and fitting bounds
function MapController({ leads }: { leads: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (leads.length > 0) {
      const bounds = L.latLngBounds(leads.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
    
    // Force invalidation of size to prevent gray boxes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [leads, map]);
  
  return null;
}

export default function LeadsMap({ leads, isDarkMode }: MapViewProps) {
  // Memoize lead data processing
  const leadsWithCoords = React.useMemo(() => {
    if (!Array.isArray(leads)) return [];
    return leads.filter(l => {
      const lat = typeof l.lat === 'string' ? parseFloat(l.lat) : l.lat;
      const lng = typeof l.lng === 'string' ? parseFloat(l.lng) : l.lng;
      return (
        lat !== null && 
        lng !== null && 
        !isNaN(lat) && 
        !isNaN(lng) && 
        lat !== undefined && 
        lng !== undefined &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      );
    }).map(l => ({
      ...l,
      lat: typeof l.lat === 'string' ? parseFloat(l.lat) : l.lat,
      lng: typeof l.lng === 'string' ? parseFloat(l.lng) : l.lng
    }));
  }, [leads]);
  
  // Default center fallback
  const defaultCenter: [number, number] = [-7.1195, -34.8450];

  const getMarkerIcon = (status: string) => {
    switch (status) {
      case 'Em Contato': return contactMarker;
      case 'Qualificado': return qualifiedMarker;
      case 'Concluído': return qualifiedMarker;
      default: return defaultMarker;
    }
  };

  return (
    <div 
      className={`leads-map-container relative w-full h-[450px] rounded-3xl overflow-hidden border transition-all z-0 ${
        isDarkMode 
          ? 'border-slate-800 bg-slate-900 shadow-2xl shadow-black/20' 
          : 'border-slate-200 bg-slate-50 shadow-sm'
      }`}
      style={{ isolation: 'isolate' }}
    >
      <MapContainer 
        key={`map-${leadsWithCoords.length}-${isDarkMode ? 'dark' : 'light'}`}
        center={leadsWithCoords.length > 0 ? [leadsWithCoords[0].lat, leadsWithCoords[0].lng] : defaultCenter} 
        zoom={leadsWithCoords.length > 0 ? 12 : 10} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={isDarkMode 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />
        
        {leadsWithCoords.map((lead) => (
          <Marker 
            key={`${lead.id}-${lead.lat}-${lead.lng}`} 
            position={[lead.lat, lead.lng]}
            icon={getMarkerIcon(lead.status)}
          >
            <Popup className="custom-leaflet-popup">
              <div className={`p-3 min-w-[200px] space-y-2 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                    <User size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm m-0 truncate">{lead.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 size={11} className="text-slate-400" />
                      <p className="text-[10px] text-slate-500 m-0 uppercase font-bold truncate">{lead.company}</p>
                    </div>
                  </div>
                </div>

                {lead.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-relaxed italic">
                      {lead.address}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800/50 mt-1">
                  <div className="flex items-center gap-1.5">
                    <Info size={11} className="text-slate-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Status</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    lead.status === 'Novo' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' :
                    lead.status === 'Em Contato' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40' :
                    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <MapController leads={leadsWithCoords} />
      </MapContainer>

      {/* Stats overlay */}
      <div className="absolute bottom-5 right-5 z-[500] px-4 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center gap-3">
        <div className="size-2.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
          {leadsWithCoords.length} Oportunidades
        </span>
      </div>
    </div>
  );
}
