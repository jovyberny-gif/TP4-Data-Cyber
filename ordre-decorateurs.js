// B2 · L'ordre des décorateurs a-t-il un effet ? Lancer : node seance4-patterns/tp-data-cyber/ordre-decorateurs.js
// Les deux compositions utilisent exactement les mêmes classes, empilées dans un ordre différent.
import { FakeHttpClient, LoggingClient, CachingClient, RetryClient } from './structuraux/decorator.js';

async function scenario(nom, fabriquer) {
  const base = new FakeHttpClient();
  const client = fabriquer(base);
  console.log(`\n${nom}`);
  await client.get('/api/ruches');
  await client.get('/api/ruches');
  await client.get('/api/instable');
  console.log(`  → appels réels sur le client de base : ${base.calls}`);
}

// Composition A : le cache est à l'extérieur
await scenario('A · Cache( Retry( Log( base ) ) )', base => new CachingClient(new RetryClient(new LoggingClient(base))));

// Composition B : la journalisation est à l'extérieur
await scenario('B · Log( Cache( Retry( base ) ) )', base => new LoggingClient(new CachingClient(new RetryClient(base))));

// Composition C : log à l'extérieur, retry au milieu, cache au centre (ordre recommandé QueenBee)
await scenario('C · Log( Retry( Cache( base ) ) )', base => new LoggingClient(new RetryClient(new CachingClient(base))));

/*
 * B2 — Réponses aux 3 questions
 *
 * 1. Pourquoi le 2e appel à /api/ruches n'est-il pas journalisé dans A, mais l'est dans B ?
 *    Dans A, l'ordre est Cache( Retry( Log( base ) ) ).
 *    Le CachingClient est la couche la plus externe : il intercepte le 2e appel à /api/ruches,
 *    constate un HIT dans son cache et retourne directement le résultat sans descendre dans
 *    les couches internes (Retry ni Log ne sont appelés). La journalisation se trouve SOUS le
 *    cache, donc elle n'est pas atteinte.
 *    Dans B, l'ordre est Log( Cache( Retry( base ) ) ).
 *    Le LoggingClient est à l'extérieur : il est traversé pour CHAQUE appel, même si le cache
 *    répond ensuite. Le log voit tous les appels entrants, puis le cache absorbe le travail réel.
 *
 * 2. Dans B, voit-on dans les logs que /api/instable a échoué une première fois ? Pourquoi ?
 *    Non. Dans B, l'ordre est Log( Cache( Retry( base ) ) ).
 *    Le LoggingClient enregistre uniquement la durée totale de l'appel (finally), après que
 *    l'ensemble Cache+Retry+base a terminé. Les tentatives intermédiaires du RetryClient sont
 *    visibles via les messages [retry] dans la console, mais le log horodaté ne les distingue
 *    pas : il ne voit qu'un seul aller-retour, qui a finalement réussi.
 *    Avec l'ordre Log( Retry( ... ) ), chaque tentative serait loguée séparément.
 *
 * 3. Quel ordre choisiriez-vous pour la passerelle QueenBee (liaison instable) et pourquoi ?
 *    Ordre recommandé : Log( Retry( Cache( base ) ) )  — composition C ci-dessus.
 *    - Log à l'extérieur : on trace TOUTES les requêtes entrantes, y compris les hits de cache,
 *      ce qui donne une visibilité complète côté API gateway (auditabilité).
 *    - Retry au milieu : si la requête atteint le réseau (cache MISS), le retry absorbe les
 *      erreurs transitoires de la liaison LoRa sans que le log supérieur ne les voie comme
 *      des échecs multiples.
 *    - Cache au centre : une fois qu'une mesure est récupérée avec succès, elle est servie
 *      localement pour les appels suivants, réduisant la pression sur la liaison instable.
 *    Ce choix évite de logger les retries individuels (bruit) tout en conservant un audit
 *    complet des requêtes et en protégeant la liaison avec le cache.
 */

