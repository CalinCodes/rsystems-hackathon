import { perSenderMessage, firstHit, type Rule } from './util';

const APPS = String.raw`\b(?:anydesk|teamviewer|quick ?support|rustdesk|ultraviewer|ammyy|supremo|alpemix|airdroid)\b`;
const ACCESS = String.raw`\bacces(?:ul)? (?:la |de la )?distanta\b|\b(?:control|conectare|conectati-va|conectati va) (?:la |de la )?distanta\b`;
const SCREEN = String.raw`\b(?:partaj|distribui)\w* (?:cu noi )?(?:ecran\w*)\b|\bshare screen\b`;

// An unnamed tool is still remote access when installing it lets the caller in: "instalati aplicatia X ca sa ma conectez".
const INSTALL_TO_CONNECT = String.raw`\b(?:instal|descarc)\w*\b[^.!?\n]{0,70}\b(?:sa ma conectez|sa ne conectam|ma conectez la|sa va (?:pot )?vad ecranul|sa vad ecranul|de la distanta|remote)\b`;
const GRANT = String.raw`\b(?:da|dati|acorda|acordati)-?mi acces\w*\b|\bacordati(?: acces| accesul)\b`;

const RE = new RegExp(`${APPS}|${ACCESS}|${SCREEN}|${INSTALL_TO_CONNECT}|${GRANT}`, 'g');

export const remoteAccess: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_REMOTE_ACCESS', m, RE));
