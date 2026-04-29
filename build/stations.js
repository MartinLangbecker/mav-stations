const url =
  'https://jegy-a.mav.hu/IK_API_PROD/api/OfferRequestApi/GetStationList';

export const downloadStations = async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = new Error(res.statusText);
    err.statusCode = res.status;
    throw err;
  }
  const body = await res.json();
  return body.stations;
};
