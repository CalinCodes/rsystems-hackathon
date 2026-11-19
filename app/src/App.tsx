import { useState } from 'react';
import { CheckScreen } from './CheckScreen';
import { Dashboard } from './Dashboard';
import { DetailView } from './DetailView';
import type { DossierRow } from './dossier';
import { ErrorBoundary } from './ErrorBoundary';
import { TabBar, type View } from './TabBar';
import type { Lang } from './lang';
import { useDossier } from './useDossier';

export function App() {
  const [lang, setLang] = useState<Lang>('ro');
  const [view, setView] = useState<View>('check');
  const [open, setOpen] = useState<DossierRow | null>(null);
  // The folder state lives here, above every screen, so tabs and the detail view never lose the table.
  const dossier = useDossier();
  const detail = open?.scenario && open.result ? { scenario: open.scenario, result: open.result } : null;
  return (
    <main
      className={`mx-auto flex flex-col gap-10 px-5 py-10 md:px-8 ${view === 'dossier' ? 'max-w-6xl' : 'max-w-2xl'}`}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl">Scam Shield</h1>
        <p className="text-xl text-ink/70">Verificăm mesajele și vă spunem ce să faceți.</p>
      </header>
      <TabBar view={view} onView={setView} />
      <ErrorBoundary>
        <div hidden={view !== 'check'}>
          <CheckScreen lang={lang} onLang={setLang} />
        </div>
        {/* Hidden, not unmounted, while a detail is open: coming back keeps the scroll position. */}
        <div hidden={view !== 'dossier' || detail !== null}>
          <Dashboard dossier={dossier} onOpen={setOpen} />
        </div>
        {view === 'dossier' && detail !== null && (
          <DetailView
            key={open?.key}
            {...detail}
            lang={lang}
            onLang={setLang}
            onBack={() => setOpen(null)}
          />
        )}
      </ErrorBoundary>
    </main>
  );
}
