export default {
  /**
   * @param {string[]} stagedFiles
   */
  "*.{ts,tsx,astro}": (stagedFiles) => {
    const files = stagedFiles.map((file) => `"${file}"`).join(" ");
    return [`eslint --fix ${files}`, "npm run typecheck", `vitest related --run ${files}`];
  },
  "*.{json,css,md}": ["prettier --write"],
};
