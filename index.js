import { createReadStream } from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function* readStations() {
  const reader = createInterface({
    input: createReadStream(pathJoin(__dirname, 'data.ndjson')),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    if (line) yield JSON.parse(line);
  }
}
