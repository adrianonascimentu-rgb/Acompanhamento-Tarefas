'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, X, Users, Clock, CheckCircle2, Truck, ChevronDown, ChevronUp } from 'lucide-react';

// Corrigir ícones padrão do Leaflet com segurança no SSR e hidratação
const getCustomIcon = () => {
  if (typeof window === 'undefined') return null;
  return new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Ícone de Caminhão para entregas em movimento
const getTruckIcon = () => {
  if (typeof window === 'undefined') return null;
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="truck-marker" style="background-color: #2563eb; border: 2.5px solid white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgb(0 0 0 / 0.25); position: relative;">
      <div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #2563eb; opacity: 0.6; animation: marker-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-3h-3v8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
    </div>
    <style>
      @keyframes marker-pulse {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    </style>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
};

export interface CheckInPoint {
  id: string;
  title: string;
  checkin_lat: number;
  checkin_lng: number;
  checkin_at: string;
  collaborator_name?: string;
  source?: 'task' | 'delivery';
  route?: [number, number][];
  address?: string;
  neighborhood?: string;
  city?: string;
}

// Formatação segura de horários sem exceções de data inválida
const formatTimeSafe = (dateStr: string) => {
  if (!dateStr) return 'Aguardando';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Aguardando' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Aguardando';
  }
};

// Componente para auto-ajustar o mapa aos marcadores quando houver check-ins
function ChangeView({ points }: { points: CheckInPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(p => typeof p.checkin_lat === 'number' && typeof p.checkin_lng === 'number' && !isNaN(p.checkin_lat));
    if (validPoints.length > 0) {
      if (validPoints.length === 1) {
        map.setView([validPoints[0].checkin_lat, validPoints[0].checkin_lng], 13);
      } else {
        const bounds = L.latLngBounds(validPoints.map(p => [p.checkin_lat, p.checkin_lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [points, map]);
  return null;
}

interface MapInteractionProps {
  onSelectArea: (latlng: { lat: number; lng: number }) => void;
  isSelecting: boolean;
}

function MapClickHandler({ onSelectArea, isSelecting }: MapInteractionProps) {
  useMapEvents({
    click(e) {
      if (isSelecting) {
        onSelectArea(e.latlng);
      }
    },
    contextmenu(e) {
      onSelectArea(e.latlng);
    }
  });
  return null;
}

export default function LiveMap({ points }: { points: CheckInPoint[] }) {
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Colapsável no mobile para não obstruir a visão
  const [consolidatedData, setConsolidatedData] = useState<{
    count: number;
    collaborators: string[];
    checkins: CheckInPoint[];
  } | null>(null);

  const [customIcon, setCustomIcon] = useState<any>(null);
  const [truckIcon, setTruckIcon] = useState<any>(null);

  useEffect(() => {
    setCustomIcon(getCustomIcon());
    setTruckIcon(getTruckIcon());
  }, []);

  const validPoints = (points || []).filter(p => typeof p.checkin_lat === 'number' && typeof p.checkin_lng === 'number' && !isNaN(p.checkin_lat) && !isNaN(p.checkin_lng));

  // Ponto central padrão (ou o primeiro check-in disponível)
  const defaultCenter: [number, number] = validPoints.length > 0
    ? [validPoints[0].checkin_lat, validPoints[0].checkin_lng]
    : [-7.1150, -34.8631]; // João Pessoa / Nordeste

  // Calcular distância em km (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleAreaSelected = (latlng: { lat: number; lng: number }) => {
    setSelectedCenter(latlng);
    setIsSelectingArea(false);

    const matchingCheckins = validPoints.filter(p => {
      const dist = calculateDistance(latlng.lat, latlng.lng, p.checkin_lat, p.checkin_lng);
      return dist <= radiusKm;
    });

    const collaborators = Array.from(new Set(matchingCheckins.map(p => p.collaborator_name || 'Colaborador')));

    setConsolidatedData({
      count: matchingCheckins.length,
      collaborators,
      checkins: matchingCheckins
    });
  };

  return (
    <div id="map" className="h-[360px] sm:h-[480px] w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0 shadow-inner">
      {/* Painel de Controle de Raio (Totalmente responsivo e otimizado para mobile) */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[400] flex flex-col items-end gap-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-lg border border-zinc-200/90 dark:border-zinc-800 max-w-[240px] sm:max-w-xs w-full transition-all">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Crosshair size={15} className="text-blue-600 shrink-0" />
            <span>Raio: <strong className="text-blue-600 dark:text-blue-400 font-mono">{radiusKm} km</strong></span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="sm:hidden text-zinc-600 dark:text-zinc-300 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Expandir/Recolher controles"
            >
              {isPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSelectingArea(!isSelectingArea);
                if (!isSelectingArea) {
                  setSelectedCenter(null);
                  setConsolidatedData(null);
                }
              }}
              className={`text-[10px] font-extrabold px-2 py-1 rounded-lg transition-all ${
                isSelectingArea 
                  ? 'bg-rose-600 text-white animate-pulse' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
            >
              {isSelectingArea ? 'Clique no Mapa...' : 'Mudar Centro'}
            </button>
          </div>
        </div>

        {/* Controles expansíveis */}
        <div className={`${isPanelOpen ? 'block' : 'hidden sm:block'} w-full space-y-2 pt-1`}>
          <div className="w-full space-y-1">
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={radiusKm}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRadiusKm(val);
                if (selectedCenter) {
                  const matchingCheckins = validPoints.filter(p => {
                    const dist = calculateDistance(selectedCenter.lat, selectedCenter.lng, p.checkin_lat, p.checkin_lng);
                    return dist <= val;
                  });
                  const collaborators = Array.from(new Set(matchingCheckins.map(p => p.collaborator_name || 'Colaborador')));
                  setConsolidatedData({
                    count: matchingCheckins.length,
                    collaborators,
                    checkins: matchingCheckins
                  });
                }
              }}
              className="w-full accent-blue-600 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
              <span>1km</span>
              <span>25km</span>
              <span>50km</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const center = selectedCenter || (validPoints.length > 0 ? { lat: validPoints[0].checkin_lat, lng: validPoints[0].checkin_lng } : { lat: -7.1150, lng: -34.8631 });
              setSelectedCenter(center);
              setIsSelectingArea(false);

              const matchingCheckins = validPoints.filter(p => {
                const dist = calculateDistance(center.lat, center.lng, p.checkin_lat, p.checkin_lng);
                return dist <= radiusKm;
              });

              const collaborators = Array.from(new Set(matchingCheckins.map(p => p.collaborator_name || 'Colaborador')));

              setConsolidatedData({
                count: matchingCheckins.length,
                collaborators,
                checkins: matchingCheckins
              });
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs text-xs transition-all active:scale-95"
          >
            <CheckCircle2 size={13} />
            Consolidar Área
          </button>
        </div>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={validPoints.length > 0 ? 12 : 5} 
        scrollWheelZoom={true} 
        className="h-full w-full"
      >
        <ChangeView points={points} />
        <MapClickHandler onSelectArea={handleAreaSelected} isSelecting={isSelectingArea} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Círculo do Raio Selecionado */}
        {selectedCenter && (
          <Circle
            center={[selectedCenter.lat, selectedCenter.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.18, weight: 2 }}
          />
        )}
        
        {/* Trajeto do Caminhão até ao endereço */}
        {validPoints.map((point) => (
          point.route && point.route.length > 1 && (
            <Polyline 
              key={`route-${point.id}`}
              positions={point.route}
              pathOptions={{ 
                color: '#2563eb', 
                weight: 4, 
                opacity: 0.8,
                dashArray: '6, 8'
              }}
            />
          )
        ))}
        
        {validPoints.map((point) => (
          <Marker 
            key={point.id} 
            position={[point.checkin_lat, point.checkin_lng]} 
            icon={(point.source === 'delivery' ? truckIcon : customIcon) || undefined}
          >
            <Popup>
              <div className="p-1 min-w-[160px] max-w-[240px]">
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    point.source === 'delivery' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {point.source === 'delivery' ? '🚚 Caminhão em Rota' : '📍 Tarefa'}
                  </span>
                </div>
                <p className="font-extrabold text-xs text-zinc-900 leading-tight">
                  {point.collaborator_name || 'Motorista'}
                </p>
                <p className="text-[11px] text-zinc-700 font-bold mt-1">
                  {point.title}
                </p>

                {/* Endereço de Destino no Popup do Mapa */}
                {point.address && (
                  <p className="text-[10px] text-zinc-600 mt-1.5 flex items-start gap-1 font-medium bg-zinc-50 border border-zinc-200/80 p-1.5 rounded-lg">
                    <MapPin size={12} className="text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-tight"><strong>Destino:</strong> {point.address}</span>
                  </p>
                )}

                <div className="mt-1.5 pt-1 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Atualizado:</span>
                  <span className="font-bold text-blue-600">
                    {formatTimeSafe(point.checkin_at)}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Resumo Consolidado da Área */}
      {consolidatedData && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-[500] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                <MapPin size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Resumo da Área ({radiusKm} km)
                </h3>
                <p className="text-[10px] text-zinc-500">
                  {consolidatedData.count} ponto{consolidatedData.count === 1 ? '' : 's'} localizado{consolidatedData.count === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setConsolidatedData(null);
                setSelectedCenter(null);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px] text-zinc-400 block font-medium">Entregas e GPS</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                {consolidatedData.count}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px] text-zinc-400 block font-medium">Equipe</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1 mt-0.5">
                <Users size={13} className="text-blue-500" />
                {consolidatedData.collaborators?.length || 0}
              </span>
            </div>
          </div>

          {(consolidatedData.checkins?.length || 0) > 0 && (
            <div className="max-h-24 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-[11px]">
              {consolidatedData.checkins.map(chk => (
                <div key={chk.id} className="py-1 flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-2">
                    {chk.collaborator_name} <span className="font-normal text-zinc-500">— {chk.title}</span>
                  </span>
                  <span className="text-zinc-400 font-mono text-[10px] shrink-0">
                    {formatTimeSafe(chk.checkin_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
