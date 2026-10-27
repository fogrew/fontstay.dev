import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';
import ru from '../../../messages/ru.json';
import type { Locale } from './paraglide/runtime.js';

type MessageKey = Exclude<keyof typeof en, '$schema'>;

export const catalogs = { en, ru, ar, es, pt } satisfies Record<Locale, Record<MessageKey, string>>;
