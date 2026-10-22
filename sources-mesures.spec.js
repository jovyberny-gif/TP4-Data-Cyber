import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapteurLoRaSource, ReleveManuelSource, LoRaAdapter, ReleveManuelAdapter, toutesLesMesures } from './sources-mesures.js';

test('C-Data · LoRaAdapter respecte le contrat Mesure', async () => {
  const [m] = await new LoRaAdapter(new CapteurLoRaSource()).mesures();
  assert.deepEqual(m, { hiveId: 'SN-CASA-014', at: '2027-03-14T08:15:00.000Z', poidsKg: 34.2, temperatureC: 34.8, source: 'capteur' });
});

test('C-Data · ReleveManuelAdapter convertit unités et dates', async () => {
  const [m] = await new ReleveManuelAdapter(new ReleveManuelSource()).mesures();
  assert.deepEqual(m, { hiveId: 'CM-BAF-003', at: '2027-03-13T07:00:00.000Z', poidsKg: 41.85, temperatureC: 34, source: 'releve-manuel' });
});

test('C-Data · les lignes incomplètes sont écartées', async () => {
  const mesures = await new ReleveManuelAdapter(new ReleveManuelSource()).mesures();
  assert.equal(mesures.length, 2);
  assert.equal(mesures.some(m => m.hiveId === 'CM-BAF-004'), false);
});

test('C-Data · le client fusionne les deux sources par ordre chronologique', async () => {
  const toutes = await toutesLesMesures([new LoRaAdapter(new CapteurLoRaSource()), new ReleveManuelAdapter(new ReleveManuelSource())]);
  assert.equal(toutes.length, 4);
  assert.deepEqual(toutes.map(m => m.hiveId), ['CM-BAF-003', 'SN-CASA-014', 'SN-CASA-015', 'CM-BAF-005']);
});
