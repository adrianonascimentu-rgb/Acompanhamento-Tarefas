'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Truck, Navigation, List as ListIcon, X, MapPin, Eye, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { getNeighborhoodCoords } from '@/lib/neighborhoodCoords';
import 'leaflet/dist/leaflet.css';

interface Delivery {
  id: number | string;
  driver: string;
  address: string;
  neighborhood: string;
  city: string;
  value: number;
  status: string;
  lat?: number;
  lng?: number;
  route?: [number, number][];
}

interface DeliveriesMapProps {
  deliveries: Delivery[];
}

const MapController = ({ selectedCoords, L }: { selectedCoords: [number, number] | null, L: any }) => {
  const map = (window as any).MapComponents?.useMap();
  useEffect(() => {
    if (selectedCoords && map) {
      map.flyTo(selectedCoords, 16, {
        duration: 1.2
      });
    }
  }, [selectedCoords, map]);
  return null;
};

// Auto-fit bounds controller for all deliveries
const BoundsController = ({ deliveries, L }: { deliveries: Delivery[], L: any }) => {
  const map = (window as any).MapComponents?.useMap();
  useEffect(() => {
    if (map && L && deliveries.length > 0) {
      const validPoints = deliveries
        .filter(d => typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng) && d.lat !== 0)
        .map(d => [d.lat!, d.lng!] as [number, number]);

      if (validPoints.length === 1) {
        map.setView(validPoints[0], 14);
      } else if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [deliveries, map, L]);
  return null;
};

// Client-side cache for geocoded deliveries
const clientGeocodeCache = new Map<string, [number, number]>();

export function DeliveriesMap({ deliveries }: DeliveriesMapProps) {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [geocodedDeliveries, setGeocodedDeliveries] = useState<Delivery[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Expose useMap for inner controllers
  useEffect(() => {
    if (MapComponents) {
      (window as any).MapComponents = MapComponents;
    }
  }, [MapComponents]);

  useEffect(() => {
    let isMounted = true;
    
    const resolveDeliveryCoordinates = async () => {
      const processed: Delivery[] = deliveries.map(d => ({ ...d }));
      
      // Pass 1: Resolve fast items (already valid coordinates or local lookup)
      for (let i = 0; i < processed.length; i++) {
        const d = processed[i];
        
        // Check if DB already had valid real coordinates (not São Paulo placeholder)
        const hasValidDbCoords = 
          typeof d.lat === 'number' && 
          typeof d.lng === 'number' && 
          !isNaN(d.lat) && 
          !isNaN(d.lng) &&
          d.lat < 0 && d.lat > -15 && // Paraíba / Nordeste region check
          d.lng < -30 && d.lng > -45;

        if (hasValidDbCoords) {
          continue;
        }

        // Check in-memory cache
        const cacheKey = `${d.address || ''}|${d.neighborhood || ''}|${d.city || ''}`.toLowerCase();
        if (clientGeocodeCache.has(cacheKey)) {
          const [cachedLat, cachedLng] = clientGeocodeCache.get(cacheKey)!;
          processed[i].lat = cachedLat;
          processed[i].lng = cachedLng;
          continue;
        }

        // Immediate regional fallback from high-precision table
        const regionalCoords = getNeighborhoodCoords(d.neighborhood, d.city);
        if (regionalCoords) {
          // Add micro hash offset so deliveries in the same neighborhood don't perfectly overlap
          const hash = String(d.id || i).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const microLat = ((hash % 17) - 8) * 0.0003;
          const microLng = (((hash * 3) % 17) - 8) * 0.0003;
          processed[i].lat = regionalCoords[0] + microLat;
          processed[i].lng = regionalCoords[1] + microLng;
        }
      }

      if (isMounted) {
        setGeocodedDeliveries([...processed]);
      }

      // Pass 2: Asynchronously refine exact address coordinates via /api/geocode endpoint
      for (let i = 0; i < processed.length; i++) {
        if (!isMounted) break;
        const d = processed[i];
        
        // If address is populated and not already refined via API cache
        if (d.address && d.address.trim().length > 3) {
          const cacheKey = `${d.address}|${d.neighborhood || ''}|${d.city || ''}`.toLowerCase();
          if (!clientGeocodeCache.has(cacheKey)) {
            try {
              const res = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: d.address,
                  neighborhood: d.neighborhood,
                  city: d.city,
                  state: 'Paraíba'
                })
              });

              if (res.ok) {
                const data = await res.json();
                if (data.lat && data.lng) {
                  clientGeocodeCache.set(cacheKey, [data.lat, data.lng]);
                  processed[i].lat = data.lat;
                  processed[i].lng = data.lng;

                  if (isMounted) {
                    setGeocodedDeliveries([...processed]);
                  }
                }
              }
            } catch (err) {
              console.warn(`Geocode refinement failed for ${d.address}:`, err);
            }
          }
        }
      }
    };

    resolveDeliveryCoordinates();

    return () => {
      isMounted = false;
    };
  }, [deliveries]);

  useEffect(() => {
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([leaflet, leafletCore]) => {
      setMapComponents({ ...leaflet });
      setL(leafletCore);
    });
  }, []);

  // Filter deliveries that have lat/lng
  const mapDeliveries = useMemo(() => 
    geocodedDeliveries.filter(d => typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng)),
    [geocodedDeliveries]
  );
  
  const activeDeliveries = useMemo(() => 
    mapDeliveries.filter(d => d.status === 'Em Andamento'),
    [mapDeliveries]
  );

  const selectedCoords = useMemo(() => {
    if (!selectedDriverId) return null;
    const delivery = mapDeliveries.find(d => d.id === selectedDriverId);
    return delivery ? [delivery.lat!, delivery.lng!] as [number, number] : null;
  }, [selectedDriverId, mapDeliveries]);

  if (!MapComponents || !L) return null;

  const { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } = MapComponents;

  const getNavigationIcon = () => {
    return L.divIcon({
      html: renderToString(
        <div className="p-1.5 rounded-full bg-blue-600 shadow-2xl border-2 border-white text-white animate-bounce relative">
          <Navigation size={14} fill="currentColor" className="rotate-45" />
          <div className="absolute -inset-1 rounded-full bg-blue-400/30 animate-ping -z-10" />
        </div>
      ),
      className: 'custom-nav-icon bg-transparent',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const getDestinationIcon = () => {
    return L.divIcon({
      html: renderToString(
        <div className="p-1.5 rounded-full bg-emerald-600 shadow-2xl border-2 border-white text-white relative">
          <MapPin size={14} fill="currentColor" />
          <div className="absolute -dashed-ring -inset-2 rounded-full border-2 border-emerald-500/50 animate-pulse-slow" />
        </div>
      ),
      className: 'custom-dest-icon bg-transparent',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const getIcon = (status: string, isSpecial: boolean = false) => {
    let color = 'text-blue-600';
    let bgColor = 'bg-blue-100';
    let ringColor = 'ring-blue-500/50';
    
    if (isSpecial) {
      color = 'text-white';
      bgColor = 'bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600';
      ringColor = 'ring-amber-400 ring-offset-2 animate-pulse';
    } else if (status === 'Finalizada') {
      color = 'text-emerald-600';
      bgColor = 'bg-emerald-100';
      ringColor = 'ring-emerald-500/50';
    } else if (status === 'Pendente') {
      color = 'text-amber-600';
      bgColor = 'bg-amber-100';
      ringColor = 'ring-amber-500/50';
    } else if (status === 'Agendada') {
      color = 'text-slate-600';
      bgColor = 'bg-slate-100';
      ringColor = 'ring-slate-500/50';
    }

    return L.divIcon({
      html: renderToString(
        <div className={`p-2 rounded-full border-4 border-white shadow-xl ${bgColor} ring-4 ${ringColor} relative cursor-pointer hover:scale-110 transition-transform`}>
          <Truck className={color} size={22} />
          {isSpecial ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-900 text-[10px] font-black border border-white shadow-sm">
              ★
            </span>
          ) : status === 'Em Andamento' && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
        </div>
      ),
      className: 'custom-marker bg-transparent',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  const getRouteColor = (status: string) => {
    if (status === 'Finalizada') return '#10b981'; // emerald-600
    if (status === 'Em Andamento') return '#2563eb'; // blue-600
    return '#94a3b8'; // slate-400
  };

  // Center on João Pessoa / Paraíba default
  const defaultCenter: [number, number] = (mapDeliveries?.length || 0) > 0 
    ? [mapDeliveries[0].lat!, mapDeliveries[0].lng!] 
    : [-7.1150, -34.8631];

  return (
    <div className="h-[600px] md:h-[700px] w-full rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl relative z-0 flex flex-col md:flex-row">
      {/* Interactive Sidebar */}
      <div className={`
        absolute md:relative z-[1000] w-full md:w-80 h-auto md:h-full 
        transition-all duration-500 ease-in-out
        ${showSidebar ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:-translate-x-full'}
        bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800
        ${!showSidebar ? 'invisible opacity-0' : 'visible opacity-100'}
        bottom-12 md:bottom-0
      `}>
        <div className="p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-400">Entregadores Ativos</h3>
              <p className="text-[10px] text-slate-500 font-medium">Rotas e entregas em tempo real</p>
            </div>
            <button 
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
            {activeDeliveries.length > 0 ? (
              activeDeliveries.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriverId(d.id)}
                  className={`
                    w-full p-4 rounded-2xl text-left border transition-all flex flex-col gap-2 group cursor-pointer
                    ${selectedDriverId === d.id 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/20' 
                      : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-900'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm truncate">{d.driver}</span>
                    <div className={`size-2 rounded-full animate-pulse ${selectedDriverId === d.id ? 'bg-white' : 'bg-blue-500'}`} />
                  </div>
                  <div className="flex items-center gap-2 opacity-80">
                    <MapPin size={12} />
                    <span className="text-[10px] font-bold truncate uppercase">{d.neighborhood || d.address || 'Sem bairro'}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${selectedDriverId === d.id ? 'bg-blue-500 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                      {d.route?.length || 0} pts
                    </span>
                    <Eye size={14} className={`transition-transform group-hover:scale-125 ${selectedDriverId === d.id ? 'text-white' : 'text-blue-500'}`} />
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <Navigation size={32} className="mb-2" />
                <p className="text-xs font-bold text-center">Nenhum entregador em movimento no momento</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Control Overlay */}
      {!showSidebar && (
        <button 
          onClick={() => setShowSidebar(true)}
          className="absolute top-4 left-4 z-[1000] p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-blue-600 animate-bounce"
        >
          <ListIcon size={20} />
        </button>
      )}

      <div className="flex-1 relative">
        <MapContainer 
          center={defaultCenter}
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController selectedCoords={selectedCoords} L={L} />
          <BoundsController deliveries={mapDeliveries} L={L} />
          
          {mapDeliveries.map(delivery => (
            <React.Fragment key={delivery.id}>
              {/* Render Route */}
              {delivery.route && delivery.route.length > 1 && (
                <Polyline 
                  positions={delivery.route} 
                  color={getRouteColor(delivery.status)}
                  weight={selectedDriverId === delivery.id ? 10 : 4}
                  opacity={selectedDriverId === delivery.id ? 1 : 0.6}
                  dashArray={delivery.status === 'Finalizada' ? '' : '10, 10'}
                  pathOptions={{
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: selectedDriverId === delivery.id ? 'active-route-path animate-dash' : ''
                  }}
                />
              )}
              
              {/* Render Navigation Icons for Active Delivery */}
              {selectedDriverId === delivery.id && delivery.status === 'Em Andamento' && (
                <>
                  {/* Current Location as Navigation Icon */}
                  <Marker 
                    position={[delivery.lat!, delivery.lng!]} 
                    icon={getNavigationIcon()}
                    zIndexOffset={1000}
                  >
                    <Tooltip permanent direction="top" offset={[0, -15]} opacity={1}>
                      <div className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter">
                        Localização Atual ({delivery.driver})
                      </div>
                    </Tooltip>
                  </Marker>

                  {/* Destination Point */}
                  {delivery.route && delivery.route.length > 0 && (
                     <Marker 
                      position={delivery.route[delivery.route.length - 1]} 
                      icon={getDestinationIcon()}
                      zIndexOffset={900}
                    >
                      <Tooltip permanent direction="top" offset={[0, -15]} opacity={1}>
                        <div className="bg-emerald-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter">
                          Destino da Entrega
                        </div>
                      </Tooltip>
                    </Marker>
                  )}
                </>
              )}
                
              {/* Render Standard Marker for non-active or non-selected */}
              {selectedDriverId !== delivery.id && (() => {
                const isSpecial = (delivery as any).delivery_type === 'especial' || 
                                  (delivery as any).is_special === true || 
                                  (delivery as any).notes?.includes('[ESPECIAL]') || 
                                  (delivery as any).product?.includes('[ESPECIAL]');
                return (
                <Marker 
                  position={[delivery.lat!, delivery.lng!]} 
                  icon={getIcon(delivery.status, isSpecial)}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <div className="font-bold text-[10px] uppercase tracking-wider">
                      {isSpecial && <span className="text-amber-500 mr-1 font-black">★ ESPECIAL •</span>}
                      {delivery.driver || 'Entregador'} • <span className={
                        isSpecial ? 'text-amber-600 font-extrabold' :
                        delivery.status === 'Finalizada' ? 'text-emerald-600' :
                        delivery.status === 'Em Andamento' ? 'text-blue-600' :
                        'text-slate-600'
                      }>{delivery.status}</span>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 min-w-[190px]">
                      {isSpecial && (
                        <div className="mb-2 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider text-center">
                          ★ Entrega/Retirada Especial ★
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-bold text-sm text-slate-800">{delivery.driver || 'Sem entregador'}</h3>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                          isSpecial ? 'bg-amber-100 text-amber-800 font-black' :
                          delivery.status === 'Finalizada' ? 'bg-emerald-100 text-emerald-700' :
                          delivery.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {delivery.status}
                        </span>
                      </div>
                      
                      {delivery.address ? (
                        <p className="text-xs font-semibold text-slate-700 leading-tight mb-1 flex items-start gap-1">
                          <MapPin size={12} className="text-blue-600 shrink-0 mt-0.5" />
                          <span>{delivery.address}</span>
                        </p>
                      ) : null}

                      <p className="text-[11px] text-slate-500 font-medium">
                        {[delivery.neighborhood, delivery.city].filter(Boolean).join(', ') || 'Paraíba'}
                      </p>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-black text-blue-600">
                          R$ {Number(delivery.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {delivery.route && delivery.route.length > 0 && (
                          <span className="text-[8px] text-slate-400 font-bold uppercase">{delivery.route.length} pts rota</span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
                );
              })()}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
