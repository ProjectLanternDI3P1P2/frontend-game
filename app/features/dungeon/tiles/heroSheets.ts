/**
 * The URLs of the hero's sheets, bundled by Vite: a layer's image is chosen at run time,
 * so it cannot be written in the stylesheet like the other sheets.
 */
const ROOT = "../../../assets/heroes/mana-seed/";

const URLS = import.meta.glob<string>("../../../assets/heroes/mana-seed/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** The URL of a sheet given by `heroSheetPath`. */
export function heroSheetUrl(path: string): string {
  const url = URLS[ROOT + path];
  if (!url) throw new Error(`Missing hero sheet: ${path}`);
  return url;
}
