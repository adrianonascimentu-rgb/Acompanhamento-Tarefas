// Distance and GPS calculation utilities

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function getTaskCoords(task: any, index: number = 0): { lat: number; lng: number } {
  const lat = task.latitude ?? task.lat ?? task.destination_lat ?? task.checkin_lat;
  const lng = task.longitude ?? task.lng ?? task.destination_lng ?? task.checkin_lng;

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    return { lat, lng };
  }

  // Base fallback coordinates across Brazil
  const BASE_COORDINATES: [number, number][] = [
    [-23.55052, -46.633308], // São Paulo
    [-23.561414, -46.655881], // SP Paulista
    [-22.9068, -43.1729],    // Rio de Janeiro
    [-19.9167, -43.9345],    // Belo Horizonte
    [-25.4284, -49.2733],    // Curitiba
    [-15.7975, -47.8919],    // Brasília
    [-30.0346, -51.2177],    // Porto Alegre
    [-12.9777, -38.5016],    // Salvador
  ];

  const idVal = typeof task.id === 'number' ? task.id : (task.id ? task.id.toString().charCodeAt(0) : index);
  const base = BASE_COORDINATES[idVal % BASE_COORDINATES.length];
  const hash = Math.sin((index + 1) * 999) * 10000;
  const offsetLat = ((hash - Math.floor(hash)) - 0.5) * 0.04;
  const hash2 = Math.cos((index + 1) * 777) * 10000;
  const offsetLng = ((hash2 - Math.floor(hash2)) - 0.5) * 0.04;

  return { lat: base[0] + offsetLat, lng: base[1] + offsetLng };
}
