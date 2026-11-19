export type View = 'check' | 'dossier';

interface TabBarProps {
  view: View;
  onView: (view: View) => void;
}

const TABS: { id: View; label: string }[] = [
  { id: 'check', label: 'Verifică un mesaj' },
  { id: 'dossier', label: 'Verifică un dosar' },
];

export function TabBar({ view, onView }: TabBarProps) {
  return (
    <nav aria-label="Secțiuni" className="flex flex-wrap gap-3">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={view === t.id ? 'page' : undefined}
          onClick={() => onView(t.id)}
          className={`min-h-14 rounded-card border-2 px-6 text-xl font-semibold ${
            view === t.id ? 'border-ink bg-ink text-surface' : 'border-ink/30 bg-surface'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
