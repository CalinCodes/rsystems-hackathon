import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

const NOUN = String.raw`(?:cvv2?|cvc2?|cnp|pin|numar(?:ul)?\s+(?:de\s+)?(?:card(?:ului)?|cont(?:ului)?)|date(?:le)?\s+(?:de\s+)?(?:card(?:ului)?|bancare|personale|de\s+autentificare|de\s+acces|de\s+identificare|de\s+logare|contului)|data\s+expirarii|serie(?:a)?(?:\s+si\s+numar(?:ul)?)?\s+(?:de\s+)?(?:buletin|ci)|parola|datele\s+(?:dvs|tale|dumneavoastra)|credentiale\w*)`;
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|dati|furniz\w*|transmit\w*|introdu\w*|completa(?:ti)?|actualiza(?:ti)?|confirma(?:ti)?|verifica(?:ti)?|dezvalui\w*|scrie(?:ti)?)`;

/**
 * Asking the reader to log in to THEIR bank account is a data request ("intrati in contul de banca",
 * "logati-va in aplicatia bancii"). The bank word is deliberately the GENERIC one: "banca dunarea" or
 * "bancadunarea.ro" (a catalog organisation's own name/site) does not count, or a genuine "vedeti pe bancadunarea.ro"
 * would be flagged.
 */
const ACCESS_VERB = String.raw`(?:intrati|intra|logati(?:-va)?|conectati(?:-va)?|autentificati(?:-va)?|accesati|deschideti)`;
const BANK_ACCOUNT = String.raw`${NOT}\b${ACCESS_VERB}\b[^!?;\n]{0,20}\b(?:contul|cont|contului|aplicatia|aplicatiei)\b[^!?;\n]{0,15}\bbanc(?:a|ii|ar\w*)\b(?!\s*dunarea)`;

const RE = new RegExp(`${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b|${BANK_ACCOUNT}`, 'g');

export const dataRequest: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_DATA_REQUEST', m, RE));
