import { readFileSync } from 'node:fs';
import preact from '@astrojs/preact';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'astro/config';
import { paraglideOptions } from './paraglide.config.mjs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: 'https://fontstay.dev',
  srcDir: './src/app',
  trailingSlash: 'always',
  integrations: [preact()],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "worker-src 'self'",
        "frame-src 'self'",
        "font-src 'self' blob: data:",
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net",
        "img-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ],
    },
  },
  vite: {
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [paraglideVitePlugin(paraglideOptions)],
  },
});
