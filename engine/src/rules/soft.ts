import type { FlagCode } from '@ss/contracts';
import { clauseAt, firstHit, isDenied, makeHit, perSenderMessage, type MsgCtx, type Rule } from './util';

const re = (parts: string[]): RegExp => new RegExp(parts.join('|'), 'g');
const sender = (flag: FlagCode, rx: RegExp): Rule => (c) => perSenderMessage(c, (m) => firstHit(flag, m, rx));

const URGENCY = re([
  String.raw`\burgent\w*`,
  String.raw`\bimediat\b`,
  String.raw`\bcat mai repede\b`,
  String.raw`\bchiar acum\b`,
  String.raw`\bin (?:\d+|o|un) (?:de )?(?:ore|ora|minute|minut)\b`,
  String.raw`\bpana (?:azi|maine|diseara)\b`,
  String.raw`\bultima (?:sansa|zi|ocazie)\b`,
  String.raw`\btermen\w*`,
  String.raw`\brepede\b`,
  String.raw`\bgrabi\w*`,
  String.raw`\bnu mai (?:astepta|intarzia)\w*`,
  String.raw`\bin cel mai scurt timp\b`,
]);

const TOO_GOOD = re([
  String.raw`\b(?:ati|ai) castigat\b`,
  String.raw`\bfelicitari\b`,
  String.raw`\bcastigator\w*`,
  String.raw`\bpremiu\w*`,
  String.raw`\bvoucher\w*`,
  String.raw`\bgratuit\w*`,
  String.raw`\b(?:profit|randament|castig\w*) garantat\w*`,
  String.raw`\binvestitie sigura\b`,
  String.raw`\boferta (?:unica|exclusiva)\b`,
  String.raw`\bati fost (?:selectat|ales)\w*`,
  String.raw`\bloterie\b|\btombola\b`,
  String.raw`\bmostenire\b`,
  String.raw`\bdublam\b|\bsuma dublata\b`,
  String.raw`\blucr\w+ de acasa\b`,
]);

const THREAT = re([
  String.raw`\b(?:contul|cardul|cont|card)\b[^!?;\n]{0,30}\b(?:blocat\w*|suspendat\w*|inchis\w*|anulat\w*|restrictionat\w*)`,
  String.raw`\bvor fi (?:blocate|suspendate|anulate)\b`,
  String.raw`\bvom (?:bloca|suspenda)\b`,
  String.raw`\bamend\w*`,
  String.raw`\bexecutare silita\b|\bpoprire\w*`,
  String.raw`\bdosar penal\b|\bcercetat\w*|\barest\w*`,
  String.raw`\bveti pierde\b|\bpierdeti\b`,
  String.raw`\bactiune in (?:instanta|justitie)\b|\bdat in judecata\b`,
  String.raw`\bconsecinte\w*`,
  String.raw`\bsanctiun\w*|\bpenalizar\w*`,
]);

const IMPERSONATION = re([
  String.raw`\b(?:sunt|suntem|ma numesc|va (?:suna|contacteaza|scrie|apelez)|va apelam)\b[^!?;\n]{0,50}\b(?:de la|din partea)\s+(?:banc\w*|politi\w*|parchet\w*|anaf|curier\w*|firma|companie\w*|microsoft|dna|dnsc|serviciul|departamentul|institutia)`,
  String.raw`\bdin partea (?:bancii|politiei|anaf|parchetului|companiei|firmei|curierului)\b`,
  String.raw`\b(?:agent|ofiter|procuror|inspector|consilier|reprezentant|angajat|operator|colonel|comisar)\b[^!?;\n]{0,30}\b(?:banc\w*|politi\w*|parchet\w*|anaf|curier\w*|securitate)`,
]);

const EMOTIONAL = re([
  String.raw`\bajuta-?ma\b|\bajutati-?ma\b`,
  String.raw`\bte implor\b`,
  String.raw`\bsunt disperat\w*`,
  String.raw`\bnu am pe nimeni\b`,
  String.raw`\bsunt in necaz\b`,
  String.raw`\bam avut un accident\b`,
  String.raw`\bsunt la spital\b`,
  String.raw`\bsingura (?:speranta|persoana)\b`,
  String.raw`\bte iubesc\b|\biubirea mea\b|\bsufletul meu\b|\bdragostea mea\b`,
]);

const CHANNEL_SWITCH = re([
  String.raw`\b(?:scrie-?mi|scrieti-?mi|contacteaza-?ma|continuam|vorbim|ne auzim|hai)\b[^!?;\n]{0,25}\b(?:pe|la|prin|in)\s+(?:whatsapp|telegram|signal|viber|messenger|privat)\b`,
  String.raw`\badauga-?ma pe (?:whatsapp|telegram|signal)\b`,
  String.raw`\bwa\.me\b|\bt\.me\b`,
  String.raw`\bnumarul meu de (?:whatsapp|telegram)\b`,
]);

const SECRECY = re([
  String.raw`\bnu (?:(?:le|ii|mai) )*(?:spune|spuneti|zice|zici|povesti|povestiti|anunta|anuntati)\w*[^!?;\n]{0,25}\b(?:nimanui|nimeni|nimic)\b`,
  String.raw`\bnu (?:spune|spuneti|zice|zici)\w*[^!?;\n]{0,25}\bnici\b`,
  String.raw`\bramane (?:intre noi|secret)\b`,
  String.raw`\b(?:strict )?(?:secret|confidential)\b`,
  String.raw`\bnu (?:vorbi|vorbiti) cu nimeni\b`,
  String.raw`\bnu (?:sunati|apelati|contactati) (?:la )?(?:banca|politia)\b`,
]);

/**
 * Secrecy is skipped when the clause is about a code/PIN: genuine banks say "nu spuneți nimănui codul".
 * Tradeoff: a scammer who adds "cod" to the clause dodges this 20-pt flag, but the code request itself still scores 35.
 */
const SECURITY_NOUN = /\b(?:cod\w*|otp|pin|parola|cvv)\b/;
const secrecy: Rule = (c) =>
  perSenderMessage(c, (m: MsgCtx) => {
    for (const match of m.norm.matchAll(SECRECY)) {
      const idx = match.index ?? 0;
      if (isDenied(m.norm, idx) || SECURITY_NOUN.test(clauseAt(m.norm, idx))) continue;
      return makeHit('RF_SECRECY', m, idx, match[0].length);
    }
    return null;
  });

export const urgency = sender('RF_URGENCY', URGENCY);
export const tooGood = sender('RF_TOO_GOOD', TOO_GOOD);
export const threat = sender('RF_THREAT', THREAT);
export const impersonation = sender('RF_IMPERSONATION', IMPERSONATION);
export const emotionalPressure = sender('RF_EMOTIONAL_PRESSURE', EMOTIONAL);
export const channelSwitch = sender('RF_CHANNEL_SWITCH', CHANNEL_SWITCH);
export const secrecyRule: Rule = secrecy;
