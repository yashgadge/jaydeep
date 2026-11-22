// Adapted from the React Bits BounceCards source supplied for this integration.
import { useEffect, useRef, type CSSProperties } from 'react';
import './BounceCards.css';

type CardImage = string | { src?: string; alt?: string; fit?: 'contain' | 'cover' };
type Slot = { x: number; y: number; rotate: number };
type Body = Slot & { scale: number; vx: number; vy: number; vr: number; vs: number; born: number };
type Props = {
  images?: CardImage[]; className?: string; style?: CSSProperties;
  containerWidth?: number; containerHeight?: number; cardSize?: number;
  spread?: number; rotation?: number; arc?: number; pushDistance?: number;
  hoverScale?: number; bounciness?: number; animationDelay?: number;
  animationStagger?: number; borderWidth?: number; borderColor?: string;
  radius?: number; shadow?: boolean; enableHover?: boolean;
  transformStyles?: string[]; onCardClick?: (index: number) => void;
  activeIndex?: number;
};
const PATTERN = [1, .5, -.3, -1, .2, .75, -.6, .35, -.85, .1];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseTransform = (value?: string): Slot | null => {
  if (typeof value !== 'string') return null;
  const rotate = value.match(/rotate\(\s*(-?[\d.]+)deg\s*\)/);
  const translate = value.match(/translate\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?\s*\)/);
  return { x: translate ? Number(translate[1]) : 0, y: translate?.[2] ? Number(translate[2]) : 0, rotate: rotate ? Number(rotate[1]) : 0 };
};
const step = (value: number, velocity: number, target: number, stiffness: number, damping: number, dt: number): [number, number] => {
  const next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
  return [value + next * dt, next];
};

export default function BounceCards({
  images = [], className = '', style, containerWidth = 400, containerHeight = 400,
  cardSize = 200, spread = 85, rotation = 10, arc = 0, animationDelay = .5,
  animationStagger = .06, bounciness = .6, enableHover = true, pushDistance = 160,
  hoverScale = 1.06, borderWidth = 5, borderColor = '#ffffff', radius = 25,
  shadow = true, transformStyles, onCardClick, activeIndex,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wakeRef = useRef<(() => void) | null>(null);
  const cards = images.map(item => typeof item === 'string' ? { src: item, alt: '', fit: 'cover' as const } : { ...item, alt: item.alt ?? '' });
  const middle = (cards.length - 1) / 2, reach = Math.max(1, middle);
  const slots = cards.map((_, i) => parseTransform(transformStyles?.[i]) ?? {
    x: (i - middle) * spread, y: arc * ((i - middle) / reach) ** 2, rotate: rotation * PATTERN[i % PATTERN.length],
  });
  const settings = { slots, cardSize: Math.max(10, cardSize), delay: Math.max(0, animationDelay), stagger: Math.max(0, animationStagger), bounciness: clamp(bounciness, 0, 1), enableHover, pushDistance, hoverScale: clamp(hoverScale, .5, 2), clickable: typeof onCardClick === 'function' };
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const clickRef = useRef(onCardClick); clickRef.current = onCardClick;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = media.matches, visible = false, alive = true, raf = 0, last = performance.now();
    const bodies: Body[] = [];
    const state = { hovered: -1, time: 0, layer: -2 };
    let down: { x: number; y: number } | null = null;
    const body = (i: number) => {
      if (!bodies[i]) bodies[i] = { ...settingsRef.current.slots[i], scale: reduce ? 1 : 0, vx: 0, vy: 0, vr: 0, vs: 0, born: state.time };
      return bodies[i];
    };
    const frame = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const s = settingsRef.current, dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
      last = now; state.time += dt;
      const hovered = s.enableHover && !reduce ? state.hovered : -1;
      const popStiffness = 170, popDamping = 2 * (1 - .85 * s.bounciness) * Math.sqrt(popStiffness);
      const moveStiffness = 210, moveDamping = 2 * .72 * Math.sqrt(moveStiffness);
      const substeps = Math.ceil(dt / (1 / 240)), h = dt / substeps;
      let moving = 0;
      for (let i = 0; i < s.slots.length; i++) {
        const el = cardRefs.current[i]; if (!el) continue;
        const card = body(i), slot = s.slots[i], appeared = reduce || state.time - card.born >= s.delay + i * s.stagger;
        let targetX = slot.x, targetY = slot.y, targetRotate = slot.rotate, targetScale = appeared ? 1 : 0;
        if (hovered >= 0 && appeared) {
          if (i === hovered) { targetY = slot.y - s.cardSize * .04; targetRotate = 0; targetScale = s.hoverScale; }
          else targetX = slot.x + Math.sign(i - hovered) * s.pushDistance;
        }
        if (reduce) Object.assign(card, { x: targetX, y: targetY, rotate: targetRotate, scale: targetScale, vx: 0, vy: 0, vr: 0, vs: 0 });
        else for (let k = 0; k < substeps; k++) {
          [card.x, card.vx] = step(card.x, card.vx, targetX, moveStiffness, moveDamping, h);
          [card.y, card.vy] = step(card.y, card.vy, targetY, moveStiffness, moveDamping, h);
          [card.rotate, card.vr] = step(card.rotate, card.vr, targetRotate, moveStiffness, moveDamping, h);
          [card.scale, card.vs] = step(card.scale, card.vs, targetScale, popStiffness, popDamping, h);
        }
        moving += Math.abs(card.vx) + Math.abs(card.vy) + Math.abs(card.vr) + Math.abs(card.vs) * 100 + Math.abs(targetX - card.x) + Math.abs(targetY - card.y) + Math.abs(targetRotate - card.rotate) + Math.abs(targetScale - card.scale) * 100 + (appeared ? 0 : 1);
        el.style.transform = `translate(-50%, -50%) translate3d(${card.x.toFixed(2)}px, ${card.y.toFixed(2)}px, 0) rotate(${card.rotate.toFixed(3)}deg) scale(${Math.max(0, card.scale).toFixed(4)})`;
      }
      if (state.layer !== hovered) {
        state.layer = hovered;
        cardRefs.current.forEach((el, i) => { if (el) { el.style.zIndex = i === hovered ? String(s.slots.length + 1) : String(i + 1); el.toggleAttribute('data-active', i === hovered); } });
      }
      if (moving > .02) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && alive && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    wakeRef.current = wake;
    const pick = (event: PointerEvent | MouseEvent) => {
      const s = settingsRef.current, rect = root.getBoundingClientRect();
      const px = event.clientX - rect.left - rect.width / 2, py = event.clientY - rect.top - rect.height / 2;
      let best = -1, distance = Infinity;
      s.slots.forEach((slot, i) => { const gap = Math.abs(px - slot.x); if (gap < distance) { distance = gap; best = i; } });
      if (best < 0) return -1;
      const slot = s.slots[best], half = s.cardSize / 2;
      if (Math.abs(py - slot.y) > half + 12 || distance > half + 12) return -1;
      if (state.hovered >= 0 && state.hovered !== best) {
        const current = s.slots[state.hovered];
        if (current && Math.abs(px - current.x) - distance < 6) return state.hovered;
      }
      return best;
    };
    const onMove = (event: PointerEvent) => { const next = pick(event); if (next !== state.hovered) { state.hovered = next; wake(); } };
    const onDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; onMove(event); };
    const onLeave = () => { if (state.hovered !== -1) { state.hovered = -1; wake(); } };
    const activate = (index: number) => { if (bodies[index] && !reduce) bodies[index].vs -= 2.2; wake(); clickRef.current?.(index); };
    const onClick = (event: MouseEvent) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 14) { down = null; return; }
      down = null;
      // Keyboard/assistive activation has no pointer coordinates.
      const focused = cardRefs.current.indexOf(event.target as HTMLDivElement);
      const index = event.detail === 0 && focused >= 0 ? focused : pick(event);
      if (index >= 0) activate(index);
    };
    const onFocus = (event: FocusEvent) => { const index = cardRefs.current.indexOf(event.target as HTMLDivElement); if (index >= 0) { state.hovered = index; wake(); } };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const index = cardRefs.current.indexOf(event.target as HTMLDivElement);
      if (index >= 0 && settingsRef.current.clickable) { event.preventDefault(); activate(index); }
    };
    const onReduce = () => { reduce = media.matches; wake(); };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: .1 });
    observer.observe(root);
    root.addEventListener('pointermove', onMove); root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerleave', onLeave); root.addEventListener('pointercancel', onLeave);
    root.addEventListener('click', onClick); root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onLeave); root.addEventListener('keydown', onKey);
    media.addEventListener('change', onReduce); document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false; cancelAnimationFrame(raf); observer.disconnect(); wakeRef.current = null;
      root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerleave', onLeave); root.removeEventListener('pointercancel', onLeave);
      root.removeEventListener('click', onClick); root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', onLeave); root.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onReduce); document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  useEffect(() => { wakeRef.current?.(); });

  return <div ref={rootRef} className={`bounce-cards ${className}`} style={{
    width: containerWidth, height: containerHeight,
    '--bounce-cards-size': `${settings.cardSize}px`, '--bounce-cards-border': `${Math.max(0, borderWidth)}px`,
    '--bounce-cards-border-color': borderColor, '--bounce-cards-radius': `${Math.max(0, radius)}px`,
    '--bounce-cards-shadow': shadow ? '0 1px 2px #0003, 0 10px 28px -6px #0008' : 'none',
    '--bounce-cards-shadow-active': shadow ? '0 2px 4px #0003, 0 22px 44px -10px #000a' : 'none',
    ...style,
  } as CSSProperties}>
    {cards.map((card, i) => <div key={i} ref={el => { cardRefs.current[i] = el; }}
      className={`bounce-cards__card${settings.clickable ? ' bounce-cards__card--clickable' : ''}`}
      style={{ zIndex: i + 1 }} data-selected={activeIndex === i || undefined}
      {...(settings.clickable ? { role: 'button', tabIndex: 0, 'aria-label': card.alt || `Card ${i + 1}`, 'aria-pressed': activeIndex === i, 'aria-controls': 'managed-brand-detail' } : {})}>
      {card.src ? <img src={card.src} alt={card.alt} draggable={false} style={{ objectFit: card.fit ?? 'cover' }} /> : <span className="bounce-cards__fallback" aria-hidden>{card.alt.slice(0, 2)}</span>}
    </div>)}
  </div>;
}
