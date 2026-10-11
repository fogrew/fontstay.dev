import raw from '../data/blocks.json';

export interface UnicodeBlock {
  name: string;
  start: number;
  end: number;
}

export interface BlockCoverage extends UnicodeBlock {
  covered: number;
  total: number;
}

const blocks: readonly UnicodeBlock[] = (raw.blocks as [number, number, string][]).map(
  ([start, end, name]) => ({ name, start, end }),
);

export function unicodeBlocks(): readonly UnicodeBlock[] {
  return blocks;
}

export function blockCoverage(codePoints: ArrayLike<number>): BlockCoverage[] {
  const result: BlockCoverage[] = [];
  let index = 0;
  for (const block of blocks) {
    while (index < codePoints.length && (codePoints[index] ?? 0) < block.start) index++;
    let covered = 0;
    while (index < codePoints.length && (codePoints[index] ?? 0) <= block.end) {
      covered++;
      index++;
    }
    if (covered > 0) {
      result.push({ ...block, covered, total: block.end - block.start + 1 });
    }
  }
  return result;
}
