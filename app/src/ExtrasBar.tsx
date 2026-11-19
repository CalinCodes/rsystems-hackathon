import type { Result } from '@ss/contracts';
import { ReadAloudButton } from './ReadAloudButton';
import { TrustedPerson } from './TrustedPerson';

interface ExtrasBarProps {
  result: Result;
}

/**
 * Read-aloud and "call someone you trust", shown under the warning on both screens. The voice is
 * Romanian, so it always reads the Romanian text, whatever language the card shows. The trusted
 * person is offered only when there is something to worry about.
 */
export function ExtrasBar({ result }: ExtrasBarProps) {
  const { ro, action } = result.warning;
  return (
    <div className="flex flex-col gap-4">
      <ReadAloudButton text={`${ro} ${action}`} />
      {result.verdict !== 'SAFE' && <TrustedPerson />}
    </div>
  );
}
