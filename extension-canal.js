// B1 · Étendre sans modifier : ajouter le canal « sms-groupe » à la fabrique de notifications
// (un SMS envoyé à toutes les apicultrices d'une coopérative). factory.js ne doit PAS être modifié.
import { Notification, registerChannel } from './creationnels/factory.js';

// B1.1 : SmsGroupeNotification hérite de Notification et formate le message
export class SmsGroupeNotification extends Notification {
  send(msg) {
    return `[SMS-GROUPE] ${msg}`;
  }
}

export function installerCanalGroupe() {
  // B1.2 : enregistrement dans le registre de la fabrique — factory.js non modifié (OCP)
  registerChannel('sms-groupe', SmsGroupeNotification);
}
