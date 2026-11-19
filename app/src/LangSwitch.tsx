import { LANG_LABEL, type Lang } from './lang';

interface LangSwitchProps {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

const LANGS: Lang[] = ['ro', 'en'];

export function LangSwitch({ lang, onChange }: LangSwitchProps) {
  return (
    <div role="group" aria-label="Limba avertismentului" className="inline-flex gap-2">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`min-h-12 rounded-card border-2 px-4 font-semibold ${
            lang === l ? 'border-ink bg-ink text-surface' : 'border-ink/30 bg-surface'
          }`}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
