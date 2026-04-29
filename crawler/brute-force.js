#!/usr/bin/env node
/**
 * Brute-force station ID scanner for MAV timetable API.
 * Tests 5-digit suffixes for a given 2-digit UIC country code.
 * With --trainline: fetches Trainline CSV candidates first, then does range scan.
 *
 * Usage:
 *   node crawler/brute-force.js --uic 84 --trainline --start 1 --end 747
 */

import { randomUUID } from 'crypto';
import { readFile, rename, writeFile } from 'fs/promises';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag('help') || args.includes('-h')) {
  console.log(`Usage: node crawler/brute-force.js [options]

Brute-force scanner that tries 5-digit suffixes for a UIC country code
against the MAV StationInfo endpoint.

Options:
  --uic <2digits>  UIC country code (default: 80 = Germany)
  --trainline      Fetch Trainline CSV and test those candidates first
  --start <n>      Start suffix for range scan (default: 1)
  --end <n>        End suffix for range scan (default: 99999)
  --delay <ms>     Delay between requests (default: 250)
  --output <path>  Output file (default: crawler/brute-force-hits.json)
  --help, -h       Show this help`);
  process.exit(0);
}

const UIC = flag('uic', '80');
const PREFIX = '00' + UIC;
const USE_TRAINLINE = hasFlag('trainline');
const START = parseInt(flag('start', '1'));
const END = parseInt(flag('end', '99999'));
const DELAY_MS = parseInt(flag('delay', '250'));
const __dirname = new URL('.', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);
const OUTPUT = flag('output', __dirname + 'brute-force-hits.json');

const BASE = 'https://jegy-a.mav.hu/IK_API_PROD/api';
const sessionId = randomUUID();
const headers = {
  'Content-Type': 'application/json',
  UserSessionId: sessionId,
  Language: 'en',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeWrite = async (p, data) => {
  await writeFile(p + '.tmp', data);
  await rename(p + '.tmp', p);
};
const pad = (n) => String(n).padStart(5, '0');

const loadKnownCodes = async () => {
  const projectRoot = new URL('..', import.meta.url).pathname.replace(
    /^\/([A-Z]:)/,
    '$1',
  );
  try {
    const text = await readFile(projectRoot + 'data.ndjson', 'utf-8');
    const codes = new Set();
    for (const line of text.split('\n')) {
      if (!line) continue;
      const s = JSON.parse(line);
      if (s.id) codes.add(s.id);
    }
    return codes;
  } catch {
    console.log('Warning: data.ndjson not found, run "npm run build" first');
    return new Set();
  }
};

const fetchTrainlineCandidates = async (uic) => {
  const url =
    'https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv';
  console.log('Fetching Trainline CSV...');
  const res = await fetch(url);
  const csv = await res.text();
  const lines = csv.split('\n');
  const header = lines[0].split(';');
  const uicIdx = header.indexOf('uic');
  const nameIdx = header.indexOf('name');
  const candidates = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const code = cols[uicIdx];
    if (!code || code.length !== 7) continue;
    if (code.slice(0, 2) !== uic) continue;
    candidates.push({ code: '00' + code, name: cols[nameIdx] });
  }
  return candidates;
};

const queryStation = async (code) => {
  const res = await fetch(`${BASE}/InformationApi/GetTimetable`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'StationInfo',
      travelDate: new Date().toISOString(),
      stationNumberCode: code,
      minCount: '0',
      maxCount: '9999999',
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.stationSchedulerDetails?.station ?? null;
};

const testCodes = async (codes, known, hits, hitCodes, label) => {
  let checked = 0;
  const toCheck = codes.filter((c) => !known.has(c) && !hitCodes.has(c));
  console.log(`\n${label}: ${toCheck.length} codes to check (${codes.length - toCheck.length} skipped)`);

  for (const code of toCheck) {
    await sleep(DELAY_MS);
    checked++;

    try {
      const station = await queryStation(code);
      if (station) {
        hits.push(station);
        hitCodes.add(code);
        console.log(
          `HIT: ${code} — ${station.name} (${hits.length} total hits)`,
        );
        await safeWrite(OUTPUT, JSON.stringify(hits, null, 2));
      }
    } catch {
      // 500 or timeout = invalid code
    }

    if (checked % 100 === 0) {
      console.log(`  ${label}: ${checked}/${toCheck.length} checked, ${hits.length} hits`);
    }
  }
  console.log(`  ${label} done: ${checked} checked`);
};

const main = async () => {
  const known = await loadKnownCodes();
  console.log(`Known stations: ${known.size}`);

  let hits = [];
  try {
    hits = JSON.parse(await readFile(OUTPUT, 'utf-8'));
    console.log(`Resuming with ${hits.length} previous hits`);
  } catch { /* first run */ }
  const hitCodes = new Set(hits.map((h) => h.code));

  // Phase 1: Trainline candidates
  if (USE_TRAINLINE) {
    const candidates = await fetchTrainlineCandidates(UIC);
    console.log(`Trainline: ${candidates.length} codes for UIC ${UIC}`);
    await testCodes(
      candidates.map((c) => c.code),
      known,
      hits,
      hitCodes,
      'Trainline',
    );
  }

  // Phase 2: Range scan
  const rangeCodes = [];
  for (let i = START; i <= END; i++) {
    rangeCodes.push(PREFIX + pad(i));
  }
  await testCodes(rangeCodes, known, hits, hitCodes, `Range ${pad(START)}-${pad(END)}`);

  console.log(`\nDone. ${hits.length} total hits.`);
  await safeWrite(OUTPUT, JSON.stringify(hits, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
