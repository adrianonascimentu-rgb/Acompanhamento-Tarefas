'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Filter, 
  Layers, 
  Maximize2, 
  Navigation, 
  Search,
  Flag,
  Calendar,
  Check,
  Eye
} from 'lucide-react';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';

interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  progress?: number;
  due?: string;
  due_date?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  checkin_lat?: number;
  checkin_lng?: number;
  location?: string;
  address?: string;
  assignees?: { name: string; avatarUrl?: string }[];
  isOverdue?: boolean;
  isDueSoon?: boolean;
  distanceFormatted?: string;
  distanceKm?: number;
}

interface TasksMapViewProps {
  tasks: Task[];
  isDarkMode?: boolean;
  onSelectTask?: (task: Task) => void;
  onStatusUpdate?: (taskId: string | number, newStatus: string) => void;
  userCoords?: { lat: number; lng: number } | null;
  onFetchLocation?: () => void;
  loadingGeo?: boolean;
}

// Fallback coordinates across major Brazilian regions/cities for tasks without explicit lat/lng
const BASE_COORDINATES: [number, number][] = [
  [-23.55052, -46.633308], // São Paulo Centro
  [-23.561414, -46.655881], // SP Av. Paulista
  [-23.5475, -46.6361],    // SP República
  [-23.5874, -46.6576],    // SP Ibirapuera
  [-23.5200, -46.6800],    // SP Lapa
  [-22.9068, -43.1729],    // Rio de Janeiro Centro
  [-22.9711, -43.1825],    // RJ Copacabana
  [-19.9167, -43.9345],    // Belo Horizonte
  [-25.4284, -49.2733],    // Curitiba
  [-15.7975, -47.8919],    // Brasília
  [-30.0346, -51.2177],    // Porto Alegre
  [-12.9777, -38.5016],    // Salvador
  [-8.0476, -34.8770],     // Recife
  [-3.7319, -38.5267],     // Fortaleza
  [-20.3155, -40.3128],    // Vitória
];

function getTaskCoordinates(task: Task, index: number): [number, number] {
  const lat = task.latitude ?? task.lat ?? task.checkin_lat;
  const lng = task.longitude ?? task.lng ?? task.checkin_lng;

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    return [lat, lng];
  }

  // Generate deterministic offset around base locations based on task ID or index
  const baseIndex = (typeof task.id === 'number' ? task.id : task.id.toString().charCodeAt(0)) % BASE_COORDINATES.length;
  const base = BASE_COORDINATES[baseIndex] || BASE_COORDINATES[index % BASE_COORDINATES.length];
  
  // Add small deterministic spread (~1-3km) so markers don't overlap completely
  const hash = Math.sin((index + 1) * 999) * 10000;
  const offsetLat = ((hash - Math.floor(hash)) - 0.5) * 0.04;
  const hash2 = Math.cos((index + 1) * 777) * 10000;
  const offsetLng = ((hash2 - Math.floor(hash2)) - 0.5) * 0.04;

  return [base[0] + offsetLat, base[1] + offsetLng];
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  let colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  if (priority === 'Urgente') colorClass = 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400';
  else if (priority === 'Alta') colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
  else if (priority === 'Média') colorClass = 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      {priority}
    </span>
  );
};

export function TasksMapView({ 
  tasks, 
  isDarkMode = false, 
  onSelectTask, 
  onStatusUpdate,
  userCoords,
  onFetchLocation,
  loadingGeo = false
}: TasksMapViewProps) {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [filterPendingOnly, setFilterPendingOnly] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  // Load Leaflet dynamically on client side
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([reactLeaflet, leafletModule]) => {
      if (isMounted) {
        setMapComponents(reactLeaflet);
        setL(leafletModule.default || leafletModule);
      }
    }).catch(err => {
      console.error('Erro ao carregar mapa Leaflet:', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Custom User GPS marker icon
  const createUserGpsMarkerIcon = () => {
    if (!L) return null;
    const html = renderToString(
      <div className="relative flex items-center justify-center">
        <div className="size-6 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white z-10">
          <Navigation size={12} className="fill-white" />
        </div>
        <div className="absolute size-10 rounded-full bg-blue-500/30 animate-ping" />
      </div>
    );
    return L.divIcon({
      html,
      className: 'custom-user-gps-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Filter tasks based on pending toggle and search query
  const mapTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterPendingOnly && task.status === 'Concluída') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        const matchesPriority = task.priority?.toLowerCase().includes(query);
        const matchesAssignee = task.assignees?.some(a => a.name.toLowerCase().includes(query));
        return matchesTitle || matchesDesc || matchesPriority || matchesAssignee;
      }
      return true;
    }).map((task, index) => ({
      ...task,
      coords: getTaskCoordinates(task, index)
    }));
  }, [tasks, filterPendingOnly, searchQuery]);

  const activePendingCount = useMemo(() => {
    return tasks.filter(t => t.status !== 'Concluída').length;
  }, [tasks]);

  const createCustomMarkerIcon = (task: Task) => {
    if (!L) return null;

    let pinBg = '#3b82f6'; // Blue for Em Andamento
    let borderColor = '#2563eb';

    if (task.priority === 'Urgente' || task.status === 'Atrasadas' || task.isOverdue) {
      pinBg = '#ef4444'; // Red
      borderColor = '#dc2626';
    } else if (task.status === 'Pendente' || task.priority === 'Alta') {
      pinBg = '#f59e0b'; // Amber
      borderColor = '#d97706';
    } else if (task.status === 'Concluída') {
      pinBg = '#10b981'; // Emerald
      borderColor = '#059669';
    }

    const html = renderToString(
      <div className="relative flex items-center justify-center group">
        <div 
          className="size-9 rounded-full flex items-center justify-center text-white shadow-lg border-2 transition-transform transform group-hover:scale-110"
          style={{ backgroundColor: pinBg, borderColor: '#ffffff' }}
        >
          <MapPin size={18} className="drop-shadow-xs" />
        </div>
        <div 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
          style={{ backgroundColor: pinBg }}
        />
        {task.priority === 'Urgente' && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
          </span>
        )}
      </div>
    );

    return L.divIcon({
      html,
      className: 'custom-task-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
    setSelectedCoords((task as any).coords);
    if (onSelectTask) {
      onSelectTask(task);
    }
  };

  if (!MapComponents || !L) {
    return (
      <div className={`w-full h-[550px] rounded-2xl border flex flex-col items-center justify-center gap-3 animate-pulse ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        <MapPin size={32} className="animate-bounce text-blue-500" />
        <p className="text-xs font-bold uppercase tracking-wider">Carregando Mapa de Tarefas...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap } = MapComponents;

  // Controller component to handle flying to selected task
  const MapFlyTo = () => {
    const map = useMap();
    useEffect(() => {
      if (selectedCoords) {
        map.flyTo(selectedCoords, 15, { duration: 1.2 });
      }
    }, [map]);
    return null;
  };

  const defaultCenter: [number, number] = mapTasks.length > 0 ? mapTasks[0].coords : [-23.55052, -46.633308];

  return (
    <div className={`w-full rounded-2xl border overflow-hidden shadow-sm flex flex-col ${
      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
    }`}>
      {/* Top Header Control Bar */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Mapa de Tarefas Pendentes
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 text-[10px] font-black">
                {activePendingCount} pendentes
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Visualização geográfica das demandas por localização
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tarefa no mapa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full sm:w-48 pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border outline-none transition-all ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' 
                  : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Pending Toggle Button */}
          <button
            onClick={() => setFilterPendingOnly(!filterPendingOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filterPendingOnly
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-900'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <Filter size={13} />
            <span>{filterPendingOnly ? 'Apenas Pendentes' : 'Todas as Tarefas'}</span>
          </button>

          {/* GPS Location Button */}
          {onFetchLocation && (
            <button
              onClick={onFetchLocation}
              disabled={loadingGeo}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                userCoords
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-900'
              }`}
              title="Obter GPS atual e ordenar tarefas"
            >
              {loadingGeo ? (
                <div className="size-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <Navigation size={13} className={userCoords ? 'fill-white' : ''} />
              )}
              <span>{userCoords ? 'GPS Ativo' : 'Obter GPS'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map & Sidebar Layout */}
      <div className="relative w-full h-[540px] flex">
        {/* Leaflet Interactive Map */}
        <div className="flex-1 h-full z-0">
          <MapContainer
            center={userCoords ? [userCoords.lat, userCoords.lng] : defaultCenter}
            zoom={userCoords ? 13 : 12}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
            />

            <MapFlyTo />

            {/* User GPS Marker */}
            {userCoords && createUserGpsMarkerIcon() && (
              <Marker
                position={[userCoords.lat, userCoords.lng]}
                icon={createUserGpsMarkerIcon()!}
              >
                <Popup>
                  <div className="p-1 text-center">
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Sua Posição GPS</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">Você está aqui</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {mapTasks.map((task) => {
              const icon = createCustomMarkerIcon(task);
              if (!icon) return null;

              return (
                <Marker
                  key={task.id}
                  position={task.coords}
                  icon={icon}
                  eventHandlers={{
                    click: () => handleTaskClick(task)
                  }}
                >
                  <Popup className="custom-task-popup">
                    <div className="p-1 min-w-[220px] max-w-[280px]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <PriorityBadge priority={task.priority} />
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          task.status === 'Concluída' 
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'Em Andamento'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {task.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 leading-snug mb-1">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      {typeof task.progress === 'number' && (
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                            <span>Progresso</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Assignees & Due Date */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center gap-1 font-medium">
                          <User size={12} className="text-slate-400" />
                          <span>
                            {task.assignees && task.assignees.length > 0 
                              ? task.assignees.map(a => a.name).join(', ') 
                              : 'Sem responsável'}
                          </span>
                        </div>
                        {task.due && (
                          <div className="flex items-center gap-1 font-semibold text-slate-600">
                            <Calendar size={11} />
                            <span>{task.due}</span>
                          </div>
                        )}
                      </div>

                      {/* Status Action Buttons */}
                      {onStatusUpdate && task.status !== 'Concluída' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex gap-1.5">
                          <button
                            onClick={() => onStatusUpdate(task.id, 'Em Andamento')}
                            className="flex-1 py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all text-center"
                          >
                            Em Andamento
                          </button>
                          <button
                            onClick={() => onStatusUpdate(task.id, 'Concluída')}
                            className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1"
                          >
                            <Check size={11} />
                            Concluir
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Task List Floating Drawer / Sidebar */}
        <div className={`w-72 sm:w-80 h-full border-l flex flex-col z-10 shrink-0 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}>
          <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tarefas no Mapa ({mapTasks.length})
            </span>
            <span className="text-[10px] text-slate-400">Clique para centrar</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {mapTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <AlertCircle size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Nenhuma tarefa encontrada com os filtros atuais.</p>
              </div>
            ) : (
              mapTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? (isDarkMode ? 'bg-slate-800 border-blue-500/80 shadow-sm' : 'bg-blue-50/80 border-blue-300 shadow-sm')
                        : (isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-300')
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <PriorityBadge priority={task.priority} />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${
                        task.status === 'Concluída' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight mb-1">
                      {task.title}
                    </h5>

                    {task.description && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate font-medium">
                          {task.assignees && task.assignees[0] ? task.assignees[0].name : 'Sem atribuído'}
                        </span>
                        {task.distanceFormatted && (
                          <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-full text-[9px]">
                            {task.distanceFormatted}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        <Navigation size={10} />
                        <span>Ver no Mapa</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
