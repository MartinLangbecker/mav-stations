import ndjson from 'ndjson';
import fs from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import pump from 'pump';
import through from 'through2';

import { parse } from './parse.js';
import { downloadStations } from './stations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const showError = (err) => {
  if (!err) return;
  console.error(err);
  process.exit(1);
};

// download station data
const stations = downloadStations();
const aliasNames = new Map();

const stationsWithoutAliases = pump(
  stations,
  through.obj((station, _, cb) => {
    if (!station.isAlias) {
      // if station name is not an alias, do nothing
      cb(null, station);
    } else {
      // save alias entries (same code, different name) in map
      let aliases = aliasNames.get(station.code) ?? [];
      aliases.push(station.name);
      aliasNames.set(station.code, aliases);
      // discard alias station entry
      cb();
    }
  }),
  showError
);

const stationsWithAliases = pump(
  stationsWithoutAliases,
  through.obj((station, _, cb) => {
    // set field aliasNames to value from map generated in previous step
    station.aliasNames = aliasNames.get(station.code) ?? [];
    cb(null, station);
  }),
  showError
);

pump(
  stationsWithAliases,
  parse(),
  ndjson.stringify(),
  fs.createWriteStream(pathJoin(__dirname, '../data.ndjson')),
  showError
);
