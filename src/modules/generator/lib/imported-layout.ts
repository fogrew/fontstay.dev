import type { ImportedBlock } from '@/modules/import-receiver';
import type { Block } from '@/modules/layout-shift';

const FLUID = 0.9;

export interface ImportedLayout {
  key: string;
  origin: string;
  blocks: Block[];
}

export function layoutFromImport(
  origin: string,
  blocks: readonly ImportedBlock[],
  key: string,
  viewport = 0,
): ImportedLayout | undefined {
  if (blocks.length === 0) return undefined;
  return {
    key,
    origin,
    blocks: blocks.map(
      (block): Block => ({
        tag: block.tag,
        text: block.text,
        style: {
          fontPx: block.fontPx,
          marginTop: block.marginTop,
          marginBottom: block.marginBottom,
          indent: block.indent,
          padX: block.padX,
          padY: block.padY,
          ...(viewport > 0 && block.width < viewport * FLUID ? { maxWidth: block.width } : {}),
          ...(block.lineHeight === undefined ? {} : { lineHeightEm: block.lineHeight }),
        },
      }),
    ),
  };
}
