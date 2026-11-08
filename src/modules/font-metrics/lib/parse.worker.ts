import type { GlyphRequest, GlyphResponse } from './glyph-model';
import { readGlyphOutline, readGlyphTable } from './glyphs';
import { FontParseError, type FontParseResult } from './model';
import { parseFontBuffer } from './parse';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ArrayBuffer | GlyphRequest>) => void) | null;
  postMessage: (message: FontParseResult | GlyphResponse, transfer?: Transferable[]) => void;
};

function answerGlyphRequest(data: GlyphRequest) {
  try {
    if (!(data.buffer instanceof ArrayBuffer)) throw new FontParseError('invalid-font');
    if (data.kind === 'outline') {
      const path = readGlyphOutline(data.buffer, data.glyph);
      scope.postMessage({ ok: true, kind: 'outline', path });
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
}

scope.onmessage = ({ data }) => {
  try {
    if (data !== null && typeof data === 'object' && 'kind' in data) {
      answerGlyphRequest(data);
      return;
    }
    if (!(data instanceof ArrayBuffer)) throw new FontParseError('invalid-font');
    const font = parseFontBuffer(data);
    scope.postMessage({ ok: true, font }, [font.codePoints.buffer, font.advances.buffer]);
  } catch (error) {
    scope.postMessage({
      ok: false,
      error: { code: error instanceof FontParseError ? error.code : 'invalid-font' },
    });
  }
};
