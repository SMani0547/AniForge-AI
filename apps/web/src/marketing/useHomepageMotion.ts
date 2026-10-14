import { useEffect, useRef } from 'react';

/** Reveal individual pieces, preserving visible content, keyboard focus and native scrolling. */
export function useHomepageMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    // Observe siblings independently instead of fading entire tall sections together.
    const targets = Array.from(page.querySelectorAll<HTMLElement>([
      '.af-section-heading > *', '.af-home-workflow li', '.af-product-visual',
      '.af-feature-copy > *', '.af-examples-heading > div > *', '.af-examples-heading > p',
      '.af-art-gallery figure', '.af-control-grid article', '.af-faq-list details',
      '.af-home-final > *',
    ].join(',')));
    for (const element of targets) {
      const siblings = targets.filter((candidate) => candidate.parentElement === element.parentElement);
      element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 3) * 170}ms`);
      if (element.matches('a,button,input,textarea,select,summary') || element.querySelector('a,button,input,textarea,select,summary')) element.dataset.revealInteractive = 'true';
    }
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const reveal = (element: HTMLElement, immediate = false) => {
      if (immediate) element.dataset.revealImmediate = 'true';
      element.dataset.reveal = 'visible';
      observer?.unobserve(element);
    };
    const draw = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - innerHeight;
      page.style.setProperty('--reading-progress', String(range > 0 ? scrollY / range : 0));
      // Fast scrolls may jump entirely over the observer band; never leave content hidden behind it.
      for (const element of targets) if (element.dataset.reveal === 'pending' && element.getBoundingClientRect().bottom < 0) reveal(element, true);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const configure = () => {
      observer?.disconnect();
      const enabled = !reduced.matches && page.dataset.animationPaused !== 'true';
      page.dataset.motion = String(enabled);
      if (!enabled) page.dataset.typingComplete = 'true';
      if (enabled && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
        targets.forEach((element) => {
          if (element.dataset.reveal === 'visible' || element.getBoundingClientRect().top < innerHeight || element.contains(document.activeElement)) reveal(element, true);
          else { element.dataset.reveal = 'pending'; observer?.observe(element); }
        });
      } else targets.forEach((element) => reveal(element, true));
      schedule();
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>('[data-reveal]');
      if (target) reveal(target, true);
    };
    const pauseObserver = new MutationObserver(configure);
    const finishTyping = (event: AnimationEvent) => {
      if (event.animationName === 'af-type-in' && event.target === page.querySelector('.af-type-letter:last-child')) page.dataset.typingComplete = 'true';
    };
    pauseObserver.observe(page, { attributes: true, attributeFilter: ['data-animation-paused'] });
    configure();
    reduced.addEventListener('change', configure);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    page.addEventListener('focusin', focus);
    page.addEventListener('animationend', finishTyping);
    return () => {
      observer?.disconnect(); pauseObserver.disconnect(); cancelAnimationFrame(frame);
      reduced.removeEventListener('change', configure);
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      page.removeEventListener('focusin', focus);
      page.removeEventListener('animationend', finishTyping);
    };
  }, []);
  return root;
}
