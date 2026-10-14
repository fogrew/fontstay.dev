import { type Locale, messagesFor } from '@/common/i18n';
import { Icon } from '@/common/ui';
import { downloadFont, loadCatalog } from '../lib/fontsource';
import { type FontSource, SourcePicker } from './SourcePicker';

const CATEGORIES = ['Sans Serif', 'Serif', 'Monospace', 'Display', 'Handwriting', 'Other'];

export function FontsourcePicker(props: {
  locale: Locale;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const t = messagesFor(props.locale);
  const source: FontSource = {
    id: 'fontsource',
    icon: <Icon name="text-width" />,
    heading: t.fontsource_heading(),
    note: t.fontsource_note(),
    listLabel: t.fontsource_list_label(),
    categories: CATEGORIES,
    loadCatalog,
    download: downloadFont,
  };
  return <SourcePicker {...props} source={source} />;
}
