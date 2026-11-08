import type { GlyphRequest, GlyphResponse } from './glyph-model';
import { readGlyphOutline, readGlyphTable } from './glyphs';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GlyphRequest>) => void) | null;
  postMessage: (message: GlyphResponse, transfer?: Transferable[]) => void;
};

scope.onmessage = ({ data }) => {
  try {
    if (!(data?.buffer instanceof ArrayBuffer)) throw new Error('invalid request');
    if (data.kind === 'outline') {
      scope.postMessage({
        ok: true,
        kind: 'outline',
        path: readGlyphOutline(data.buffer, data.glyph),
      });
      return;
    }
    const table = readGlyphTable(data.buffer);
    scope.postMessage({ ok: true, kind: 'table', table }, [
      table.advances.buffer,
      table.bounds.buffer,
      table.flags.buffer,
    ]);
  } catch {
    scope.postMessage({ ok: false });
  }
};
