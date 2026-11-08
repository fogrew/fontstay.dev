const MAX_GLYPHS = 65535;
const MAX_POINTS = 4_000_000;
const MAX_OUTPUT = 64 * 1024 * 1024;

const ARG_1_AND_2_ARE_WORDS = 0x0001;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;
const WE_HAVE_INSTRUCTIONS = 0x0100;

export class Woff2GlyfError extends Error {}

class Reader {
  pos = 0;
  constructor(readonly bytes: Uint8Array) {}

  u8(): number {
    const value = this.bytes[this.pos];
    if (value === undefined) throw new Woff2GlyfError('Truncated WOFF2 glyf stream');
    this.pos += 1;
    return value;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  i16(): number {
    return (this.u16() << 16) >> 16;
  }

  u255(): number {
    const code = this.u8();
    if (code === 253) return this.u16();
    if (code === 255) return this.u8() + 253;
    if (code === 254) return this.u8() + 506;
    return code;
  }

  take(length: number): Uint8Array {
    if (length < 0 || this.pos + length > this.bytes.length) {
      throw new Woff2GlyfError('Truncated WOFF2 glyf stream');
    }
    const slice = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }
}

interface Point {
  x: number;
  y: number;
  onCurve: boolean;
}

const withSign = (flag: number, value: number) => (flag & 1 ? value : -value);

function readPoints(flags: Reader, glyphs: Reader, count: number): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  for (let index = 0; index < count; index++) {
    const raw = flags.u8();
    const onCurve = (raw & 0x80) === 0;
    const flag = raw & 0x7f;
    let dx: number;
    let dy: number;
    if (flag < 10) {
      dx = 0;
      dy = withSign(flag, ((flag & 14) << 7) + glyphs.u8());
    } else if (flag < 20) {
      dx = withSign(flag, (((flag - 10) & 14) << 7) + glyphs.u8());
      dy = 0;
    } else if (flag < 84) {
      const b0 = flag - 20;
      const b1 = glyphs.u8();
      dx = withSign(flag, 1 + (b0 & 48) + (b1 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0 & 12) << 2) + (b1 & 15));
    } else if (flag < 120) {
      const b0 = flag - 84;
      dx = withSign(flag, 1 + (Math.floor(b0 / 12) << 8) + glyphs.u8());
      dy = withSign(flag >> 1, 1 + ((Math.floor((b0 % 12) / 4) << 8) + glyphs.u8()));
    } else if (flag < 124) {
      const b1 = glyphs.u8();
      const b2 = glyphs.u8();
      dx = withSign(flag, (b1 << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 15) << 8) + glyphs.u8());
    } else {
      dx = withSign(flag, glyphs.u16());
      dy = withSign(flag >> 1, glyphs.u16());
    }
    x += dx;
    y += dy;
    points.push({ x, y, onCurve });
  }
  return points;
}

const int16 = (value: number) => {
  if (value < -32768 || value > 32767) throw new Woff2GlyfError('Coordinate out of range');
  return value;
};

function boxOf(points: Point[]): [number, number, number, number] {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const { x, y } of points) {
    xMin = Math.min(xMin, x);
    yMin = Math.min(yMin, y);
    xMax = Math.max(xMax, x);
    yMax = Math.max(yMax, y);
  }
  return [xMin, yMin, xMax, yMax];
}

function writeSimple(
  numberOfContours: number,
  ends: number[],
  points: Point[],
  box: readonly [number, number, number, number],
  instructions: Uint8Array,
  overlap: boolean,
): Uint8Array {
  const size = 10 + 2 * ends.length + 2 + instructions.length + points.length * 5;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setInt16(0, numberOfContours);
  for (const [index, value] of box.entries()) view.setInt16(2 + 2 * index, int16(value));
  let at = 10;
  for (const end of ends) {
    view.setUint16(at, end);
    at += 2;
  }
  view.setUint16(at, instructions.length);
  at += 2;
  out.set(instructions, at);
  at += instructions.length;
  for (const [index, point] of points.entries()) {
    out[at + index] = (point.onCurve ? 1 : 0) | (overlap && index === 0 ? 0x40 : 0);
  }
  at += points.length;
  let previous = 0;
  for (const point of points) {
    view.setInt16(at, int16(point.x - previous));
    previous = point.x;
    at += 2;
  }
  previous = 0;
  for (const point of points) {
    view.setInt16(at, int16(point.y - previous));
    previous = point.y;
    at += 2;
  }
  return out.subarray(0, at);
}

export interface RebuiltGlyf {
  glyf: Uint8Array;
  loca: Uint8Array;
  xMin: Int16Array;
}

export function rebuildGlyf(table: Uint8Array): RebuiltGlyf {
  const head = new Reader(table);
  head.u16();
  const optionFlags = head.u16();
  const numGlyphs = head.u16();
  head.u16();
  if (numGlyphs > MAX_GLYPHS) throw new Woff2GlyfError('Too many glyphs');
  const sizes: number[] = [];
  for (let index = 0; index < 7; index++) {
    sizes.push(head.u16() * 0x10000 + head.u16());
  }
  const [contourSize, pointSize, flagSize, glyphSize, compositeSize, bboxSize, instructionSize] =
    sizes as [number, number, number, number, number, number, number];
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (head.pos + total > table.length) throw new Woff2GlyfError('Truncated WOFF2 glyf table');
  const contours = new Reader(head.take(contourSize));
  const pointCounts = new Reader(head.take(pointSize));
  const flags = new Reader(head.take(flagSize));
  const glyphs = new Reader(head.take(glyphSize));
  const composites = new Reader(head.take(compositeSize));
  const boxStream = new Reader(head.take(bboxSize));
  const instructions = new Reader(head.take(instructionSize));
  const bitmapLength = 4 * Math.ceil(numGlyphs / 32);
  const bitmap = boxStream.take(bitmapLength);
  const overlapBitmap = optionFlags & 1 ? head.take(Math.ceil(numGlyphs / 8)) : undefined;
  const hasBit = (map: Uint8Array | undefined, index: number) =>
    !!map && ((map[index >> 3] ?? 0) & (0x80 >> (index & 7))) !== 0;

  const parts: Uint8Array[] = [];
  const offsets = new Uint32Array(numGlyphs + 1);
  const xMin = new Int16Array(numGlyphs);
  let used = 0;
  let totalPoints = 0;
  for (let glyph = 0; glyph < numGlyphs; glyph++) {
    offsets[glyph] = used;
    const numberOfContours = contours.i16();
    let bytes: Uint8Array | undefined;
    if (numberOfContours > 0) {
      const ends: number[] = [];
      let count = 0;
      for (let contour = 0; contour < numberOfContours; contour++) {
        const added = pointCounts.u255();
        if (added === 0) throw new Woff2GlyfError('Contour without points');
        count += added;
        if (count > 0xffff) throw new Woff2GlyfError('Too many points in a glyph');
        ends.push(count - 1);
      }
      totalPoints += count;
      if (totalPoints > MAX_POINTS) throw new Woff2GlyfError('Too many points');
      const points = readPoints(flags, glyphs, count);
      const instructionLength = glyphs.u255();
      const code = instructions.take(instructionLength);
      let box: [number, number, number, number];
      if (hasBit(bitmap, glyph)) {
        box = [boxStream.i16(), boxStream.i16(), boxStream.i16(), boxStream.i16()];
      } else {
        box = boxOf(points);
      }
      xMin[glyph] = int16(box[0]);
      bytes = writeSimple(numberOfContours, ends, points, box, code, hasBit(overlapBitmap, glyph));
    } else if (numberOfContours === 0) {
      if (hasBit(bitmap, glyph)) throw new Woff2GlyfError('Empty glyph with a box');
    } else {
      if (!hasBit(bitmap, glyph)) throw new Woff2GlyfError('Composite glyph without a box');
      const box = [boxStream.i16(), boxStream.i16(), boxStream.i16(), boxStream.i16()] as const;
      const start = composites.pos;
      let instructed = false;
      let more = true;
      while (more) {
        const componentFlags = composites.u16();
        composites.u16();
        composites.take(componentFlags & ARG_1_AND_2_ARE_WORDS ? 4 : 2);
        if (componentFlags & WE_HAVE_A_SCALE) composites.take(2);
        else if (componentFlags & WE_HAVE_AN_X_AND_Y_SCALE) composites.take(4);
        else if (componentFlags & WE_HAVE_A_TWO_BY_TWO) composites.take(8);
        instructed ||= (componentFlags & WE_HAVE_INSTRUCTIONS) !== 0;
        more = (componentFlags & MORE_COMPONENTS) !== 0;
      }
      const body = composites.bytes.subarray(start, composites.pos);
      const code = instructed ? instructions.take(glyphs.u255()) : new Uint8Array(0);
      bytes = new Uint8Array(10 + body.length + (instructed ? 2 + code.length : 0));
      const view = new DataView(bytes.buffer);
      view.setInt16(0, numberOfContours);
      for (const [index, value] of box.entries()) view.setInt16(2 + 2 * index, value);
      bytes.set(body, 10);
      if (instructed) {
        view.setUint16(10 + body.length, code.length);
        bytes.set(code, 12 + body.length);
      }
      xMin[glyph] = box[0];
    }
    if (bytes) {
      const padded = (bytes.length + 3) & ~3;
      used += padded;
      if (used > MAX_OUTPUT) throw new Woff2GlyfError('Rebuilt glyf table is too large');
      const out = new Uint8Array(padded);
      out.set(bytes);
      parts.push(out);
    }
  }
  offsets[numGlyphs] = used;
  const glyf = new Uint8Array(used);
  let at = 0;
  for (const part of parts) {
    glyf.set(part, at);
    at += part.length;
  }
  const loca = new Uint8Array(4 * (numGlyphs + 1));
  const locaView = new DataView(loca.buffer);
  for (const [index, offset] of offsets.entries()) locaView.setUint32(4 * index, offset);
  return { glyf, loca, xMin };
}
