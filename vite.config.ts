import { defineConfig } from "vitest/config";

export default defineConfig({
	base: "./",
	test: {
		// svg2pdf.js déclare un build UMD que Node charge mal : on le fait passer par Vite (build ES).
		server: { deps: { inline: ["svg2pdf.js"] } },
	},
});
