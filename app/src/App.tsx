import type { Result } from '@ss/contracts';
import mock from '@ss/contracts/mock-results.json';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

const results = mock as Result[];

function Timeline({ scores, firstAlert }: { scores: number[]; firstAlert: number | null }) {
  return (
    <ol className="mt-3 flex items-end gap-1" aria-label="Evoluția riscului pe mesaje">
      {scores.map((s, i) => {
        // 1-based message number; the message where the app first warned gets a ring.
        const alerted = firstAlert !== null && i + 1 === firstAlert;
        return (
          <li
            key={i}
            className={`w-6 rounded-sm bg-ink/70 ${alerted ? 'ring-2 ring-suspicious' : ''}`}
            style={{ height: `${Math.max(4, s)}px` }}
            title={`Mesaj ${i + 1}: ${s}`}
          />
        );
      })}
    </ol>
  );
}

function WarningCard({ warning }: { warning: Result['warning'] }) {
  return (
    <div className="mt-4 rounded-card bg-bg p-4">
      <p className="text-lg">{warning.ro}</p>
      <p className="mt-2 font-semibold">Ce să faceți: {warning.action}</p>
    </div>
  );
}

function ResultCard({ r }: { r: Result }) {
  const look = VERDICT_LOOK[r.verdict];
  return (
    <li className={`rounded-card border-2 bg-surface p-5 ${look.cls}`}>
      <p className="text-2xl font-semibold">
        <span aria-hidden="true">{look.icon}</span> {look.word}
      </p>
      <p className="mt-1 text-ink">
        {scamTypeLabel(r.scamType)} · Scor {r.score} · Prima alertă:{' '}
        {r.firstAlert ? `mesajul ${r.firstAlert}` : '—'}
      </p>
      <Timeline scores={r.timeline} firstAlert={r.firstAlert} />
      <p className="mt-3 text-ink/80">
        Semnale: {r.hits.map((h) => h.flag).join(', ') || '—'}
      </p>
      <WarningCard warning={r.warning} />
    </li>
  );
}

export function App() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-3xl">Scam Shield</h1>
      <p className="mb-5 text-ink/80">Verificăm mesajele și vă spunem ce să faceți.</p>
      <ul className="flex flex-col gap-5">
        {results.map((r) => (
          <ResultCard key={r.id} r={r} />
        ))}
      </ul>
    </main>
  );
}
