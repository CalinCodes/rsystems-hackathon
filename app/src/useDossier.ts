import { useCallback, useMemo, useRef, useState } from 'react';
import { compareRows, isJsonFile, loadDossier, type DossierRow, type Progress } from './dossier';
import { useAnalyze } from './useAnalyze';

export interface DossierState {
  rows: DossierRow[];
  progress: Progress;
  /** True once something was loaded, so "no .json files" can be told apart from "nothing yet". */
  touched: boolean;
  loading: boolean;
  load: (files: File[]) => Promise<void>;
}

/** The dashboard's state. It lives above the screens so going to a detail view and back keeps the table. */
export function useDossier(): DossierState {
  const { run } = useAnalyze();
  const [rows, setRows] = useState<DossierRow[]>([]);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 });
  const [touched, setTouched] = useState(false);
  const current = useRef(0);

  const load = useCallback(
    async (files: File[]) => {
      // A newer load replaces an older one: the old run stops and its rows are dropped.
      const mine = ++current.current;
      setRows([]);
      setTouched(true);
      setProgress({ done: 0, total: files.filter(isJsonFile).length });
      await loadDossier(
        files,
        run,
        (row, p) => {
          setRows((all) => [...all, row]);
          setProgress(p);
        },
        () => current.current !== mine,
      );
    },
    [run],
  );

  const sorted = useMemo(() => [...rows].sort(compareRows), [rows]);
  return { rows: sorted, progress, touched, loading: progress.done < progress.total, load };
}
