interface TimelineProps {
  scores: number[];
  firstAlert: number | null;
}

/** Risk after each message. The bar where the app first warned gets a ring, so it is not colour-only. */
export function Timeline({ scores, firstAlert }: TimelineProps) {
  return (
    <div>
      <p className="mb-1 font-semibold">Cum a crescut riscul, mesaj cu mesaj</p>
      <ol className="flex items-end gap-2" aria-label="Riscul după fiecare mesaj">
        {scores.map((s, i) => {
          const n = i + 1;
          const alerted = firstAlert === n;
          return (
            <li key={n} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 rounded-sm bg-ink/70 ${alerted ? 'ring-2 ring-suspicious ring-offset-2' : ''}`}
                style={{ height: `${Math.max(4, s)}px` }}
                title={`Mesajul ${n}: risc ${s}`}
              />
              <span className="text-sm">{n}</span>
            </li>
          );
        })}
      </ol>
      {firstAlert !== null && (
        <p className="mt-1 text-sm">Cercul arată mesajul la care am început să vă avertizăm.</p>
      )}
    </div>
  );
}
