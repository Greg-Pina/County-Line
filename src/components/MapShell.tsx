'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export default function MapShell() {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapNodeRef.current) return;

    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: MAP_STYLE,
      center: [-98.5795, 39.8283],
      zoom: 3
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={mapNodeRef} className="mapContainer" aria-label="U.S. map canvas" />;
}
