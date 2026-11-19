import type { Result } from '@ss/contracts';
import { LangSwitch } from './LangSwitch';
import { warningParts, type Lang } from './lang';

interface WarningCardProps {
  warning: Result['warning'];
  lang: Lang;
  onLang: (lang: Lang) => void;
}

/** The hero of the result: the warning in large type, the one thing to do set apart below it. */
export function WarningCard({ warning, lang, onLang }: WarningCardProps) {
  const { body, action } = warningParts(warning, lang);
  return (
    <section className="flex flex-col gap-5" aria-label="Avertisment">
      <p className="font-heading text-2xl leading-relaxed text-ink md:text-3xl">{body}</p>
      {action !== '' && (
        <p className="rounded-card border-l-8 border-current bg-bg p-5 text-xl font-semibold text-ink">
          {lang === 'ro' ? 'Ce să faceți' : 'What to do (in Romanian)'}: {action}
        </p>
      )}
      <LangSwitch lang={lang} onChange={onLang} />
    </section>
  );
}
