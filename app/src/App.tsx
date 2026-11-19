import { useState } from 'react';
import { CheckScreen } from './CheckScreen';
import { Dashboard } from './Dashboard';
import { ErrorBoundary } from './ErrorBoundary';
import { TabBar, type View } from './TabBar';
import type { Lang } from './lang';
import { useDossier } from './useDossier';

export function App() {
  const [lang, setLang] = useState<Lang>('ro');
  const [view, setView] = useState<View>('check');
  // The folder state lives here, above both screens, so switching tabs never loses the table.
  const dossier = useDossier();
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
        <div hidden={view !== 'dossier'}>
          <Dashboard dossier={dossier} />
        </div>
      </ErrorBoundary>
    </main>
  );
}
