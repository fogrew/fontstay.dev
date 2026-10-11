import preact from '@astrojs/preact';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'astro/config';
import { paraglideOptions } from './paraglide.config.mjs';

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
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ],
    },
  },
  vite: {
    plugins: [paraglideVitePlugin(paraglideOptions)],
  },
});
