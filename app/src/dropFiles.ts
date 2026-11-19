async function filesOf(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = entry as FileSystemFileEntry;
    return [await new Promise<File>((resolve, reject) => file.file(resolve, reject))];
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // readEntries returns the folder in batches and signals the end with an empty one.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    children.push(...batch);
  }
  return (await Promise.all(children.map(filesOf))).flat();
}

/**
 * Files from a drop, including whole folders. The entries must be taken before the first await:
 * the browser empties the DataTransfer as soon as the drop handler returns.
 */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of dt.items) {
    const entry = item.kind === 'file' ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) return [...dt.files];
  return (await Promise.all(entries.map(filesOf))).flat();
}
