import { downloadCsv, toCsv } from './csv';
import type { DossierRow } from './dossier';
import type { DossierState } from './useDossier';
import { LoadPanel } from './LoadPanel';
import { ResultsTable } from './ResultsTable';
import { SummaryBar } from './SummaryBar';

interface DashboardProps {
  dossier: DossierState;
  onOpen?: (row: DossierRow) => void;
}

export function Dashboard({ dossier, onOpen }: DashboardProps) {
  const { rows, progress, touched, loading, load } = dossier;
  const results = rows.flatMap((r) => (r.result ? [r.result] : []));
  return (
    <div className="flex flex-col gap-8">
      <LoadPanel disabled={loading} onFiles={load} />
      {touched && rows.length === 0 && !loading && (
        <p role="status" className="text-xl font-semibold">
          Nu am găsit fișiere .json în ce ați ales.
        </p>
      )}
      {touched && rows.length > 0 && (
        <>
          <SummaryBar rows={rows} progress={progress} />
          <ResultsTable rows={rows} onOpen={onOpen} />
          <button
            type="button"
            disabled={loading || results.length === 0}
            onClick={() => downloadCsv(toCsv(results), 'rezultate.csv')}
            className="min-h-14 self-start rounded-card border-2 border-ink px-6 text-xl font-semibold disabled:opacity-50"
          >
            Exportă CSV
          </button>
        </>
      )}
    </div>
  );
}
