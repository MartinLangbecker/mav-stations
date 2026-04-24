import { Readable } from 'node:stream';
import stations from './data.json' with { type: 'json' };

export const readStations = () =>
  Readable.from(stations, { objectMode: true });
