// The Scam Shield mascot: a cartoon thief the shield catches. One framework-free SVG source, shared by the app and
// the WhatsApp extension, so both always draw the same figure.
// WHY a friendly cartoon: the brief says "never scare without explaining". The thief is the one in trouble (caught,
// behind bars), never the reader. The figure is decoration only; the words always carry the verdict.
// WHY a data URL image: no network, no innerHTML (WhatsApp Web's Trusted Types would block it), and CSS
// animations inside an SVG image still run.

/** sneak = still checking, peek = something to verify, caught = scam stopped, safe = shield alone, all clear. */
export type ThiefMood = 'sneak' | 'peek' | 'caught' | 'safe';

const INK = '#1f2335';
const SKIN = '#f2c79a';
const SHIELD = '#1f4e79';

const STYLE = `<style>
.sst-bob{animation:sst-bob .9s ease-in-out infinite}
.sst-leg-l{animation:sst-step .9s ease-in-out infinite;transform-origin:89px 142px}
.sst-leg-r{animation:sst-step .9s ease-in-out infinite reverse;transform-origin:111px 142px}
.sst-eyes{animation:sst-look 2.6s ease-in-out infinite}
.sst-tail{animation:sst-flap .45s ease-in-out infinite alternate;transform-origin:128px 72px}
.sst-shake{animation:sst-shake .45s ease-in-out .5s 3;transform-origin:100px 170px}
.sst-bars{animation:sst-drop .65s cubic-bezier(.3,1.45,.6,1) both}
.sst-sweat{animation:sst-sweat 1.3s ease-in infinite}
.sst-glow{animation:sst-glow 2.6s ease-in-out infinite;transform-origin:100px 98px}
.sst-pop{animation:sst-pop .55s cubic-bezier(.3,1.5,.6,1) both;transform-origin:100px 98px}
.sst-spark{animation:sst-spark 1.8s ease-in-out infinite;transform-origin:150px 40px}
@keyframes sst-bob{50%{transform:translateY(-5px)}}
@keyframes sst-step{0%,100%{transform:rotate(12deg)}50%{transform:rotate(-12deg)}}
@keyframes sst-look{0%,40%{transform:translateX(-2px)}50%,90%{transform:translateX(2.5px)}100%{transform:translateX(-2px)}}
@keyframes sst-flap{to{transform:rotate(-16deg)}}
@keyframes sst-shake{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes sst-drop{from{transform:translateY(-200px)}to{transform:translateY(0)}}
@keyframes sst-sweat{from{transform:translateY(0);opacity:1}to{transform:translateY(14px);opacity:0}}
@keyframes sst-glow{0%,100%{opacity:.22;transform:scale(1)}50%{opacity:.45;transform:scale(1.07)}}
@keyframes sst-pop{from{transform:scale(.6);opacity:0}}
@keyframes sst-spark{0%,100%{transform:scale(.4);opacity:0}50%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`;

const SHIELD_PATH = 'M100 22 L158 44 V96 C158 136 132 160 100 176 C68 160 42 136 42 96 V44 Z';

const legs = (walk: boolean): string => `
<g class="${walk ? 'sst-leg-l' : ''}"><rect x="82" y="140" width="14" height="36" rx="6" fill="#2b2f45"/><ellipse cx="86" cy="178" rx="11" ry="6" fill="#111"/></g>
<g class="${walk ? 'sst-leg-r' : ''}"><rect x="104" y="140" width="14" height="36" rx="6" fill="#2b2f45"/><ellipse cx="114" cy="178" rx="11" ry="6" fill="#111"/></g>`;

// Striped shirt: the classic cartoon-burglar sign, readable even at 48 px.
const body = `<rect x="66" y="94" width="68" height="54" rx="22" fill="${INK}"/>
<rect x="70" y="106" width="60" height="7" rx="3" fill="#f4f4f5"/><rect x="70" y="120" width="60" height="7" rx="3" fill="#f4f4f5"/>
<rect x="72" y="134" width="56" height="6" rx="3" fill="#f4f4f5"/>`;

const head = (shocked: boolean, watching: boolean): string => `
<circle cx="100" cy="70" r="30" fill="${SKIN}"/>
<path d="M70 66 C70 36 130 36 130 66 Z" fill="#2b2f45"/><rect x="68" y="58" width="64" height="10" rx="5" fill="#3a3f5c"/>
<circle cx="100" cy="37" r="7" fill="#e63946"/>
<rect x="72" y="67" width="56" height="15" rx="7.5" fill="#111"/>
<path class="sst-tail" d="M127 70 L142 64 L139 79 Z" fill="#111"/>
<ellipse cx="88" cy="74" rx="6.5" ry="5" fill="#fff"/><ellipse cx="112" cy="74" rx="6.5" ry="5" fill="#fff"/>
<g class="${watching ? 'sst-eyes' : ''}"><circle cx="89" cy="74.5" r="2.8" fill="#111"/><circle cx="113" cy="74.5" r="2.8" fill="#111"/></g>
${shocked ? '<ellipse cx="100" cy="91" rx="5" ry="6" fill="#6b3a2a"/>' : '<path d="M91 89 Q101 95 110 88" stroke="#6b3a2a" stroke-width="3" fill="none" stroke-linecap="round"/>'}`;

const sack = (x: number, y: number): string => `<g transform="translate(${x} ${y})">
<path d="M8 10 C30 -2 52 14 48 40 C45 62 16 66 6 48 C0 36 -2 18 8 10 Z" fill="#c4975a" stroke="#8a6532" stroke-width="3"/>
<rect x="12" y="4" width="16" height="8" rx="4" fill="#8a6532"/>
<text x="27" y="42" font-family="system-ui,sans-serif" font-size="15" font-weight="800" fill="#5e4220" text-anchor="middle">lei</text></g>`;

const hand = (cx: number, cy: number): string => `<circle cx="${cx}" cy="${cy}" r="7.5" fill="${SKIN}"/>`;
const arm = (d: string): string => `<path d="${d}" stroke="${INK}" stroke-width="13" fill="none" stroke-linecap="round"/>`;

const shadow = '<ellipse cx="100" cy="186" rx="46" ry="7" fill="#000" opacity=".16"/>';

function sneak(): string {
  return `${shadow}<g class="sst-bob">${sack(124, 60)}${legs(true)}${body}
${arm('M72 106 Q52 118 56 134')}${hand(56, 137)}${arm('M128 106 Q142 98 138 84')}${hand(138, 82)}
${head(false, true)}</g>`;
}

function peek(): string {
  // The thief hides behind the shield and peeks around its edge: something here needs checking.
  return `${shadow}<g transform="translate(34 0)"><g>${legs(false)}${body}${arm('M128 106 Q146 112 144 128')}${hand(144, 131)}
${head(false, true)}</g></g>
<path d="${SHIELD_PATH}" fill="${SHIELD}" stroke="#fff" stroke-width="5" transform="translate(-14 4)"/>
<text x="86" y="120" font-family="system-ui,sans-serif" font-size="58" font-weight="900" fill="#ffd36e" text-anchor="middle">?</text>
${hand(143, 62)}`;
}

function caught(): string {
  const bars = [44, 74, 104, 134, 164].map((x) => `<rect x="${x - 4}" y="20" width="8" height="166" rx="4" fill="#4a5068"/>`).join('');
  return `${shadow}${sack(18, 136)}<g class="sst-shake">${legs(false)}${body}
${arm('M72 106 Q52 90 56 66')}${hand(56, 62)}${arm('M128 106 Q148 90 144 66')}${hand(144, 62)}
${head(true, false)}<path class="sst-sweat" d="M138 44 C144 54 146 58 141 61 C136 63 133 58 138 44 Z" fill="#6ec6ff"/></g>
<g class="sst-bars"><rect x="34" y="16" width="132" height="9" rx="4.5" fill="#4a5068"/>${bars}</g>`;
}

function safe(): string {
  return `<circle class="sst-glow" cx="100" cy="98" r="80" fill="#2e7d4f" opacity=".22"/>
<g class="sst-pop"><path d="${SHIELD_PATH}" fill="#2e7d4f" stroke="#fff" stroke-width="6"/>
<path d="M72 98 L92 118 L130 78" stroke="#fff" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<path class="sst-spark" d="M150 28 L154 38 L164 40 L154 43 L150 53 L146 43 L136 40 L146 38 Z" fill="#ffd36e"/>`;
}

const DRAW: Record<ThiefMood, () => string> = { sneak, peek, caught, safe };

/** The figure as SVG markup. Pure and fixed: the same mood always gives the same picture. */
export function thiefSvg(mood: ThiefMood): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${STYLE}${DRAW[mood]()}</svg>`;
}

/** For an `<img src>`: works in React and inside WhatsApp Web without touching innerHTML. */
export function thiefDataUrl(mood: ThiefMood): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thiefSvg(mood))}`;
}

/** Which figure goes with a verdict. */
export function moodFor(verdict: 'SAFE' | 'SUSPICIOUS' | 'SCAM'): ThiefMood {
  return verdict === 'SCAM' ? 'caught' : verdict === 'SUSPICIOUS' ? 'peek' : 'safe';
}
