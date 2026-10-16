'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { getNeighborhoodCoords } from '@/lib/neighborhoodCoords';

// Fix for default marker icon in Leaflet + Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapUpdaterProps {
  center: [number, number];
}

function MapUpdater({ center }: MapUpdaterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

interface LiveTrackerMapProps {
  lat?: number;
  lng?: number;
  route?: [number, number][];
  driverName: string;
  status: string;
  address?: string;
  neighborhood?: string;
  city?: string;
}

export default function LiveTrackerMap({ 
  lat, 
  lng, 
  route, 
  driverName, 
  status,
  address,
  neighborhood,
  city
}: LiveTrackerMapProps) {
  const [resolvedCoords, setResolvedCoords] = useState<[number, number] | null>(() => {
    // Check if passed coords are valid and not a placeholder
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat > -15 && lat < 0) {
      return [lat, lng];
    }
    const regional = getNeighborhoodCoords(neighborhood, city);
    return regional ? [regional[0], regional[1]] : null;
  });

  useEffect(() => {
    let isMounted = true;

    // Check if initial lat/lng is valid
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat > -15 && lat < 0) {
      setResolvedCoords([lat, lng]);
      return;
    }

    // Try geocoding if address or neighborhood is present
    if (address || neighborhood || city) {
      fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          neighborhood,
          city,
          state: 'Paraíba'
        })
      })
        .then(res => res.json())
        .then(data => {
          if (isMounted && data.lat && data.lng) {
            setResolvedCoords([data.lat, data.lng]);
          }
        })
        .catch(err => console.warn('LiveTracker geocode error:', err));
    }

    return () => {
      isMounted = false;
    };
  }, [lat, lng, address, neighborhood, city]);

  if (!resolvedCoords) {
    return (
      <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center p-4 text-center">
        <p className="text-slate-400 text-sm font-medium italic">Localização da entrega não disponível.</p>
      </div>
    );
  }

  const trackerIcon = L.divIcon({
    html: renderToString(
      <div className={`p-2 rounded-full border-4 border-white shadow-xl bg-blue-100 ring-4 ring-blue-500/50 relative ${status === 'Em Andamento' ? 'animate-pulse' : ''}`}>
        <Truck className="text-blue-600" size={24} />
      </div>
    ),
    className: 'custom-marker bg-transparent',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 z-0 relative">
      <MapContainer 
        center={resolvedCoords} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {route && route.length > 1 && (
          <Polyline 
            positions={route} 
            color="#2563eb"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}

        <Marker position={resolvedCoords} icon={trackerIcon}>
          <Popup>
            <div className="text-xs font-bold p-1">
              <div className="text-slate-900">{driverName || 'Entregador'}</div>
              <div className="text-[10px] text-slate-500 font-normal">Status: {status}</div>
              {address && <div className="text-[10px] text-blue-600 font-medium mt-1">{address}</div>}
            </div>
          </Popup>
        </Marker>
        <MapUpdater center={resolvedCoords} />
      </MapContainer>
    </div>
  );
}
