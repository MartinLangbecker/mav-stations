import tokenize from 'tokenize-db-station-name';

export const createFilter = (selector) => {
  if (selector === 'all') return () => true;

  const props = Object.keys(selector);
  const selectorTokens =
    'string' === typeof selector.name ? tokenize(selector.name) : [];

  return (s) => {
    for (const prop of props) {
      if (prop === 'name') {
        const sTokens = tokenize(s.name);
        // check if selectorTokens is a subset of sTokens
        for (const selectorToken of selectorTokens) {
          if (sTokens.indexOf(selectorToken) < 0) return false;
        }
      } else if (s[prop] !== selector[prop]) {
        return false;
      }
    }

    return true;
  };
};
