'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [
    {
      id: 'us-focused-background',
      type: 'background',
      paint: {
        'background-color': '#dfeff2'
      }
    }
  ]
};
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
const STATE_LEGISLATIVE_UPPER_SOURCE_ID = 'state-legislative-upper';
const STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID = 'state-legislative-upper-fill';
const STATE_LEGISLATIVE_UPPER_LINE_LAYER_ID = 'state-legislative-upper-line';
const STATE_LEGISLATIVE_UPPER_LABEL_LAYER_ID = 'state-legislative-upper-label';
const STATE_LEGISLATIVE_UPPER_LAYER_IDS = [
  STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID,
  STATE_LEGISLATIVE_UPPER_LINE_LAYER_ID,
  STATE_LEGISLATIVE_UPPER_LABEL_LAYER_ID
];
const STATE_LEGISLATIVE_UPPER_QUERY_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer/56/query';
const STATE_LEGISLATIVE_LOWER_SOURCE_ID = 'state-legislative-lower';
const STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID = 'state-legislative-lower-fill';
const STATE_LEGISLATIVE_LOWER_LINE_LAYER_ID = 'state-legislative-lower-line';
const STATE_LEGISLATIVE_LOWER_LABEL_LAYER_ID = 'state-legislative-lower-label';
const STATE_LEGISLATIVE_LOWER_LAYER_IDS = [
  STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID,
  STATE_LEGISLATIVE_LOWER_LINE_LAYER_ID,
  STATE_LEGISLATIVE_LOWER_LABEL_LAYER_ID
];
const STATE_LEGISLATIVE_LOWER_QUERY_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer/58/query';
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

function getLegislativeDistrictName(feature: MapGeoJSONFeature, chamber: 'upper' | 'lower') {
  const name = feature.properties?.NAME;
  const basename = feature.properties?.BASENAME;
  const chamberName = chamber === 'upper' ? 'Upper' : 'Lower';

  if (typeof name === 'string' && name.length > 0) {
    return name;
  }

  if (typeof basename === 'string' && basename.length > 0) {
    const districtNumber = Number(basename);
    const districtName = Number.isNaN(districtNumber) ? basename : `District ${districtNumber}`;

    return `${chamberName} ${districtName}`;
  }

  return `${chamberName} legislative district`;
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

function getStateLegislativeDistrictsUrl(stateFips: string, chamber: 'upper' | 'lower') {
  const params = new URLSearchParams({
    where: `STATE='${stateFips}'`,
    outFields: chamber === 'upper' ? 'GEOID,STATE,SLDU,BASENAME,NAME,LSY' : 'GEOID,STATE,SLDL,BASENAME,NAME,LSY',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson'
  });
  const queryUrl =
    chamber === 'upper' ? STATE_LEGISLATIVE_UPPER_QUERY_URL : STATE_LEGISLATIVE_LOWER_QUERY_URL;

  return `${queryUrl}?${params.toString()}`;
}

function setStateLayerVisibility(map: maplibregl.Map, isVisible: boolean) {
  const visibility = isVisible ? 'visible' : 'none';

  US_STATES_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function setStateLegislativeLayerVisibility(
  map: maplibregl.Map,
  layerIds: string[],
  isVisible: boolean
) {
  const visibility = isVisible ? 'visible' : 'none';

  layerIds.forEach((layerId) => {
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

function updateStateLegislativeDistrictSource(
  map: maplibregl.Map,
  sourceId: string,
  stateFips: string | null,
  chamber: 'upper' | 'lower'
) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;

  if (!source) return;

  source.setData(
    stateFips ? getStateLegislativeDistrictsUrl(stateFips, chamber) : EMPTY_FEATURE_COLLECTION
  );
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
  const hoveredStateUpperRef = useRef<string | number | null>(null);
  const selectedStateUpperRef = useRef<string | number | null>(null);
  const hoveredStateLowerRef = useRef<string | number | null>(null);
  const selectedStateLowerRef = useRef<string | number | null>(null);
  const hoveredCongressionalDistrictRef = useRef<string | number | null>(null);
  const selectedCongressionalDistrictRef = useRef<string | number | null>(null);
  const selectedStateNameRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [statesVisible, setStatesVisible] = useState(true);
  const [stateUpperVisible, setStateUpperVisible] = useState(false);
  const [stateLowerVisible, setStateLowerVisible] = useState(false);
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
      zoom: 3.15,
      minZoom: 2.4,
      maxBounds: [
        [-179, 15],
        [-60, 74]
      ],
      renderWorldCopies: false
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

    const clearHoveredStateUpper = () => {
      if (hoveredStateUpperRef.current !== null) {
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: hoveredStateUpperRef.current },
          { hover: false }
        );
        hoveredStateUpperRef.current = null;
      }
    };

    const clearSelectedStateUpper = () => {
      if (selectedStateUpperRef.current !== null) {
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: selectedStateUpperRef.current },
          { selected: false }
        );
        selectedStateUpperRef.current = null;
      }
    };

    const clearHoveredStateLower = () => {
      if (hoveredStateLowerRef.current !== null) {
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_LOWER_SOURCE_ID, id: hoveredStateLowerRef.current },
          { hover: false }
        );
        hoveredStateLowerRef.current = null;
      }
    };

    const clearSelectedStateLower = () => {
      if (selectedStateLowerRef.current !== null) {
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_LOWER_SOURCE_ID, id: selectedStateLowerRef.current },
          { selected: false }
        );
        selectedStateLowerRef.current = null;
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
      clearHoveredStateUpper();
      clearSelectedStateUpper();
      clearHoveredStateLower();
      clearSelectedStateLower();
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

    const handleStateUpperMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      map.getCanvas().style.cursor = 'pointer';

      if (feature.id !== undefined && hoveredStateUpperRef.current !== feature.id) {
        clearHoveredStateUpper();
        hoveredStateUpperRef.current = feature.id;
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: feature.id },
          { hover: true }
        );
      }

      setActiveStateName(
        `${selectedStateNameRef.current ?? 'State'} ${getLegislativeDistrictName(feature, 'upper')}`
      );
    };

    const handleStateUpperLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredStateUpper();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
    };

    const handleStateUpperClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      const districtName = getLegislativeDistrictName(feature, 'upper');
      setActiveStateName(`${selectedStateNameRef.current ?? 'State'} ${districtName}`);

      clearSelectedStateUpper();

      if (feature.id !== undefined) {
        selectedStateUpperRef.current = feature.id;
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: feature.id },
          { selected: true }
        );
      }

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText(districtName)
        .addTo(map);
    };

    const handleStateLowerMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      map.getCanvas().style.cursor = 'pointer';

      if (feature.id !== undefined && hoveredStateLowerRef.current !== feature.id) {
        clearHoveredStateLower();
        hoveredStateLowerRef.current = feature.id;
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_LOWER_SOURCE_ID, id: feature.id },
          { hover: true }
        );
      }

      setActiveStateName(
        `${selectedStateNameRef.current ?? 'State'} ${getLegislativeDistrictName(feature, 'lower')}`
      );
    };

    const handleStateLowerLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredStateLower();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
    };

    const handleStateLowerClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      if (!feature) return;

      const districtName = getLegislativeDistrictName(feature, 'lower');
      setActiveStateName(`${selectedStateNameRef.current ?? 'State'} ${districtName}`);

      clearSelectedStateLower();

      if (feature.id !== undefined) {
        selectedStateLowerRef.current = feature.id;
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_LOWER_SOURCE_ID, id: feature.id },
          { selected: true }
        );
      }

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText(districtName)
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

      map.addSource(STATE_LEGISLATIVE_UPPER_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
        promoteId: 'GEOID'
      });

      map.addSource(STATE_LEGISLATIVE_LOWER_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
        promoteId: 'GEOID'
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
            '#7dd3fc',
            '#bfdbfe'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.52,
            ['boolean', ['feature-state', 'hover'], false],
            0.56,
            0.72
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
            '#92400e',
            '#334155'
          ],
          'line-opacity': 0.9,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2.5, 0.8, 5, 1.3, 8, 2.1]
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
          'text-color': '#0f172a',
          'text-halo-color': '#f8fafc',
          'text-halo-width': 1.8,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 3.6, 0.2, 4.2, 0.86]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID,
        type: 'fill',
        source: STATE_LEGISLATIVE_UPPER_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#059669',
            ['boolean', ['feature-state', 'hover'], false],
            '#34d399',
            '#10b981'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.34,
            ['boolean', ['feature-state', 'hover'], false],
            0.28,
            0.12
          ]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_UPPER_LINE_LAYER_ID,
        type: 'line',
        source: STATE_LEGISLATIVE_UPPER_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#ecfdf5',
            '#047857'
          ],
          'line-opacity': 0.92,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 6, 1.6, 9, 2.5]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_UPPER_LABEL_LAYER_ID,
        type: 'symbol',
        source: STATE_LEGISLATIVE_UPPER_SOURCE_ID,
        minzoom: 6,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'BASENAME'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 9, 13],
          'text-max-width': 5,
          'text-padding': 3
        },
        paint: {
          'text-color': '#064e3b',
          'text-halo-color': '#ecfdf5',
          'text-halo-width': 1.4,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.2, 6.8, 0.9]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID,
        type: 'fill',
        source: STATE_LEGISLATIVE_LOWER_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#be123c',
            ['boolean', ['feature-state', 'hover'], false],
            '#fb7185',
            '#e11d48'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.32,
            ['boolean', ['feature-state', 'hover'], false],
            0.26,
            0.1
          ]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_LOWER_LINE_LAYER_ID,
        type: 'line',
        source: STATE_LEGISLATIVE_LOWER_SOURCE_ID,
        layout: {
          visibility: 'none'
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#fff1f2',
            '#be123c'
          ],
          'line-opacity': 0.9,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 6, 1.4, 9, 2.2]
        }
      });

      map.addLayer({
        id: STATE_LEGISLATIVE_LOWER_LABEL_LAYER_ID,
        type: 'symbol',
        source: STATE_LEGISLATIVE_LOWER_SOURCE_ID,
        minzoom: 6.4,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'BASENAME'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6.4, 9, 9, 12],
          'text-max-width': 5,
          'text-padding': 3
        },
        paint: {
          'text-color': '#881337',
          'text-halo-color': '#fff1f2',
          'text-halo-width': 1.4,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 6.4, 0.2, 7.2, 0.9]
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
      map.on('mousemove', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperMove);
      map.on('mouseleave', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperLeave);
      map.on('click', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperClick);
      map.on('mousemove', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerMove);
      map.on('mouseleave', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerLeave);
      map.on('click', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerClick);
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
      if (map.getLayer(STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID)) {
        map.off('mousemove', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperMove);
        map.off('mouseleave', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperLeave);
        map.off('click', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperClick);
      }
      if (map.getLayer(STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID)) {
        map.off('mousemove', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerMove);
        map.off('mouseleave', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerLeave);
        map.off('click', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerClick);
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

    const shouldShowUpper = stateUpperVisible && selectedStateFips !== null;
    updateStateLegislativeDistrictSource(
      mapRef.current,
      STATE_LEGISLATIVE_UPPER_SOURCE_ID,
      shouldShowUpper ? selectedStateFips : null,
      'upper'
    );
    setStateLegislativeLayerVisibility(
      mapRef.current,
      STATE_LEGISLATIVE_UPPER_LAYER_IDS,
      shouldShowUpper
    );
  }, [stateUpperVisible, selectedStateFips]);

  useEffect(() => {
    if (!mapRef.current) return;

    const shouldShowLower = stateLowerVisible && selectedStateFips !== null;
    updateStateLegislativeDistrictSource(
      mapRef.current,
      STATE_LEGISLATIVE_LOWER_SOURCE_ID,
      shouldShowLower ? selectedStateFips : null,
      'lower'
    );
    setStateLegislativeLayerVisibility(
      mapRef.current,
      STATE_LEGISLATIVE_LOWER_LAYER_IDS,
      shouldShowLower
    );
  }, [stateLowerVisible, selectedStateFips]);

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
            checked={stateUpperVisible}
            onChange={(event) => setStateUpperVisible(event.target.checked)}
          />
          <span className="toggleTrack toggleTrackUpper" aria-hidden="true">
            <span className="toggleThumb" />
          </span>
          <span className="layerToggleText">
            <span>State upper chamber districts</span>
            <span className="layerToggleMeta">{selectedStateName ?? 'Select a state'}</span>
          </span>
        </label>
        <label className="layerToggle">
          <input
            type="checkbox"
            checked={stateLowerVisible}
            onChange={(event) => setStateLowerVisible(event.target.checked)}
          />
          <span className="toggleTrack toggleTrackLower" aria-hidden="true">
            <span className="toggleThumb" />
          </span>
          <span className="layerToggleText">
            <span>State lower chamber districts</span>
            <span className="layerToggleMeta">{selectedStateName ?? 'Select a state'}</span>
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
            <span className="layerToggleMeta">
              {selectedStateName ? `${selectedStateName} - 119th Congress` : 'Select a state'}
            </span>
          </span>
        </label>
      </aside>
    </div>
  );
}
