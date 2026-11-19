import type { PasteInput } from './scenario';

export interface Example {
  label: string;
  input: PasteInput;
}

// Fictional organisations and numbers only (see contracts/catalog.json). These let a visitor try the
// app in one click without pasting private messages.
export const EXAMPLES: Example[] = [
  {
    label: 'Mesaj de la „bancă”',
    input: {
      channel: 'sms',
      knownContact: false,
      text: 'Banca Dunărea: Cardul dvs. a fost blocat. Pentru deblocare accesați în 2 ore: bancadunarea-securizat.example',
    },
  },
  {
    label: '„Mamă, am alt număr”',
    input: {
      channel: 'whatsapp',
      knownContact: false,
      text: [
        'Bună mami, mi-am schimbat numărul.',
        'Eu: Cine ești?',
        'Sunt Andrei. Am o problemă la bancă. Poți să-mi transferi 2.500 lei urgent?',
        'Nu spune nimănui, te rog.',
      ].join('\n\n'),
    },
  },
  {
    label: 'Cod cerut de dumneavoastră',
    input: {
      channel: 'sms',
      knownContact: true,
      text: 'Banca Dunărea: Codul de confirmare este 483920. Nu îl comunicați nimănui.',
    },
  },
];
