import { useState } from 'react';
import { CheckScreen } from './CheckScreen';
import { ErrorBoundary } from './ErrorBoundary';
import type { Lang } from './lang';

export function App() {
  const [lang, setLang] = useState<Lang>('ro');
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-5 py-10 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl">Scam Shield</h1>
        <p className="text-xl text-ink/70">Verificăm mesajele și vă spunem ce să faceți.</p>
      </header>
      <ErrorBoundary>
        <CheckScreen lang={lang} onLang={setLang} />
      </ErrorBoundary>
    </main>
  );
}
