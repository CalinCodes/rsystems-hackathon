import { perSenderMessage, firstHit, type Rule } from './util';

const APPS = String.raw`\b(?:anydesk|teamviewer|quick ?support|rustdesk|ultraviewer|ammyy|supremo|alpemix|airdroid)\b`;
const ACCESS = String.raw`\bacces(?:ul)? (?:la |de la )?distanta\b|\b(?:control|conectare|conectati-va|conectati va) (?:la |de la )?distanta\b`;
const SCREEN = String.raw`\b(?:partaj|distribui)\w* (?:cu noi )?(?:ecran\w*)\b|\bshare screen\b`;

const RE = new RegExp(`${APPS}|${ACCESS}|${SCREEN}`, 'g');

export const remoteAccess: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_REMOTE_ACCESS', m, RE));
