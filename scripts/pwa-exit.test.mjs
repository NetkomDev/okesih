import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installPwaExitGuard, pwaExitScope } from '../src/lib/pwa-exit-guard.ts';

function fixture(path, native = true) {
  const win = new EventTarget();
  win.document = new EventTarget();
  win.document.visibilityState = 'visible';
  const entries = [{ url: 'https://example.com/login', state: {} }, { url: `https://example.com${path}`, state: { __NA: true, tree: 'preserved' } }];
  let index = 1;
  const nav = new EventTarget();
  nav.entries = () => entries.map((entry, index) => ({ ...entry, index }));
  Object.defineProperty(nav, 'currentEntry', { get: () => ({ index }) });
  Object.defineProperty(win, 'location', { get: () => new URL(entries[index].url) });
  const move = delta => {
    index += delta;
    nav.dispatchEvent(new Event('currententrychange'));
    const event = new Event('popstate');
    event.state = entries[index].state;
    win.dispatchEvent(event);
  };
  win.history = {
    get state() { return entries[index].state; },
    replaceState(state) { entries[index].state = state; },
    pushState(state, _, url) {
      entries.splice(index + 1);
      entries.push({ state, url: new URL(url ?? entries[index].url, win.location.href).href });
      index++;
      nav.dispatchEvent(new Event('currententrychange'));
    },
    forward() { move(1); }, back() { move(-1); },
  };
  const watchers = [];
  class Watcher extends EventTarget {
    active = true;
    constructor() { super(); watchers.push(this); }
    destroy() { this.active = false; }
    close() { this.active = false; this.dispatchEvent(new Event('close')); }
  }
  if (native) { win.navigation = nav; win.CloseWatcher = Watcher; }
  let warning = false;
  const guard = installPwaExitGuard(win, pwaExitScope(path), open => { warning = open; });
  return { win, guard, entries, get warning() { return warning; },
    back() { const active = watchers.find(w => w.active); if (active) active.close(); else win.history.back(); },
    get active() { return watchers.filter(w => w.active).length; } };
}

for (const path of ['/superadmin', '/owner', '/marketing/dashboard', '/pos']) {
  test(`${path}: internal Back, exit warning, outside cancellation and second Back`, () => {
    const f = fixture(path);
    assert.equal(f.active, 1);
    f.win.history.pushState({}, '', `${path}/profile`);
    assert.equal(f.active, 0);
    f.back();
    assert.equal(f.warning, false);
    assert.equal(f.win.location.pathname, path);
    f.back();
    assert.equal(f.warning, true);
    assert.equal(f.active, 0);
    f.guard.dismiss();
    assert.equal(f.active, 1);
    assert.equal(f.warning, false);
    f.back(); f.back();
    assert.equal(f.win.location.pathname, '/login');
    f.guard.dispose();
    assert.equal(f.active, 0);
  });
}
test('resume rearms warning; cleanup removes watchers', () => {
  const f = fixture('/owner');
  f.back();
  f.win.document.visibilityState = 'hidden';
  f.win.document.dispatchEvent(new Event('visibilitychange'));
  f.win.document.visibilityState = 'visible';
  f.win.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.warning, false);
  assert.equal(f.active, 1);
  f.guard.dispose();
  f.win.dispatchEvent(new Event('pageshow'));
  assert.equal(f.active, 0);
});
test('fallback preserves router state and cancellation does not grow history', () => {
  const f = fixture('/pos', false);
  assert.equal(f.win.history.state.__NA, true);
  assert.equal(f.win.history.state.tree, 'preserved');
  for (let i = 0; i < 5; i++) {
    f.back(); assert.equal(f.warning, true); f.guard.dismiss();
    assert.equal(f.entries.length, 3);
  }
  f.guard.dispose();
  const guard = installPwaExitGuard(f.win, 'pos', () => {});
  assert.equal(f.entries.length, 3);
  guard.dispose();
});
test('public/login paths excluded', () => {
  for (const path of ['/login', '/marketing', '/marketing/register', '/owner-other', '/menu']) assert.equal(pwaExitScope(path), null);
});
test('fallback internal navigation and second Back leave the protected surface', () => {
  const f = fixture('/owner', false);
  f.win.history.pushState({}, '', '/owner/settings');
  f.back(); assert.equal(f.warning, false);
  f.back(); assert.equal(f.warning, true);
  f.back(); assert.equal(f.win.location.pathname, '/login');
  f.guard.dispose();
});
test('native remount on a child route preserves previous-page navigation', () => {
  const f = fixture('/owner');
  f.win.history.pushState({}, '', '/owner/settings');
  f.guard.dispose();
  const guard = installPwaExitGuard(f.win, 'owner', () => {});
  assert.equal(f.active, 0);
  f.back(); assert.equal(f.win.location.pathname, '/owner');
  assert.equal(f.active, 1);
  guard.dispose();
});
