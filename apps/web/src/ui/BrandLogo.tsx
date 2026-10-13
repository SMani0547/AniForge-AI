import './brand.css';

/** Decorative image inside a link/button that supplies the accessible name. */
export function BrandLogo({ variant = 'navigation' }: { variant?: 'navigation' | 'full' | 'monogram' }) {
  if (variant === 'navigation') return <picture className="af-brand-logo af-brand-logo--navigation" aria-hidden="true">
    <source media="(max-width: 550px)" srcSet="/brand/monogram.webp" />
    <img src="/brand/wordmark.webp" alt="" width="1118" height="150" />
  </picture>;
  return <img className={`af-brand-logo af-brand-logo--${variant}`} src={`/brand/${variant === 'full' ? 'full-logo' : 'monogram'}.webp`} alt="" aria-hidden="true" width={variant === 'full' ? 480 : 384} height={variant === 'full' ? 306 : 225} loading={variant === 'full' ? 'lazy' : undefined} />;
}
