export interface FaceLabelInput {
  weight: number;
  italic: boolean;
  subset?: string | undefined;
}

export interface FaceLabelWords {
  regular: string;
  italic: string;
}

export function faceLabel(face: FaceLabelInput, words: FaceLabelWords): string {
  const style = `${face.weight} ${face.italic ? words.italic : words.regular}`;
  return face.subset ? `${style} · ${face.subset}` : style;
}
