/**
 * The catalogue of the hero's sheets (Mana Seed Character Base), and the only file that
 * imports them: every view asks it for a sheet by its codes (slot, style, colour), never by a
 * path, and squads exchange those codes, never a URL or an image.
 *
 * The sheets live in `app/assets/heroes/mana-seed/<slot>/`, under the art's own names:
 * `char_a_{page}_{layer}_{style}_v{NN}.webp`. To add one, drop it in the folder of its slot
 * and list it in `HERO_CATALOGUE`.
 */
import type { HeroClassCode } from "./types";

/** The hero's layers, from back to front (body, outfit, hair, hat, then what it holds). */
export const HERO_SLOTS = [
  "body",
  "outfit",
  "hair",
  "hat",
  "weapon",
  "shield",
] as const;

export type HeroSlot = (typeof HERO_SLOTS)[number];

/**
 * The pages of the art: `p1` stands, walks and runs without a weapon; `pONE1` to `pONE3`
 * fight with a weapon in one hand, `pBOW1` to `pBOW3` with a bow, `pPOL1` to `pPOL3` with a
 * polearm (spear, halberd). The second page of each fighting style holds its idle and move.
 */
export type HeroPage =
  | "p1"
  | "pONE1"
  | "pONE2"
  | "pONE3"
  | "pBOW1"
  | "pBOW2"
  | "pBOW3"
  | "pPOL1"
  | "pPOL2"
  | "pPOL3";

/** A piece of the art: its style (`humn`, `bob1`, `sw01`…) and its colour (v01, v02…). */
export interface HeroPiece {
  style: string;
  variant: number;
}

/**
 * The art's code of each layer, in the names of its sheets. `shield` is the off hand
 * (`7tlb`): a shield with a one-handed weapon, a quiver with a bow.
 */
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
  // Hero creation and the Player screens (portraits, preview): standing and walking, unarmed.
  p1: {
    body: { humn: 10 },
    outfit: { undi: 1 },
    hair: { bob1: 13, dap1: 13 },
    hat: { pfht: 5, pnty: 5 },
  },
  // The dungeon: on guard and moving, by fighting style (`features/dungeon/tiles/hero.ts`).
  pONE2: {
    body: { humn: 10 },
    outfit: { undi: 1, boxr: 1, fstr: 5, pfpn: 5 },
    hair: { bob1: 13, dap1: 13 },
    hat: { pfht: 5, pnty: 5 },
    weapon: { sw01: 5, sw02: 5, ax01: 5, mc01: 5, wand: 4 },
    shield: { sh01: 5, sh02: 5, sh03: 5 },
  },
  pBOW2: {
    body: { humn: 10 },
    outfit: { undi: 1, boxr: 1, fstr: 5, pfpn: 5 },
    hair: { bob1: 13, dap1: 13 },
    hat: { pfht: 5, pnty: 5 },
    weapon: { bo01: 5, bo02: 5, bo03: 5 },
    shield: { qv01: 8 },
  },
  // Held in both hands: no shield.
  pPOL2: {
    body: { humn: 10 },
    outfit: { undi: 1, boxr: 1, fstr: 5, pfpn: 5 },
    hair: { bob1: 13, dap1: 13 },
    hat: { pfht: 5, pnty: 5 },
    weapon: { sp01: 5, sp02: 5, hb01: 5 },
  },
} satisfies Partial<Record<HeroPage, Partial<Record<HeroSlot, HeroStyles>>>>;

/** The sheet of a piece, relative to `app/assets/heroes/mana-seed/`. */
export function heroSheetPath(
  page: HeroPage,
  slot: HeroSlot,
  { style, variant }: HeroPiece,
): string {
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

// ---------------------------------------------------------------------------------------
// Hero customization (Player): the look chosen at creation, as the Player API returns it.
// Every hero starts in underwear; the class is told apart by its headwear only. These
// helpers turn that look into pieces of the catalogue above (page `p1`).
// ---------------------------------------------------------------------------------------

export type HeroHairStyle = "bald" | "bob1" | "dap1";

/**
 * The `appearance` object of the Player API (hero creation, sheet, list). Not to be confused
 * with the dungeon's `HeroAppearance` (`features/dungeon/tiles/hero.ts`), which lists a piece
 * per slot. `hairColor` is null for a bald hero.
 */
export interface HeroAppearance {
  skinTone: number;
  hairStyle: HeroHairStyle;
  hairColor: number | null;
}

export interface AppearanceSwatch {
  value: number;
  /** Representative mid-tone of the sheet, used for the picker swatch. */
  color: string;
  label: string;
}

export interface HairStyleOption {
  value: HeroHairStyle;
  label: string;
}

export const DEFAULT_HERO_APPEARANCE: Readonly<HeroAppearance> = Object.freeze({
  skinTone: 1,
  hairStyle: "bob1",
  hairColor: 1,
});

export const SKIN_TONES: readonly AppearanceSwatch[] = [
  { value: 1, color: "#d08860", label: "Peach" },
  { value: 2, color: "#d08070", label: "Rose" },
  { value: 3, color: "#de864b", label: "Golden" },
  { value: 4, color: "#c88028", label: "Amber" },
  { value: 5, color: "#b56131", label: "Copper" },
  { value: 6, color: "#ab5544", label: "Sienna" },
  { value: 7, color: "#8e321e", label: "Mahogany" },
  { value: 8, color: "#a56d51", label: "Olive" },
  { value: 9, color: "#a36039", label: "Bronze" },
  { value: 10, color: "#7c5834", label: "Umber" },
];

export const HAIR_STYLES: readonly HairStyleOption[] = [
  { value: "bald", label: "Bald" },
  { value: "bob1", label: "Bob" },
  { value: "dap1", label: "Updo" },
];

export const HAIR_COLORS: readonly AppearanceSwatch[] = [
  { value: 1, color: "#a7b5a7", label: "Silver" },
  { value: 2, color: "#b8a080", label: "Ash blond" },
  { value: 3, color: "#d6ae42", label: "Golden" },
  { value: 4, color: "#d58464", label: "Strawberry" },
  { value: 5, color: "#d66129", label: "Copper" },
  { value: 6, color: "#e4917f", label: "Salmon" },
  { value: 7, color: "#8868a0", label: "Violet" },
  { value: 8, color: "#30b8a8", label: "Teal" },
  { value: 9, color: "#5c99c6", label: "Azure" },
  { value: 10, color: "#7e868e", label: "Steel" },
  { value: 11, color: "#725436", label: "Chestnut" },
  { value: 12, color: "#e37baf", label: "Pink" },
  { value: 13, color: "#63778f", label: "Slate" },
];

/** Headwear per class: the warrior goes bare-headed, the shaman wears the farmer hat. */
export const CLASS_HEADWEAR: Readonly<Record<HeroClassCode, HeroPiece | null>> = {
  warrior: null,
  shaman: { style: "pfht", variant: 4 },
  mage: { style: "pnty", variant: 1 },
};

/** The starting outfit of every hero. */
const UNDERWEAR: HeroPiece = { style: "undi", variant: 1 };

/** The page the Player screens draw from. */
const PLAYER_PAGE = "p1" satisfies HeroPage;

export function isHairless(appearance: Pick<HeroAppearance, "hairStyle">): boolean {
  return appearance.hairStyle === "bald";
}

/** Fills gaps (older heroes, older API) so a hero can always be drawn. */
export function resolveAppearance(
  appearance: Partial<HeroAppearance> | null | undefined,
): HeroAppearance {
  const skinTone = SKIN_TONES.some((tone) => tone.value === appearance?.skinTone)
    ? appearance!.skinTone!
    : DEFAULT_HERO_APPEARANCE.skinTone;
  const hairStyle = HAIR_STYLES.some((style) => style.value === appearance?.hairStyle)
    ? appearance!.hairStyle!
    : DEFAULT_HERO_APPEARANCE.hairStyle;
  if (hairStyle === "bald") return { skinTone, hairStyle, hairColor: null };
  const hairColor = HAIR_COLORS.some((color) => color.value === appearance?.hairColor)
    ? appearance!.hairColor!
    : DEFAULT_HERO_APPEARANCE.hairColor;
  return { skinTone, hairStyle, hairColor };
}

/**
 * The pieces of a hero, back to front: body, underwear, then the class headwear, or the hair
 * when bare-headed. Headwear hides the hair: the hair sheets stick out of the farmer hat and
 * the pointy hat (the art's guide: "some hats will require the hair to be removed"). The hair
 * stays chosen and shows whenever the hero is drawn bare-headed.
 */
export function heroLayerPieces(
  classCode: HeroClassCode | null | undefined,
  appearance: Partial<HeroAppearance> | null | undefined,
): { slot: HeroSlot; piece: HeroPiece }[] {
  const resolved = resolveAppearance(appearance);
  const layers: { slot: HeroSlot; piece: HeroPiece }[] = [
    { slot: "body", piece: { style: "humn", variant: resolved.skinTone } },
    { slot: "outfit", piece: UNDERWEAR },
  ];
  const headwear = classCode ? CLASS_HEADWEAR[classCode] : null;
  if (headwear) return [...layers, { slot: "hat", piece: headwear }];
  if (resolved.hairStyle !== "bald" && resolved.hairColor !== null) {
    layers.push({
      slot: "hair",
      piece: { style: resolved.hairStyle, variant: resolved.hairColor },
    });
  }
  return layers;
}

/** Sheet URLs of a hero, back to front (page `p1`). */
export function heroLayerUrls(
  classCode: HeroClassCode | null | undefined,
  appearance: Partial<HeroAppearance> | null | undefined,
): string[] {
  return heroLayerPieces(classCode, appearance).map(({ slot, piece }) =>
    heroSheetUrl(PLAYER_PAGE, slot, piece),
  );
}
