import { type Locale, messagesFor } from '@/common/i18n';
import { Icon } from '@/common/ui';
import { downloadFont, loadCatalog } from '../lib/google';
import { type FontSource, SourcePicker } from './SourcePicker';

const CATEGORIES = ['Sans Serif', 'Serif', 'Monospace', 'Display', 'Handwriting'];

export function GoogleFontsPicker(props: {
  locale: Locale;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const t = messagesFor(props.locale);
  const source: FontSource = {
    id: 'google',
    icon: <Icon name="googlefonts" />,
    heading: t.google_heading(),
    note: t.google_note(),
    listLabel: t.google_list_label(),
    categories: CATEGORIES,
    loadCatalog,
    download: (family, style, subset) => downloadFont(family.name, style, subset),
  };
  return <SourcePicker {...props} source={source} />;
}
