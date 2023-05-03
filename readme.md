# mav-stations

A **collection of all\* stations of [Magyar Államvasutak](https://jegy.mav.hu/) (MÁV, Hungarian State Railways)**, requested from an endpoint used by their website.

_(\* All stations that would appear when using the MAV website. This excludes internally used stations or sub-stations like `"München Hbf Gl.5-10"` with ID `"008069685"`.)_

[![npm version](https://img.shields.io/npm/v/mav-stations.svg)](https://www.npmjs.com/package/mav-stations)
![ISC-licensed](https://img.shields.io/github/license/martinlangbecker/mav-stations.svg)

## Installing

```shell
npm install mav-stations
```

_Note:_ This Git repo does not contain the data, but the npm package does.

## Usage

`readStations()` returns a [readable stream](https://nodejs.org/api/stream.html#readable-streams) in [object mode](https://nodejs.org/api/stream.html#object-mode), emitting [_Friendly Public Transport Format_](https://github.com/public-transport/friendly-public-transport-format) `station` objects.

```js
import { readStations } from 'mav-stations';

for await (const station of readStations()) {
  console.log(station);
}
```

```js
{
  type: 'station',
  id: '005510009', // EVA-like number
  name: 'BUDAPEST*',
  aliasNames: ['Bp (BUDAPEST*)'], // if several names for the same station exist
  baseCode: '3638', // only defined on Hungarian stations
  isInternational: false, // true if international trains available (?)
  canUseForOfferRequest: true,
  canUseForPassengerInformation: false,
  country: 'Hungary',
  countryIso: 'HU',
  isIn108_1: true, // apparently only true for select Hungarian stations; "internationalCapable"
  transportMode: {"code": 100,"name": "Rail", "description": "Rail. Used for intercity or long-distance travel."}
}
// and a lot more…
```

## Related

<!-- - [`mav-stations-autocomplete`](https://github.com/martinlangbecker/mav-stations-autocomplete#mav-stations-autocomplete) – Search for stations of MAV (data from MAV station API). -->

- [`db-stations`](https://github.com/derhuerst/db-stations#db-stations) – A list of DB stations (data from DB station API).
- [`db-stations-autocomplete`](https://github.com/derhuerst/db-stations-autocomplete#db-stations-autocomplete) – Search for stations of DB (data from DB station API).
- [`db-hafas-stations`](https://github.com/derhuerst/db-hafas-stations#db-hafas-stations) – A list of DB stations, taken from HAFAS.
- [`db-hafas-stations-autocomplete`](https://github.com/derhuerst/db-hafas-stations-autocomplete#db-stations-autocomplete) – Search for stations of DB (data from HAFAS).

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-stations/issues).
