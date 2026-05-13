'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

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
const CONGRESSIONAL_DISTRICTS_SOURCE_ID = 'congressional-districts';
const CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID = 'congressional-districts-fill';
const CONGRESSIONAL_DISTRICTS_LINE_LAYER_ID = 'congressional-districts-line';
const CONGRESSIONAL_DISTRICTS_LABEL_LAYER_ID = 'congressional-districts-label';
const CONGRESSIONAL_DISTRICTS_LAYER_IDS = [
  CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
  CONGRESSIONAL_DISTRICTS_LINE_LAYER_ID,
  CONGRESSIONAL_DISTRICTS_LABEL_LAYER_ID
];
const CONGRESSIONAL_DISTRICTS_QUERY_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer/54/query';
const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
};
const STATE_NAME_TO_FIPS = new Map([
  ['Alabama', '01'],
  ['Alaska', '02'],
  ['Arizona', '04'],
  ['Arkansas', '05'],
  ['California', '06'],
  ['Colorado', '08'],
  ['Connecticut', '09'],
  ['Delaware', '10'],
  ['District of Columbia', '11'],
  ['Florida', '12'],
  ['Georgia', '13'],
  ['Hawaii', '15'],
  ['Idaho', '16'],
  ['Illinois', '17'],
  ['Indiana', '18'],
  ['Iowa', '19'],
  ['Kansas', '20'],
  ['Kentucky', '21'],
  ['Louisiana', '22'],
  ['Maine', '23'],
  ['Maryland', '24'],
  ['Massachusetts', '25'],
  ['Michigan', '26'],
  ['Minnesota', '27'],
  ['Mississippi', '28'],
  ['Missouri', '29'],
  ['Montana', '30'],
  ['Nebraska', '31'],
  ['Nevada', '32'],
  ['New Hampshire', '33'],
  ['New Jersey', '34'],
  ['New Mexico', '35'],
  ['New York', '36'],
  ['North Carolina', '37'],
  ['North Dakota', '38'],
  ['Ohio', '39'],
  ['Oklahoma', '40'],
  ['Oregon', '41'],
  ['Pennsylvania', '42'],
  ['Rhode Island', '44'],
  ['South Carolina', '45'],
  ['South Dakota', '46'],
  ['Tennessee', '47'],
  ['Texas', '48'],
  ['Utah', '49'],
  ['Vermont', '50'],
  ['Virginia', '51'],
  ['Washington', '53'],
  ['West Virginia', '54'],
  ['Wisconsin', '55'],
  ['Wyoming', '56']
]);

function getStateName(feature: MapGeoJSONFeature) {
  return typeof feature.properties?.name === 'string' ? feature.properties.name : 'Selected state';
}

function getStateFips(stateName: string) {
  return STATE_NAME_TO_FIPS.get(stateName) ?? null;
}

function getCongressionalDistrictName(feature: MapGeoJSONFeature) {
  const basename = feature.properties?.BASENAME;
  const name = feature.properties?.NAME;

  if (typeof basename === 'string' && basename.length > 0) {
    const districtNumber = Number(basename);

    if (basename === '00' || basename.toLowerCase() === 'at large') {
      return 'At-large district';
    }

    return Number.isNaN(districtNumber) ? basename : `District ${districtNumber}`;
  }

  return typeof name === 'string' ? name : 'Congressional district';
}

function getCongressionalDistrictsUrl(stateFips: string) {
  const params = new URLSearchParams({
    where: `STATE='${stateFips}'`,
    outFields: 'GEOID,STATE,BASENAME,NAME,CD119',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson'
  });

  return `${CONGRESSIONAL_DISTRICTS_QUERY_URL}?${params.toString()}`;
}

function setStateLayerVisibility(map: maplibregl.Map, isVisible: boolean) {
  const visibility = isVisible ? 'visible' : 'none';

  US_STATES_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function setCongressionalDistrictLayerVisibility(map: maplibregl.Map, isVisible: boolean) {
  const visibility = isVisible ? 'visible' : 'none';

  CONGRESSIONAL_DISTRICTS_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function updateCongressionalDistrictSource(map: maplibregl.Map, stateFips: string | null) {
  const source = map.getSource(CONGRESSIONAL_DISTRICTS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (!source) return;

  source.setData(stateFips ? getCongressionalDistrictsUrl(stateFips) : EMPTY_FEATURE_COLLECTION);
}

export default function MapShell() {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoveredStateRef = useRef<string | number | null>(null);
  const selectedStateRef = useRef<string | number | null>(null);
  const hoveredCongressionalDistrictRef = useRef<string | number | null>(null);
  const selectedCongressionalDistrictRef = useRef<string | number | null>(null);
  const selectedStateNameRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [statesVisible, setStatesVisible] = useState(true);
  const [districtsVisible, setDistrictsVisible] = useState(false);
  const [activeStateName, setActiveStateName] = useState('United States');
  const [selectedStateName, setSelectedStateName] = useState<string | null>(null);
  const [selectedStateFips, setSelectedStateFips] = useState<string | null>(null);

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

    const clearHoveredCongressionalDistrict = () => {
      if (hoveredCongressionalDistrictRef.current !== null) {
        map.setFeatureState(
          {
            source: CONGRESSIONAL_DISTRICTS_SOURCE_ID,
            id: hoveredCongressionalDistrictRef.current
          },
          { hover: false }
        );
        hoveredCongressionalDistrictRef.current = null;
      }
    };

    const clearSelectedCongressionalDistrict = () => {
      if (selectedCongressionalDistrictRef.current !== null) {
        map.setFeatureState(
          {
            source: CONGRESSIONAL_DISTRICTS_SOURCE_ID,
            id: selectedCongressionalDistrictRef.current
          },
          { selected: false }
        );
        selectedCongressionalDistrictRef.current = null;
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
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
    };

    const handleStateClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      const stateName = getStateName(feature);
      const stateFips = getStateFips(stateName);
      selectedStateNameRef.current = stateName;
      setActiveStateName(stateName);
      setSelectedStateName(stateName);
      setSelectedStateFips(stateFips);

      clearSelectedState();
      clearHoveredCongressionalDistrict();
      clearSelectedCongressionalDistrict();

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

    const handleCongressionalDistrictMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      map.getCanvas().style.cursor = 'pointer';

      if (
        feature.id !== undefined &&
        hoveredCongressionalDistrictRef.current !== feature.id
      ) {
        clearHoveredCongressionalDistrict();
        hoveredCongressionalDistrictRef.current = feature.id;
        map.setFeatureState(
          { source: CONGRESSIONAL_DISTRICTS_SOURCE_ID, id: feature.id },
          { hover: true }
        );
      }

      setActiveStateName(
        `${selectedStateNameRef.current ?? 'Congressional'} ${getCongressionalDistrictName(feature)}`
      );
    };

    const handleCongressionalDistrictLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredCongressionalDistrict();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
    };

    const handleCongressionalDistrictClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      const districtName = getCongressionalDistrictName(feature);
      setActiveStateName(`${selectedStateNameRef.current ?? 'Congressional'} ${districtName}`);

      clearSelectedCongressionalDistrict();

      if (feature.id !== undefined) {
        selectedCongressionalDistrictRef.current = feature.id;
        map.setFeatureState(
          { source: CONGRESSIONAL_DISTRICTS_SOURCE_ID, id: feature.id },
          { selected: true }
        );
      }

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText(districtName)
        .addTo(map);
    };

    const addMapLayers = () => {
      if (map.getSource(US_STATES_SOURCE_ID)) return;

      map.addSource(US_STATES_SOURCE_ID, {
        type: 'geojson',
        data: US_STATES_GEOJSON_URL,
        promoteId: 'name'
      });

      map.addSource(CONGRESSIONAL_DISTRICTS_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
        promoteId: 'GEOID'
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

      map.addLayer({
        id: CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
        type: 'fill',
        source: CONGRESSIONAL_DISTRICTS_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#facc15',
            ['boolean', ['feature-state', 'hover'], false],
            '#fb7185',
            '#f97316'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.4,
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            0.14
          ]
        }
      });

      map.addLayer({
        id: CONGRESSIONAL_DISTRICTS_LINE_LAYER_ID,
        type: 'line',
        source: CONGRESSIONAL_DISTRICTS_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#fef3c7',
            '#fed7aa'
          ],
          'line-opacity': 0.92,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.1, 5, 1.6, 8, 2.6]
        }
      });

      map.addLayer({
        id: CONGRESSIONAL_DISTRICTS_LABEL_LAYER_ID,
        type: 'symbol',
        source: CONGRESSIONAL_DISTRICTS_SOURCE_ID,
        minzoom: 5,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'BASENAME'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 8, 15],
          'text-max-width': 6,
          'text-padding': 3
        },
        paint: {
          'text-color': '#fff7ed',
          'text-halo-color': '#0b1020',
          'text-halo-width': 1.5,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 5.8, 0.9]
        }
      });

      map.on('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
      map.on('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
      map.on('click', US_STATES_FILL_LAYER_ID, handleStateClick);
      map.on('mousemove', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictMove);
      map.on('mouseleave', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictLeave);
      map.on('click', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictClick);
    };

    map.on('load', addMapLayers);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off('load', addMapLayers);
      if (map.getLayer(US_STATES_FILL_LAYER_ID)) {
        map.off('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
        map.off('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
        map.off('click', US_STATES_FILL_LAYER_ID, handleStateClick);
      }
      if (map.getLayer(CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID)) {
        map.off(
          'mousemove',
          CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
          handleCongressionalDistrictMove
        );
        map.off(
          'mouseleave',
          CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
          handleCongressionalDistrictLeave
        );
        map.off('click', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictClick);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    setStateLayerVisibility(mapRef.current, statesVisible);
  }, [statesVisible]);

  useEffect(() => {
    if (!mapRef.current) return;

    const shouldShowDistricts = districtsVisible && selectedStateFips !== null;
    updateCongressionalDistrictSource(
      mapRef.current,
      shouldShowDistricts ? selectedStateFips : null
    );
    setCongressionalDistrictLayerVisibility(mapRef.current, shouldShowDistricts);
  }, [districtsVisible, selectedStateFips]);

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
          <span className="layerToggleText">
            <span>States</span>
          </span>
        </label>
        <label className="layerToggle">
          <input
            type="checkbox"
            checked={districtsVisible}
            onChange={(event) => setDistrictsVisible(event.target.checked)}
          />
          <span className="toggleTrack" aria-hidden="true">
            <span className="toggleThumb" />
          </span>
          <span className="layerToggleText">
            <span>Congressional districts</span>
            <span className="layerToggleMeta">{selectedStateName ?? '119th Congress'}</span>
          </span>
        </label>
      </aside>
    </div>
  );
}
