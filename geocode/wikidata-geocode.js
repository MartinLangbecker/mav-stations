#!/usr/bin/env node
/**
 * Geocodes all rail stations (MAV + discovered) via Wikidata SPARQL:
 *   1. P722 (UIC station code) — fast batch queries
 *   2. Name + country fallback — matches against all railway stations in a country
 *
 * Usage:
 *   node wikidata-geocode.js              # geocode all, skip cached
 *   node wikidata-geocode.js --map-only   # regenerate map from cache only
 */

import { readFile, rename, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, ...p);

const CACHE_FILE = resolve('wikidata-geocode-cache.json');
const MAP_FILE = resolve('..', 'index.html');
const TRAINLINE_CSV_URL = 'https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv';

const BATCH_SIZE = 200;
const BATCH_DELAY = 1500; // ms between batches (be nice to Wikidata)

const args = process.argv.slice(2);
const mapOnly = args.includes('--map-only');

const OVERRIDES_FILE = resolve('geocode-overrides.json');
const REJECTIONS_FILE = resolve('geocode-rejections.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const safeWrite = async (p, data) => { await writeFile(p + '.tmp', data); await rename(p + '.tmp', p); };
const fmt = ms => {
	const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
	return m > 0 ? `${m}m${s % 60}s` : `${s}s`;
};

// --- Load all rail stations ---
const loadStations = async () => {
	const all = new Map(); // code -> { name, code, source, country }

	// MAV stations (rail only)
	const rl = createInterface({ input: createReadStream(resolve('..', 'data.ndjson')), crlfDelay: Infinity });
	for await (const line of rl) {
		if (!line) continue;
		const s = JSON.parse(line);
		if (s.transportMode?.code !== 100) continue;
		all.set(s.id, { name: s.name, code: s.id, source: 'mav', country: s.countryIso });
	}

	// Discovered stations
	const disc = JSON.parse(await readFile(resolve('..', 'crawler', 'discovered-stations.json'), 'utf-8'));
	const discoveredCodes = new Set(disc.map(s => s.code));
	for (const s of disc) {
		if (!all.has(s.code)) {
			all.set(s.code, { name: s.name, code: s.code, source: 'discovered', country: s.coutryIso });
		} else {
			all.get(s.code).source = 'discovered';
		}
	}

	return all;
};

// --- Wikidata SPARQL batch query ---
const normalize = (s) => s.toLowerCase()
	.replace(/ß/g, 'ss')
	.replace(/ø/g, 'oe').replace(/æ/g, 'ae').replace(/å/g, 'aa')
	.replace(/đ/g, 'd').replace(/ł/g, 'l').replace(/ð/g, 'd').replace(/þ/g, 'th')
	.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
	// German umlaut transliterations
	.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ss/g, 's')
	.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

// City names that differ between languages
const CITY_ALIASES = [
	['munchen', 'munich'], ['nurnberg', 'nuremberg'], ['koln', 'cologne'],
	['bruxeles', 'brusel', 'brisel', 'brussels'], ['bruges', 'bruge', 'brugge'],
	['gand', 'gent'], ['courtrai', 'kortrijk'], ['louvain', 'leuven'],
	['anvers', 'antwerp', 'antwerpen'], ['la pane', 'de pane'],
	['geneve', 'geneva'], ['luzern', 'lucerne'],
	['koebenhavn', 'copenhagen', 'kobenhavn'], ['koege', 'koge'],
	['hjoering', 'hjoring'], ['hoeje', 'hoje'], ['hoejslev', 'hojslev'],
	['bucuresti', 'bucharest'], ['wien', 'vienna', 'becs'],
	['praha', 'prague', 'praga'], ['warszawa', 'warsaw', 'varso'],
	['elk', 'elk'], // Polish ł
	['st ', 'sankt ', 'saint ', 'ste ', 'sveti '], ['st.', 'sankt'],
	// Hungarian names for foreign cities
	['pozsony', 'bratislava'], ['kassa', 'kosice'], ['kolozsvar', 'cluj'],
	['temesvar', 'timisoara'], ['nagyszombat', 'trnava'], ['ujvidek', 'novi sad'],
	['szabadka', 'subotica'], ['eszek', 'osijek'], ['zagrab', 'zagreb'],
	['fiume', 'rijeka'], ['laibach', 'ljubljana'],
	['velence', 'venezia', 'venice'], ['milano', 'mailand', 'milan'],
	['roma', 'rom'], ['firenze', 'florence', 'florenz'],
	['kisinev', 'chisinau', 'kishinev'], ['ungeny', 'ungheni'],
	['kalarash', 'calarasi'],
	['harkov', 'kharkiv', 'harkiv'], ['kijev', 'kyiv', 'kiev'],
	['lviv', 'lvov', 'lemberg'], ['odessa', 'odesa'],
	['chop', 'cop', 'csap'],
	// Danish ø/å
	['roedekro', 'rodekro'], ['goerding', 'gording'], ['broerup', 'brorup'],
	['goedstrup', 'godstrup'], ['graasten', 'grasten'], ['nykoebing', 'nykobing'],
	// Italian S. abbreviations
	['s.', 'san ', 'santa ', 'santo '],
];

const stripSuffixes = (s) => s
	.replace(/\b(hbf|hauptbahnhof|central\s*station|railway\s*station|station|bahnhof|train\s*station|hl\s*n|hlavni\s*nadrazi|hl\s*st|railway\s*halt|railway\s*stop|haltepunkt|megallohely)\b/gi, '')
	.replace(/\s*\([^)]*\)\s*/g, ' ')
	.replace(/\s+/g, ' ').trim();

const namesMatch = (wikidataName, mavName) => {
	const wd = normalize(wikidataName);
	const mv = normalize(mavName);
	// Direct containment
	if (wd.includes(mv) || mv.includes(wd)) return true;

	// After stripping station-type suffixes and qualifiers
	const wdStrip = normalize(stripSuffixes(wikidataName));
	const mvStrip = normalize(stripSuffixes(mavName));
	if (wdStrip && mvStrip && (wdStrip.includes(mvStrip) || mvStrip.includes(wdStrip))) return true;

	// First word match (city name)
	const wdFirst = wdStrip.split(' ')[0];
	const mvFirst = mvStrip.split(' ')[0];
	if (wdFirst.length >= 3 && mvFirst.length >= 3 && (wdFirst === mvFirst || wdFirst.includes(mvFirst) || mvFirst.includes(wdFirst))) return true;

	// City alias match
	for (const aliases of CITY_ALIASES) {
		const wdHas = aliases.some(a => wdStrip.includes(a));
		const mvHas = aliases.some(a => mvStrip.includes(a));
		if (wdHas && mvHas) return true;
	}

	return false;
};

// Strict matching for name+country fallback — no first-word fallback
const namesMatchStrict = (wikidataName, mavName) => {
	const wd = normalize(wikidataName);
	const mv = normalize(mavName);
	if (!wd || !mv || mv.length < 3) return false;
	if (wd === mv) return true;

	const wdStrip = normalize(stripSuffixes(wikidataName));
	const mvStrip = normalize(stripSuffixes(mavName));
	if (!wdStrip || !mvStrip || mvStrip.length < 3) return false;
	if (wdStrip === mvStrip) return true;
	// Require the shorter to be fully contained AND at least 60% of the longer
	const shorter = wdStrip.length <= mvStrip.length ? wdStrip : mvStrip;
	const longer = wdStrip.length > mvStrip.length ? wdStrip : mvStrip;
	if (longer.includes(shorter) && shorter.length >= longer.length * 0.6) return true;

	// City alias match
	for (const aliases of CITY_ALIASES) {
		const wdHas = aliases.some(a => wdStrip.includes(a));
		const mvHas = aliases.some(a => mvStrip.includes(a));
		if (wdHas && mvHas) return true;
	}

	return false;
};

const queryWikidata = async (codes) => {
	const values = codes.map(c => `"${c}"`).join(' ');
	// Fetch coords + all language labels for each station
	const sparql = `SELECT ?code ?coord (GROUP_CONCAT(DISTINCT ?label; SEPARATOR="|||") AS ?labels) WHERE { VALUES ?code { ${values} } ?s wdt:P722 ?code . ?s wdt:P625 ?coord . ?s rdfs:label ?label . } GROUP BY ?code ?coord`;
	const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql);
	const res = await fetch(url, {
		headers: { Accept: 'application/json', 'User-Agent': 'mav-stations-geocoder/1.0 (https://github.com/martinlangbecker/mav-stations)' },
		signal: AbortSignal.timeout(30000),
	});
	if (!res.ok) throw new Error(`Wikidata ${res.status}: ${res.statusText}`);
	const data = await res.json();
	const results = {};
	for (const b of data.results.bindings) {
		const m = b.coord.value.match(/Point\(([\d.-]+) ([\d.-]+)\)/);
		if (m) {
			results[b.code.value] = {
				lat: parseFloat(m[2]),
				lon: parseFloat(m[1]),
				wdLabels: (b.labels?.value || '').split('|||'),
			};
		}
	}
	return results;
};

// --- Wikidata name+country fallback ---
// ISO -> Wikidata country QID
const ISO_TO_QID = {
	HU: 'Q28', AT: 'Q40', DE: 'Q183', CZ: 'Q213', SK: 'Q214', PL: 'Q36',
	RO: 'Q218', RS: 'Q403', HR: 'Q224', SI: 'Q215', CH: 'Q39', IT: 'Q38',
	NL: 'Q55', BE: 'Q31', DK: 'Q35', LU: 'Q32', UA: 'Q212', FR: 'Q142',
	MD: 'Q217', LT: 'Q37', ME: 'Q236', GB: 'Q145', BG: 'Q219',
};

// Query Wikidata for railway stations in a country, return all with coords + labels
const queryByCountry = async (countryQid) => {
	const sparql = `SELECT ?s ?coord (GROUP_CONCAT(DISTINCT ?label; SEPARATOR="|||") AS ?labels) WHERE {
  VALUES ?type { wd:Q55488 wd:Q928830 wd:Q18543139 wd:Q27020748 wd:Q22808403 wd:Q1339195 }
  ?s wdt:P31 ?type ; wdt:P17 wd:${countryQid} ; wdt:P625 ?coord .
  ?s rdfs:label ?label .
} GROUP BY ?s ?coord`;
	const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql);
	const res = await fetch(url, {
		headers: { Accept: 'application/json', 'User-Agent': 'mav-stations-geocoder/1.0 (https://github.com/martinlangbecker/mav-stations)' },
		signal: AbortSignal.timeout(60000),
	});
	if (!res.ok) throw new Error(`Wikidata ${res.status}: ${res.statusText}`);
	const data = await res.json();
	return data.results.bindings.map(b => {
		const m = b.coord.value.match(/Point\(([\d.-]+) ([\d.-]+)\)/);
		return m ? { lat: parseFloat(m[2]), lon: parseFloat(m[1]), labels: (b.labels?.value || '').split('|||') } : null;
	}).filter(Boolean);
};

// --- Overpass API query ---
const OVERPASS_COUNTRIES = new Set(['PL','HU','RS','RO','SI','SK','HR','DE','AT','UA','FR','CZ','IT','NL','BE','CH','DK','BG','ME','MD','LT','GB','LU']);
const OVERPASS_DELAY = 3000;

// UIC prefix (digits 3-4 of 9-digit code) -> ISO country
const UIC_PREFIX_TO_ISO = {
	'55': 'HU', '81': 'AT', '80': 'DE', '54': 'CZ', '56': 'SK', '51': 'PL',
	'53': 'RO', '72': 'RS', '78': 'HR', '79': 'SI', '85': 'CH', '83': 'IT',
	'84': 'NL', '88': 'BE', '86': 'DK', '82': 'LU', '22': 'UA', '87': 'FR',
	'23': 'MD', '24': 'LT', '62': 'ME', '70': 'GB', '52': 'BG',
};
const uicCountry = (code) => UIC_PREFIX_TO_ISO[code.slice(2, 4)] || null;


const queryOverpass = async (countryIso) => {
	const query = `[out:json];area["ISO3166-1"="${countryIso}"]->.c;node["railway"~"station|halt"](area.c);out;`;
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch('https://overpass-api.de/api/interpreter', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'mav-stations-geocoder/1.0' },
			body: 'data=' + encodeURIComponent(query),
			signal: AbortSignal.timeout(120000),
		});
		if (res.status === 429) {
			console.error(`\n  Overpass 429, backing off 20s (attempt ${attempt + 1}/3)`);
			await sleep(20000);
			continue;
		}
		if (!res.ok) throw new Error(`Overpass ${res.status}: ${res.statusText}`);
		const data = await res.json();
		return data.elements.filter(e => e.tags?.name).map(e => ({
			lat: e.lat, lon: e.lon, labels: [e.tags.name, ...(e.tags['name:en'] ? [e.tags['name:en']] : [])],
		}));
	}
	throw new Error(`Overpass failed after 3 retries for ${countryIso}`);
};

// --- Generate map HTML ---
const generateMap = (stations) => {
	const mav = stations.filter(s => s.source === 'mav');
	const disc = stations.filter(s => s.source === 'discovered');

	// Country stats
	const byCountry = {};
	for (const s of stations) (byCountry[s.country] ??= []).push(s);
	const countryStats = Object.entries(byCountry)
		.map(([c, arr]) => `${c}: ${arr.length}`)
		.sort()
		.join(', ');

	return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>European Station Map – MAV</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%}
.legend{background:#fff;padding:10px 14px;border-radius:5px;line-height:1.8;font:13px/1.8 system-ui}
.legend i{width:12px;height:12px;display:inline-block;margin-right:6px;border-radius:50%}
.legend b{font-size:14px}
</style>
</head><body>
<div id="map"></div>
<script>
const map = L.map('map').setView([48.5, 13], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap',maxZoom:18,referrerPolicy:'no-referrer-when-downgrade'
}).addTo(map);

function dot(color,r){return{radius:r||4,fillColor:color,color:'#333',weight:0.5,opacity:0.8,fillOpacity:0.7}}

const data = {
  mav: ${JSON.stringify(mav)},
  discovered: ${JSON.stringify(disc)}
};

const layers = {};
layers['mav-stations ('+data.mav.length+')'] = L.layerGroup(
  data.mav.map(s=>L.circleMarker([s.lat,s.lon],dot('#2196F3')).bindPopup('<b>'+s.name+'</b><br>'+s.code+' ('+s.country+')<br><i>mav-stations</i>'))
).addTo(map);
layers['discovered ('+data.discovered.length+')'] = L.layerGroup(
  data.discovered.map(s=>L.circleMarker([s.lat,s.lon],dot('#FF9800')).bindPopup('<b>'+s.name+'</b><br>'+s.code+' ('+s.country+')<br><i>discovered</i>'))
).addTo(map);

L.control.layers(null, layers, {collapsed:false}).addTo(map);

const legend = L.control({position:'bottomright'});
legend.onAdd = function(){
  const d=L.DomUtil.create('div','legend');
  d.innerHTML='<b>European Station Coverage</b><br>'+
    '<i style="background:#2196F3"></i>mav-stations ('+data.mav.length+')<br>'+
    '<i style="background:#FF9800"></i>discovered ('+data.discovered.length+')<br>'+
    '<br>Total: ${stations.length} geocoded<br>'+
    '${countryStats}<br>'+
    'Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}';
  return d;
};
legend.addTo(map);
</script>
</body></html>`;
};

// --- Main ---
const main = async () => {
	const t0 = Date.now();
	const allStations = await loadStations();
	console.log(`Loaded ${allStations.size} rail stations`);

	let cache = {};
	try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf-8')); } catch { /* empty */ }
	console.log(`Cache: ${Object.keys(cache).length} entries`);

	// Load manual overrides (accepted rejections)
	let overrides = {};
	try { overrides = JSON.parse(await readFile(OVERRIDES_FILE, 'utf-8')); } catch { /* empty */ }
	if (Object.keys(overrides).length > 0) console.log(`Overrides: ${Object.keys(overrides).length} entries`);

	const allRejections = [];

	if (!mapOnly) {
		// Determine what needs geocoding
		const toGeocode = [...allStations.entries()]
			.filter(([code, s]) => !cache[code] && !s.name.includes('*'))
			.map(([code]) => code);
		console.log(`To geocode: ${toGeocode.length}`);

		if (toGeocode.length > 0) {
			const batches = [];
			for (let i = 0; i < toGeocode.length; i += BATCH_SIZE) {
				batches.push(toGeocode.slice(i, i + BATCH_SIZE));
			}

			let found = 0, missed = 0, rejected = 0;
			for (let i = 0; i < batches.length; i++) {
				const batch = batches[i];
				const uicCodes = batch.map(c => c.replace(/^00/, ''));
				const codeMap = Object.fromEntries(batch.map((c, j) => [uicCodes[j], c])); // uic -> original

				try {
					const results = await queryWikidata(uicCodes);
					for (const [uic, data] of Object.entries(results)) {
						const origCode = codeMap[uic];
						const station = allStations.get(origCode);
						if (station && (data.wdLabels.some(label => namesMatch(label, station.name)) || overrides[origCode] || station.country === uicCountry(origCode))) {
							cache[origCode] = { lat: data.lat, lon: data.lon };
							found++;
						} else {
							rejected++;
							if (station) {
								console.error(`\n  ⚠ Rejected ${origCode} "${station.name}" — Wikidata says "${data.wdLabels.slice(0, 3).join(', ')}"`);
								allRejections.push({ code: origCode, mavName: station.name, wdLabels: data.wdLabels.slice(0, 5), lat: data.lat, lon: data.lon, accept: false });
							}
						}
					}
					missed += batch.length - Object.keys(results).length;
				} catch (e) {
					console.error(`\n  Batch ${i + 1} failed: ${e.message}`);
					missed += batch.length;
				}

				const pct = (((i + 1) / batches.length) * 100).toFixed(0);
				process.stdout.write(`\r  Batch ${i + 1}/${batches.length} (${pct}%) – ${found} found, ${rejected} rejected, ${missed} missed`);

				// Save periodically
				if ((i + 1) % 5 === 0 || i === batches.length - 1) {
					await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
				}
				if (i < batches.length - 1) await sleep(BATCH_DELAY);
			}
			console.log(`\n  Done: ${found} new, ${rejected} rejected (name mismatch), ${missed} not found. Cache: ${Object.keys(cache).length}`);
			await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
		}


		// Trainline CSV UIC lookup for remaining misses (fast, no name matching)
		const stillMissing = [...allStations.entries()]
			.filter(([code]) => !cache[code] && !allStations.get(code).name.includes('*'))
			.map(([code]) => code);
		if (stillMissing.length > 0) {
			console.log(`\nTrainline UIC lookup: ${stillMissing.length} stations`);
			try {
				const tlRes = await fetch(TRAINLINE_CSV_URL, { signal: AbortSignal.timeout(30000) });
				if (tlRes.ok) {
					const text = await tlRes.text();
					const lines = text.split('\n');
					const header = lines[0].split(';');
					const uicIdx = header.indexOf('uic');
					const latIdx = header.indexOf('latitude');
					const lonIdx = header.indexOf('longitude');
					const trainlineByUic = new Map();
					for (let i = 1; i < lines.length; i++) {
						const cols = lines[i].split(';');
						const uic = cols[uicIdx];
						const lat = parseFloat(cols[latIdx]);
						const lon = parseFloat(cols[lonIdx]);
						if (uic && !isNaN(lat) && !isNaN(lon)) trainlineByUic.set(uic, { lat, lon });
					}
					let tlFound = 0;
					for (const code of stillMissing) {
						const uic7 = code.replace(/^00/, '');
						const tl = trainlineByUic.get(uic7);
						if (tl) { cache[code] = { lat: tl.lat, lon: tl.lon }; tlFound++; }
					}
					console.log(`  Trainline: ${tlFound} found (${trainlineByUic.size} stations in CSV)`);
					if (tlFound > 0) await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
				}
			} catch (e) {
				console.error(`  Trainline failed: ${e.message}`);
			}
		}


		// Wikidata name+country fallback for remaining misses
		const stillMissingByCountry = {};
		for (const [code, s] of allStations) {
			if (!cache[code] && s.country && !s.name.includes('*')) {
				(stillMissingByCountry[s.country] ??= []).push([code, s]);
			}
		}
		const countriesToQuery = Object.entries(stillMissingByCountry)
			.filter(([iso, arr]) => ISO_TO_QID[iso] && arr.length >= 3)
			.sort((a, b) => b[1].length - a[1].length);
		const totalNameMissing = countriesToQuery.reduce((s, [, arr]) => s + arr.length, 0);

		if (totalNameMissing > 0) {
			console.log(`\nWikidata name+country fallback: ${totalNameMissing} stations in ${countriesToQuery.length} countries`);
			let nameFound = 0, nameMissed = 0;
			for (const [iso, stations] of countriesToQuery) {
				try {
					const wdStations = await queryByCountry(ISO_TO_QID[iso]);
					const usedWd = new Set(); // prevent same WD entity matching multiple stations
					for (const [code, s] of stations) {
						const idx = wdStations.findIndex((wd, i) => !usedWd.has(i) && wd.labels.some(label => namesMatchStrict(label, s.name)));
						if (idx >= 0) {
							cache[code] = { lat: wdStations[idx].lat, lon: wdStations[idx].lon };
							usedWd.add(idx);
							nameFound++;
						} else {
							nameMissed++;
						}
					}
					process.stdout.write(`\r  Name fallback: ${nameFound} found, ${nameMissed} missed (${iso}: ${stations.length})`);
					await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
				} catch (e) {
					console.error(`\n  ${iso} failed: ${e.message}`);
					nameMissed += stations.length;
				}
				await sleep(BATCH_DELAY);
			}
			console.log(`\n  Done: ${nameFound} found, ${nameMissed} missed. Cache: ${Object.keys(cache).length}`);
			await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
		}

		// Overpass API fallback for remaining misses
		const overpassMissing = {};
		for (const [code, s] of allStations) {
			if (!cache[code] && s.country && !s.name.includes('*') && OVERPASS_COUNTRIES.has(s.country)) {
				(overpassMissing[s.country] ??= []).push([code, s]);
			}
		}
		const overpassCountries = Object.entries(overpassMissing).sort((a, b) => b[1].length - a[1].length);
		const totalOverpass = overpassCountries.reduce((s, [, arr]) => s + arr.length, 0);

		if (totalOverpass > 0) {
			console.log(`\nOverpass API fallback: ${totalOverpass} stations in ${overpassCountries.length} countries`);
			let osmFound = 0, osmMissed = 0;
			for (const [iso, stations] of overpassCountries) {
				try {
					const osmStations = await queryOverpass(iso);
					const usedOsm = new Set();
					for (const [code, s] of stations) {
						const idx = osmStations.findIndex((osm, i) => !usedOsm.has(i) && osm.labels.some(label => namesMatchStrict(label, s.name)));
						if (idx >= 0) {
							cache[code] = { lat: osmStations[idx].lat, lon: osmStations[idx].lon };
							usedOsm.add(idx);
							osmFound++;
						} else {
							osmMissed++;
						}
					}
					process.stdout.write(`\r  Overpass: ${osmFound} found, ${osmMissed} missed (${iso}: ${stations.length})`);
					await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
				} catch (e) {
					console.error(`\n  Overpass ${iso} failed: ${e.message}`);
					osmMissed += stations.length;
				}
				await sleep(OVERPASS_DELAY);
			}
			console.log(`\n  Done: ${osmFound} found, ${osmMissed} missed. Cache: ${Object.keys(cache).length}`);
			await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
		}

		// Write rejections file for manual review
		if (allRejections.length > 0) {
			await writeFile(REJECTIONS_FILE, JSON.stringify(allRejections, null, 2));
			console.log(`\n  Wrote ${allRejections.length} rejections to ${REJECTIONS_FILE}`);
			console.log(`  To accept: set "accept": true, then copy to ${OVERRIDES_FILE} as {code: {lat, lon}}`);
		}
	}

	// Apply manual overrides for accepted rejections
	for (const [code, coords] of Object.entries(overrides)) {
		if (!cache[code] && coords.lat != null) {
			cache[code] = { lat: coords.lat, lon: coords.lon };
		}
	}
	if (Object.keys(overrides).length > 0) await safeWrite(CACHE_FILE, JSON.stringify(cache, null, 2));

	// Build results
	const results = [];
	for (const [code, station] of allStations) {
		if (cache[code]) results.push({ ...station, ...cache[code] });
	}
	console.log(`\n${results.length}/${allStations.size} stations geocoded`);

	// Country breakdown
	const byCountry = {};
	for (const s of results) (byCountry[s.country] ??= []).push(s);
	for (const [c, arr] of Object.entries(byCountry).sort()) {
		const total = [...allStations.values()].filter(s => s.country === c).length;
		console.log(`  ${c}: ${arr.length}/${total}`);
	}

	// Generate map
	const html = generateMap(results);
	await writeFile(MAP_FILE, html);
	console.log(`\nMap: ${MAP_FILE}`);
	console.log(`Time: ${fmt(Date.now() - t0)}`);
};

main().catch(e => { console.error(e); process.exit(1); });
