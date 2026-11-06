export { generateFallbackCss } from './lib/css';
export {
  buildExport,
  EXPORT_FORMATS,
  type ExportFamily,
  type ExportFile,
  type ExportFont,
  type ExportFormat,
  type ExportInput,
} from './lib/formats';
export {
  type CssAdjustment,
  CssExportError,
  type FallbackCss,
  type FallbackCssInput,
  type FallbackFace,
  type GenericFamily,
} from './lib/model';
export { SELF_HOST_BASE, type SelfHostFont, selfHostFontFaces } from './lib/self-host';
export type { SelfHostArchiveFont } from './lib/self-host-archive';
export { createZip, MAX_ZIP_BYTES, MAX_ZIP_ENTRIES, type ZipEntry, ZipError } from './lib/zip';
export const loadSelfHostArchive = () => import('./lib/self-host-archive');
