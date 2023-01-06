import ndjson from 'ndjson';
import fs from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import pump from 'pump';
import through from 'through2';

import { parser as parse } from './parse.js';
import { downloadStations as getStations } from './stations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const showError = (err) => {
  if (!err) return;
  console.error(err);
  process.exit(1);
};

const stations = getStations();

let aliasNames = new Map();

const noAliases = pump(
  stations,
  through.obj((s, _, cb) => {
    if (!s.isAlias) {
      cb(null, s);
    } else {
      // separate alias entries (same code, different name)
      let arr = aliasNames.get(s.code) ?? [];
      arr.push(s.name);
      aliasNames.set(s.code, arr);
      cb();
    }
  }),
  showError
);

const src = pump(
  noAliases,
  through.obj((s, _, cb) => {
    s.aliasNames = aliasNames.get(s.code) ?? [];
    cb(null, s);
  }),
  showError
);

pump(
  src,
  parse(),
  ndjson.stringify(),
  fs.createWriteStream(pathJoin(__dirname, '../data.ndjson')),
  showError
);
