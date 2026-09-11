import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    /**
     * **30 s, e o número veio de um caso medido — não de cautela.**
     *
     * A suite rodou no default de 5 s por 27 arquivos. O 28º
     * (`linha-do-tempo-da-reserva`, SPEC-032) derrubou **quatro** casos em
     * quatro arquivos diferentes, todos por *timeout* — e **nenhum deles era
     * lento**: cada arquivo aqui monta um jsdom inteiro, e o custo é de
     * contenção entre workers.
     *
     * Medido antes de mexer: com 27 arquivos, `vitest run` verde (238 casos);
     * com 28, quatro vermelhos; com este teto, verde de novo.
     *
     * 30 s é folga para a contenção **sem esconder travamento de verdade** —
     * um caso que passe disso está pendurado, não ocupado. É o mesmo número, e
     * a mesma razão, do `testTimeout` do `test/jest-e2e.json` no `back`.
     */
    testTimeout: 30_000,
  },
});
