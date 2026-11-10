import type { Download } from './metrics-sources';

const GOOGLE_FONTS = 'bd8f81ddb5c74d5c8897b36ad88b440266245103';
const noto = (path: string): Download => ({
  url: `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS}/ofl/${path}`,
  license: 'OFL-1.1',
});

export interface ScriptSource {
  id: string;
  family: string;
  aliases?: readonly string[];
  files: readonly string[];
  download?: Download;
}

export const SCRIPT_SOURCES: readonly ScriptSource[] = [
  { id: 'segoe-ui', family: 'Segoe UI', files: ['segoeui.ttf'] },
  { id: 'tahoma', family: 'Tahoma', files: ['tahoma.ttf'] },
  { id: 'arial', family: 'Arial', files: ['arial.ttf'] },
  { id: 'nirmala-ui', family: 'Nirmala UI', files: ['Nirmala.ttc'] },
  { id: 'leelawadee-ui', family: 'Leelawadee UI', files: ['LeelawUI.ttf'] },
  { id: 'yu-gothic', family: 'Yu Gothic', files: ['YuGothR.ttc'] },
  { id: 'ms-gothic', family: 'MS Gothic', files: ['msgothic.ttc'] },
  { id: 'malgun-gothic', family: 'Malgun Gothic', files: ['malgun.ttf'] },
  { id: 'microsoft-yahei', family: 'Microsoft YaHei', files: ['msyh.ttc'] },
  { id: 'simsun', family: 'SimSun', files: ['simsun.ttc'] },
  { id: 'microsoft-jhenghei', family: 'Microsoft JhengHei', files: ['msjh.ttc'] },
  {
    id: 'noto-sans-arabic',
    family: 'Noto Sans Arabic',
    files: [],
    download: noto('notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-naskh-arabic',
    family: 'Noto Naskh Arabic',
    files: [],
    download: noto('notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf'),
  },
  {
    id: 'noto-sans-hebrew',
    family: 'Noto Sans Hebrew',
    files: [],
    download: noto('notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-sans-devanagari',
    family: 'Noto Sans Devanagari',
    files: [],
    download: noto('notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-sans-thai',
    family: 'Noto Sans Thai',
    files: [],
    download: noto('notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-sans-bengali',
    family: 'Noto Sans Bengali',
    files: [],
    download: noto('notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-sans-tamil',
    family: 'Noto Sans Tamil',
    files: [],
    download: noto('notosanstamil/NotoSansTamil%5Bwdth%2Cwght%5D.ttf'),
  },
  {
    id: 'noto-sans-jp',
    family: 'Noto Sans JP',
    aliases: ['Noto Sans CJK JP'],
    files: [],
    download: noto('notosansjp/NotoSansJP%5Bwght%5D.ttf'),
  },
  {
    id: 'noto-sans-kr',
    family: 'Noto Sans KR',
    aliases: ['Noto Sans CJK KR'],
    files: [],
    download: noto('notosanskr/NotoSansKR%5Bwght%5D.ttf'),
  },
  {
    id: 'noto-sans-sc',
    family: 'Noto Sans SC',
    aliases: ['Noto Sans CJK SC'],
    files: [],
    download: noto('notosanssc/NotoSansSC%5Bwght%5D.ttf'),
  },
  {
    id: 'noto-sans-tc',
    family: 'Noto Sans TC',
    aliases: ['Noto Sans CJK TC'],
    files: [],
    download: noto('notosanstc/NotoSansTC%5Bwght%5D.ttf'),
  },
];
