import type { Scenario } from '@ss/contracts';
import { normalizeText } from '../normalize';
import { ORGS, isOfficialHost, type Org } from './contact';

type Sender = Scenario['sender'];

export const isPhoneNumber = (address: string | null): boolean =>
  address !== null && /^[+\d\s().-]+$/.test(address) && address.replace(/\D/g, '').length >= 9;

/**
 * The WHOLE address as one national-form number ("+40 800 500 600" -> "0800500600"), or null if it is not exactly one.
 * Not extractPhones()[0]: that would accept "0800 500 600 0721 555 000" as the first number and ignore the rest.
 */
function wholeAddressAsNumber(address: string): string | null {
  const digits = address.replace(/\D/g, '');
  if (address.trim().startsWith('+40')) return digits.startsWith('40') ? `0${digits.slice(2)}` : null;
  if (digits.startsWith('0040')) return `0${digits.slice(4)}`;
  return digits.startsWith('0') ? digits : null;
}

/**
 * Is the sender verifiably this organisation? Only the sender's ADDRESS can vouch, never the display name:
 *  - phone number: exactly one number, and it is one of the catalog's own numbers;
 *  - e-mail: the domain after the last "@" is the official site or a subdomain (display name and local part are free
 *    text: "megashop@evil.xyz" proves nothing);
 *  - anything else is an alphanumeric SMS sender id, which counts when it names the organisation.
 * Caveat: an alphanumeric sender id cannot be verified offline and real SMS ids can be spoofed. It is trusted as the
 * best signal available; the message is still judged by its links, numbers and requests.
 */
export function senderIsOrg(s: Sender, org: Org): boolean {
  const address = s.address;
  if (address === null || address.trim() === '') return false;
  if (isPhoneNumber(address)) {
    const number = wholeAddressAsNumber(address);
    return number !== null && org.phones.includes(number);
  }
  if (address.includes('@')) {
    const domain = address.toLowerCase().slice(address.lastIndexOf('@') + 1);
    return domain !== '' && isOfficialHost(domain, org.site);
  }
  return wholeIdRegex(org).test(normalizeText(address).trim());
}

/**
 * The sender id must BE the organisation's name, not merely contain it: "MegaShop-Premii", "MegaShop 0721 555 000" and
 * "Fake MegaShop" all contain the name and none of them is the shop. Space/case tolerant ("Banca Dunarea", "BANCADUNAREA").
 */
const wholeIdCache = new Map<Org, RegExp>();
function wholeIdRegex(org: Org): RegExp {
  let re = wholeIdCache.get(org);
  if (!re) {
    re = new RegExp(`^${org.nameSrc}$`);
    wholeIdCache.set(org, re);
  }
  return re;
}

