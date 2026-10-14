const toBuffer = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

const ready =
  document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'fontstay:payload') return;
  void ready.then(() => {
    const files = (message.payload.files ?? []).map((file) => ({
      name: file.name,
      bytes: toBuffer(file.base64),
    }));
    window.postMessage(
      {
        type: 'fontstay:import',
        v: 1,
        token: message.token,
        origin: message.payload.origin,
        payload: { ...message.payload, files },
      },
      location.origin,
      files.map((file) => file.bytes),
    );
  });
});
