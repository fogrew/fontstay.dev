export interface JsonSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: readonly string[] }>;
  required?: readonly string[];
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

export interface FontInfo {
  id: number;
  fileName: string;
  family: string;
  weight: number;
  italic: boolean;
  variable: boolean;
  kind: string;
  scripts: string[];
  glyphs: number;
  selected: boolean;
}

export interface SystemPick {
  system: string;
  share: number;
  fonts: string[];
}

export interface Suggestion {
  font: string;
  kind: string;
  coverage: number;
  picks: SystemPick[];
}

export interface ShiftReport {
  adjusted: { width: number; score: number }[];
  plain: { width: number; score: number }[];
}

export interface ToolHost {
  listFonts: () => FontInfo[];
  selectFont: (id: number) => boolean;
  analyzeFont: (id: number) => Record<string, unknown> | undefined;
  getAudience: () => { query: string; shares: Record<string, number> };
  setAudience: (query: string) => { ok: boolean; message: string };
  suggest: () => Suggestion[];
  setFallbacks: (input: { fontId: number; system: string; fonts: string[] }) => {
    ok: boolean;
    message: string;
  };
  setKind: (fontId: number, kind: string) => boolean;
  getCss: () => string;
  getExport: (format: string) => string | undefined;
  exportFormats: () => readonly string[];
  getShift: () => ShiftReport | undefined;
}
