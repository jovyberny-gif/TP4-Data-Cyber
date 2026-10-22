import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNotification } from './creationnels/factory.js';
import { installerCanalGroupe } from './extension-canal.js';

test('B1 · le canal sms-groupe est disponible après installation', () => {
  installerCanalGroupe();
  assert.equal(createNotification('sms-groupe').send('Récolte validée'), '[SMS-GROUPE] Récolte validée');
});

test('B1 · factory.js n’a pas été modifié (principe ouvert/fermé)', () => {
  const src = readFileSync(new URL('./creationnels/factory.js', import.meta.url), 'utf8');
  assert.equal(src.includes('sms-groupe'), false);
});
