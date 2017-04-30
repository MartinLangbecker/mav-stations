# db-stations 🚏

A **collection of all stations of [Deutsche Bahn](http://db.de/)**, computed from open data.

Unfortunately, Deutsche Bahn published two datasets, which neither cover the same stations nor provide the same attributes; [the build script](build/index.js) tries to merge them.

[![npm version](https://img.shields.io/npm/v/db-stations.svg)](https://www.npmjs.com/package/db-stations)
[![build status](https://img.shields.io/travis/derhuerst/db-stations.svg)](https://travis-ci.org/derhuerst/db-stations)
[![dependency status](https://img.shields.io/david/derhuerst/db-stations.svg)](https://david-dm.org/derhuerst/db-stations)
[![dev dependency status](https://img.shields.io/david/dev/derhuerst/db-stations.svg)](https://david-dm.org/derhuerst/db-stations#info=devDependencies)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/db-stations.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)


## Installing

```shell
npm install db-stations
```


## Usage

`stations()` returns a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) in [object mode](https://nodejs.org/api/stream.html#stream_object_mode).

```js
const stations = require('db-stations')

stations()
.on('data', console.log)
.on('error', console.error)
```

```js
{
	id: 8000001, // EVA number
	ds100: 'KA', // DS100 code
	nr: 1, // DB internal
	name: 'Aachen Hbf',
	latitude: 50.7678,
	longitude: 6.091499,
	agency: 'AVV.',
	street: 'Bahnhofplatz 2a',
	zip: '52064',
	city: 'Aachen',
	state: 'NW'
}
{
	id: 8070704, // EVA number
	ds100: 'KASZ', // DS100 code
	nr: 7205, // DB internal
	name: 'Aachen Schanz',
	latitude: 50.769862,
	longitude: 6.07384,
	agency: 'AVV.',
	street: 'Vaalserstraße 15',
	zip: '52064',
	city: 'Aachen',
	state: 'NW'
}
// and a lot more…
```


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/db-stations/issues).


## Data License

The generated data in [`data.ndjson`](data.ndjson) has originally [been](http://data.deutschebahn.com/dataset/data-stationsdaten) [published](http://data.deutschebahn.com/dataset/data-haltestellen) under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) by *Deutsche Bahn (DB)*.
