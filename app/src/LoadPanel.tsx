import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { filesFromDrop } from './dropFiles';

interface LoadPanelProps {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

// React's input typings do not know "webkitdirectory", so it is added as a plain attribute.
const FOLDER_ATTR = { webkitdirectory: '' };

/** Loads a folder by button or by dropping files or a folder. Files are read in memory only. */
export function LoadPanel({ disabled, onFiles }: LoadPanelProps) {
  const folder = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length > 0) onFiles(files);
  }

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = await filesFromDrop(e.dataTransfer);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center gap-4 rounded-card border-2 border-dashed p-8 text-center ${
        over ? 'border-ink bg-bg' : 'border-ink/30 bg-surface'
      }`}
    >
      <input
        ref={folder}
        type="file"
        multiple
        {...FOLDER_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => folder.current?.click()}
        className="min-h-16 rounded-card bg-ink px-8 text-2xl font-semibold text-surface shadow-soft disabled:opacity-50"
      >
        Încarcă dosarul
      </button>
      <p className="text-ink/70">sau trageți aici fișierele .json sau întregul dosar</p>
    </div>
  );
}
