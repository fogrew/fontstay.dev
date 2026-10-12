import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const output = fileURLToPath(new URL('../../public/og.png', import.meta.url));
const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;background:#161a19;color:#f1efe8;font-family:Georgia,'Times New Roman',serif}
  main{box-sizing:border-box;height:630px;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
  h1{margin:0;font-size:84px;line-height:1.05;letter-spacing:-1px}
  p{margin:0;font-size:36px;line-height:1.3;color:#b9d8c3;max-width:900px;font-family:system-ui,sans-serif}
  .row{display:flex;gap:24px;font-family:ui-monospace,Consolas,monospace;font-size:26px;color:#c8e6d1}
  .row span{border:2px solid #3b6b4c;border-radius:10px;padding:8px 16px}
  .brand{font-family:system-ui,sans-serif;font-size:30px;color:#8fdca4;font-weight:700}
</style><main><div class="brand">fontstay.dev</div><div><h1>Fallback fonts that match your web font</h1></div>
<p>size-adjust, ascent, descent and line-gap per system, tuned to your audience, with a layout shift estimate.</p>
<div class="row"><span>size-adjust</span><span>ascent-override</span><span>CLS 0.00</span></div></main>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: output });
await browser.close();
console.log(`written ${output}`);
