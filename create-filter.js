import tokenize from 'tokenize-db-station-name';

export const createFilter = (selector) => {
  if (selector === 'all') return () => true;

  const props = Object.keys(selector);
  const selectorTokens = 'string' === typeof selector.name
    ? tokenize(selector.name)
    : [];

  const filter = (s) => {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];

      if (prop === 'name') {
        const sTokens = tokenize(s.name);
        // check if selectorTokens is a subset of sTokens
        for (let i = 0; i < selectorTokens.length; i++) {
          if (sTokens.indexOf(selectorTokens[i]) < 0) return false;
        }
      } else if (s[prop] !== selector[prop]) {
        return false;
      }
    }

    return true;
  };

  return filter;
};
