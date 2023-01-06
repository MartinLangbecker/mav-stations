import through from 'through2';

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
      country: data.country,
      countryIso: data.coutryIso,
      isIn108_1: data.isIn108_1,
    });
  });
};

export { createParser as parser };
