// C · DATA — Adapter : deux sources de mesures hétérogènes, un seul contrat.
//
// Contrat attendu par le reste de QueenBee (contexte « Santé des colonies ») :
//   Mesure = { hiveId: string, at: string ISO 8601 (UTC), poidsKg: number, temperatureC: number, source: string }

// --- Source 1 : trames capteurs déjà décodées (format 6.5 du cahier des charges) — NON modifiable
export class CapteurLoRaSource {
  async trames() {
    return [
      { hive_id: 'SN-CASA-014', site_id: 'SN-CASA', timestamp: '2027-03-14T08:15:00Z', weight_kg: 34.2, temp_internal_c: 34.8 },
      { hive_id: 'SN-CASA-015', site_id: 'SN-CASA', timestamp: '2027-03-14T08:30:00Z', weight_kg: 29.9, temp_internal_c: 35.1 },
    ];
  }
}

// --- Source 2 : anciens relevés papier numérisés (CSV) — NON modifiable
// colonnes : ruche ; date « JJ/MM/AAAA HH:MM » (heure UTC) ; poids en GRAMMES ; température en °F
export class ReleveManuelSource {
  async lignes() {
    return [
      'CM-BAF-003;13/03/2027 07:00;41850;93.2',
      'CM-BAF-004;13/03/2027 07:20;;95.0', // poids manquant : ligne inexploitable
      'CM-BAF-005;14/03/2027 09:05;38100;94.1',
    ];
  }
}

// --- Adaptateurs : À VOUS
// C-Data.1 : LoRaAdapter — renomme les champs LoRa vers le contrat Mesure (source: 'capteur')
export class LoRaAdapter {
  constructor(source) { this.source = source; }
  async mesures() {
    const trames = await this.source.trames();
    return trames.map(t => ({
      hiveId:       t.hive_id,
      at:           new Date(t.timestamp).toISOString(),
      poidsKg:      t.weight_kg,
      temperatureC: t.temp_internal_c,
      source:       'capteur',
    }));
  }
}

// C-Data.2 : ReleveManuelAdapter — parse CSV, convertit unités et dates, filtre les lignes incomplètes
export class ReleveManuelAdapter {
  constructor(source) { this.source = source; }
  async mesures() {
    const lignes = await this.source.lignes();
    const mesures = [];
    for (const ligne of lignes) {
      const [hiveId, dateStr, poidsGStr, tempFStr] = ligne.split(';');

      // Qualité des données : ignorer les lignes avec champs manquants
      if (!hiveId || !dateStr || !poidsGStr || !tempFStr) continue;
      const poidsG = parseFloat(poidsGStr);
      const tempF  = parseFloat(tempFStr);
      if (isNaN(poidsG) || isNaN(tempF)) continue;

      // Date : « JJ/MM/AAAA HH:MM » (UTC) → ISO 8601
      // ex. '13/03/2027 07:00' → Date.UTC(2027, 2, 13, 7, 0)
      const [datePart, timePart] = dateStr.trim().split(' ');
      const [dd, mm, yyyy] = datePart.split('/');
      const [hh, mn]       = timePart.split(':');
      const at = new Date(Date.UTC(
        Number(yyyy), Number(mm) - 1, Number(dd),
        Number(hh),   Number(mn)
      )).toISOString();

      // Conversions : grammes → kg ; °F → °C arrondi au dixième
      const poidsKg      = poidsG / 1000;
      const temperatureC = Math.round((tempF - 32) * 5 / 9 * 10) / 10;

      mesures.push({ hiveId, at, poidsKg, temperatureC, source: 'releve-manuel' });
    }
    return mesures;
  }
}

// --- Client : ne connaît que le contrat Mesure (fourni)
export async function toutesLesMesures(adaptateurs) {
  const lots = await Promise.all(adaptateurs.map(a => a.mesures()));
  return lots.flat().sort((a, b) => a.at.localeCompare(b.at));
}
