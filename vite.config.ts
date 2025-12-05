import mkcert from "vite-plugin-mkcert";

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [sveltekit(), mkcert()], build: { rollupOptions: { external: ["cssstyle"] } } });
