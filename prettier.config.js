/** @type {import("prettier").Config} */
const config = {
  printWidth: 120,
  tabWidth: 2,
  plugins: ["prettier-plugin-svelte"],
  trailingComma: "all",
  experimentalTernaries: true,
  quoteProps: "consistent",
  objectWrap: "collapse",
  overrides: [
    {
      files: "*.svelte",
      options: {
        parser: "svelte",
      },
    },
  ],
};

export default config;
