/** Only authenticated app surfaces participate; public/login routes keep native Back. */
export function pwaExitScope(pathname: string): string | null {
  return pathname.match(/^\/(superadmin|owner|pos)(?:\/|$)/)?.[1]
    ?? (/^\/marketing\/dashboard(?:\/|$)/.test(pathname) ? "marketing" : null);
}

type Entry = { index: number; url?: string };
type Navigation = EventTarget & { currentEntry: Entry | null; entries(): Entry[] };
type Watcher = EventTarget & { destroy(): void };
export type ExitWindow = Window & {
  navigation?: Navigation;
  CloseWatcher?: new () => Watcher;
};
const MARKER = "__okesihExitBoundary";

export function installPwaExitGuard(win: ExitWindow, scope: string, warn: (open: boolean) => void) {
  warn(false);
  let disposed = false;
  let showing = false;
  let watcher: Watcher | undefined;
  let returning = false;
  const nav = win.navigation;
  const native = !!(nav && win.CloseWatcher);
  const setWarning = (open: boolean) => { showing = open; warn(open); };
  const destroyWatcher = () => { watcher?.destroy(); watcher = undefined; };
  const inScope = () => pwaExitScope(win.location.pathname) === scope;
  function atBoundary() {
    const previous = nav?.entries().find(entry => entry.index === (nav.currentEntry?.index ?? 0) - 1);
    if (!previous?.url) return true;
    const url = new URL(previous.url, win.location.href);
    return url.origin !== win.location.origin || pwaExitScope(url.pathname) !== scope;
  }
  function arm() {
    destroyWatcher();
    if (disposed || showing || win.document.visibilityState === "hidden" || !inScope()) return;
    if (native && atBoundary()) {
      watcher = new win.CloseWatcher!();
      watcher.addEventListener("close", () => {
        watcher = undefined; // A closed CloseWatcher is consumed; the next Back stays native.
        if (!disposed) setWarning(true);
      }, { once: true });
    }
  }
  function navigationChanged() { setWarning(false); arm(); }
  function dismiss() {
    if (disposed || !showing) return;
    setWarning(false);
    if (native) arm();
    else if (win.history.state?.[MARKER] === `${scope}:base`) {
      returning = true;
      win.history.forward(); // Reuse the guard, never grow history on cancellation.
    }
  }
  function pop(event: PopStateEvent) {
    if (disposed || !inScope()) return;
    if (returning) {
      returning = false;
      event.stopImmediatePropagation();
      return;
    }
    if (event.state?.[MARKER] === `${scope}:base` && !showing) {
      event.stopImmediatePropagation();
      setWarning(true);
    }
  }
  function resume() {
    if (win.document.visibilityState === "hidden") { destroyWatcher(); return; }
    if (native) navigationChanged();
    else dismiss();
  }
  if (native) {
    nav!.addEventListener("currententrychange", navigationChanged);
    arm();
  } else {
    // Older Android engines: retain Next's private router metadata on both entries.
    const marker = win.history.state?.[MARKER];
    if (marker === `${scope}:base`) {
      returning = true;
      win.history.forward();
    } else if (marker !== `${scope}:guard`) {
      win.history.replaceState({ ...win.history.state, [MARKER]: `${scope}:base` }, "");
      win.history.pushState({ ...win.history.state, [MARKER]: `${scope}:guard` }, "");
    }
    win.addEventListener("popstate", pop, true);
  }
  win.addEventListener("pageshow", resume);
  win.document.addEventListener("visibilitychange", resume);
  return {
    dismiss,
    dispose() {
      disposed = true;
      destroyWatcher();
      nav?.removeEventListener("currententrychange", navigationChanged);
      win.removeEventListener("popstate", pop, true);
      win.removeEventListener("pageshow", resume);
      win.document.removeEventListener("visibilitychange", resume);
    },
  };
}
