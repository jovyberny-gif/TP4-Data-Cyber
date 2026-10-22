// C · CYBER — Proxy de protection : contrôle d'accès par rôle + journal d'audit.
// Rôles du cahier des charges QueenBee (section 3.2) et principe du moindre privilège (8.2).

export const PERMISSIONS = {
  apiculteur:   ['lister'],
  coordinateur: ['lister', 'acquitter'],
  gestionnaire: ['lister', 'acquitter'],
  admin:        ['lister', 'acquitter', 'modifierSeuil', 'supprimer'],
};

// Service métier existant (NON modifiable) : il ne connaît rien des rôles
export function creerServiceAlertes() {
  const alertes = new Map([['ALR-1', { id: 'ALR-1', siteId: 'SN-CASA', statut: 'LEVÉE' }]]);
  const seuils = { 'SN-CASA': 0.5 };
  return {
    nom: 'service-alertes',
    lister: siteId => [...alertes.values()].filter(a => a.siteId === siteId),
    acquitter: id => { alertes.get(id).statut = 'PRISE_EN_CHARGE'; return alertes.get(id); },
    modifierSeuil: (siteId, kg) => { seuils[siteId] = kg; return seuils[siteId]; },
    supprimer: id => alertes.delete(id),
  };
}

// Proxy de protection : même interface que le service, accès filtré et tracé
export function avecControleAcces(service, utilisateur, journal = []) {
  return new Proxy(service, {
    get(cible, action) {
      const valeur = cible[action];

      // 1. Laisser passer les propriétés non-fonction (ex. « nom »)
      if (typeof valeur !== 'function') return valeur;

      // 2. Pour toute méthode, retourner une fonction gardée
      return function (...args) {
        const droits = PERMISSIONS[utilisateur.role] ?? []; // 5. rôle inconnu → aucun droit
        const autorise = droits.includes(action);

        const entree = {
          qui:     utilisateur.nom,
          role:    utilisateur.role,
          action,
          at:      new Date().toISOString(),
          resultat: autorise ? 'AUTORISÉ' : 'REFUSÉ',
        };
        journal.push(entree);

        // 3. Accès interdit : journaliser REFUSÉ et lever une erreur
        if (!autorise) {
          throw new Error(`Accès refusé : ${utilisateur.role} ne peut pas exécuter « ${action} »`);
        }

        // 4. Accès autorisé : appeler la vraie méthode
        return valeur.apply(cible, args);
      };
    },
  });
}

