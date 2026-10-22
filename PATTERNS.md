# PATTERNS.md — TP 4 · parcours Data / Cyber
**Binôme :** jovyberny-gif · parcours Data
**Module :** Architecture logicielle · Séance 4 — Patterns de conception

---

## Partie A · Reconnaître les patterns (6 extraits QueenBee)

*(Correction en séance — non reproduite ici)*

---

## Partie B1 · Factory Method — Étendre sans modifier

**Pattern utilisé :** Factory Method (registre + `registerChannel`)

| Fichier modifié | Fichier non modifié |
|-----------------|---------------------|
| `extension-canal.js` (création de `SmsGroupeNotification` + appel `registerChannel`) | `factory.js` ✅ |

**Justification OCP :** La fabrique expose `registerChannel(name, Ctor)` précisément pour permettre l'ajout de canaux sans toucher au code existant. On crée une nouvelle sous-classe de `Notification`, on l'enregistre dans le registre externe, et `createNotification('sms-groupe')` fonctionne immédiatement. Aucune ligne de `factory.js` n'a été modifiée.

---

## Partie B2 · Décorateur — Ordre et composition

### Composition C ajoutée
```
C · Log( Retry( Cache( base ) ) )
```

### Réponse 1 — Pourquoi le 2e appel à `/api/ruches` n'est-il pas journalisé dans A, mais l'est dans B ?

Dans **A** (`Cache( Retry( Log( base ) ) )`), le `CachingClient` est la couche la plus **externe**.
Il intercepte le 2e appel, détecte un HIT dans son cache et retourne le résultat directement, **sans traverser** les couches internes (`Retry`, `Log`). Le `LoggingClient` est à l'intérieur du cache : il n'est jamais atteint pour les requêtes servies depuis le cache.

Dans **B** (`Log( Cache( Retry( base ) ) )`), le `LoggingClient` est à l'**extérieur**.
Il est traversé pour **chaque appel entrant**, qu'il y ait cache hit ou non. Le cache répond ensuite rapidement, mais le log a déjà commencé à mesurer la durée. Résultat : tous les appels sont journalisés.

> **Règle clé :** seules les couches placées **à l'extérieur** d'un décorateur voient 100 % du trafic.

### Réponse 2 — Dans B, voit-on dans les logs que `/api/instable` a échoué une première fois ?

**Non.** Dans B, le `LoggingClient` est à l'extérieur du `RetryClient`. Il ne voit qu'un seul aller-retour : le `try/finally` du log démarre, puis `Cache` + `Retry` travaillent en dessous jusqu'à ce que la requête réussisse (ou échoue définitivement), et le `finally` conclut. Les tentatives intermédiaires du `RetryClient` produisent des messages `[retry]` dans la console, mais le log horodaté n'en voit qu'un seul, celui qui a finalement abouti.

Avec l'ordre `Log( Retry( Cache(...) ) )`, le log serait à l'extérieur du retry : chaque tentative génèrerait sa propre entrée de journal.

### Réponse 3 — Quel ordre choisir pour la passerelle QueenBee (liaison instable) ?

**Ordre recommandé : `Log( Retry( Cache( base ) ) )`** — notre Composition C.

| Couche (ext → int) | Rôle dans QueenBee |
|--------------------|--------------------|
| `Log` (externe) | Trace **toutes** les requêtes entrantes vers l'API (auditabilité complète) |
| `Retry` (milieu) | Absorbe les erreurs transitoires de la liaison LoRa avant qu'elles remontent au log |
| `Cache` (interne) | Sert localement les données récentes ; réduit la pression réseau sur la liaison instable |

**Justification :** Le cache réduit le nombre de vraies requêtes réseau. Lorsqu'une requête atteint quand même le réseau (cache MISS), le retry gère les défaillances LoRa de manière transparente. Le log extérieur capture l'ensemble du flux sans bruit des retries internes. Ce choix respecte le **principe du moindre surprise** : un appel API = une entrée de log, quelle que soit la mécanique interne.

---

## Partie C · Data — Adapter

**Pattern utilisé :** Adapter (objet)

### Problème
Deux sources de mesures hétérogènes :
- `CapteurLoRaSource` : objets JS avec `hive_id`, `weight_kg`, `temp_internal_c`, `timestamp`
- `ReleveManuelSource` : lignes CSV avec format date `JJ/MM/AAAA HH:MM`, poids en grammes, température en °F

### Solution
Deux adaptateurs implémentent le même contrat `mesures()` → `Mesure[]` :

| Adaptateur | Source | Transformations |
|------------|--------|-----------------|
| `LoRaAdapter` | `CapteurLoRaSource` | Renommage des champs, `timestamp` → ISO 8601 |
| `ReleveManuelAdapter` | `ReleveManuelSource` | Parse CSV ; `JJ/MM/AAAA HH:MM` → `Date.UTC()` → ISO 8601 ; grammes → kg ; °F → °C (`(F−32)×5/9`, arrondi au dixième) ; lignes incomplètes écartées |

**Qualité des données :** La ligne `CM-BAF-004` (poids manquant) est détectée par le test `!poidsGStr` et exclue avant toute conversion. Sans ce filtre, `parseFloat('')` produirait `NaN` qui contaminerait silencieusement les calculs en aval.

**Bénéfice architectural :** `toutesLesMesures(adaptateurs)` ne connaît que le contrat `Mesure`. Ajouter une 3e source (API REST, base de données…) = créer un nouvel adaptateur sans modifier le client.

---

## Partie C · Cyber — Proxy de protection

**Pattern utilisé :** Proxy (protection)

### Problème
Le service métier `creerServiceAlertes()` n'a aucune connaissance des rôles. Ajouter des contrôles d'accès directement dedans violerait SRP.

### Solution
`avecControleAcces(service, utilisateur, journal)` retourne un `Proxy` JS qui intercepte chaque accès aux propriétés :

1. **Propriétés non-fonction** (ex. `nom`) → passées telles quelles (transparence)
2. **Méthodes** → enveloppées dans une fonction qui :
   - consulte `PERMISSIONS[utilisateur.role]`
   - journalise l'accès (`AUTORISÉ` ou `REFUSÉ`) avec `qui`, `role`, `action`, `at`
   - lève une `Error("Accès refusé …")` si le rôle n'a pas le droit
   - appelle sinon la vraie méthode via `valeur.apply(cible, args)`
3. **Rôle inconnu** → `PERMISSIONS[role] ?? []` → aucun droit (moindre privilège)

**Bénéfice :** Le service métier reste inchangé. La politique de sécurité est concentrée dans le proxy. On peut tester les deux séparément.
