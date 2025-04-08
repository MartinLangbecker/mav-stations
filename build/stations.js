import createDebug from 'debug';
import createFetch from 'fetch-ponyfill';
import through from 'through2';

const { fetch } = createFetch();
const debug = createDebug('mav-stations:stations');

const url =
  'https://jegy-a.mav.hu/IK_API_PROD/api/OfferRequestApi/GetStationList';

const request = () => {
  debug('fetching stations');

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cacheHash: '' }),
  }).then((result) => {
    if (!result.ok) {
      const error = new Error(result.statusText);
      error.statusCode = result.status;
      throw error;
    }
    return result.json();
  });
};

export const downloadStations = () => {
  let stations = through.obj((station, _, cb) => {
    cb(null, station);
  });

  request()
    .then((data) => {
      for (let station of data.stations) stations.write(station);
      stations.end();
    })
    .catch((err) => stations.destroy(err));

  return stations;
};
