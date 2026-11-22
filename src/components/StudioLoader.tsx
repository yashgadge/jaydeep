import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useScrollLock } from '../hooks/smoothScroll';
import { agency } from '../data/agency';
import './studio-loader.css';

type Opening = { open: boolean; beat: number; finish: () => void };
const OpeningContext = createContext<Opening>({ open: false, beat: 6, finish: () => {} });
export const useStudioOpening = () => useContext(OpeningContext);

// Coordinate a reveal of the real hero. No duplicate scene or crossfade handoff.
export default function StudioLoader({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(() => !window.location.hash && !window.history.state?.mvmVisited && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [beat, setBeat] = useState(0);
  const finish = useCallback(() => { setBeat(6); setOpen(false); }, []);
  useScrollLock(open);

  useEffect(() => {
    const replay = () => { setBeat(0); setOpen(true); };
    window.addEventListener('mvm-replay-intro', replay);
    return () => window.removeEventListener('mvm-replay-intro', replay);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (reduced) { finish(); return; }
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const portraits = Object.values(agency.portraits).filter(Boolean).map(src => {
      const image = new Image(); image.src = src!;
      return image.decode().catch(() => {});
    });
    const timeout = new Promise<void>(resolve => later(resolve, 2200));
    void Promise.race([Promise.all([document.fonts.ready, ...portraits]), timeout]).then(() => {
      if (cancelled) return;
      // Original Portfolio_series opening cues, starting after assets are ready.
      later(() => setBeat(1), 300);
      later(() => setBeat(2), 1900);
      later(() => setBeat(3), 2700);
      later(() => setBeat(4), 3400);
      later(() => setBeat(5), 4300);
      later(() => setBeat(6), 5000);
      later(finish, 6200);
    });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
    window.addEventListener('keydown', escape);
    return () => { cancelled = true; timers.forEach(clearTimeout); window.removeEventListener('keydown', escape); };
  }, [open, reduced, finish]);


  useEffect(() => {
    if (!open) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-studio-page] main > section:not(#top), [data-studio-page] footer, [data-studio-page] .agency-skip-link'));
    sections.forEach(section => section.setAttribute('inert', ''));
    return () => sections.forEach(section => section.removeAttribute('inert'));
  }, [open]);

  return <OpeningContext.Provider value={{ open, beat: open ? beat : 6, finish }}>{children}</OpeningContext.Provider>;
}
