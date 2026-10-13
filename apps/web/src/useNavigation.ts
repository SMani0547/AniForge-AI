import { useEffect, useRef, useState } from 'react';
import { mayLeaveStudio } from './navigationGuard';

// Preserve the browser's forward entries when a guarded Back/Forward is cancelled.
export function useNavigation() {
  const [path, setPath] = useState(window.location.pathname);
  const index = useRef<number>(window.history.state?.aniforgeIndex ?? 0);
  const restoring = useRef(false);
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, aniforgeIndex: index.current }, '');
    function update(event: PopStateEvent) {
      if (restoring.current) { restoring.current = false; return; }
      const nextIndex: number = event.state?.aniforgeIndex ?? index.current;
      if (!mayLeaveStudio()) {
        const delta = index.current - nextIndex;
        if (delta) { restoring.current = true; window.history.go(delta); }
        return;
      }
      index.current = nextIndex;
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    document.title = path === '/projects' ? 'Your projects | AniForge AI' : path === '/studio/preview' ? 'Sketch playground | AniForge AI' : 'Your studio | AniForge AI';
    const frame = requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [path]);
  function navigate(next: string, authorized = false) {
    if (restoring.current || next === path || (!authorized && !mayLeaveStudio())) return;
    if (next === '/') { window.location.assign('/'); return; }
    index.current++;
    window.history.pushState({ aniforgeIndex: index.current }, '', next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  return { path, navigate };
}
