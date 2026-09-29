// ADR-FE-015 — `eslint-plugin-vuejs-accessibility` is the automated part of the
// accessibility acceptance criteria. Manual keyboard testing is the other part
// and cannot be replaced by this file.
import vuejsAccessibility from "eslint-plugin-vuejs-accessibility";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(...vuejsAccessibility.configs["flat/recommended"], {
  rules: {
    // Pages and layouts are named by their route, not by a compound noun.
    "vue/multi-word-component-names": "off",

    // Prettier serializes Vue void elements as `<input />` and `<img />`.
    // Keep ESLint aligned so formatting never creates lint warnings.
    "vue/html-self-closing": [
      "error",
      {
        html: { void: "always", normal: "always", component: "always" },
        svg: "always",
        math: "always",
      },
    ],

    // A `<label for>` pointing at a matching `id` is a correct association.
    // The rule's default also demands nesting, which would force us to wrap
    // every control in its label for no accessibility gain.
    "vuejs-accessibility/label-has-for": [
      "error",
      { required: { some: ["nesting", "id"] }, allowChildren: false },
    ],

    // We keep `role="list"` on every `<ul>` even though it is redundant per
    // spec. ADR-FE-010 styles lists with `list-style: none`, and Safari with
    // VoiceOver drops list semantics from an unstyled-marker list — the
    // explicit role is what keeps "list, 5 items" announced. This is a
    // deliberate, documented deviation, not an oversight.
    "vuejs-accessibility/no-redundant-roles": "off",
  },
});
