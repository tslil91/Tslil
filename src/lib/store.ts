import type { Item } from "./types";

export interface Store {
  mode: "demo" | "cloud";
  list(): Promise<Item[]>;
  /** Create or update an item. `files` maps attachment id -> file to upload. `prev` is the saved version, to clean up removed files. */
  save(item: Item, files?: Map<string, Blob>, prev?: Item): Promise<Item>;
  remove(item: Item): Promise<void>;
  /** A URL the browser can open/display for a stored file. */
  fileUrl(path: string): Promise<string>;
  /** Called when the data changes elsewhere (the other phone). Returns an unsubscribe function. */
  onChange(cb: () => void): () => void;
}

export function fileExt(name: string, mime?: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  if (m) return m[1].toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime?.startsWith("image/")) return mime.slice(6).replace("jpeg", "jpg");
  return "bin";
}
