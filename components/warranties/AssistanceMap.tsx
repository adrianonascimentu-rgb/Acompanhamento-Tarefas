'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface AssistanceMapProps {
  address: string;
  name: string;
}

export default function AssistanceMap({ address, name }: AssistanceMapProps) {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const geocode = async () => {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        // Using OpenStreetMap Nominatim for geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setError('Localização não encontrada');
        }
      } catch (err) {
        console.error('Geocoding error:', err);
        setError('Erro ao carregar mapa');
      } finally {
        setLoading(false);
      }
    };

    geocode();
  }, [address]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center">
        <p className="text-slate-400 text-sm font-medium">Buscando coordenadas...</p>
      </div>
    );
  }

  if (error || !coords) {
    return (
      <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center p-4 text-center">
        <p className="text-slate-400 text-sm font-medium">{error || 'Coordenadas não disponíveis'}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 z-0 relative">
      <MapContainer 
        center={coords} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coords}>
          <Popup>
            <div className="text-xs font-bold">
              {name}
            </div>
          </Popup>
        </Marker>
        <MapUpdater center={coords} />
      </MapContainer>
    </div>
  );
}
