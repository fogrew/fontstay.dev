import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storePending } from './handoff';
import { runReceivePage } from './receive-page';
import { startReceiver } from './receiver';

vi.mock('./handoff', () => ({ storePending: vi.fn() }));
vi.mock('./receiver', () => ({ startReceiver: vi.fn() }));

const TOKEN = 'abcdefghijklmnopqrstuvwx';

function setup(hash: string) {
  const status = { textContent: '' };
  const home = { removeAttribute: vi.fn() };
  const root = {
    dataset: { after: '/en/#import', failed: 'Nothing was received.' },
    querySelector: (selector: string) =>
      selector === '[data-status]' ? status : selector === '[data-home]' ? home : null,
  };
  const location = { hash, pathname: '/en/import/', replace: vi.fn() };
  const history = { replaceState: vi.fn() };
  const win = { opener: { marker: true } as object | null };
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', history);
  vi.stubGlobal('window', win);
  return { root: root as unknown as HTMLElement, status, home, location, history, win };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('runReceivePage', () => {
  it('fails at once without a token', () => {
    const { root, status, home } = setup('');
    runReceivePage(root);
    expect(status.textContent).toBe('Nothing was received.');
    expect(home.removeAttribute).toHaveBeenCalledWith('hidden');
    expect(startReceiver).not.toHaveBeenCalled();
  });

  it('wipes the token from the address and waits for the data', () => {
    const { root, history } = setup(`#t=${TOKEN}`);
    runReceivePage(root);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/en/import/');
    expect(startReceiver).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ token: TOKEN }),
    );
  });

  it('stores the import, drops the opener and moves on', async () => {
    vi.mocked(storePending).mockResolvedValue(true);
    const { root, location, win } = setup(`#t=${TOKEN}`);
    runReceivePage(root);
    const options = vi.mocked(startReceiver).mock.calls[0]?.[1];
    options?.onImport({} as never);
    await vi.waitFor(() => expect(location.replace).toHaveBeenCalledWith('/en/#import'));
    expect(win.opener).toBeNull();
  });

  it('reports a failure when the import cannot be stored', async () => {
    vi.mocked(storePending).mockResolvedValue(false);
    const { root, status, location, win } = setup(`#t=${TOKEN}`);
    runReceivePage(root);
    vi.mocked(startReceiver).mock.calls[0]?.[1].onImport({} as never);
    await vi.waitFor(() => expect(status.textContent).toBe('Nothing was received.'));
    expect(location.replace).not.toHaveBeenCalled();
    expect(win.opener).not.toBeNull();
  });
});
