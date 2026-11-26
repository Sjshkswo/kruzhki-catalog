import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function LeafletMap({ clubs = [], center = [43.238949, 76.889709], zoom = 12, userLocation = null }) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!window.L || !containerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(containerRef.current).setView(center, zoom);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof window.L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add user marker if available
    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = window.L.divIcon({
        className: 'user-geo-pin',
        html: '<div style="background:#2563eb;color:#fff;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      window.L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Вы здесь</b>');
    }

    // Add club markers
    const validClubs = clubs.filter(c => c.lat && c.lng);
    const bounds = [];

    if (userLocation && userLocation.lat && userLocation.lng) {
      bounds.push([userLocation.lat, userLocation.lng]);
    }

    validClubs.forEach((c) => {
      const pos = [Number(c.lat), Number(c.lng)];
      bounds.push(pos);
      const marker = window.L.marker(pos).addTo(map);
      const popupHtml = `
        <div style="font-family:sans-serif;font-size:14px;min-width:180px;">
          <b style="color:#6d28d9;display:block;margin-bottom:4px;">${c.title}</b>
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📍 ${c.district ? c.district + ', ' : ''}${c.address || ''}</div>
          <div style="font-size:13px;font-weight:bold;margin-bottom:6px;">${Number(c.price) === 0 ? 'Бесплатно' : Number(c.price).toLocaleString('ru-RU') + ' ₸'}</div>
          <a href="/clubs/${c.id}" style="color:#f97316;font-weight:bold;text-decoration:none;">Подробнее →</a>
        </div>
      `;
      marker.bindPopup(popupHtml);
    });

    if (bounds.length > 0 && map.fitBounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (_) {}
    }
  }, [clubs, center, zoom, userLocation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '420px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!window.L && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
          <p>🗺️ <b>Карта кружков</b></p>
          <p className="muted">Кружки на карте (с координатами):</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {clubs.filter(c => c.lat && c.lng).map(c => (
              <li key={c.id}>📍 <Link to={`/clubs/${c.id}`}><b>{c.title}</b></Link> ({c.district || c.address})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
