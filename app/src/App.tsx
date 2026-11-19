import type { Result, Verdict } from '@ss/contracts';
import mock from '@ss/contracts/mock-results.json';

const results = mock as Result[];

const LOOK: Record<Verdict, { icon: string; word: string; cls: string }> = {
  SAFE: { icon: '✓', word: 'Sigur', cls: 'text-safe border-safe' },
  SUSPICIOUS: { icon: '⚠', word: 'Suspect', cls: 'text-suspicious border-suspicious' },
  SCAM: { icon: '⛔', word: 'Înșelătorie', cls: 'text-scam border-scam' },
};

function ResultRow({ r }: { r: Result }) {
  const look = LOOK[r.verdict];
  return (
    <li className={`rounded-card border-2 bg-surface p-4 ${look.cls}`}>
      <p className="text-xl font-semibold">
        <span aria-hidden="true">{look.icon}</span> {look.word} · {r.id}
      </p>
      <p className="text-ink">
        Tip: {r.scamType} · Scor: {r.score} · Prima alertă: {r.firstAlert ?? '—'}
      </p>
      <p className="text-ink">Semnale: {r.hits.map((h) => h.flag).join(', ') || '—'}</p>
    </li>
  );
}

export function App() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-3xl">Scam Shield</h1>
      <ul className="flex flex-col gap-4">
        {results.map((r) => (
          <ResultRow key={r.id} r={r} />
        ))}
      </ul>
    </main>
  );
}
