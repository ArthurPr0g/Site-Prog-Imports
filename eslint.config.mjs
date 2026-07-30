import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// A cor da marca é configurável por loja (ver src/lib/brand.ts): ela vive no
// token --color-accent e nos canais --brand-accent-rgb. Escrever o hexadecimal
// direto no componente fura esse mecanismo — foi assim que a cor acabou cravada
// em 67 lugares de 33 arquivos, e trocar a marca de um cliente virou uma
// caçada. Esta regra existe para a dívida não voltar.
const proibeCorDaMarcaCravada = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/lib/brand.ts"], // é onde o padrão da Prog Imports mora
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/#[Ff]28705|242,\\s*135,\\s*5/]",
        message:
          "Cor da marca cravada. Use a classe accent do Tailwind, var(--color-accent) para cor sólida, ou rgb(var(--brand-accent-rgb) / .X) quando precisar de transparência.",
      },
      {
        selector: "TemplateElement[value.raw=/#[Ff]28705|242,\\s*135,\\s*5/]",
        message:
          "Cor da marca cravada em template string. Use var(--color-accent) ou rgb(var(--brand-accent-rgb) / .X).",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  proibeCorDaMarcaCravada,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff reference bundle, not app source:
    "project/**",
  ]),
]);

export default eslintConfig;
