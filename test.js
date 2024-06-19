import test from 'tape';

import { createFilter } from './create-filter.js';
import { readStations as stations } from './index.js';

const assertIsValidStation = (test, station, row) => {
  test.equal(station.type, 'station', `row ${row}: s.type`);

  test.equal(typeof station.id, 'string', `row ${row}: s.id`);
  test.ok(station.id, `row ${row}: s.id`);

  test.equal(typeof station.name, 'string', `row ${row}: s.name`);
  test.ok(station.name, `row ${row}: s.name`);

  if (station.aliasNames !== null) {
    test.equal(typeof station.aliasNames, 'object', `row ${row}: s.aliasNames`);
  }

  if (station.baseCode !== null && station.baseCode !== '') {
    test.equal(typeof station.baseCode, 'string', `row ${row}: s.baseCode`);
    test.ok(station.baseCode, `row ${row}: s.baseCode`);
  }

  if (station.isInternational !== null) {
    test.equal(
      typeof station.isInternational,
      'boolean',
      `row ${row}: s.isInternational`
    );
  }

  if (station.canUseForOfferRequest !== null) {
    test.equal(
      typeof station.canUseForOfferRequest,
      'boolean',
      `row ${row}: s.canUseForOfferRequest`
    );
  }

  if (station.canUseForPassengerInformation !== null) {
    test.equal(
      typeof station.canUseForPassengerInformation,
      'boolean',
      `row ${row}: s.canUseForPassengerInformation`
    );
  }

  if (station.country !== null) {
    test.equal(typeof station.country, 'string', `row ${row}: s.country`);
    test.ok(station.country, `row ${row}: s.country`);
  }

  if (station.countryIso !== null) {
    test.equal(typeof station.countryIso, 'string', `row ${row}: s.countryIso`);
    test.ok(station.countryIso, `row ${row}: s.countryIso`);
  }

  if (station.isIn108_1 !== null) {
    test.equal(typeof station.isIn108_1, 'boolean', `row ${row}: s.isIn108_1`);
  }

  if (station.transportMode !== null) {
    test.equal(typeof station.transportMode, 'object', `row ${row}: s.transportMode`);
  }
};

const assertIsBerlinHbf = (test, station) => {
  test.ok(
    station.id === '008065969' || station.id === '008031922',
    'id is 008065969 or 008031922'
  );
  test.ok(station.name.startsWith('Berlin Hbf'), 'name starts with "Berlin Hbf"');
  test.ok(station.isInternational, 'has international connections');
  test.ok(station.canUseForOfferRequest, 'can be used to request offers');
  test.ok(
    station.canUseForPassengerInformation,
    'can be used to request passenger information'
  );
  test.equal(station.country, 'Germany', 'country is Germany');
  test.equal(station.countryIso, 'DE', 'country ISO code is "DE"');
};

test('data.ndjson contains valid simplified stations', (test) => {
  let row = 0;
  stations()
    .on('error', test.ifError)
    .on('data', (station) => {
      assertIsValidStation(test, station, ++row);
    })
    .on('end', () => {
      test.end();
    });
});

test('data.ndjson contains Berlin Hauptbahnhof', (test) => {
  stations()
    .on('error', test.ifError)
    .on('data', (station) => {
      if (station.id === '008065969' || station.id === '008031922') {
        assertIsBerlinHbf(test, station);
      }
    })
    .on('end', () => {
      test.end();
    });
});

test('createFilter works properly', (test) => {
  const station = {
    type: 'station',
    id: 'foo',
    name: 'Foo',
  };

  test.equal(createFilter({ id: 'foo' })(station), true);
  test.equal(createFilter({ id: 'FOO' })(station), false);

  test.end();
});
