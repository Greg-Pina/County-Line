'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl';

const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const US_STATES_SOURCE_ID = 'us-states';
const US_STATES_FILL_LAYER_ID = 'us-states-fill';
const US_STATES_LINE_LAYER_ID = 'us-states-line';
const US_STATES_LABEL_LAYER_ID = 'us-states-label';
const US_STATES_LAYER_IDS = [
  US_STATES_FILL_LAYER_ID,
  US_STATES_LINE_LAYER_ID,
  US_STATES_LABEL_LAYER_ID
];
const US_STATES_GEOJSON_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

function getStateName(feature: MapGeoJSONFeature) {
  return typeof feature.properties?.name === 'string' ? feature.properties.name : 'Selected state';
}

function setStateLayerVisibility(map: maplibregl.Map, isVisible: boolean) {
  const visibility = isVisible ? 'visible' : 'none';

  US_STATES_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

export default function MapShell() {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoveredStateRef = useRef<string | number | null>(null);
  const selectedStateRef = useRef<string | number | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [statesVisible, setStatesVisible] = useState(true);
  const [activeStateName, setActiveStateName] = useState('United States');

  useEffect(() => {
    if (!mapNodeRef.current) return;

    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: MAP_STYLE,
      center: [-98.5795, 39.8283],
      zoom: 3
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const clearHoveredState = () => {
      if (hoveredStateRef.current !== null) {
        map.setFeatureState(
          { source: US_STATES_SOURCE_ID, id: hoveredStateRef.current },
          { hover: false }
        );
        hoveredStateRef.current = null;
      }
    };

    const clearSelectedState = () => {
      if (selectedStateRef.current !== null) {
        map.setFeatureState(
          { source: US_STATES_SOURCE_ID, id: selectedStateRef.current },
          { selected: false }
        );
        selectedStateRef.current = null;
      }
    };

    const handleStateMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      map.getCanvas().style.cursor = 'pointer';

      if (feature.id !== undefined && hoveredStateRef.current !== feature.id) {
        clearHoveredState();
        hoveredStateRef.current = feature.id;
        map.setFeatureState({ source: US_STATES_SOURCE_ID, id: feature.id }, { hover: true });
      }

      setActiveStateName(getStateName(feature));
    };

    const handleStateLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredState();
    };

    const handleStateClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      const stateName = getStateName(feature);
      setActiveStateName(stateName);

      clearSelectedState();

      if (feature.id !== undefined) {
        selectedStateRef.current = feature.id;
        map.setFeatureState({ source: US_STATES_SOURCE_ID, id: feature.id }, { selected: true });
      }

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText(stateName)
        .addTo(map);
    };

    const addUsStateLayers = () => {
      if (map.getSource(US_STATES_SOURCE_ID)) return;

      map.addSource(US_STATES_SOURCE_ID, {
        type: 'geojson',
        data: US_STATES_GEOJSON_URL,
        promoteId: 'name'
      });

      map.addLayer({
        id: US_STATES_FILL_LAYER_ID,
        type: 'fill',
        source: US_STATES_SOURCE_ID,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#f59e0b',
            ['boolean', ['feature-state', 'hover'], false],
            '#38bdf8',
            '#0ea5e9'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.44,
            ['boolean', ['feature-state', 'hover'], false],
            0.34,
            0.18
          ]
        }
      });

      map.addLayer({
        id: US_STATES_LINE_LAYER_ID,
        type: 'line',
        source: US_STATES_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#fde68a',
            '#e0f2fe'
          ],
          'line-opacity': 0.84,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2.5, 0.75, 5, 1.2, 8, 2]
        }
      });

      map.addLayer({
        id: US_STATES_LABEL_LAYER_ID,
        type: 'symbol',
        source: US_STATES_SOURCE_ID,
        minzoom: 3.6,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3.6, 10, 6, 13],
          'text-max-width': 8,
          'text-padding': 3
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#0b1020',
          'text-halo-width': 1.4,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 3.6, 0.2, 4.2, 0.86]
        }
      });

      map.on('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
      map.on('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
      map.on('click', US_STATES_FILL_LAYER_ID, handleStateClick);
    };

    map.on('load', addUsStateLayers);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off('load', addUsStateLayers);
      if (map.getLayer(US_STATES_FILL_LAYER_ID)) {
        map.off('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
        map.off('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
        map.off('click', US_STATES_FILL_LAYER_ID, handleStateClick);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    setStateLayerVisibility(mapRef.current, statesVisible);
  }, [statesVisible]);

  return (
    <div className="mapStage">
      <div ref={mapNodeRef} className="mapContainer" aria-label="U.S. map canvas" />
      <aside className="layerPanel" aria-label="Map layers">
        <div className="layerPanelHeader">
          <span>Layers</span>
          <span className="activeGeography">{activeStateName}</span>
        </div>
        <label className="layerToggle">
          <input
            type="checkbox"
            checked={statesVisible}
            onChange={(event) => setStatesVisible(event.target.checked)}
          />
          <span className="toggleTrack" aria-hidden="true">
            <span className="toggleThumb" />
          </span>
          <span>States</span>
        </label>
      </aside>
    </div>
  );
}
