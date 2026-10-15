import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

export function InstallButton({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const [prompt, setPrompt] = useState<InstallPrompt>();

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(undefined);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt) return null;
  return (
    <div class="ff-install">
      <Button
        onClick={() => {
          void prompt.prompt().finally(() => setPrompt(undefined));
        }}
      >
        {t.pwa_install()}
      </Button>
    </div>
  );
}
