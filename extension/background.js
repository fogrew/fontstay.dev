const ORIGIN = 'https://fontstay.dev';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const makeToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => ALPHABET[byte % 62]).join('');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function whenComplete(tabId) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await sleep(250);
  }
}

let generation = 0;

async function setStatus(text, title) {
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setTitle({ title });
  } catch {}
}

async function deliver(tabId, token, payload, mine) {
  await whenComplete(tabId);
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'fontstay:payload', token, payload });
      return;
    } catch {
      await sleep(250);
    }
  }
  if (mine === generation) {
    await setStatus(
      '!',
      'Could not send this page to fontstay.dev. Click the button on the page to try again.',
    );
  }
}

async function sendTab(tab) {
  const mine = ++generation;
  await setStatus('', 'Send this page to fontstay');
  if (tab.id === undefined || !/^https?:/.test(tab.url ?? '')) return;
  let payload;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['collect-run.js'],
    });
    payload = injection?.result;
  } catch {
    await setStatus('!', 'Could not read this page.');
    return;
  }
  if (!payload) {
    await setStatus('!', 'Could not read this page.');
    return;
  }
  const token = makeToken();
  const locale = chrome.i18n.getUILanguage().startsWith('ru') ? 'ru' : 'en';
  const created = await chrome.tabs.create({ url: `${ORIGIN}/${locale}/import/#t=${token}` });
  if (created.id !== undefined) await deliver(created.id, token, payload, mine);
}

self.fontstaySend = sendTab;
chrome.action.onClicked.addListener(sendTab);
