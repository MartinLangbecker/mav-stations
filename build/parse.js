const countries = {
  Ausztria: 'Austria',
  Belgium: 'Belgium',
  Bulgária: 'Bulgaria',
  Csehország: 'Czechia',
  Dánia: 'Denmark',
  'Egyesült Királyság': 'United Kingdom',
  Franciaország: 'France',
  Hollandia: 'Netherlands',
  Horvátország: 'Croatia',
  Lengyelország: 'Poland',
  Litvánia: 'Lithuania',
  Luxemburg: 'Luxembourg',
  Magyarország: 'Hungary',
  Moldávia: 'Moldova',
  Montenegró: 'Montenegro',
  Németország: 'Germany',
  Olaszország: 'Italy',
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

export const parseStation = (data) => ({
  type: 'station',
  id: data.code,
  name: data.name,
  aliasNames: data.aliasNames ?? [],
  baseCode: data.baseCode ?? '',
  isInternational: data.isInternational,
  canUseForOfferRequest: data.canUseForOfferRequest,
  canUseForPassengerInformation: data.canUseForPassengerInformation,
  country: countries[data.country] ?? data.country,
  // "coutryIso" is a typo in the MÁV API response — not a bug in this code
  countryIso: data.coutryIso,
  isIn108_1: data.isIn108_1 ?? false,
  transportMode: data.modalities?.length
    ? transportModes[data.modalities[0].code]
    : data.modalities,
});
