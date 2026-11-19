import type { FlagCode } from '@ss/contracts';

// Plain words for an elderly reader: no codes like RF_*, no jargon. Record type makes the
// compiler fail when a new FlagCode is added without a label.
export const FLAG_LABEL_RO: Record<FlagCode, string> = {
  RF_CODE_REQUEST: 'Cere un cod',
  RF_REMOTE_ACCESS: 'Cere acces la calculatorul dumneavoastră',
  RF_DATA_REQUEST: 'Cere date personale',
  RF_PAYMENT_REQUEST: 'Cere bani',
  RF_SUSPICIOUS_CONTACT: 'Adresă de internet sau contact suspect',
  RF_NEW_NUMBER: 'Spune că are un număr nou',
  RF_SECRECY: 'Cere să păstrați secretul',
  RF_TOO_GOOD: 'Promite ceva prea frumos',
  RF_IMPERSONATION: 'Se dă drept altcineva',
  RF_URGENCY: 'Vă grăbește',
  RF_THREAT: 'Vă sperie',
  RF_EMOTIONAL_PRESSURE: 'Apasă pe sentimente',
  RF_CHANNEL_SWITCH: 'Vă mută pe altă aplicație',
};

export function flagLabel(flag: FlagCode): string {
  return FLAG_LABEL_RO[flag];
}
