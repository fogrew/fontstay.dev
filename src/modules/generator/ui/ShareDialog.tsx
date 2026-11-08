import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Icon, transition } from '@/common/ui';
import { encodeShareState, HASH_KEY, MAX_HASH_CHARS, type ShareState } from '../lib/share';
import { type SharePart, sharePartsIn, withoutShareParts } from '../lib/share-parts';

export interface ShareDialogProps {
  locale: Locale;
  build: (pin: boolean) => ShareState;
  canPin: boolean;
  files: string[];
  note: string;
}

type Link = { text: string; length: number; pinDropped: boolean; tooLong: boolean };

async function linkFor(
  build: (pin: boolean) => ShareState,
  pin: boolean,
  excluded: SharePart[],
): Promise<Link> {
  const encode = (withPin: boolean) =>
    encodeShareState(withoutShareParts(build(withPin), excluded));
  let payload = await encode(pin);
  let pinDropped = false;
  if (pin && payload.length > MAX_HASH_CHARS) {
    payload = await encode(false);
    pinDropped = true;
  }
  return {
    text: `${location.origin}${location.pathname}#${HASH_KEY}${payload}`,
    length: payload.length,
    pinDropped,
    tooLong: payload.length > MAX_HASH_CHARS,
  };
}

export function ShareDialog({ locale, build, canPin, files, note }: ShareDialogProps) {
  const t = messagesFor(locale);
  const titleId = useId();
  const pinNoteId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(false);
  const [excluded, setExcluded] = useState<SharePart[]>([]);
  const [link, setLink] = useState<Link>();
  const [message, setMessage] = useState('');
  const hideRef = useRef(() => {});
  const buildRef = useRef(build);
  buildRef.current = build;
  const labels: Record<SharePart, string> = {
    fonts: t.share_part_fonts(),
    style: t.share_part_style(),
    systems: t.share_part_systems(),
    tuning: t.share_part_tuning(),
    panel: t.share_part_panel(),
    preview: t.share_part_preview(),
    siteFonts: t.share_part_site_fonts(),
  };
  const effectivePin = pin && canPin && !excluded.includes('tuning');
  const excludedKey = excluded.join(',');
  const pinned = pin && canPin;
  const parts = useMemo(() => (open ? sharePartsIn(buildRef.current(pinned)) : []), [open, pinned]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void linkFor(buildRef.current, effectivePin, excluded).then((next) => {
      if (current) setLink(next);
    });
    return () => {
      current = false;
    };
  }, [open, effectivePin, excludedKey]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let pressedOnBackdrop = false;
    const onPress = (event: PointerEvent) => {
      pressedOnBackdrop = event.target === element;
    };
    const onClick = (event: MouseEvent) => {
      if (pressedOnBackdrop && event.target === element) hideRef.current();
      pressedOnBackdrop = false;
    };
    element.addEventListener('pointerdown', onPress);
    element.addEventListener('click', onClick);
    return () => {
      element.removeEventListener('pointerdown', onPress);
      element.removeEventListener('click', onClick);
    };
  }, []);

  const show = () => {
    setMessage('');
    setLink(undefined);
    transition(() => {
      dialog.current?.showModal();
      setOpen(true);
    });
  };
  const hide = () => {
    transition(() => {
      dialog.current?.close();
      setOpen(false);
    });
  };
  hideRef.current = hide;
  const toggle = (part: SharePart) => {
    setMessage('');
    setLink(undefined);
    setExcluded((list) =>
      list.includes(part) ? list.filter((item) => item !== part) : [...list, part],
    );
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.text);
      setMessage(
        files.length === 0 ? t.share_copied() : t.share_copied_files({ files: files.join(', ') }),
      );
    } catch {
      setMessage(t.share_failed());
    }
  };

  return (
    <>
      <Button class="ff-share__trigger" data-open={open ? '' : undefined} onClick={show}>
        <Icon name="share" />
        {t.share_copy_short()}
      </Button>
      <dialog
        ref={dialog}
        class="ff-share-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          hide();
        }}
        onClose={() => setOpen(false)}
      >
        {open && (
          <div class="ff-share-dialog__body">
            <div class="ff-share-dialog__header">
              <h2 class="ff-share-dialog__title" id={titleId}>
                {t.share_dialog_title()}
              </h2>
              <Button class="ff-share-dialog__close" onClick={hide}>
                {t.share_dialog_close()}
              </Button>
            </div>
            <p class="ff-muted">{note}</p>
            <fieldset class="ff-share-dialog__group">
              <legend class="ff-share-dialog__legend">{t.share_dialog_include()}</legend>
              {parts.length === 0 && <p class="ff-muted">{t.share_dialog_empty()}</p>}
              {parts.map((part) => (
                <label class="ff-share-dialog__option" key={part}>
                  <input
                    class="ff-control"
                    type="checkbox"
                    checked={!excluded.includes(part)}
                    onChange={() => toggle(part)}
                  />
                  {labels[part]}
                </label>
              ))}
            </fieldset>
            <div class="ff-share-dialog__group">
              <label class="ff-share-dialog__option">
                <input
                  class="ff-control"
                  type="checkbox"
                  aria-describedby={pinNoteId}
                  checked={effectivePin}
                  disabled={!canPin || excluded.includes('tuning')}
                  onChange={(event) => {
                    setMessage('');
                    setLink(undefined);
                    setPin(event.currentTarget.checked);
                  }}
                />
                {t.share_pin()}
              </label>
              <p class="ff-muted" id={pinNoteId}>
                {t.share_pin_note()}
              </p>
            </div>
            <label class="ff-share-dialog__link">
              {t.share_dialog_link()}
              <input
                class="ff-control"
                type="text"
                readOnly
                data-testid="share-link"
                value={link?.text ?? ''}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <p class="ff-muted" data-testid="share-length">
              {link ? t.share_dialog_length({ count: link.length }) : ''}
            </p>
            {link?.pinDropped && <p class="ff-error">{t.share_pin_too_long()}</p>}
            {link?.tooLong && <p class="ff-error">{t.share_dialog_too_long()}</p>}
            <div class="ff-share-dialog__footer">
              <Button variant="primary" disabled={!link} onClick={() => void copy()}>
                <Icon name="copy" />
                {t.share_dialog_copy()}
              </Button>
              <span class="ff-muted" role="status">
                {message}
              </span>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
