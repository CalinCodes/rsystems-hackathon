import type { FlagCode } from '@ss/contracts';
import { NOT, clauseAt, firstHit, isDenied, makeHit, perSenderMessage, type MsgCtx, type Rule } from './util';

const re = (parts: string[]): RegExp => new RegExp(parts.join('|'), 'g');
const sender = (flag: FlagCode, rx: RegExp): Rule => (c) => perSenderMessage(c, (m) => firstHit(flag, m, rx));

const URGENCY = re([
  String.raw`\burgent\w*`,
  String.raw`\bimediat\b`,
  String.raw`\bcat mai repede\b`,
  String.raw`\bchiar acum\b|\bacum\b`,
  String.raw`\b(?:azi|astazi)\b`,
  String.raw`\bintr-?o (?:ora|jumatate de ora)\b|\bintr-?un (?:sfert de ora|minut)\b`,
  // "24h", "24 h", "in 24 de ore", "peste 2 ore", "doar 30 min"
  String.raw`\b\d{1,3}\s?h\b`,
  String.raw`\b(?:in|peste|timp de|doar|maxim|sub)\s+(?:\d+|o|un|doua|trei|cinci|zece)\s*(?:de\s+)?(?:h|ore|ora|min|minute|minut|secunde|sec)\b`,
  // deadlines: "pana la 15.03", "pana pe 3 mai", "pana maine", "pana vineri", "pana la ora 18"
  String.raw`\bpana\s+(?:la\s+|pe\s+)?(?:azi|astazi|maine|diseara|dimineata|\d{1,2}\s?[./-]\s?\d{1,2}(?:\s?[./-]\s?\d{2,4})?|(?:\d{1,2}\s+)?(?:ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|nov|dec)\w*|ora\s+\d{1,2}|luni|marti|miercuri|joi|vineri|sambata|duminica)`,
  String.raw`\bultima (?:sansa|zi|ocazie)\b`,
  String.raw`\btermen\w*`,
  String.raw`\bexpir\w*`,
  String.raw`\brepede\b`,
  String.raw`\bgrab[ie]\w*`,
  String.raw`\bnu mai (?:astepta|intarzia)\w*`,
  String.raw`\bin cel mai scurt timp\b`,
]);

const TOO_GOOD = re([
  String.raw`\b(?:ati|ai) castigat\b`,
  String.raw`\bfelicitari\b`,
  String.raw`\bcastigator\w*`,
  String.raw`\bpremiu\w*`,
  String.raw`\bvoucher\w*`,
  // "gratuit"/"gratis" ALONE is not a lure: support and service offers say it. Only a free *prize* is.
  String.raw`\b(?:cadou|premiu|iphone|telefon) (?:gratuit|gratis)\w*|\b(?:gratuit|gratis)\w* (?:cadou|premiu|iphone)`,
  String.raw`\b(?:profit|randament|castig\w*|venit\w*|dobanda)\s+garantat\w*|\bgarantat\w*`,
  String.raw`\binvestitie sigura\b`,
  String.raw`\boferta (?:unica|exclusiva)\b`,
  String.raw`\bati fost (?:selectat|ales)\w*`,
  String.raw`\bloterie\b|\btombola\b`,
  String.raw`\bmostenire\b`,
  String.raw`\bdublam\b|\bsuma dublata\b`,
  String.raw`\blucr\w+ de acasa\b`,
  String.raw`\b(?:job\w*|munca)\b[^.!?\n]{0,25}\bde acasa\b`,
  // "200-400 lei/zi" offered as pay
  String.raw`\b(?:oferim|castig\w*|venit\w*|salariu|primesti|primiti)\b[^.!?\n]{0,40}\d[\d.,\s-]*(?:lei|ron|euro?|€)\s*\/\s*(?:zi|ora)\b`,
  // overpaying buyer: "iti dau 100 lei in plus", "platesc dublu"
  String.raw`\b\d+\s*(?:lei|ron|euro?|€)\s+(?:in plus|peste pret)\b|\bplatesc (?:dublu|mai mult)\b`,
  // Easy money per day/hour ("primiti 150 lei pe zi"). Needs an earn verb: "parcarea costa 10 lei pe ora" is a price.
  String.raw`\b(?:primiti|primesti|castigati|castigi|incasati|incasezi|faceti|faci)\b[^.!?;\n]{0,25}\d[\d.,]*\s*(?:lei|ron|euro?|€)\s+pe\s+(?:zi|ora|saptamana)\b`,
  String.raw`\bvesti (?:bune|minunate|excelente)\b`,
  String.raw`\b(?:va|vor) creste\b`,
  String.raw`\brambursar\w*|\brestituir\w*|\bdespagubir\w*`,
  String.raw`\bveti (?:beneficia|incasa|castiga)\b`,
  // "veti primi" alone is ordinary ("veti primi coletul"); it is a lure only next to money or a benefit.
  String.raw`\bveti primi\b[^.!?;\n]{0,30}\b(?:bani|banii|suma|sume|bonus\w*|premiu\w*|pensi\w*|ajutor\w*|compensat\w*|voucher\w*|cadou\w*|lei|ron|euro?|dolari|€)`,
]);

const THREAT = re([
  String.raw`\b(?:contul|cardul|cont|card|contului|cardului)\b[^!?;\n]{0,30}\b(?:blocat\w*|suspendat\w*|inchis\w*|anulat\w*|restrictionat\w*|dezactivat\w*)`,
  String.raw`\b(?:a fost|este|e|fost|vor fi|va fi|sunt|veti fi)\s+(?:blocat\w*|suspendat\w*|inchis\w*|dezactivat\w*|restrictionat\w*)`,
  String.raw`\b(?:blocarea|suspendarea|inchiderea|dezactivarea)\s+(?:contului|cardului|conturilor)`,
  String.raw`\bvom (?:bloca|suspenda|inchide)\b`,
  String.raw`\bamend\w*`,
  String.raw`\bexecutare silita\b|\bpoprire\w*`,
  String.raw`\bdosar penal\b|\bcercetat\w*|\barest\w*`,
  String.raw`\binchisoare\b|\bpuscarie\b|\bspalare de bani\b`,
  String.raw`\bblocheaz\w*\b[^!?;\n]{0,15}\b(?:cont\w*|card\w*)`,
  // Loss-aversion is not a threat: "ca sa nu pierdeti ocazia" -> NOT skips a verb preceded by "nu".
  String.raw`${NOT}\b(?:veti pierde|vei pierde|pierdeti|pierzi)\b`,
  String.raw`\bactiune in (?:instanta|justitie)\b|\bdat in judecata\b`,
  String.raw`\bconsecinte\w*`,
  String.raw`\bsanctiun\w*|\bpenalizar\w*`,
  // Not inside a web address: "https://malware.com" or "virus-scan.net" is a link, not a scare.
  String.raw`(?<![\w./-])(?:virus\w*|infectat\w*|malware|compromis\w*|hack\w*)(?![\w-]*\.[a-z]{2,})`,
  // "calculatorul dvs. trimite date": "dvs." has a dot, so it is allowed inside the gap; other dots end the sentence.
  String.raw`\b(?:calculator\w*|computer\w*|laptop\w*|dispozitiv\w*|router\w*)\b(?:[^.!?;\n]|dvs\.){0,25}\b(?:trimite|transmite|infectat|compromis|atacat|piratat|hackuit)\w*`,
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
  String.raw`\bmi-?e (?:rusine|frica|teama)\b|\bsunt (?:speriat|panicat)\w*`,
  String.raw`\bdoar tu (?:ma )?(?:poti|puteti) ajuta\b`,
  String.raw`\bte iubesc\b|\biubirea mea\b|\bsufletul meu\b|\bdragostea mea\b`,
]);

const CHANNEL_SWITCH = re([
  String.raw`\b(?:scrie-?mi|scrieti-?mi|contacteaza-?ma|continuam|vorbim|ne auzim|hai)\b[^!?;\n]{0,25}\b(?:pe|la|prin|in)\s+(?:whatsapp|telegram|signal|viber|messenger|privat)\b`,
  String.raw`\badauga-?ma pe (?:whatsapp|telegram|signal)\b`,
  // "va adaug intr-un grup pe Telegram", "hai pe tg"
  String.raw`\b(?:va|te) (?:adaug|adaugam|invit|invitam)\b[^!?;\n]{0,30}\b(?:whatsapp|telegram|signal|viber)\b`,
  String.raw`\b(?:hai|vorbim|scrie-?mi)\s+pe\s+(?:tg|wa|wapp)\b`,
  String.raw`\bwa\.me\b|\bt\.me\b`,
  String.raw`\bnumarul meu de (?:whatsapp|telegram)\b`,
]);

const SECRECY = re([
  // "nu spune nimanui", "nu-i spune lui Mihai", "nu zice la nimeni", "nu le arata familiei"
  String.raw`\bnu(?:-(?:i|le|ti|mi|ne|va))?\s+(?:(?:le|ii|i|il|o|mai)\s+)*(?:spune|spuneti|zice|zici|zic|povesti|povestiti|anunta|anuntati|arata|dezvalui)\w*[^!?;\n]{0,30}\b(?:nimanui|nimeni|nimic|lui|ei|lor|familiei|sotului|sotiei|parintilor|copiilor)\b`,
  String.raw`\bnu(?:-(?:i|le|ti|mi|ne|va))?\s+(?:(?:le|ii|i|il|o|mai)\s+)*(?:spune|spuneti|zice|zici)\w*[^!?;\n]{0,25}\bnici\b`,
  // "sa ramana intre noi", "pastram intre noi", "pastreaza secretul"
  String.raw`\b(?:ram\w*|past\w*|ascund\w*)\b[^!?;\n]{0,15}\bintre noi\b`,
  String.raw`\b(?:past|ascund)\w*\b[^!?;\n]{0,15}\bsecret\w*`,
  String.raw`\b(?:strict )?(?:secret|confidential)\b`,
  String.raw`\bnu (?:vorbi|vorbiti) cu nimeni\b`,
  String.raw`\bnu (?:aveti|ai) voie sa (?:spune|vorbi|povesti|anunta|merge|suna)\w*`,
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
export const emotionalPressure = sender('RF_EMOTIONAL_PRESSURE', EMOTIONAL);
export const channelSwitch = sender('RF_CHANNEL_SWITCH', CHANNEL_SWITCH);
export const secrecyRule: Rule = secrecy;
