import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerServiceAlertes, avecControleAcces } from './proxy-roles.js';

const apicultrice = { id: 'U-31', role: 'apiculteur' };
const admin = { id: 'U-1', role: 'admin' };

test('C-Cyber · une apicultrice peut lister les alertes de son site', () => {
  const s = avecControleAcces(creerServiceAlertes(), apicultrice);
  assert.equal(s.lister('SN-CASA').length, 1);
});

test('C-Cyber · une apicultrice ne peut pas supprimer, et le refus est journalisé', () => {
  const journal = [];
  const s = avecControleAcces(creerServiceAlertes(), apicultrice, journal);
  assert.throws(() => s.supprimer('ALR-1'), /Accès refusé/);
  assert.equal(journal.at(-1).resultat, 'REFUSÉ');
  assert.equal(journal.at(-1).action, 'supprimer');
});

test('C-Cyber · un administrateur peut modifier un seuil (action journalisée)', () => {
  const journal = [];
  const s = avecControleAcces(creerServiceAlertes(), admin, journal);
  assert.equal(s.modifierSeuil('SN-CASA', 0.8), 0.8);
  assert.equal(journal.at(-1).resultat, 'AUTORISÉ');
});

test('C-Cyber · rôle inconnu : aucun droit (moindre privilège)', () => {
  const s = avecControleAcces(creerServiceAlertes(), { id: 'X', role: 'stagiaire' });
  assert.throws(() => s.lister('SN-CASA'), /Accès refusé/);
});

test('C-Cyber · les propriétés non fonctionnelles restent lisibles', () => {
  assert.equal(avecControleAcces(creerServiceAlertes(), apicultrice).nom, 'service-alertes');
});
