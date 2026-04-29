#!/usr/bin/env node
/**
 * Discovers MAV stations not in GetStationList by BFS-crawling the timetable API.
 *
 * Usage:
 *   node discover-stations.js [--delay 2000] [--max-trains 5] [--max-depth 3] [--seed 008016321,008069685] [--date 2026-06-15T08:00:00+02:00]
 *
 * Writes results to discovered-stations.json
 */

import { randomUUID } from 'crypto';
import { readFile, rename, writeFile } from 'fs/promises';

// --- CLI args ---
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node discover-stations.js [options]

BFS crawler that discovers MAV stations not in the known station list
by following trains through the timetable API.
Compares against data.ndjson (run "npm run build" first to include previous discoveries).

Options:
  --seed <codes>        Comma-separated station codes to start from
                        Default: 008016321,008069685,008103217,008011065
  --max-depth <n>       BFS depth limit (default: 3, use "infinite" to keep
                        going while new stations are found)
  --max-trains <n>      Max trains to follow per station (default: 5)
  --delay <ms>          Delay between API calls in ms (default: 250)
  --date <iso>          Travel date for timetable queries
                        Default: current timestamp
  --output <path>       Output file path (default: crawler/discovered-stations.json)
  --seen-trains <path>  Seen trains file path (default: crawler/seen-trains.json)
  --help, -h            Show this help message

Examples:
  # Discover from German hubs, depth 4, 15 trains per station
  npm run discover -- --seed 008013240,008014350 --max-depth 4 --max-trains 15 --delay 500

  # Quick test run from Budapest
  npm run discover -- --seed 005510009 --max-depth 1 --max-trains 3

Station codes are 9 digits: 00 + UIC country code (2 digits) + station number (5 digits).
Major hub stations (e.g. Budapest Keleti, Wien Hbf) are good seeds.
Meta-stations (ALL CAPS with *) return 0 timetable results and cannot be used as seeds.
Seen trains are persisted in seen-trains.json for incremental crawling.`);
  process.exit(0);
}

const DELAY_MS = parseInt(flag('delay', '250')); // ms between API calls
const MAX_TRAINS = parseInt(flag('max-trains', '5')); // trains to follow per station
const MAX_DEPTH =
  flag('max-depth', '3') === 'infinite'
    ? Infinity
    : parseInt(flag('max-depth', '3'));
const SEEDS = flag('seed', '008016321,008069685,008103217,008011065').split(
  ',',
);
const __dirname = new URL('.', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);
const OUTPUT = flag('output', __dirname + 'discovered-stations.json');
const SEEN_TRAINS_FILE = flag('seen-trains', __dirname + 'seen-trains.json');
const TRAVEL_DATE = flag('date', new Date().toISOString());

// --- API client ---
const BASE = 'https://jegy-a.mav.hu/IK_API_PROD/api';
const sessionId = randomUUID();
const headers = {
  'Content-Type': 'application/json',
  UserSessionId: sessionId,
  Language: 'en',
};

let requestCount = 0;
const startTime = Date.now();

const safeWrite = async (p, data) => {
  await writeFile(p + '.tmp', data);
  await rename(p + '.tmp', p);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (ms) => {
  const s = Math.floor(ms / 1000),
    m = Math.floor(s / 60),
    h = Math.floor(m / 60);
  return h > 0
    ? `${h}h${m % 60}m${s % 60}s`
    : m > 0
      ? `${m}m${s % 60}s`
      : `${s}s`;
};
const elapsed = () => fmt(Date.now() - startTime);
const rps = () =>
  requestCount > 0
    ? (requestCount / ((Date.now() - startTime) / 1000)).toFixed(1)
    : '0';

const apiCall = async (path, body) => {
  await sleep(DELAY_MS);
  requestCount++;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

// --- Load known stations from data.ndjson ---
// Excludes brute-force stations so they can be "upgraded" to crawled
const loadKnownStations = async () => {
  const projectRoot = new URL('..', import.meta.url).pathname.replace(
    /^\/([A-Z]:)/,
    '$1',
  );

  // Load brute-force codes to exclude
  const bruteForceCodes = new Set();
  try {
    const disc = JSON.parse(
      await readFile(projectRoot + 'crawler/discovered-stations.json', 'utf-8'),
    );
    for (const s of disc) {
      if (s.source === 'brute-force') bruteForceCodes.add(s.code);
    }
  } catch {}

  const ndjsonPath = projectRoot + 'data.ndjson';
  let lines;
  try {
    const text = await readFile(ndjsonPath, 'utf-8');
    lines = text.split('\n').filter(Boolean);
  } catch {
    console.log('  Warning: data.ndjson not found, run "npm run build" first');
    return new Set();
  }
  const codes = new Set();
  for (const line of lines) {
    const s = JSON.parse(line);
    if (s.id && !bruteForceCodes.has(s.id)) codes.add(s.id);
  }
  console.log(
    `Known stations: ${codes.size} (from data.ndjson, ${bruteForceCodes.size} brute-force excluded)`,
  );
  return codes;
};

// --- Timetable queries ---
const getStationDepartures = async (stationCode) => {
  const data = await apiCall('/InformationApi/GetTimetable', {
    type: 'StationInfo',
    travelDate: TRAVEL_DATE,
    stationNumberCode: stationCode,
    minCount: '0',
    maxCount: '50',
  });
  const deps = data.stationSchedulerDetails?.departureScheduler ?? [];
  const arrs = data.stationSchedulerDetails?.arrivalScheduler ?? [];
  return [...deps, ...arrs];
};

const getTrainStops = async (trainId, travelDate) => {
  const data = await apiCall('/InformationApi/GetTimetable', {
    type: 'TrainInfo',
    travelDate,
    minCount: '0',
    maxCount: '9999999',
    trainId,
  });
  return data.trainSchedulerDetails?.[0]?.scheduler ?? [];
};

// --- BFS crawler ---
const crawl = async (officialCodes) => {
  const discovered = new Map(); // code -> station info
  const visited = new Set(); // station codes we've fetched departures for
  let queue = [...SEEDS]; // BFS queue of station codes
  let depth = 0;

  // Load persisted seen train numbers (stable across days, unlike trainId)
  let seenTrains;
  try {
    seenTrains = new Set(JSON.parse(await readFile(SEEN_TRAINS_FILE, 'utf-8')));
    console.log(`Loaded ${seenTrains.size} previously seen train numbers`);
  } catch {
    seenTrains = new Set();
  }

  while (queue.length > 0 && depth < MAX_DEPTH) {
    depth++;
    const nextQueue = [];
    let discoveredThisDepth = 0;
    console.log(
      `\n--- Depth ${depth}, ${queue.length} stations to explore ---`,
    );

    for (const stationCode of queue) {
      if (visited.has(stationCode)) continue;
      visited.add(stationCode);

      const stationName = discovered.get(stationCode)?.name ?? stationCode;
      console.log(
        `\n[${visited.size}] Station: ${stationName} (${stationCode}) [${elapsed()}, ${requestCount} reqs, ${rps()} req/s]`,
      );

      let trains;
      try {
        trains = await getStationDepartures(stationCode);
      } catch (e) {
        console.log(`  ⚠ Failed to get timetable: ${e.message}`);
        continue;
      }
      console.log(`  ${trains.length} trains found`);

      // Pick unseen trains (by train number, stable across days)
      // Prefix with station country to avoid cross-country duplicates
      // (e.g. "IC 123" can exist in both DE and HU)
      const countryPrefix = stationCode.slice(2, 4) + '-';
      const unseenTrains = trains
        .filter(
          (t) => t.fullName && !seenTrains.has(countryPrefix + t.fullName),
        )
        .filter(
          (t, i, arr) => arr.findIndex((u) => u.fullName === t.fullName) === i,
        )
        .slice(0, MAX_TRAINS);
      console.log(`  ${trains.length} trains, ${unseenTrains.length} unseen`);

      for (const train of unseenTrains) {
        seenTrains.add(countryPrefix + train.fullName);
        const trainId = parseInt(train.trainId);
        console.log(
          `  Train ${train.fullName}: ${train.startStation?.name} → ${train.endStation?.name}`,
        );

        let stops;
        try {
          stops = await getTrainStops(trainId, train.startDate);
        } catch (e) {
          console.log(`    ⚠ Failed: ${e.message}`);
          continue;
        }

        for (const stop of stops) {
          const code = stop.station?.code;
          if (!code) continue;
          if (officialCodes.has(code)) continue;

          if (!discovered.has(code)) {
            discoveredThisDepth++;
            stop.station.source = 'crawled';
            discovered.set(code, stop.station);
            console.log(
              `    ★ ${code} "${stop.station.name}" (${stop.station.coutryIso})`,
            );
          }
          if (!visited.has(code)) nextQueue.push(code);
        }
      }
    }

    queue = [...new Set(nextQueue)].filter((c) => !visited.has(c));
    console.log(
      `\nDepth ${depth} complete. Discovered so far: ${discovered.size}. Next queue: ${queue.length}. [${elapsed()}, ${requestCount} reqs]`,
    );

    // In infinite mode, stop if this depth found nothing new
    if (MAX_DEPTH === Infinity && discoveredThisDepth === 0) {
      console.log(`\nNo new discoveries at depth ${depth}, stopping.`);
      break;
    }
  }

  return { discovered, seenTrains };
};

// --- Main ---
const main = async () => {
  console.log(
    `Config: delay=${DELAY_MS}ms, max-trains=${MAX_TRAINS}/station, max-depth=${MAX_DEPTH === Infinity ? '∞' : MAX_DEPTH}`,
  );
  console.log(`Seeds: ${SEEDS.join(', ')}`);
  console.log(
    `Started: ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n`,
  );

  const officialCodes = await loadKnownStations();
  const { discovered, seenTrains } = await crawl(officialCodes);

  console.log(
    `\n=== RESULTS: ${discovered.size} hidden stations (${requestCount} API requests, ${elapsed()}) ===\n`,
  );

  // Group by country
  const byCountry = {};
  for (const s of discovered.values()) {
    (byCountry[s.coutryIso ?? 'unknown'] ??= []).push(s);
  }
  for (const [iso, stations] of Object.entries(byCountry).sort()) {
    console.log(`${iso} (${stations.length}):`);
    for (const s of stations.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(
        `  ${s.code} ${s.name}${s.canUseForOfferRequest ? '' : ' [no offers]'}`,
      );
    }
  }

  // Load existing results if any, merge
  let existing = [];
  try {
    existing = JSON.parse(await readFile(OUTPUT, 'utf-8'));
  } catch {
    /* first run */
  }
  const merged = new Map(existing.map((s) => [s.code, s]));
  for (const s of discovered.values()) merged.set(s.code, s);

  const output = [...merged.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  await safeWrite(OUTPUT, JSON.stringify(output, null, 2));
  await safeWrite(SEEN_TRAINS_FILE, JSON.stringify([...seenTrains].sort()));
  console.log(`\nSaved ${output.length} stations to ${OUTPUT}`);
  console.log(
    `Saved ${seenTrains.size} seen train numbers to ${SEEN_TRAINS_FILE}`,
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
