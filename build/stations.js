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
    cache: 'no-store',
  }).then((res) => {
    if (!res.ok) {
      const err = new Error(res.statusText);
      err.statusCode = res.status;
      throw err;
    }
    return res.json();
  });
};

const downloadStations = () => {
  let stationsData = through.obj((s, _, cb) => {
    cb(null, s);
  });

  request()
    .then((data) => {
      for (let res of data) stationsData.write(res);
      stationsData.end();
    })
    .catch((err) => stationsData.destroy(err));

  return stationsData;
};

export { downloadStations };
