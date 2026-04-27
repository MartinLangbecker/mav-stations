# mav-stations

A **collection of all stations of [Magyar Államvasutak](https://jegy.mav.hu/) (MÁV, Hungarian State Railways)** requested from an endpoint used by their website plus thousands more discovered by crawling the MÁV timetable API.

[![npm version](https://img.shields.io/npm/v/mav-stations.svg)](https://www.npmjs.com/package/mav-stations)
![ISC-licensed](https://img.shields.io/github/license/martinlangbecker/mav-stations.svg)

## Coverage

**10,500+ rail stations** across **23 countries**. The [interactive station map](european-stations-map.html) shows all geocoded stations, color-coded by source (official MAV list vs. discovered via timetable crawl).

> **Note:** Station discovery is an ongoing process. The dataset grows with each crawl and may not yet cover all stations reachable through the MÁV timetable, particularly in countries far from Hungary.

## Installing

```shell
npm install mav-stations
```

_Note:_ This Git repo does not contain the actual station data from the MÁV endpoint, but the npm package does. To retrieve station data and merge with discovered stations, run:

```shell
npm run build
```

## Usage

`readStations()` returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) of [_Friendly Public Transport Format_](https://github.com/public-transport/friendly-public-transport-format) `station` objects.

```js
import { readStations } from 'mav-stations';

for await (const station of readStations()) {
  console.log(station);
}
```

```js
{
  type: 'station',
  id: '005510009', // station ID, used throughout booking system
  name: 'BUDAPEST*',
  aliasNames: ['Bp (BUDAPEST*)'], // if several names for the same station exist, otherwise empty list
  baseCode: '3638', // internal MÁV identifier, only set on Hungarian stations
  isInternational: false, // true if international trains available (?)
  canUseForOfferRequest: true,
  canUseForPassengerInformation: false,
  country: 'Hungary',
  countryIso: 'HU',
  isIn108_1: true, // only true for select Hungarian stations; likely refers to UIC leaflet 108.1 (international tariff stations)
  transportMode: {"code": 100,"name": "Rail", "description": "Rail. Used for intercity or long-distance travel."}
}
// and a lot more…
```

## Tools

### Station Discovery (`crawler/`)

BFS (breadth-first search) crawler that follows trains from seed stations through the MÁV timetable API, discovering stations not in the official station list. Starting from a set of seed stations, it queries departures, follows each train to its stops, and repeats for newly found stations up to a configurable depth.

```shell
npm run discover -- [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--seed <codes>` | `008016321,008069685,…` | Comma-separated station codes to start from |
| `--max-depth <n>` | `3` | BFS depth limit |
| `--max-trains <n>` | `5` | Max trains to follow per station |
| `--delay <ms>` | `500` | Delay between API calls in ms |
| `--date <iso>` | `2026-06-15T08:00:00+02:00` | Travel date for timetable queries |
| `--output <path>` | `crawler/discovered-stations.json` | Output file path |
| `--seen-trains <path>` | `crawler/seen-trains.json` | Seen trains file (for incremental crawling) |
| `--help` | | Show help message |

```shell
# Discover stations reachable from German hubs, depth 4, 15 trains per station
npm run discover -- --seed 008013240,008014350 --max-depth 4 --max-trains 15 --delay 500
```

Output: `crawler/discovered-stations.json` — merged into the main dataset during `npm run build`.

### Geocoding (`geocode/`)

Looks up geographic coordinates (latitude/longitude) for stations via [Wikidata](https://www.wikidata.org/) SPARQL queries — first by UIC station code ([P722](https://www.wikidata.org/wiki/Property:P722)), then by station name + country as fallback, with multi-language label matching. Stations not found in Wikidata are resolved via the [Overpass API](https://overpass-api.de/) (OpenStreetMap), querying all railway nodes per country and matching by name. Generates an interactive map using [Leaflet](https://leafletjs.com/).

```shell
# Full geocode (only queries stations not already in cache)
npm run geocode

# Regenerate map from cache (no API calls)
npm run geocode:map
```

Manual overrides for rejected matches go in `geocode/geocode-overrides.json` (format: `{"stationCode": {"lat": ..., "lon": ...}}`).

## Notes on Data Quality

- **`canUseForOfferRequest`** is unreliable for discovered stations. The flag is set by the timetable system, not the pricing engine. Entire countries (e.g. France, Moldova) appear in the timetable via cross-border services but are outside MAV's booking scope — no tickets can be purchased to or from those stations at the time of writing.
- **Meta-stations** (names ending in `*`, e.g. `BUDAPEST*`, `WIEN*`) are virtual groupings of nearby stations, not physical locations. They are excluded from geocoding.
- **Ghost stations** — 88 stations (mostly small Serbian halts) are returned by the timetable API with `id: 0` and no metadata. Their names and country codes have been resolved via the StationInfo endpoint and UIC prefix. They are real operational stops where trains call, but MAV doesn't have them in its official station list.

## Related

- [`mav-prices`](https://github.com/martinlangbecker/mav-prices) – Query MÁV connection prices.
- [`db-stations`](https://github.com/derhuerst/db-stations#db-stations) – A list of DB stations (data from DB station API).
- [`db-stations-autocomplete`](https://github.com/derhuerst/db-stations-autocomplete#db-stations-autocomplete) – Search for stations of DB (data from DB station API).
- [`db-hafas-stations`](https://github.com/derhuerst/db-hafas-stations#db-hafas-stations) – A list of DB stations, taken from HAFAS.
- [`db-hafas-stations-autocomplete`](https://github.com/derhuerst/db-hafas-stations-autocomplete#db-stations-autocomplete) – Search for stations of DB (data from HAFAS).

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-stations/issues).
