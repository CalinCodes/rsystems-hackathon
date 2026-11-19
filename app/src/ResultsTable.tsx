import { uniqueFlags } from './csv';
import type { DossierRow } from './dossier';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

interface ResultsTableProps {
  rows: DossierRow[];
  /** When given, a row opens its detail view. */
  onOpen?: (row: DossierRow) => void;
}

const HEAD = 'px-3 py-3 text-left font-semibold';
const CELL = 'px-3 py-2 align-top';

function VerdictCell({ row }: { row: DossierRow }) {
  if (!row.result) return <span className="font-semibold">✕ Nu pot citi fișierul</span>;
  const look = VERDICT_LOOK[row.result.verdict];
  return (
    <span className={`font-semibold ${look.cls.split(' ')[0]}`}>
      <span aria-hidden="true">{look.icon}</span> {look.short}
    </span>
  );
}

/** Plain compact rows in large type: 17 threads must be readable from a few metres. */
export function ResultsTable({ rows, onOpen }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xl">
        <thead className="border-b-2 border-ink/30">
          <tr>
            {['ID', 'Verdict', 'Tipul', 'Scor', 'Prima alertă', 'Semnale'].map((h) => (
              <th key={h} scope="col" className={HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = row.result;
            return (
              <tr key={row.key} className="border-b border-ink/15">
                <td className={`${CELL} font-semibold`}>
                  {onOpen ? (
                    <button type="button" onClick={() => onOpen(row)} className="min-h-11 underline decoration-2">
                      {row.id}
                    </button>
                  ) : (
                    row.id
                  )}
                </td>
                <td className={CELL}>
                  <VerdictCell row={row} />
                </td>
                <td className={CELL}>{r && r.verdict !== 'SAFE' ? scamTypeLabel(r.scamType) : '—'}</td>
                <td className={`${CELL} tabular-nums`}>{r ? r.score : '—'}</td>
                <td className={`${CELL} tabular-nums`}>{r && r.verdict !== 'SAFE' && r.firstAlert !== null ? r.firstAlert : ''}</td>
                <td className={`${CELL} font-mono text-lg`}>{r ? uniqueFlags(r).join('; ') : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
