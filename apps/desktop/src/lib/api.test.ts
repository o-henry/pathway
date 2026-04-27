import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkLocalApiReady, setLocalApiToken } from './api';

describe('checkLocalApiReady', () => {
  afterEach(() => {
    setLocalApiToken(null);
    vi.unstubAllGlobals();
  });

  it('checks the authenticated goals endpoint without the long api retry loop', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setLocalApiToken('local-test-token');

    await checkLocalApiReady(100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/goals');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer local-test-token');
  });

  it('fails immediately when the local API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    await expect(checkLocalApiReady(100)).rejects.toThrow('Pathway local API is not reachable');
  });
});
