type WheelInput = {
  deltaX: number; deltaY: number; deltaMode: number;
  ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; cancelable: boolean;
};
export type ReelWheelState = {
  lastAt: number; direction: number; axis: 'horizontal' | 'vertical' | '';
  pageGesture: boolean; burst: { at: number; distance: number }[];
  total: number; movedAt: number;
};
export const createReelWheelState = (): ReelWheelState => ({
  lastAt: -Infinity, direction: 0, axis: '', pageGesture: false,
  burst: [], total: 0, movedAt: -Infinity,
});

/** Route gentle gestures to reels; release a vertical flick and its momentum to the page. */
export function routeReelWheel(state: ReelWheelState, event: WheelInput, now: number, pageHeight: number): { route: 'ignore' | 'page' | 'reel'; step: number } {
  if (event.ctrlKey || event.metaKey || !event.cancelable) return { route: 'ignore', step: 0 };
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || Boolean(event.shiftKey);
  const raw = horizontal && event.deltaX ? event.deltaX : event.deltaY;
  const delta = raw * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1);
  if (!Number.isFinite(delta) || !delta) return { route: 'ignore', step: 0 };
  const axis = horizontal ? 'horizontal' : 'vertical', direction = Math.sign(delta);
  const idle = now - state.lastAt > 280, axisChanged = axis !== state.axis;
  if (idle || axisChanged) { state.pageGesture = false; state.total = 0; state.burst = []; }
  if (direction !== state.direction) { state.total = 0; state.burst = []; }
  state.lastAt = now; state.axis = axis; state.direction = direction;

  if (!horizontal) {
    state.burst = state.burst.filter(sample => now - sample.at <= 140);
    state.burst.push({ at: now, distance: Math.abs(delta) });
    const distance = state.burst.reduce((sum, sample) => sum + sample.distance, 0);
    const duration = Math.max(60, now - state.burst[0].at);
    const flick = event.deltaMode === 2 || Math.abs(delta) >= 300 || (distance >= 420 && distance / duration >= 3.6);
    if (state.pageGesture || flick) {
      state.pageGesture = true; state.total = 0;
      return { route: 'page', step: 0 };
    }
  }

  if (now - state.movedAt < 650) return { route: 'reel', step: 0 };
  state.total += delta;
  if (Math.abs(state.total) < 45) return { route: 'reel', step: 0 };
  state.total = 0; state.movedAt = now;
  return { route: 'reel', step: direction };
}
