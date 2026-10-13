import { useEffect, useRef } from 'react';

/** Progressive enhancement: content remains readable when motion is unavailable. */
export function useHomepageMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const targets = Array.from(page.querySelectorAll<HTMLElement>('.af-section-heading, .af-feature-row, .af-home-workflow li, .af-examples-heading, .af-art-gallery figure, .af-control-grid article, .af-faq-list, .af-home-final'));
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - innerHeight;
      page.style.setProperty('--reading-progress', String(range > 0 ? scrollY / range : 0));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const reveal = (element: HTMLElement) => { element.dataset.reveal = 'visible'; observer?.unobserve(element); };
    const configure = () => {
      observer?.disconnect();
      page.dataset.motion = String(!reduced.matches);
      if (!reduced.matches && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
        targets.forEach((element) => {
          // Never conceal restored scroll positions, focused content or hash targets.
          if (element.getBoundingClientRect().top < innerHeight || element.contains(document.activeElement)) reveal(element);
          else { element.dataset.reveal = 'pending'; observer?.observe(element); }
        });
      } else targets.forEach(reveal);
      schedule();
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const hidden = event.target.closest<HTMLElement>('[data-reveal="pending"]');
        if (hidden) reveal(hidden);
      }
    };
    configure();
    reduced.addEventListener('change', configure);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    page.addEventListener('focusin', focus);
    return () => {
      observer?.disconnect(); cancelAnimationFrame(frame);
      reduced.removeEventListener('change', configure);
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      page.removeEventListener('focusin', focus);
    };
  }, []);
  return root;
}
