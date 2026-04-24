import tokenize from 'tokenize-db-station-name';

export const createFilter = (selector) => {
  if (selector === 'all') {
    return () => true;
  }

  const props = Object.keys(selector);
  const selectorTokens =
    'string' === typeof selector.name ? tokenize(selector.name) : [];

  return (station) => {
    const stationTokens = tokenize(station.name);
    return props.every((prop) => {
      if (prop === 'name') {
        return selectorTokens.every((token) => stationTokens.includes(token));
      }
      return station[prop] === selector[prop];
    });
  };
};
