import { useState } from 'react';
import { browserStorage, clearTrusted, readTrusted, saveTrusted, telHref, type TrustedPerson as Person } from './trusted';

const BUTTON = 'min-h-14 rounded-card border-2 px-5 text-xl font-semibold';
const FIELD = 'min-h-14 rounded-card border-2 border-ink/30 bg-surface px-4 font-normal';

/** Call someone you trust. The first use asks for a name and number, kept only on this computer. */
export function TrustedPerson() {
  const [person, setPerson] = useState<Person | null>(() => readTrusted(browserStorage()));
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bad, setBad] = useState(false);

  if (person !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a href={telHref(person.phone)} className={`${BUTTON} flex items-center border-ink bg-ink text-surface`}>
          <span aria-hidden="true">📞</span>&nbsp;Sunați pe {person.name}
        </a>
        <button
          type="button"
          onClick={() => {
            clearTrusted(browserStorage());
            setPerson(null);
          }}
          className={`${BUTTON} border-ink/30 bg-surface`}
        >
          Șterge persoana
        </button>
      </div>
    );
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${BUTTON} self-start border-ink/30 bg-surface`}>
        <span aria-hidden="true">📞</span> Sunați pe cineva de încredere
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const ok = saveTrusted(browserStorage(), name, phone);
        setBad(!ok);
        if (ok) setPerson(readTrusted(browserStorage()));
      }}
    >
      <label className="flex flex-col gap-1 font-semibold">
        Numele persoanei
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Numărul de telefon
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="off" className={FIELD} />
      </label>
      <p className="text-ink/70">Rămâne doar pe acest calculator. Îl puteți șterge oricând.</p>
      {bad && <p role="alert" className="font-semibold text-scam">Scrieți un nume și un număr de telefon valid.</p>}
      <div className="flex gap-3">
        <button type="submit" className={`${BUTTON} border-ink bg-ink text-surface`}>Salvează</button>
        <button type="button" onClick={() => setAsking(false)} className={`${BUTTON} border-ink/30 bg-surface`}>Renunț</button>
      </div>
    </form>
  );
}
