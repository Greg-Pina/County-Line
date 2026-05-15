import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon } from 'geojson';

const TIGERWEB_BASE_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer';

const TIGERWEB_QUERY_URLS = {
  zcta: `${TIGERWEB_BASE_URL}/2/query`,
  incorporatedPlace: `${TIGERWEB_BASE_URL}/28/query`,
  censusDesignatedPlace: `${TIGERWEB_BASE_URL}/30/query`,
  congressionalDistricts: `${TIGERWEB_BASE_URL}/54/query`,
  stateLegislativeUpper: `${TIGERWEB_BASE_URL}/56/query`,
  stateLegislativeLower: `${TIGERWEB_BASE_URL}/58/query`,
  states: `${TIGERWEB_BASE_URL}/80/query`
};

export const STATE_LEGISLATIVE_UPPER_QUERY_URL = TIGERWEB_QUERY_URLS.stateLegislativeUpper;
export const STATE_LEGISLATIVE_LOWER_QUERY_URL = TIGERWEB_QUERY_URLS.stateLegislativeLower;
export const CONGRESSIONAL_DISTRICTS_QUERY_URL = TIGERWEB_QUERY_URLS.congressionalDistricts;

export const STATE_NAME_TO_FIPS = new Map([
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

const STATE_ABBR_TO_FIPS = new Map([
  ['AL', '01'],
  ['AK', '02'],
  ['AZ', '04'],
  ['AR', '05'],
  ['CA', '06'],
  ['CO', '08'],
  ['CT', '09'],
  ['DE', '10'],
  ['DC', '11'],
  ['FL', '12'],
  ['GA', '13'],
  ['HI', '15'],
  ['ID', '16'],
  ['IL', '17'],
  ['IN', '18'],
  ['IA', '19'],
  ['KS', '20'],
  ['KY', '21'],
  ['LA', '22'],
  ['ME', '23'],
  ['MD', '24'],
  ['MA', '25'],
  ['MI', '26'],
  ['MN', '27'],
  ['MS', '28'],
  ['MO', '29'],
  ['MT', '30'],
  ['NE', '31'],
  ['NV', '32'],
  ['NH', '33'],
  ['NJ', '34'],
  ['NM', '35'],
  ['NY', '36'],
  ['NC', '37'],
  ['ND', '38'],
  ['OH', '39'],
  ['OK', '40'],
  ['OR', '41'],
  ['PA', '42'],
  ['RI', '44'],
  ['SC', '45'],
  ['SD', '46'],
  ['TN', '47'],
  ['TX', '48'],
  ['UT', '49'],
  ['VT', '50'],
  ['VA', '51'],
  ['WA', '53'],
  ['WV', '54'],
  ['WI', '55'],
  ['WY', '56']
]);

const STATE_FIPS_TO_NAME = new Map(
  Array.from(STATE_NAME_TO_FIPS.entries()).map(([stateName, fips]) => [fips, stateName])
);

const STATE_NAME_KEY_TO_FIPS = new Map(
  Array.from(STATE_NAME_TO_FIPS.entries()).map(([stateName, fips]) => [
    stateName.toLowerCase(),
    fips
  ])
);

const STATE_FIPS_TO_ABBR = new Map(
  Array.from(STATE_ABBR_TO_FIPS.entries()).map(([abbr, fips]) => [fips, abbr])
);

type TigerProperties = Record<string, unknown>;
type TigerFeature = Feature<Geometry | null, TigerProperties>;
type TigerFeatureCollection = FeatureCollection<Geometry | null, TigerProperties>;

type TigerQueryParams = Record<string, string | number | boolean>;

type TigerGeometryQuery = {
  geometry: string;
  geometryType: 'esriGeometryPoint' | 'esriGeometryPolygon';
};

type ParsedSearch = {
  searchText: string;
  stateFips: string | null;
  zipCode: string | null;
};

export type GeographySearchSource = 'incorporated-place' | 'census-designated-place' | 'zcta';

export type GeographySearchResult = {
  id: string;
  label: string;
  typeLabel: string;
  source: GeographySearchSource;
  stateFips: string | null;
  stateName: string | null;
  stateAbbr: string | null;
  longitude: number;
  latitude: number;
  geometry: Geometry | null;
  zoom: number;
};

export type DistrictLookupKind = 'state' | 'congressional' | 'state-upper' | 'state-lower';

export type DistrictLookupResult = {
  id: string;
  kind: DistrictLookupKind;
  title: string;
  subtitle: string;
  stateFips: string | null;
  stateName: string | null;
  featureId: string | number | null;
  properties: TigerProperties;
};

export function getStateFips(stateName: string) {
  return STATE_NAME_TO_FIPS.get(stateName) ?? null;
}

export function getStateNameFromFips(stateFips: string | null | undefined) {
  return stateFips ? STATE_FIPS_TO_NAME.get(stateFips) ?? null : null;
}

export function getStateAbbrFromFips(stateFips: string | null | undefined) {
  return stateFips ? STATE_FIPS_TO_ABBR.get(stateFips) ?? null : null;
}

export function getDistrictKindLabel(kind: DistrictLookupKind) {
  switch (kind) {
    case 'congressional':
      return 'Federal congressional';
    case 'state-upper':
      return 'State upper chamber';
    case 'state-lower':
      return 'State lower chamber';
    case 'state':
      return 'State';
  }
}

export function getReadableDistrictName(
  kind: Exclude<DistrictLookupKind, 'state'>,
  properties: TigerProperties
) {
  const name = getStringProperty(properties, 'NAME');
  const basename = getStringProperty(properties, 'BASENAME');

  if (kind === 'congressional') {
    if (basename === '00' || basename?.toLowerCase() === 'at large') {
      return 'At-large Congressional District';
    }

    if (basename) {
      const districtNumber = Number(basename);

      return Number.isNaN(districtNumber)
        ? `Congressional District ${basename}`
        : `Congressional District ${districtNumber}`;
    }

    return name ?? 'Congressional District';
  }

  if (name) {
    return name;
  }

  if (basename) {
    const districtNumber = Number(basename);
    const districtName = Number.isNaN(districtNumber) ? basename : `District ${districtNumber}`;

    return kind === 'state-upper'
      ? `State Upper Chamber ${districtName}`
      : `State Lower Chamber ${districtName}`;
  }

  return kind === 'state-upper' ? 'State upper chamber district' : 'State lower chamber district';
}

export async function searchGeographies(searchInput: string) {
  const parsedSearch = parseSearchInput(searchInput);

  if (parsedSearch.zipCode) {
    return searchZipCode(parsedSearch.zipCode);
  }

  if (parsedSearch.searchText.length < 2) {
    return [];
  }

  const [incorporatedPlaces, censusDesignatedPlaces] = await Promise.all([
    searchPlaceLayer(
      TIGERWEB_QUERY_URLS.incorporatedPlace,
      parsedSearch,
      'incorporated-place',
      'Incorporated place'
    ),
    searchPlaceLayer(
      TIGERWEB_QUERY_URLS.censusDesignatedPlace,
      parsedSearch,
      'census-designated-place',
      'Census designated place'
    )
  ]);

  return dedupeSearchResults([...incorporatedPlaces, ...censusDesignatedPlaces])
    .sort((firstResult, secondResult) =>
      compareSearchResults(firstResult, secondResult, parsedSearch)
    )
    .slice(0, 8);
}

export async function lookupDistrictsForSearchResult(searchResult: GeographySearchResult) {
  return lookupDistricts({
    longitude: searchResult.longitude,
    latitude: searchResult.latitude,
    geometry: searchResult.geometry
  });
}

function parseSearchInput(searchInput: string): ParsedSearch {
  const trimmedInput = searchInput.trim().replace(/\s+/g, ' ');
  const zipMatch = trimmedInput.match(/^\d{5}$/);

  if (zipMatch) {
    return {
      searchText: trimmedInput,
      stateFips: null,
      zipCode: trimmedInput
    };
  }

  const commaParts = trimmedInput
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length > 1) {
    const possibleState = commaParts[commaParts.length - 1];
    const stateFips = getStateFipsFromHint(possibleState);

    if (stateFips) {
      return {
        searchText: commaParts.slice(0, -1).join(', '),
        stateFips,
        zipCode: null
      };
    }
  }

  const trailingStateMatch = trimmedInput.match(/^(.+)\s+([A-Za-z]{2})$/);

  if (trailingStateMatch) {
    const stateFips = getStateFipsFromHint(trailingStateMatch[2]);

    if (stateFips) {
      return {
        searchText: trailingStateMatch[1].trim(),
        stateFips,
        zipCode: null
      };
    }
  }

  return {
    searchText: trimmedInput,
    stateFips: null,
    zipCode: null
  };
}

async function searchZipCode(zipCode: string): Promise<GeographySearchResult[]> {
  const features = await fetchTigerFeatures(TIGERWEB_QUERY_URLS.zcta, {
    where: `ZCTA5='${escapeArcGisLiteral(zipCode)}'`,
    outFields: 'GEOID,ZCTA5,BASENAME,NAME,INTPTLAT,INTPTLON',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: 1
  });

  return features
    .map((feature) => searchResultFromFeature(feature, 'zcta', 'ZIP/ZCTA'))
    .filter(isGeographySearchResult);
}

async function searchPlaceLayer(
  queryUrl: string,
  parsedSearch: ParsedSearch,
  source: GeographySearchSource,
  typeLabel: string
): Promise<GeographySearchResult[]> {
  const term = escapeArcGisLiteral(parsedSearch.searchText);
  const stateClause = parsedSearch.stateFips ? `STATE='${parsedSearch.stateFips}' AND ` : '';
  const where = `${stateClause}(BASENAME LIKE '${term}%' OR NAME LIKE '${term}%' OR BASENAME LIKE '%${term}%' OR NAME LIKE '%${term}%')`;
  const features = await fetchTigerFeatures(queryUrl, {
    where,
    outFields: 'GEOID,STATE,BASENAME,NAME,LSADC,INTPTLAT,INTPTLON',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: 12
  });

  return features
    .map((feature) => searchResultFromFeature(feature, source, typeLabel))
    .filter(isGeographySearchResult);
}

async function lookupDistricts({
  longitude,
  latitude,
  geometry
}: {
  longitude: number;
  latitude: number;
  geometry: Geometry | null;
}): Promise<DistrictLookupResult[]> {
  const geometryQuery = geometryToTigerQuery(geometry, longitude, latitude);
  const queryBase = {
    geometry: geometryQuery.geometry,
    geometryType: geometryQuery.geometryType,
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'false'
  };

  const [states, congressionalDistricts, stateUpperDistricts, stateLowerDistricts] =
    await Promise.all([
      fetchTigerFeatures(
        TIGERWEB_QUERY_URLS.states,
        {
          ...queryBase,
          outFields: 'GEOID,STATE,NAME,STUSAB,INTPTLAT,INTPTLON'
        },
        'POST'
      ),
      fetchTigerFeatures(
        TIGERWEB_QUERY_URLS.congressionalDistricts,
        {
          ...queryBase,
          outFields: 'GEOID,STATE,BASENAME,NAME,CD119,INTPTLAT,INTPTLON'
        },
        'POST'
      ),
      fetchTigerFeatures(
        TIGERWEB_QUERY_URLS.stateLegislativeUpper,
        {
          ...queryBase,
          outFields: 'GEOID,STATE,SLDU,BASENAME,NAME,INTPTLAT,INTPTLON'
        },
        'POST'
      ),
      fetchTigerFeatures(
        TIGERWEB_QUERY_URLS.stateLegislativeLower,
        {
          ...queryBase,
          outFields: 'GEOID,STATE,SLDL,BASENAME,NAME,INTPTLAT,INTPTLON'
        },
        'POST'
      )
    ]);

  return dedupeDistrictResults([
    ...states.map((feature) => districtResultFromFeature(feature, 'state')),
    ...congressionalDistricts.map((feature) => districtResultFromFeature(feature, 'congressional')),
    ...stateUpperDistricts.map((feature) => districtResultFromFeature(feature, 'state-upper')),
    ...stateLowerDistricts.map((feature) => districtResultFromFeature(feature, 'state-lower'))
  ]).sort(compareDistrictResults);
}

async function fetchTigerFeatures(
  queryUrl: string,
  params: TigerQueryParams,
  method: 'GET' | 'POST' = 'GET'
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  searchParams.set('f', 'geojson');

  const response =
    method === 'POST'
      ? await fetch(queryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: searchParams.toString()
        })
      : await fetch(`${queryUrl}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Census geography request failed (${response.status})`);
  }

  const payload = (await response.json()) as TigerFeatureCollection | { error?: unknown };

  if (isArcGisError(payload)) {
    throw new Error(payload.error.message ?? 'Census geography request failed');
  }

  if (!isFeatureCollection(payload)) {
    return [];
  }

  return payload.features ?? [];
}

function searchResultFromFeature(
  feature: TigerFeature,
  source: GeographySearchSource,
  typeLabel: string
) {
  const properties = feature.properties ?? {};
  const stateFips = getStringProperty(properties, 'STATE');
  const stateName = getStateNameFromFips(stateFips);
  const stateAbbr = getStateAbbrFromFips(stateFips);
  const basename = getStringProperty(properties, source === 'zcta' ? 'ZCTA5' : 'BASENAME');
  const name = getStringProperty(properties, 'NAME');
  const longitude = getNumberProperty(properties, 'INTPTLON');
  const latitude = getNumberProperty(properties, 'INTPTLAT');

  if (longitude === null || latitude === null) {
    return null;
  }

  const labelBase = source === 'zcta' ? basename ?? name ?? 'ZIP code' : basename ?? name ?? 'Place';
  const label = source === 'zcta' || !stateAbbr ? labelBase : `${labelBase}, ${stateAbbr}`;

  return {
    id: `${source}:${getStringProperty(properties, 'GEOID') ?? label}`,
    label,
    typeLabel,
    source,
    stateFips,
    stateName,
    stateAbbr,
    longitude,
    latitude,
    geometry: feature.geometry ?? null,
    zoom: source === 'zcta' ? 10 : 8
  };
}

function districtResultFromFeature(feature: TigerFeature, kind: DistrictLookupKind) {
  const properties = feature.properties ?? {};
  const featureId = getStringProperty(properties, 'GEOID');
  const stateFips =
    kind === 'state'
      ? getStringProperty(properties, 'STATE') ?? featureId
      : getStringProperty(properties, 'STATE');
  const stateName =
    kind === 'state' ? getStringProperty(properties, 'NAME') : getStateNameFromFips(stateFips);
  const title = buildDistrictTitle(kind, properties, stateName);

  return {
    id: `${kind}:${featureId ?? title}`,
    kind,
    title,
    subtitle: getDistrictKindLabel(kind),
    stateFips,
    stateName,
    featureId: kind === 'state' ? stateName ?? featureId : featureId,
    properties
  };
}

function buildDistrictTitle(
  kind: DistrictLookupKind,
  properties: TigerProperties,
  stateName: string | null
) {
  if (kind === 'state') {
    return stateName ?? getStringProperty(properties, 'NAME') ?? 'Selected state';
  }

  const districtName = getReadableDistrictName(kind, properties);

  return stateName ? `${stateName} ${districtName}` : districtName;
}

function compareSearchResults(
  firstResult: GeographySearchResult,
  secondResult: GeographySearchResult,
  parsedSearch: ParsedSearch
) {
  const firstScore = getSearchResultScore(firstResult, parsedSearch);
  const secondScore = getSearchResultScore(secondResult, parsedSearch);

  if (firstScore !== secondScore) {
    return secondScore - firstScore;
  }

  return firstResult.label.localeCompare(secondResult.label);
}

function getSearchResultScore(result: GeographySearchResult, parsedSearch: ParsedSearch) {
  const label = result.label.toLowerCase();
  const searchText = parsedSearch.searchText.toLowerCase();
  let score = 0;

  if (parsedSearch.stateFips && result.stateFips === parsedSearch.stateFips) {
    score += 40;
  }

  if (label === searchText || label.startsWith(`${searchText},`)) {
    score += 100;
  } else if (label.startsWith(searchText)) {
    score += 55;
  } else if (label.includes(searchText)) {
    score += 20;
  }

  if (result.source === 'incorporated-place') {
    score += 8;
  }

  return score;
}

function compareDistrictResults(firstResult: DistrictLookupResult, secondResult: DistrictLookupResult) {
  const kindOrder: DistrictLookupKind[] = ['state', 'congressional', 'state-upper', 'state-lower'];
  const kindDifference = kindOrder.indexOf(firstResult.kind) - kindOrder.indexOf(secondResult.kind);

  if (kindDifference !== 0) {
    return kindDifference;
  }

  return firstResult.title.localeCompare(secondResult.title, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function dedupeSearchResults(results: GeographySearchResult[]) {
  const seenIds = new Set<string>();

  return results.filter((result) => {
    if (seenIds.has(result.id)) {
      return false;
    }

    seenIds.add(result.id);
    return true;
  });
}

function dedupeDistrictResults(results: DistrictLookupResult[]) {
  const seenIds = new Set<string>();

  return results.filter((result) => {
    if (seenIds.has(result.id)) {
      return false;
    }

    seenIds.add(result.id);
    return true;
  });
}

function geometryToTigerQuery(
  geometry: Geometry | null,
  longitude: number,
  latitude: number
): TigerGeometryQuery {
  if (geometry?.type === 'Polygon') {
    const polygon = geometry as Polygon;

    return {
      geometry: JSON.stringify({
        rings: polygon.coordinates,
        spatialReference: { wkid: 4326 }
      }),
      geometryType: 'esriGeometryPolygon'
    };
  }

  if (geometry?.type === 'MultiPolygon') {
    const multiPolygon = geometry as MultiPolygon;

    return {
      geometry: JSON.stringify({
        rings: multiPolygon.coordinates.flatMap((polygon) => polygon),
        spatialReference: { wkid: 4326 }
      }),
      geometryType: 'esriGeometryPolygon'
    };
  }

  if (geometry?.type === 'Point') {
    const point = geometry as Point;
    const [pointLongitude, pointLatitude] = point.coordinates;

    return {
      geometry: JSON.stringify({
        x: pointLongitude,
        y: pointLatitude,
        spatialReference: { wkid: 4326 }
      }),
      geometryType: 'esriGeometryPoint'
    };
  }

  return {
    geometry: JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: 4326 }
    }),
    geometryType: 'esriGeometryPoint'
  };
}

function getStateFipsFromHint(stateHint: string) {
  const normalizedHint = stateHint.trim();
  const uppercaseHint = normalizedHint.toUpperCase();

  return (
    STATE_ABBR_TO_FIPS.get(uppercaseHint) ??
    STATE_NAME_KEY_TO_FIPS.get(normalizedHint.toLowerCase()) ??
    null
  );
}

function escapeArcGisLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function getStringProperty(properties: TigerProperties, key: string) {
  const value = properties[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumberProperty(properties: TigerProperties, key: string) {
  const value = properties[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function isFeatureCollection(payload: unknown): payload is TigerFeatureCollection {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as TigerFeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((payload as TigerFeatureCollection).features)
  );
}

function isArcGisError(payload: unknown): payload is { error: { message?: string } } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'object' &&
    (payload as { error?: unknown }).error !== null
  );
}

function isGeographySearchResult(
  result: GeographySearchResult | null
): result is GeographySearchResult {
  return result !== null;
}
