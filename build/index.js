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
const officialCodes = new Set();
const stations = raw
  .filter((station) => !station.isAlias)
  .map((station) => {
    station.aliasNames = aliasNames.get(station.code) ?? [];
    officialCodes.add(station.code);
    return parseStation(station);
  });

// merge discovered stations not already in the official list
const discoveredPath = pathJoin(__dirname, '../crawler/discovered-stations.json');
if (fs.existsSync(discoveredPath)) {
  const discovered = JSON.parse(fs.readFileSync(discoveredPath, 'utf-8'));
  for (const station of discovered) {
    if (!officialCodes.has(station.code)) {
      stations.push(parseStation(station));
    }
  }
}

const ndjson = stations.map((station) => JSON.stringify(station)).join('\n') + '\n';
const json = JSON.stringify(stations);

fs.writeFileSync(pathJoin(__dirname, '../data.ndjson'), ndjson);
fs.writeFileSync(pathJoin(__dirname, '../data.json'), json);
