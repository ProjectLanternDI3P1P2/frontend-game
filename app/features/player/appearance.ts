/**
 * Hero appearance (hero customization) built on the Mana Seed character base.
 *
 * A hero is drawn by stacking pre-colored 512×512 sheets (8×8 frames of 64 px), from back to
 * front: body (skin tone) → underwear → hair or class headwear. Every hero starts the dungeon in
 * underwear; the class is only told apart by its headwear. Variant `v00` (the asset's base
 * ramp) is never offered.
 */
import type { HeroClassCode } from "./types";

export type HeroHairStyle = "bald" | "bob1" | "dap1";

/** Mirrors the `appearance` object of the Player API. `hairColor` is null for a bald hero. */
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

/** Headwear sheet per class: the warrior goes bare-headed. */
export const CLASS_HEADWEAR: Readonly<Record<HeroClassCode, string | null>> = {
  warrior: null,
  shaman: "5hat_pfht_v04",
  mage: "5hat_pnty_v01",
};

const UNDERWEAR = "1out_undi_v01";

const sheets = import.meta.glob<string>("../../assets/heroes/mana-seed/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

function sheetUrl(layer: string): string | null {
  const suffix = `char_a_p1_${layer}.webp`;
  const key = Object.keys(sheets).find((path) => path.endsWith(suffix));
  return key ? (sheets[key] ?? null) : null;
}

const pad = (value: number) => String(value).padStart(2, "0");

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

/** Sheet layer names, back to front. */
export function heroLayerNames(
  classCode: HeroClassCode | null | undefined,
  appearance: Partial<HeroAppearance> | null | undefined,
): string[] {
  const resolved = resolveAppearance(appearance);
  const layers = [`0bas_humn_v${pad(resolved.skinTone)}`, UNDERWEAR];
  const headwear = classCode ? CLASS_HEADWEAR[classCode] : null;
  // Headwear hides the hair: the hair sheets stick out of the farmer hat and the pointy hat
  // (the art's guide: "some hats will require the hair to be removed"). The hair stays
  // chosen and shows whenever the hero is drawn bare-headed.
  if (headwear) return [...layers, headwear];
  if (resolved.hairStyle !== "bald" && resolved.hairColor !== null) {
    layers.push(`4har_${resolved.hairStyle}_v${pad(resolved.hairColor)}`);
  }
  return layers;
}

/** Sheet URLs, back to front. Missing sheets are skipped rather than drawn broken. */
export function heroLayerUrls(
  classCode: HeroClassCode | null | undefined,
  appearance: Partial<HeroAppearance> | null | undefined,
): string[] {
  return heroLayerNames(classCode, appearance)
    .map(sheetUrl)
    .filter((url): url is string => url !== null);
}
