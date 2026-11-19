import type { Result } from '@ss/contracts';
import { LangSwitch } from './LangSwitch';
import { warningParts, type Lang } from './lang';

interface WarningCardProps {
  warning: Result['warning'];
  lang: Lang;
  onLang: (lang: Lang) => void;
}

export function WarningCard({ warning, lang, onLang }: WarningCardProps) {
  const { body, action } = warningParts(warning, lang);
  return (
    <section className="rounded-card bg-bg p-4" aria-label="Avertisment">
      <div className="mb-3">
        <LangSwitch lang={lang} onChange={onLang} />
      </div>
      <p className="text-xl leading-relaxed">{body}</p>
      {action !== '' && (
        <p className="mt-3 text-xl font-semibold">
          {lang === 'ro' ? 'Ce să faceți' : 'What to do (in Romanian)'}: {action}
        </p>
      )}
    </section>
  );
}
