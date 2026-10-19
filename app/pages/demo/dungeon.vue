<script setup lang="ts">
/**
 * Every asset the dungeon draws, cut out of its sheet with the very rectangles the
 * explorer uses (`tiles/tileset.ts`, `tiles/sprites.ts`): when a sprite moves in its
 * sheet, this page follows.
 */
import { computed, ref } from "vue";
import atlasVioletSrc from "~/assets/dongeon/atlas-violet.png";
import atlasStoneSrc from "~/assets/dongeon/atlas-stone.png";
import kitVioletSrc from "~/assets/dongeon/kit/kit-violet.png";
import kitStoneSrc from "~/assets/dongeon/kit/kit-stone.png";
import PROPS_SRC from "~/assets/dongeon/props.png";
import OBJECTS_SRC from "~/assets/dongeon/objects.png";
import LIQUIDS_SRC from "~/assets/dongeon/liquids.png";
import MOB_SRC from "~/assets/dongeon/placeholder_mob.png";
import HERO_SRC from "~/assets/heroes/swordsman/hero_swordsman_spritesheet.png";
import heroIdleSrc from "~/assets/heroes/heros/png_spritesheet/hero_16x16_idle_spriteSheet.png";
import heroRpgMakerSrc from "~/assets/heroes/heros/png_spritesheet/hero_16x16_rpgm23k_spritesheet.png";
import DungeonSpriteSwatch from "~/features/dungeon/components/DungeonSpriteSwatch.vue";
import { RIM_KEYS } from "~/features/dungeon/tiles/atlas.generated";
import {
  BOSS,
  ENEMY,
  HERO_SHEET,
  TRAP,
  gateSprite,
  heroSprite,
  itemSprite,
  type AnimatedSprite,
} from "~/features/dungeon/tiles/sprites";
import {
  BANNERS,
  DECALS,
  FACES,
  FENCES,
  FLOORS,
  FLOOR_BLOCKS,
  GRATE,
  LADDER,
  LIQUID,
  LIQUID_BANKS,
  OBSTACLES,
  OPEN_CHESTS,
  PILLARS,
  SHEETS,
  THEMES,
  TOMBS,
  TORCH,
  WALL_DETAILS,
  WALL_FOOT,
  rimSprite,
  type SheetName,
  type SpriteRect,
  type Theme,
} from "~/features/dungeon/tiles/tileset";
import { PanelHeadingLevel } from "~/shared/ui/ui.types";

useHead({ title: "Dungeon assets · UI kit" });

const ATLASES: Record<Theme, string> = { violet: atlasVioletSrc, stone: atlasStoneSrc };
const KITS: Record<Theme, string> = { violet: kitVioletSrc, stone: kitStoneSrc };

const theme = ref<Theme>("violet");
const themeTabs = THEMES.map((id) => ({ id, label: id === "violet" ? "Violet floors" : "Stone floors" }));
const atlas = computed(() => ({ src: ATLASES[theme.value], sheet: SHEETS.atlas }));

/** Image of every sheet but the atlas, which follows the theme. */
const SHEET_SRCS: Record<Exclude<SheetName, "atlas">, string> = {
  props: PROPS_SRC,
  objects: OBJECTS_SRC,
  torch: OBJECTS_SRC,
  water: LIQUIDS_SRC,
  lava: LIQUIDS_SRC,
};

const sheetSrc = (sheet: SheetName) => (sheet === "atlas" ? ATLASES[theme.value] : SHEET_SRCS[sheet]);

// --- Hero and mobs ------------------------------------------------------------------------

/** Every row of the swordsman sheet, through the same window as `heroSprite`. */
const HERO_ROWS = [
  { label: "idle", frames: 6 },
  { label: "run", frames: 8 },
  { label: "walk", frames: 8 },
  { label: "attack", frames: 8 },
  { label: "attack (end)", frames: 2 },
  { label: "hurt", frames: 4 },
  { label: "dash attack", frames: 8 },
].map(({ label, frames }, row) => {
  const window = heroSprite("idle");
  return { label, sprite: { ...window, y: row * window.h, frames, duration: frames * 0.1 } };
});

const MOBS = [
  { label: "enemy", sprite: ENEMY },
  { label: "boss", sprite: BOSS },
];

/** A sheet of `sprites.ts`, by name. */
const ANIMATED_SHEETS: Record<AnimatedSprite["sheet"], { src: string; sheet: { width: number; height: number } }> = {
  hero: { src: HERO_SRC, sheet: HERO_SHEET },
  mob: { src: MOB_SRC, sheet: { width: 32, height: 32 } },
  objects: { src: OBJECTS_SRC, sheet: SHEETS.objects },
};

// --- Walls and floors -----------------------------------------------------------------------

const FACE_GROUPS = (Object.keys(FACES) as (keyof typeof FACES)[]).map((height) => ({
  height,
  sprites: [
    ...FACES[height].plain.map((sprite, i) => ({ label: `plain ${i + 1}`, sprite })),
    ...FACES[height].worn.map((sprite, i) => ({ label: `worn ${i + 1}`, sprite })),
    { label: "left end", sprite: FACES[height].leftEnd },
    { label: "right end", sprite: FACES[height].rightEnd },
  ],
}));

const RIMS = RIM_KEYS.map((key) => ({ key, sprite: rimSprite(key) }));

const FLOOR_TILES = [
  ...FLOORS.plain.map((sprite, i) => ({ label: `plain ${i + 1}`, sprite })),
  ...FLOORS.cracked.map((sprite, i) => ({ label: `cracked ${i + 1}`, sprite })),
  ...Object.entries(FLOOR_BLOCKS).map(([name, sprite]) => ({ label: `${name} block`, sprite })),
  { label: "grate", sprite: GRATE },
];

const STRUCTURES = [
  ...["pillar", "cracked pillar", "short pillar", "broken pillar", "stump"].map((label, i) => ({
    label,
    sprite: PILLARS[i]!,
  })),
  { label: "ladder", sprite: LADDER },
];

const LIQUIDS = (["water", "lava"] as const).map((liquid) => ({
  label: liquid,
  sprite: { x: 0, y: LIQUID.rows[liquid], w: LIQUID.frame, h: LIQUID.frame },
  duration: liquid === "lava" ? 2.1 : 1.2,
}));

// --- Decor ------------------------------------------------------------------------------

const named = (entries: Record<string, SpriteRect | readonly SpriteRect[]>) =>
  Object.entries(entries).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((sprite, i) => ({ label: `${name} ${i + 1}`, sprite }))
      : [{ label: name, sprite: value as SpriteRect }],
  );

const unique = <T extends { sheet: SheetName; sprite: SpriteRect }>(props: readonly T[]) => [
  ...new Map(props.map((prop) => [`${prop.sheet}:${prop.sprite.x},${prop.sprite.y}`, prop])).values(),
];

const OBSTACLE_GROUPS = Object.entries(OBSTACLES).map(([room, props]) => ({ room, props: unique(props) }));

const DECOR_GROUPS = [
  { title: "Banners", sprites: BANNERS.map((sprite, i) => ({ label: `banner ${i + 1}`, sprite })) },
  { title: "Wall details", sprites: named(WALL_DETAILS) },
  { title: "Wall foot", sprites: WALL_FOOT.map((sprite, i) => ({ label: `foot ${i + 1}`, sprite })) },
  { title: "Fences", sprites: named(FENCES) },
  { title: "Floor litter", sprites: named(DECALS) },
];

const OBJECTS = [
  ...[0, 1, 2].map((id) => ({ label: `chest ${id + 1}`, sprite: itemSprite(id) })),
  { label: "spikes", sprite: TRAP },
  ...THEMES.map((t) => ({ label: `${t} gate`, sprite: gateSprite(t) })),
];

const TOMB_SPRITES = named(TOMBS);

// --- Raw sheets ---------------------------------------------------------------------------

const RAW_SHEETS = computed(() => [
  { title: `Atlas (${theme.value})`, src: ATLASES[theme.value], file: `dongeon/atlas-${theme.value}.png` },
  { title: `Room kit (${theme.value})`, src: KITS[theme.value], file: `dongeon/kit/kit-${theme.value}.png` },
  { title: "Props", src: PROPS_SRC, file: "dongeon/props.png" },
  { title: "Objects", src: OBJECTS_SRC, file: "dongeon/objects.png" },
  { title: "Liquids", src: LIQUIDS_SRC, file: "dongeon/liquids.png" },
  { title: "Mob placeholder", src: MOB_SRC, file: "dongeon/placeholder_mob.png" },
  { title: "Swordsman hero", src: HERO_SRC, file: "heroes/swordsman/hero_swordsman_spritesheet.png" },
  { title: "16 x 16 hero, idle", src: heroIdleSrc, file: "heroes/heros/png_spritesheet/hero_16x16_idle_spriteSheet.png" },
  { title: "16 x 16 hero, RPG Maker", src: heroRpgMakerSrc, file: "heroes/heros/png_spritesheet/hero_16x16_rpgm23k_spritesheet.png" },
]);
</script>

<template>
  <div class="demo-page">
    <header>
      <NuxtLink to="/demo">← Component library</NuxtLink>
      <h1>Dungeon assets</h1>
      <p>
        Every sprite the explorer draws, cut out with the same rectangles as the game. Hover a
        sprite for its position in the sheet.
      </p>
    </header>

    <UiTabs v-model="theme" :tabs="themeTabs" label="Floor theme">
      <p class="demo-page__hint">The theme changes the atlas: walls, floors and columns.</p>
    </UiTabs>

    <UiPanel title="Player placeholder" :heading-level="PanelHeadingLevel.TWO">
      <div class="demo-page__grid">
        <DungeonSpriteSwatch
v-for="row in HERO_ROWS" :key="row.label" v-bind="ANIMATED_SHEETS.hero"
          :sprite="row.sprite" :frames="row.sprite.frames" :pitch="row.sprite.pitch" :duration="row.sprite.duration"
          :label="row.label" />
        <DungeonSpriteSwatch
v-bind="ANIMATED_SHEETS.hero" :sprite="heroSprite('run')"
          :frames="heroSprite('run').frames" :pitch="heroSprite('run').pitch" :duration="heroSprite('run').duration"
          flip label="run (west)" />
      </div>
    </UiPanel>

    <UiPanel title="Mobs" :heading-level="PanelHeadingLevel.TWO">
      <p class="demo-page__hint">Every enemy and the boss share the art team's placeholder for now.</p>
      <div class="demo-page__grid">
        <DungeonSpriteSwatch
v-for="mob in MOBS" :key="mob.label" v-bind="ANIMATED_SHEETS[mob.sprite.sheet]"
          :sprite="mob.sprite" :zoom="3 * (mob.sprite.scale ?? 1)" :label="`${mob.label} x${mob.sprite.scale}`" />
      </div>
    </UiPanel>

    <UiPanel title="Walls" :heading-level="PanelHeadingLevel.TWO">
      <section v-for="group in FACE_GROUPS" :key="group.height" class="demo-page__group">
        <h3>Faces · {{ group.height }}</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="face in group.sprites" :key="face.label" v-bind="atlas" :sprite="face.sprite"
            :label="face.label" />
        </div>
      </section>
      <section class="demo-page__group">
        <h3>Wall tops · {{ RIMS.length }} arrangements</h3>
        <p class="demo-page__hint">Keyed by the sides N E S W, then the corners NE SE SW NW.</p>
        <div class="demo-page__grid demo-page__grid--dense">
          <DungeonSpriteSwatch
v-for="rim in RIMS" :key="rim.key" v-bind="atlas" :sprite="rim.sprite" :zoom="2"
            :label="rim.key" />
        </div>
      </section>
    </UiPanel>

    <UiPanel title="Floors & structures" :heading-level="PanelHeadingLevel.TWO">
      <section class="demo-page__group">
        <h3>Floors</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="floor in FLOOR_TILES" :key="floor.label" v-bind="atlas" :sprite="floor.sprite"
            :label="floor.label" />
        </div>
      </section>
      <section class="demo-page__group">
        <h3>Liquids</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="liquid in LIQUIDS" :key="liquid.label" :src="LIQUIDS_SRC" :sheet="SHEETS.water"
            :sprite="liquid.sprite" :frames="LIQUID.frames" :pitch="LIQUID.frame" :duration="liquid.duration"
            :label="liquid.label" />
          <DungeonSpriteSwatch
v-for="(bank, i) in LIQUID_BANKS" :key="`bank-${i}`" v-bind="atlas" :sprite="bank"
            :label="`bank ${i}`" />
        </div>
      </section>
      <section class="demo-page__group">
        <h3>Columns & ladder</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="structure in STRUCTURES" :key="structure.label" v-bind="atlas"
            :sprite="structure.sprite" :label="structure.label" />
        </div>
      </section>
    </UiPanel>

    <UiPanel title="Decor" :heading-level="PanelHeadingLevel.TWO">
      <section v-for="group in DECOR_GROUPS" :key="group.title" class="demo-page__group">
        <h3>{{ group.title }}</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="decor in group.sprites" :key="decor.label" :src="PROPS_SRC" :sheet="SHEETS.props"
            :sprite="decor.sprite" :label="decor.label" />
        </div>
      </section>
      <section class="demo-page__group">
        <h3>Tombs</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="tomb in TOMB_SPRITES" :key="tomb.label" :src="PROPS_SRC" :sheet="SHEETS.props"
            :sprite="tomb.sprite" :label="tomb.label" />
        </div>
      </section>
      <section v-for="group in OBSTACLE_GROUPS" :key="group.room" class="demo-page__group">
        <h3>Obstacles · {{ group.room }} room</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="(prop, i) in group.props" :key="i" :src="sheetSrc(prop.sheet)"
            :sheet="SHEETS[prop.sheet]" :sprite="prop.sprite" />
        </div>
      </section>
      <section class="demo-page__group">
        <h3>Open chests</h3>
        <div class="demo-page__grid">
          <DungeonSpriteSwatch
v-for="(chest, i) in OPEN_CHESTS" :key="i" :src="OBJECTS_SRC" :sheet="SHEETS.objects"
            :sprite="chest.sprite" :label="`open chest ${i + 1}`" />
        </div>
      </section>
    </UiPanel>

    <UiPanel title="Animated objects" :heading-level="PanelHeadingLevel.TWO">
      <div class="demo-page__grid">
        <DungeonSpriteSwatch
:src="OBJECTS_SRC" :sheet="SHEETS.objects" :sprite="TORCH" :frames="5" :pitch="32"
          :duration="0.7" label="torch" />
        <DungeonSpriteSwatch
v-for="object in OBJECTS" :key="object.label" v-bind="ANIMATED_SHEETS[object.sprite.sheet]"
          :sprite="object.sprite" :frames="object.sprite.frames" :pitch="object.sprite.pitch"
          :duration="object.sprite.frames > 1 ? object.sprite.duration : 1" :label="object.label" />
      </div>
    </UiPanel>

    <UiPanel title="Source sheets" :heading-level="PanelHeadingLevel.TWO">
      <div class="demo-page__sheets">
        <figure v-for="sheet in RAW_SHEETS" :key="sheet.file" class="demo-page__sheet">
          <img :src="sheet.src" :alt="sheet.title" loading="lazy" />
          <figcaption>
            <strong>{{ sheet.title }}</strong>
            <code>app/assets/{{ sheet.file }}</code>
          </figcaption>
        </figure>
      </div>
    </UiPanel>
  </div>
</template>

<style scoped lang="scss">
.demo-page {
  display: grid;
  gap: var(--space-5);
}

.demo-page>header {
  display: grid;
  gap: var(--space-2);
}

.demo-page>header p,
.demo-page__hint {
  color: var(--color-text-muted);
}

.demo-page__group {
  display: grid;
  gap: var(--space-3);
}

.demo-page__group+.demo-page__group {
  margin-top: var(--space-5);
}

.demo-page__grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}

.demo-page__grid--dense {
  gap: var(--space-2);
}

.demo-page__sheets {
  display: grid;
  gap: var(--space-4);

  @include bp.from("md") {
    grid-template-columns: repeat(2, 1fr);
  }
}

.demo-page__sheet {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.demo-page__sheet img {
  max-inline-size: 100%;
  border-radius: var(--radius-sm);
  background-color: #2a2433;
  image-rendering: pixelated;
}

.demo-page__sheet figcaption {
  display: grid;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
