'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import maplibregl from 'maplibre-gl';
import type {
  LngLatLike,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  MapMouseEvent,
  StyleSpecification
} from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
  CONGRESSIONAL_DISTRICTS_QUERY_URL,
  STATE_LEGISLATIVE_LOWER_QUERY_URL,
  STATE_LEGISLATIVE_UPPER_QUERY_URL,
  getDistrictKindLabel,
  getReadableDistrictName,
  getStateFips,
  getStateNameFromFips,
  lookupDistrictsForSearchResult,
  searchGeographies,
  type DistrictLookupKind,
  type DistrictLookupResult,
  type GeographySearchResult
} from '../lib/geography';

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
const STATE_LEGISLATIVE_LOWER_SOURCE_ID = 'state-legislative-lower';
const STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID = 'state-legislative-lower-fill';
const STATE_LEGISLATIVE_LOWER_LINE_LAYER_ID = 'state-legislative-lower-line';
const STATE_LEGISLATIVE_LOWER_LABEL_LAYER_ID = 'state-legislative-lower-label';
const STATE_LEGISLATIVE_LOWER_LAYER_IDS = [
  STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID,
  STATE_LEGISLATIVE_LOWER_LINE_LAYER_ID,
  STATE_LEGISLATIVE_LOWER_LABEL_LAYER_ID
];
const CONGRESSIONAL_DISTRICTS_SOURCE_ID = 'congressional-districts';
const CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID = 'congressional-districts-fill';
const CONGRESSIONAL_DISTRICTS_LINE_LAYER_ID = 'congressional-districts-line';
const CONGRESSIONAL_DISTRICTS_LABEL_LAYER_ID = 'congressional-districts-label';
const CONGRESSIONAL_DISTRICTS_LAYER_IDS = [
  CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
  CONGRESSIONAL_DISTRICTS_LINE_LAYER_ID,
  CONGRESSIONAL_DISTRICTS_LABEL_LAYER_ID
];
const SEARCH_MARKER_SOURCE_ID = 'place-search-marker';
const SEARCH_MARKER_LAYER_ID = 'place-search-marker-circle';
const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
};

function getStateName(feature: MapGeoJSONFeature) {
  if (typeof feature.properties?.name === 'string') {
    return feature.properties.name;
  }

  if (typeof feature.properties?.NAME === 'string') {
    return feature.properties.NAME;
  }

  return 'Selected state';
}

type DistrictChoice = DistrictLookupResult & {
  sourceId: string | null;
  popupText: string;
};

type SearchStatus = 'idle' | 'searching' | 'loading-districts' | 'error';

const SELECTABLE_FILL_LAYER_IDS = [
  STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID,
  STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID,
  CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID,
  US_STATES_FILL_LAYER_ID
];

function getDistrictSourceId(kind: DistrictLookupKind) {
  switch (kind) {
    case 'state':
      return US_STATES_SOURCE_ID;
    case 'congressional':
      return CONGRESSIONAL_DISTRICTS_SOURCE_ID;
    case 'state-upper':
      return STATE_LEGISLATIVE_UPPER_SOURCE_ID;
    case 'state-lower':
      return STATE_LEGISLATIVE_LOWER_SOURCE_ID;
  }
}

function districtChoiceFromLookupResult(result: DistrictLookupResult): DistrictChoice {
  return {
    ...result,
    sourceId: getDistrictSourceId(result.kind),
    popupText: `${result.subtitle}: ${result.title}`
  };
}

function districtChoiceFromRenderedFeature(
  feature: MapGeoJSONFeature,
  selectedStateName: string | null
): DistrictChoice | null {
  const properties = feature.properties ?? {};
  const sourceLayer = feature.layer.id;
  let kind: DistrictLookupKind;

  if (sourceLayer === US_STATES_FILL_LAYER_ID) {
    kind = 'state';
  } else if (sourceLayer === CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID) {
    kind = 'congressional';
  } else if (sourceLayer === STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID) {
    kind = 'state-upper';
  } else if (sourceLayer === STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID) {
    kind = 'state-lower';
  } else {
    return null;
  }

  const featureId =
    feature.id ?? getStringFeatureProperty(feature, 'GEOID') ?? getStringFeatureProperty(feature, 'name');
  const stateFips =
    kind === 'state'
      ? getStateFips(getStateName(feature))
      : getStringFeatureProperty(feature, 'STATE');
  const stateName =
    kind === 'state'
      ? getStateName(feature)
      : getStateNameFromFips(stateFips) ?? selectedStateName;
  const title =
    kind === 'state'
      ? stateName ?? 'Selected state'
      : `${stateName ? `${stateName} ` : ''}${getReadableDistrictName(kind, properties)}`;
  const subtitle = getDistrictKindLabel(kind);

  if (featureId === null || title.length === 0) {
    return null;
  }

  return {
    id: `${kind}:${String(featureId)}`,
    kind,
    title,
    subtitle,
    stateFips,
    stateName,
    featureId,
    properties,
    sourceId: getDistrictSourceId(kind),
    popupText: `${subtitle}: ${title}`
  };
}

function dedupeDistrictChoices(choices: DistrictChoice[]) {
  const seenChoices = new Set<string>();

  return choices.filter((choice) => {
    if (seenChoices.has(choice.id)) {
      return false;
    }

    seenChoices.add(choice.id);
    return true;
  });
}

function sortDistrictChoices(firstChoice: DistrictChoice, secondChoice: DistrictChoice) {
  const kindOrder: DistrictLookupKind[] = ['state', 'congressional', 'state-upper', 'state-lower'];
  const kindDifference = kindOrder.indexOf(firstChoice.kind) - kindOrder.indexOf(secondChoice.kind);

  if (kindDifference !== 0) {
    return kindDifference;
  }

  return firstChoice.title.localeCompare(secondChoice.title, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function getStringFeatureProperty(feature: MapGeoJSONFeature, propertyName: string) {
  const value = feature.properties?.[propertyName];

  return typeof value === 'string' && value.length > 0 ? value : null;
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

function updateSearchMarker(map: maplibregl.Map, searchResult: GeographySearchResult) {
  const source = map.getSource(SEARCH_MARKER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

  if (!source) return;

  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [searchResult.longitude, searchResult.latitude]
        },
        properties: {
          label: searchResult.label
        }
      }
    ]
  });
}

function focusMapOnSearchResult(map: maplibregl.Map, searchResult: GeographySearchResult) {
  const bounds = getGeometryBounds(searchResult.geometry);

  if (bounds) {
    map.fitBounds(bounds, {
      padding: {
        top: 48,
        bottom: 48,
        left: 360,
        right: 48
      },
      maxZoom: searchResult.zoom,
      duration: 700
    });
    return;
  }

  map.flyTo({
    center: [searchResult.longitude, searchResult.latitude],
    zoom: searchResult.zoom,
    essential: true
  });
}

function getGeometryBounds(geometry: GeographySearchResult['geometry']) {
  if (!geometry || !('coordinates' in geometry)) {
    return null;
  }

  const bounds = new maplibregl.LngLatBounds();

  extendBounds(bounds, geometry.coordinates);

  return bounds.isEmpty() ? null : bounds;
}

function extendBounds(bounds: maplibregl.LngLatBounds, coordinates: unknown) {
  if (!Array.isArray(coordinates)) return;

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    bounds.extend([coordinates[0], coordinates[1]]);
    return;
  }

  coordinates.forEach((nextCoordinates) => extendBounds(bounds, nextCoordinates));
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
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<GeographySearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchResultId, setSelectedSearchResultId] = useState<string | null>(null);
  const [districtChoices, setDistrictChoices] = useState<DistrictChoice[]>([]);
  const [selectedDistrictChoiceId, setSelectedDistrictChoiceId] = useState<string | null>(null);

  const clearSelectedFeatureStates = useCallback((map: maplibregl.Map) => {
    if (selectedStateRef.current !== null) {
      map.setFeatureState(
        { source: US_STATES_SOURCE_ID, id: selectedStateRef.current },
        { selected: false }
      );
      selectedStateRef.current = null;
    }

    if (selectedStateUpperRef.current !== null) {
      map.setFeatureState(
        { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: selectedStateUpperRef.current },
        { selected: false }
      );
      selectedStateUpperRef.current = null;
    }

    if (selectedStateLowerRef.current !== null) {
      map.setFeatureState(
        { source: STATE_LEGISLATIVE_LOWER_SOURCE_ID, id: selectedStateLowerRef.current },
        { selected: false }
      );
      selectedStateLowerRef.current = null;
    }

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
  }, []);

  const selectDistrictChoice = useCallback(
    (choice: DistrictChoice, lngLat?: LngLatLike) => {
      const map = mapRef.current;

      if (!map) return;

      clearSelectedFeatureStates(map);
      setSelectedDistrictChoiceId(choice.id);
      setActiveStateName(choice.popupText);

      if (choice.stateName) {
        selectedStateNameRef.current = choice.stateName;
        setSelectedStateName(choice.stateName);
      }

      if (choice.stateFips) {
        setSelectedStateFips(choice.stateFips);
      }

      if (choice.kind === 'state') {
        selectedStateNameRef.current = choice.title;
        setSelectedStateName(choice.title);
        setSelectedStateFips(getStateFips(choice.title));
      }

      if (choice.sourceId && choice.featureId !== null) {
        try {
          map.setFeatureState(
            { source: choice.sourceId, id: choice.featureId },
            { selected: true }
          );
        } catch {
          // District sources may still be loading after a search result changes state.
        }

        if (choice.kind === 'state') {
          selectedStateRef.current = choice.featureId;
        } else if (choice.kind === 'congressional') {
          selectedCongressionalDistrictRef.current = choice.featureId;
        } else if (choice.kind === 'state-upper') {
          selectedStateUpperRef.current = choice.featureId;
        } else if (choice.kind === 'state-lower') {
          selectedStateLowerRef.current = choice.featureId;
        }
      }

      if (lngLat) {
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(lngLat)
          .setText(choice.popupText)
          .addTo(map);
      }
    },
    [clearSelectedFeatureStates]
  );

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedSearch = searchInput.trim();

    if (trimmedSearch.length === 0 || searchStatus === 'searching') {
      return;
    }

    setSearchStatus('searching');
    setSearchError(null);
    setSearchResults([]);
    setDistrictChoices([]);
    setSelectedDistrictChoiceId(null);
    setSelectedSearchResultId(null);

    try {
      const results = await searchGeographies(trimmedSearch);

      setSearchResults(results);

      if (results.length === 0) {
        setSearchStatus('idle');
        setSearchError('No matching city or ZIP found.');
        return;
      }

      if (results.length === 1) {
        await handleSearchResultSelect(results[0]);
        return;
      }

      setActiveStateName(`${results.length} places found`);
      setSearchStatus('idle');
    } catch {
      setSearchStatus('error');
      setSearchError('Search failed. Try another city name or ZIP code.');
    }
  }

  async function handleSearchResultSelect(searchResult: GeographySearchResult) {
    const map = mapRef.current;

    setSearchStatus('loading-districts');
    setSearchError(null);
    setSelectedSearchResultId(searchResult.id);
    setSelectedDistrictChoiceId(null);
    setDistrictChoices([]);
    setStatesVisible(true);
    setStateUpperVisible(true);
    setStateLowerVisible(true);
    setDistrictsVisible(true);

    if (map) {
      updateSearchMarker(map, searchResult);
      focusMapOnSearchResult(map, searchResult);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat([searchResult.longitude, searchResult.latitude])
        .setText(searchResult.label)
        .addTo(map);
    }

    try {
      const lookupResults = await lookupDistrictsForSearchResult(searchResult);
      const choices = lookupResults.map(districtChoiceFromLookupResult).sort(sortDistrictChoices);
      const firstStateChoice = choices.find((choice) => choice.kind === 'state');
      const nextStateName = firstStateChoice?.stateName ?? searchResult.stateName;
      const nextStateFips = firstStateChoice?.stateFips ?? searchResult.stateFips;

      if (nextStateName) {
        selectedStateNameRef.current = nextStateName;
        setSelectedStateName(nextStateName);
      }

      if (nextStateFips) {
        setSelectedStateFips(nextStateFips);

        if (map) {
          updateStateLegislativeDistrictSource(
            map,
            STATE_LEGISLATIVE_UPPER_SOURCE_ID,
            nextStateFips,
            'upper'
          );
          updateStateLegislativeDistrictSource(
            map,
            STATE_LEGISLATIVE_LOWER_SOURCE_ID,
            nextStateFips,
            'lower'
          );
          updateCongressionalDistrictSource(map, nextStateFips);
          setStateLayerVisibility(map, true);
          setStateLegislativeLayerVisibility(map, STATE_LEGISLATIVE_UPPER_LAYER_IDS, true);
          setStateLegislativeLayerVisibility(map, STATE_LEGISLATIVE_LOWER_LAYER_IDS, true);
          setCongressionalDistrictLayerVisibility(map, true);
        }
      }

      setDistrictChoices(choices);
      setActiveStateName(
        `${searchResult.label}: ${choices.length} district${choices.length === 1 ? '' : 's'}`
      );
      setSearchStatus('idle');

      if (choices.length === 0) {
        setSearchError('No districts found for that place.');
      }
    } catch {
      setSearchStatus('error');
      setSearchError('District lookup failed. Try selecting directly from the map.');
    }
  }

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

    const clearHoveredStateUpper = () => {
      if (hoveredStateUpperRef.current !== null) {
        map.setFeatureState(
          { source: STATE_LEGISLATIVE_UPPER_SOURCE_ID, id: hoveredStateUpperRef.current },
          { hover: false }
        );
        hoveredStateUpperRef.current = null;
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
        `State upper chamber: ${selectedStateNameRef.current ?? 'State'} ${getReadableDistrictName(
          'state-upper',
          feature.properties ?? {}
        )}`
      );
    };

    const handleStateUpperLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredStateUpper();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
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
        `State lower chamber: ${selectedStateNameRef.current ?? 'State'} ${getReadableDistrictName(
          'state-lower',
          feature.properties ?? {}
        )}`
      );
    };

    const handleStateLowerLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredStateLower();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
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
        `Federal: ${selectedStateNameRef.current ?? 'Congressional'} ${getReadableDistrictName(
          'congressional',
          feature.properties ?? {}
        )}`
      );
    };

    const handleCongressionalDistrictLeave = () => {
      map.getCanvas().style.cursor = '';
      clearHoveredCongressionalDistrict();
      setActiveStateName(selectedStateNameRef.current ?? 'United States');
    };

    const handleMapClick = (event: MapMouseEvent) => {
      const selectableLayers = SELECTABLE_FILL_LAYER_IDS.filter((layerId) => map.getLayer(layerId));
      const choices = dedupeDistrictChoices(
        map
          .queryRenderedFeatures(event.point, { layers: selectableLayers })
          .map((feature) => districtChoiceFromRenderedFeature(feature, selectedStateNameRef.current))
          .filter((choice): choice is DistrictChoice => choice !== null)
      ).sort(sortDistrictChoices);

      if (choices.length === 0) {
        return;
      }

      setDistrictChoices(choices);

      if (choices.length === 1) {
        selectDistrictChoice(choices[0], event.lngLat);
        return;
      }

      setSelectedDistrictChoiceId(null);
      setActiveStateName('Choose a district layer');
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText('Choose which district layer to select')
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

      map.addSource(SEARCH_MARKER_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
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

      map.addLayer({
        id: SEARCH_MARKER_LAYER_ID,
        type: 'circle',
        source: SEARCH_MARKER_SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 9, 8],
          'circle-color': '#f8fafc',
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 2.5,
          'circle-opacity': 0.96
        }
      });

      map.on('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
      map.on('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
      map.on('mousemove', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperMove);
      map.on('mouseleave', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperLeave);
      map.on('mousemove', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerMove);
      map.on('mouseleave', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerLeave);
      map.on('mousemove', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictMove);
      map.on('mouseleave', CONGRESSIONAL_DISTRICTS_FILL_LAYER_ID, handleCongressionalDistrictLeave);
      map.on('click', handleMapClick);
    };

    map.on('load', addMapLayers);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off('load', addMapLayers);
      if (map.getLayer(US_STATES_FILL_LAYER_ID)) {
        map.off('mousemove', US_STATES_FILL_LAYER_ID, handleStateMove);
        map.off('mouseleave', US_STATES_FILL_LAYER_ID, handleStateLeave);
      }
      if (map.getLayer(STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID)) {
        map.off('mousemove', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperMove);
        map.off('mouseleave', STATE_LEGISLATIVE_UPPER_FILL_LAYER_ID, handleStateUpperLeave);
      }
      if (map.getLayer(STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID)) {
        map.off('mousemove', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerMove);
        map.off('mouseleave', STATE_LEGISLATIVE_LOWER_FILL_LAYER_ID, handleStateLowerLeave);
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
      }
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [selectDistrictChoice]);

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
        <form className="placeSearch" onSubmit={handleSearchSubmit}>
          <label className="placeSearchLabel" htmlFor="place-search">
            Search
          </label>
          <div className="placeSearchRow">
            <input
              id="place-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="City or ZIP code"
              autoComplete="postal-code"
            />
            <button
              type="submit"
              disabled={searchStatus === 'searching' || searchStatus === 'loading-districts'}
            >
              {searchStatus === 'searching' ? 'Finding' : 'Find'}
            </button>
          </div>
          {searchStatus === 'loading-districts' ? (
            <span className="placeSearchStatus">Loading districts</span>
          ) : null}
          {searchError ? <span className="placeSearchError">{searchError}</span> : null}
        </form>
        {searchResults.length > 0 ? (
          <div className="searchResultList" aria-label="Search results">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className={`searchResultButton${
                  selectedSearchResultId === result.id ? ' isSelected' : ''
                }`}
                onClick={() => handleSearchResultSelect(result)}
              >
                <span>{result.label}</span>
                <span>{result.typeLabel}</span>
              </button>
            ))}
          </div>
        ) : null}
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
        {districtChoices.length > 0 ? (
          <div className="districtChoiceList" aria-label="District choices">
            <div className="districtChoiceHeader">
              <span>Districts</span>
              <span>{districtChoices.length}</span>
            </div>
            {districtChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`districtChoice districtChoice-${choice.kind}${
                  selectedDistrictChoiceId === choice.id ? ' isSelected' : ''
                }`}
                aria-pressed={selectedDistrictChoiceId === choice.id}
                onClick={() => selectDistrictChoice(choice)}
              >
                <span>{choice.subtitle}</span>
                <span>{choice.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
