// todo: use import assertions once they're supported by Node.js & ESLint
// https://github.com/tc39/proposal-import-assertions
import { Readable } from 'node:stream';
import stations from './data.json';

const arrayAsReadable = (array) => {
  const length = array.length;
  let i = 0;
  return new Readable({
    objectMode: true,
    read(size) {
      const maxI = Math.min(i + size, length - 1);
      for (; i <= maxI; i++) {
        this.push(array[i]);
      }
      if (i === length - 1) {
        this.push(null); // end
      }
    },
  });
};

export const readStations = () => arrayAsReadable(stations);
