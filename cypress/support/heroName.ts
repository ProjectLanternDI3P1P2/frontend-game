/** A unique hero name: Player accepts letters, spaces, hyphens and apostrophes only. */
export const heroName = () =>
  "Eto " +
  Array.from({ length: 8 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
