/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-no-io",
      severity: "error",
      comment:
        "src/core (functional core) must not import node:fs, node:fs/promises, node:child_process, node:net, or anything from src/shell -- see CLAUDE.md Development Paradigm.",
      from: { path: "^src/core" },
      to: {
        path: [
          "^node:fs",
          "^node:fs/promises",
          "^node:child_process",
          "^node:net",
          "^src/shell",
        ],
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
