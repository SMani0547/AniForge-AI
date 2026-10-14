import { ArrowDown, ArrowRight, Pause, Pencil } from 'lucide-react';
import type { CSSProperties } from 'react';

export function AnimeHero({ paused, onPause }: { paused: boolean; onPause: () => void }) {
  return <section className="af-anime-hero" aria-labelledby="home-title">
    <div className="af-hero-wordmark" aria-hidden="true"><img src="/brand/wordmark.webp" alt="" width="1118" height="150" fetchPriority="high" /></div>
    <div className="af-anime-copy">
      <p className="af-eyebrow">A studio for the worlds in your head</p>
      <h1 id="home-title">Your sketch.<br />Your story.<br /><span className="af-type-line">{Array.from('In motion.').map((letter, index) => <span className="af-type-letter" style={{ '--letter-delay': `${600 + index * 110}ms` } as CSSProperties} key={index}>{letter}</span>)}</span></h1>
      <p className="af-home-intro">From the first pencil line to the next scene.<br />Make something only you could imagine.</p>
      <div className="af-row"><a href="/projects" className="af-button af-button--primary">Open studio <ArrowRight size={18} /></a><a href="/studio/preview" className="af-home-text-link">Try drawing <Pencil size={17} /></a></div>
      <p className="af-home-small">No account needed for the unsaved playground.</p>
    </div>
    <div className="af-anime-stage">
      <div className="af-orbit af-orbit-one" aria-hidden="true" /><div className="af-orbit af-orbit-two" aria-hidden="true" />
      <img className="af-hero-character" src="/artwork/sky-artist.webp" width="850" height="1275" fetchPriority="high" alt="Original anime artist in vermilion jacket" />
      <div className="af-floating-frame af-frame-city" aria-hidden="true"><img src="/artwork/last-tram.webp" width="1200" height="675" alt="" /><span>01 / THE LAST TRAM</span></div>
      <div className="af-floating-frame af-frame-sketch" aria-hidden="true"><img src="/artwork/sky-artist.webp" width="850" height="1275" alt="" /><span>02 / CHARACTER STUDY</span></div>
      <span className="af-hero-coordinate" aria-hidden="true">CHARACTER 001<br />THE SKY ARTIST</span>
    </div>
    <div className="af-hero-bottom"><a href="#product">Explore the studio <ArrowDown size={14} /></a><span>Original promotional art · not an AniForge video</span><button type="button" aria-pressed={paused} onClick={onPause}><Pause size={13} />Pause motion</button></div>
  </section>;
}
