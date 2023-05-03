import through from 'through2';

const countries = {
  Ausztria: 'Austria',
  Csehország: 'Czechia',
  Dánia: 'Denmark',
  Hollandia: 'Netherlands',
  Horvátország: 'Croatia',
  Olaszország: 'Italy',
  Lengyelország: 'Poland',
  Luxemburg: 'Luxembourg',
  Magyarország: 'Hungary',
  Németország: 'Germany',
  Románia: 'Romania',
  Svájc: 'Switzerland',
  Szerbia: 'Serbia',
  Szlovákia: 'Slovakia',
  Szlovénia: 'Slovenia',
  Ukrajna: 'Ukraine',
};

const transportModes = {
  100: {
    code: 100,
    name: 'Rail',
    description: 'Rail. Used for intercity or long-distance travel.',
  },
  109: { code: 109, name: 'Suburban Railway', description: 'Suburban Railway' },
  200: {
    code: 200,
    name: 'Bus',
    description: 'Bus. Used for short- and long-distance bus routes.',
  },
};

const createParser = () => {
  return through.obj((data, _, cb) => {
    cb(null, {
      type: 'station',
      id: data.code,
      name: data.name,
      aliasNames: data.aliasNames,
      baseCode: data.baseCode,
      isInternational: data.isInternational,
      canUseForOfferRequest: data.canUseForOfferRequest,
      canUseForPassengerInformation: data.canUseForPessengerInformation,
      country: countries[data.country] ?? data.country,
      countryIso: data.coutryIso,
      isIn108_1: data.isIn108_1,
      transportMode: data.modalities?.length
        ? transportModes[data.modalities[0].code]
        : data.modalities,
    });
  });
};

export { createParser as parser };
