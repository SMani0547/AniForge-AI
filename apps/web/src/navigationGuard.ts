let guard: (() => boolean) | null = null;
export function setNavigationGuard(next: (() => boolean) | null) { guard = next; }
export function mayLeaveStudio() { return guard?.() ?? true; }
