import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

const NOUN = String.raw`(?:cvv2?|cvc2?|cnp|pin|numar(?:ul)?\s+(?:de\s+)?card(?:ului)?|date(?:le)?\s+(?:de\s+)?(?:card(?:ului)?|bancare|personale|de\s+autentificare|de\s+acces)|data\s+expirarii|serie(?:a)?(?:\s+si\s+numar(?:ul)?)?\s+(?:de\s+)?(?:buletin|ci)|parola|datele\s+(?:dvs|tale|dumneavoastra)|credentiale\w*)`;
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|dati|furniz\w*|transmit\w*|introdu\w*|completa(?:ti)?|actualiza(?:ti)?|confirma(?:ti)?|verifica(?:ti)?|dezvalui\w*|scrie(?:ti)?)`;

const RE = new RegExp(`${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b`, 'g');

export const dataRequest: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_DATA_REQUEST', m, RE));
