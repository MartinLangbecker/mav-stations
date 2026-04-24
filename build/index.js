import fs from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStation } from './parse.js';
import { downloadStations } from './stations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const raw = await downloadStations();

// collect alias names per station code first (fixes race condition)
const aliasNames = new Map();
for (const station of raw) {
  if (!station.isAlias) continue;
  const aliases = aliasNames.get(station.code) ?? [];
  aliases.push(station.name);
  aliasNames.set(station.code, aliases);
}

// build parsed stations, attaching aliases
const stations = raw
  .filter((station) => !station.isAlias)
  .map((station) => {
    station.aliasNames = aliasNames.get(station.code) ?? [];
    return parseStation(station);
  });

const ndjson = stations.map((station) => JSON.stringify(station)).join('\n') + '\n';
const json = JSON.stringify(stations);

fs.writeFileSync(pathJoin(__dirname, '../data.ndjson'), ndjson);
fs.writeFileSync(pathJoin(__dirname, '../data.json'), json);
