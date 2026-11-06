export interface ShapeOptions {
  variation?: Record<string, number> | undefined;
}

export async function shapedWidthEm(
  bytes: ArrayBuffer | Uint8Array,
  text: string,
  options: ShapeOptions = {},
): Promise<number> {
  const [{ sfntOf }, { Blob, Buffer, Face, Font, Variation, shape }] = await Promise.all([
    import('./sfnt'),
    import('harfbuzzjs'),
  ]);
  const sfnt = sfntOf(bytes);
  if (!sfnt) throw new Error('Cannot extract the font tables for shaping');
  const face = new Face(new Blob(sfnt));
  const font = new Font(face);
  if (options.variation) {
    font.setVariations(
      Object.entries(options.variation).map(([tag, value]) => new Variation(tag, value)),
    );
  }
  const buffer = new Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  shape(font, buffer);
  const glyphs = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  let advance = 0;
  for (const [index, glyph] of glyphs.entries()) {
    if (glyph.codepoint !== 0) advance += positions[index]?.xAdvance ?? 0;
  }
  return advance / face.upem;
}
