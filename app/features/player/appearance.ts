/**
 * The catalogue of the hero's sheets (Mana Seed Character Base), and the only file that
 * imports them: every view asks it for a sheet by its codes (slot, style, colour), never by a
 * path, and squads exchange those codes, never a URL or an image.
 *
 * The sheets live in `app/assets/heroes/mana-seed/<slot>/`, under the art's own names:
 * `char_a_{page}_{layer}_{style}_v{NN}.webp`. To add one, drop it in the folder of its slot
 * and list it in `HERO_CATALOGUE`.
 */

/** The hero's layers, from back to front (body, outfit, hair, hat, then what it holds). */
export const HERO_SLOTS = ["body", "outfit", "hair", "hat", "weapon", "shield"] as const;

export type HeroSlot = (typeof HERO_SLOTS)[number];

/**
 * The pages of the art: `p1` stands, walks and runs without a weapon; `pONE1` to `pONE3`
 * fight with a weapon in one hand.
 */
export type HeroPage = "p1" | "pONE1" | "pONE2" | "pONE3";

/** A piece of the art: its style (`humn`, `bob1`, `sw01`…) and its colour (v01, v02…). */
export interface HeroPiece {
  style: string;
  variant: number;
}

/** The art's code of each layer, in the names of its sheets. */
export const HERO_LAYER_CODES: Record<HeroSlot, string> = {
  body: "0bas",
  outfit: "1out",
  hair: "4har",
  hat: "5hat",
  weapon: "6tla",
  shield: "7tlb",
};

/** Styles of a slot, and how many colours each has: v01 to vNN. */
export type HeroStyles = Readonly<Record<string, number>>;

/**
 * Every sheet in the repository, by page and slot. Colours start at v01: v00 is the artist's
 * palette template, never drawn. A page may lack slots: its type keeps the slots it has, so a
 * view that needs all of them only compiles with a complete page.
 */
export const HERO_CATALOGUE = {
  pONE2: {
    body: { humn: 10 },
    outfit: { fstr: 5, pfpn: 5 },
    hair: { bob1: 13, dap1: 13 },
    hat: { pfht: 5, pnty: 5 },
    weapon: { sw01: 5, ax01: 5, mc01: 5 },
    shield: { sh01: 5, sh02: 5, sh03: 5 },
  },
} satisfies Partial<Record<HeroPage, Partial<Record<HeroSlot, HeroStyles>>>>;

/** The sheet of a piece, relative to `app/assets/heroes/mana-seed/`. */
export function heroSheetPath(page: HeroPage, slot: HeroSlot, { style, variant }: HeroPiece): string {
  const colour = String(variant).padStart(2, "0");
  return `${slot}/char_a_${page}_${HERO_LAYER_CODES[slot]}_${style}_v${colour}.webp`;
}

const ROOT = "../../assets/heroes/mana-seed/";

// Bundled by Vite with a hash; a layer's sheet is chosen at run time, so every sheet is listed.
const URLS = import.meta.glob<string>("../../assets/heroes/mana-seed/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** The URL of the sheet of a piece. */
export function heroSheetUrl(page: HeroPage, slot: HeroSlot, piece: HeroPiece): string {
  const path = heroSheetPath(page, slot, piece);
  const url = URLS[ROOT + path];
  if (!url) throw new Error(`Missing hero sheet: ${path}`);
  return url;
}
