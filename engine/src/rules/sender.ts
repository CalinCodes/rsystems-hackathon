import type { Scenario } from '@ss/contracts';
import { extractPhones, normalizeText } from '../normalize';
import { ORGS, isOfficialHost, type Org } from './contact';

type Sender = Scenario['sender'];

export const isPhoneNumber = (address: string | null): boolean =>
  address !== null && /^[+\d\s().-]+$/.test(address) && address.replace(/\D/g, '').length >= 9;

/**
 * Is the sender verifiably this organisation?
 *
 * A display name is free text: anyone can call themselves "MegaShop" next to a private number, so for a PHONE sender
 * only the catalog's own numbers count. Otherwise (alphanumeric id, e-mail) the id or the official domain counts.
 * Caveat: an alphanumeric SMS sender id cannot be verified offline, so a matching one is trusted as the best
 * available signal; messages from it are still judged by their links, numbers and requests.
 */
export function senderIsOrg(s: Sender, org: Org): boolean {
  if (isPhoneNumber(s.address)) {
    const number = extractPhones(s.address ?? '')[0];
    return number !== undefined && org.phones.includes(number);
  }
  const address = s.address ?? '';
  if (org.nameRe.test(normalizeText(`${s.name ?? ''} ${address}`))) return true;
  const domain = address.includes('@') ? address.toLowerCase().slice(address.lastIndexOf('@') + 1) : '';
  return domain !== '' && isOfficialHost(domain, org.site);
}

/** True when the sender is verifiably ANY catalog organisation. */
export const senderIsAnyOrg = (s: Sender): boolean => ORGS.some((o) => senderIsOrg(s, o));
