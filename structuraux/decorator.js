// Decorator : ajouter des comportements en « enveloppant » un objet,
// sans le modifier et en gardant exactement la même interface get(url).
import { fileURLToPath } from 'node:url';

// Composant de base : un faux client HTTP (pas besoin d'Internet)
export class FakeHttpClient {
  calls = 0;
  async get(url) {
    this.calls++;
    await new Promise(r => setTimeout(r, 50)); // latence simulée
    if (url.includes('instable') && this.calls % 3 !== 0)
      throw new Error('503 Service Unavailable');
    return { url, data: `contenu de ${url}` };
  }
}

export class LoggingClient {
  constructor(inner) {
    this.inner = inner;
  }
  async get(url) {
    const t0 = performance.now();
    try {
      return await this.inner.get(url);
    } finally {
      console.log(`  [log] GET ${url} – ${Math.round(performance.now() - t0)} ms`);
    }
  }
}
export class CachingClient {
  #cache = new Map();
  constructor(inner, ttlMs = 60_000) {
    this.inner = inner;
    this.ttl = ttlMs;
  }
  async get(url) {
    const hit = this.#cache.get(url);
    if (hit && Date.now() - hit.at < this.ttl) {
      console.log(`  [cache] HIT ${url}`);
      return hit.value;
    }
    const value = await this.inner.get(url);
    this.#cache.set(url, { value, at: Date.now() });
    return value;
  }
}
export class RetryClient {
  constructor(inner, retries = 3) {
    this.inner = inner;
    this.retries = retries;
  }
  async get(url) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.inner.get(url);
      } catch (e) {
        if (attempt >= this.retries) throw e;
        console.log(
          `  [retry] tentative ${attempt} échouée (${e.message}), on réessaie`,
        );
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Composition à la carte : l'ORDRE compte (le cache évite même les logs et les retries)
  const base = new FakeHttpClient();
  const client = new CachingClient(new RetryClient(new LoggingClient(base)));

  await client.get('/api/produits');
  await client.get('/api/produits'); // servi par le cache
  await client.get('/api/instable'); // échoue, puis réussit grâce au retry
  console.log('Appels réellement effectués sur le client de base :', base.calls);
}
