/** Original vector composition authored for AniForge's UI study, not generated video. */
export function SceneArtwork({ compact = false }: { compact?: boolean }) {
  return <svg viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" className="af-scene-art" role="img" aria-label="Original vector illustration of a quiet observatory beneath a lavender moon">
    <rect width="960" height="600" fill="#232844" />
    <circle cx="704" cy="180" r="109" fill="#c3b9ee" />
    <circle cx="710" cy="160" r="78" fill="#d3cbf0" />
    <path d="M0 370 172 211 275 320 422 190 602 367 768 288 960 384V600H0Z" fill="#53577b" />
    <path d="m0 440 204-142 157 130 207-182 187 173 205-78v259H0Z" fill="#373f61" />
    <path d="M0 490Q190 438 365 487T720 482T960 485V600H0Z" fill="#181f36" />
    <path d="M314 600 450 498h61L424 600Z" fill="#827eb1" />
    <path d="M420 487v-98h110v98Z" fill="#bcc0d4" />
    <path d="M406 390a69 69 0 0 1 138 0Z" fill="#868cba" />
    <path d="M474 322v68h18v-66" fill="#464b78" />
    <path d="m493 342 70-44 8 12-70 47Z" fill="#c3c7df" />
    <rect x="463" y="433" width="25" height="54" fill="#28304e" />
    <rect x="502" y="415" width="14" height="19" fill="#f2d89f" />
    <path d="m83 525 32-110 32 110Zm34 35 37-129 38 129Zm652-25 31-107 31 107Zm69 23 36-125 36 125Z" fill="#121a2b" />
    {[['110','112'],['256','150'],['340','76'],['488','130'],['586','72'],['856','248'],['801','64']].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="2" fill="#d7d4eb" />)}
    {!compact && <><path d="M37 37h42M37 37v42M923 37h-42M923 37v42M37 563h42M37 563v-42M923 563h-42M923 563v-42" fill="none" stroke="#d8d4e5" opacity=".5" /><text x="250" y="76" fill="#e3deef" fontFamily="monospace" fontSize="13" letterSpacing="3">AF / ORIGINAL ART STUDY 01</text></>}
  </svg>;
}
