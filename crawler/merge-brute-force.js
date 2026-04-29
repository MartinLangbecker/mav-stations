#!/usr/bin/env node
/**
 * Merges brute-force hits into discovered-stations.json.
 * Enriches stations with countryIso derived from UIC prefix.
 */

import { readFileSync, writeFileSync, renameSync, readdirSync } from 'fs';

const __dirname = new URL('.', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);

const uicToIso = {
  '10': 'FI', '20': 'RU', '21': 'BY', '22': 'UA', '23': 'MD',
  '24': 'LT', '25': 'LV', '26': 'EE', '28': 'GE', '33': 'CN',
  '41': 'AL', '44': 'BA', '49': 'BA', '50': 'BA', '51': 'PL',
  '52': 'BG', '53': 'RO', '54': 'CZ', '55': 'HU', '56': 'SK',
  '62': 'ME', '65': 'MK', '70': 'GB', '71': 'ES', '72': 'RS',
  '73': 'GR', '74': 'SE', '75': 'TR', '76': 'NO', '78': 'HR',
  '79': 'SI', '80': 'DE', '81': 'AT', '82': 'LU', '83': 'IT',
  '84': 'NL', '85': 'CH', '86': 'DK', '87': 'FR', '88': 'BE',
  '94': 'PT', '99': 'IQ',
};

const isoToCountry = {
  FI: 'Finland', RU: 'Russia', BY: 'Belarus', UA: 'Ukraine', MD: 'Moldova',
  LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia', GE: 'Georgia', CN: 'China',
  AL: 'Albania', BA: 'Bosnia-Herzegovina', PL: 'Poland', BG: 'Bulgaria',
  RO: 'Romania', CZ: 'Czechia', HU: 'Hungary', SK: 'Slovakia', ME: 'Montenegro',
  MK: 'North Macedonia', GB: 'United Kingdom', ES: 'Spain', RS: 'Serbia',
  GR: 'Greece', SE: 'Sweden', TR: 'Turkey', NO: 'Norway', HR: 'Croatia',
  SI: 'Slovenia', DE: 'Germany', AT: 'Austria', LU: 'Luxembourg', IT: 'Italy',
  NL: 'Netherlands', CH: 'Switzerland', DK: 'Denmark', FR: 'France',
  BE: 'Belgium', PT: 'Portugal', IQ: 'Iraq',
};

// Load existing discovered stations
const discoveredPath = __dirname + 'discovered-stations.json';
let discovered = JSON.parse(readFileSync(discoveredPath, 'utf-8'));
const existingCodes = new Set(discovered.map((s) => s.code));
console.log(`Existing discovered stations: ${discovered.length}`);

// Find all brute-force hit files
const hitFiles = readdirSync(__dirname).filter(
  (f) => f.startsWith('brute-force-hits') && f.endsWith('.json'),
);
console.log(`Hit files: ${hitFiles.join(', ')}`);

let added = 0;
let enriched = 0;

// Backfill country info on existing entries
for (const station of discovered) {
  const uic = station.code.slice(2, 4);
  const iso = uicToIso[uic] ?? null;
  let changed = false;
  if (!station.coutryIso && iso) { station.coutryIso = iso; changed = true; }
  if (!station.country && iso) { station.country = isoToCountry[iso] ?? null; changed = true; }
  if (changed) enriched++;
}

for (const file of hitFiles) {
  const hits = JSON.parse(readFileSync(__dirname + file, 'utf-8'));
  if (!Array.isArray(hits) || hits.length === 0) continue;

  for (const station of hits) {
    if (existingCodes.has(station.code)) continue;

    // Enrich with countryIso and country from UIC prefix
    const uic = station.code.slice(2, 4);
    const iso = uicToIso[uic] ?? null;
    if (!station.coutryIso) station.coutryIso = iso;
    if (!station.country) station.country = isoToCountry[iso] ?? null;
    station.source = 'brute-force';

    discovered.push(station);
    existingCodes.add(station.code);
    added++;
  }
}

console.log(`Added ${added} new stations, enriched ${enriched} existing. Total: ${discovered.length}`);

// Safe write
writeFileSync(discoveredPath + '.tmp', JSON.stringify(discovered, null, 2));
renameSync(discoveredPath + '.tmp', discoveredPath);
console.log('Written to discovered-stations.json');
