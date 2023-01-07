import test from 'tape';

import { readStations as stations } from './index.js';
import { createFilter } from './create-filter.js';

const assertIsValidStation = (t, s, row) => {
  t.equal(s.type, 'station', `row ${row}: s.type`);

  t.equal(typeof s.id, 'string', `row ${row}: s.id`);
  t.ok(s.id, `row ${row}: s.id`);

  t.equal(typeof s.name, 'string', `row ${row}: s.name`);
  t.ok(s.name, `row ${row}: s.name`);

  if (s.aliasNames !== null) {
    t.equal(typeof s.aliasNames, 'object', `row ${row}: s.aliasNames`);
  }

  if (s.baseCode !== null && s.baseCode !== '') {
    t.equal(typeof s.baseCode, 'string', `row ${row}: s.baseCode`);
    t.ok(s.baseCode, `row ${row}: s.baseCode`);
  }

  if (s.isInternational !== null) {
    t.equal(
      typeof s.isInternational,
      'boolean',
      `row ${row}: s.isInternational`
    );
  }

  if (s.canUseForOfferRequest !== null) {
    t.equal(
      typeof s.canUseForOfferRequest,
      'boolean',
      `row ${row}: s.canUseForOfferRequest`
    );
  }

  if (s.canUseForPassengerInformation !== null) {
    t.equal(
      typeof s.canUseForPassengerInformation,
      'boolean',
      `row ${row}: s.canUseForPassengerInformation`
    );
  }

  if (s.country !== null) {
    t.equal(typeof s.country, 'string', `row ${row}: s.country`);
    t.ok(s.country, `row ${row}: s.country`);
  }

  if (s.countryIso !== null) {
    t.equal(typeof s.countryIso, 'string', `row ${row}: s.countryIso`);
    t.ok(s.countryIso, `row ${row}: s.countryIso`);
  }

  if (s.isIn108_1 !== null) {
    t.equal(typeof s.isIn108_1, 'boolean', `row ${row}: s.isIn108_1`);
  }
};

const assertIsBerlinHbf = (t, s) => {
  t.ok(
    s.id === '008065969' || s.id === '008031922',
    'id is 008065969 or 008031922'
  );
  t.ok(s.name.startsWith('Berlin Hbf'), 'name starts with "Berlin Hbf"');
  t.ok(s.isInternational, 'has international connections');
  t.ok(s.canUseForOfferRequest, 'can be used to request offers');
  t.ok(
    s.canUseForPassengerInformation,
    'can be used to request passenger information'
  );
  t.equal(s.country, 'Germany', 'country is Germany');
  t.equal(s.countryIso, 'DE', 'country ISO code is "DE"');
};

test('data.ndjson contains valid simplified stations', (t) => {
  let row = 0;
  stations()
    .on('error', t.ifError)
    .on('data', (s) => {
      assertIsValidStation(t, s, ++row);
    })
    .on('end', () => {
      t.end();
    });
});

test('data.ndjson contains Berlin Hauptbahnhof', (t) => {
  stations()
    .on('error', t.ifError)
    .on('data', (s) => {
      if (s.id === '008065969' || s.id === '008031922') {
        assertIsBerlinHbf(t, s);
      }
    })
    .on('end', () => {
      t.end();
    });
});

test('createFilter works properly', (t) => {
  const s = {
    type: 'station',
    id: 'foo',
    name: 'Foo',
  };

  t.equal(createFilter({ id: 'foo' })(s), true);
  t.equal(createFilter({ id: 'FOO' })(s), false);

  t.end();
});
