// Factory Method (forme idiomatique JS) : une fonction fabrique + un registre.
import { fileURLToPath } from 'node:url';
export class Notification {
  send(msg) {
    throw new Error('méthode abstraite');
  }
}
class EmailNotification extends Notification {
  send(msg) {
    return `[EMAIL] : ${msg}`;
  }
}
class SmsNotification extends Notification {
  send(msg) {
    return `[SMS] : ${msg.slice(0, 160)}`;
  }
}
class PushNotification extends Notification {
  send(msg) {
    return `[PUSH] : ${msg}`;
  }
}

const registry = new Map([
  ['email', EmailNotification],
  ['sms', SmsNotification],
  ['push', PushNotification],
]);

export function createNotification(channel) {
  const Ctor = registry.get(channel);
  if (!Ctor) throw new Error(`Canal inconnu : ${channel}`);
  return new Ctor();
}
export function registerChannel(name, Ctor) {
  registry.set(name, Ctor);
}

// --- Démonstration (uniquement si le fichier est exécuté directement) ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const users = [
    { name: 'Alice', channel: 'email' },
    { name: 'Bob', channel: 'sms' },
    { name: 'Chloé', channel: 'push' },
  ];
  for (const u of users)
    console.log(
      createNotification(u.channel).send(`Bonjour ${u.name}, votre colis est expédié`),
    );

  // Nouveau canal : UNE ligne, la fabrique n'est pas modifiée (OCP)
  registerChannel(
    'slack',
    class extends Notification {
      send(msg) {
        return `[SLACK] : ${msg}`;
      }
    },
  );
  console.log(createNotification('slack').send('Déploiement terminé'));

  try {
    createNotification('pigeon');
  } catch (e) {
    console.log('✗', e.message);
  }
}
