#!/usr/bin/env node
/**
 * Resolves unnamed/ghost stations in discovered-stations.json via StationInfo.
 * Queries the MAV API for station metadata and fills in name/country.
 */

import { randomUUID } from 'crypto';
import { readFile, rename, writeFile } from 'fs/promises';

const __dirname = new URL('.', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);
const DISCOVERED_PATH = __dirname + 'discovered-stations.json';
const DELAY_MS = 300;

const BASE = 'https://jegy-a.mav.hu/IK_API_PROD/api';
const headers = {
  'Content-Type': 'application/json',
  UserSessionId: randomUUID(),
  Language: 'en',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const uicToIso = {
  '10': 'FI', '20': 'RU', '21': 'BY', '22': 'UA', '23': 'MD',
  '24': 'LT', '25': 'LV', '51': 'PL', '52': 'BG', '53': 'RO',
  '54': 'CZ', '55': 'HU', '56': 'SK', '62': 'ME', '65': 'MK',
  '70': 'GB', '71': 'ES', '72': 'RS', '73': 'GR', '74': 'SE',
  '76': 'NO', '78': 'HR', '79': 'SI', '80': 'DE', '81': 'AT',
  '82': 'LU', '83': 'IT', '84': 'NL', '85': 'CH', '86': 'DK',
  '87': 'FR', '88': 'BE',
};

const isoToCountry = {
  RS: 'Serbia', BG: 'Bulgaria', RO: 'Romania', HR: 'Croatia',
  DE: 'Germany', AT: 'Austria', HU: 'Hungary', PL: 'Poland',
  CZ: 'Czechia', SK: 'Slovakia', SI: 'Slovenia', ME: 'Montenegro',
};

const discovered = JSON.parse(await readFile(DISCOVERED_PATH, 'utf-8'));
const unnamed = discovered.filter((s) => !s.name);
console.log(`${unnamed.length} unnamed stations to resolve`);

let resolved = 0;
for (const station of unnamed) {
  await sleep(DELAY_MS);
  try {
    const res = await fetch(`${BASE}/InformationApi/GetTimetable`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'StationInfo',
        travelDate: new Date().toISOString(),
        stationNumberCode: station.code,
        minCount: '0',
        maxCount: '0',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) continue;
    const data = await res.json();
    const info = data.stationSchedulerDetails?.station;
    if (info?.name) {
      station.name = info.name;
      station.isInternational = info.isInternational;
      station.canUseForOfferRequest = info.canUseForOfferRequest;
      const uic = station.code.slice(2, 4);
      if (!station.coutryIso) station.coutryIso = uicToIso[uic] ?? null;
      if (!station.country)
        station.country = isoToCountry[station.coutryIso] ?? null;
      resolved++;
      console.log(`  ${station.code} → ${info.name}`);
    }
  } catch { /* network error, skip */ }
}

console.log(`\nResolved ${resolved}/${unnamed.length} stations`);
await writeFile(DISCOVERED_PATH + '.tmp', JSON.stringify(discovered, null, 2));
await rename(DISCOVERED_PATH + '.tmp', DISCOVERED_PATH);
console.log('Saved.');
