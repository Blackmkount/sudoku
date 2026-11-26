// ─────────────────────────────────────────────────────────────
//  Avatares ilustrados (SVG por capas)
//  Un avatar se guarda como código corto: letra de la ranura + índice.
//  Ej.: s1e0m0h0c1t0k0g0a0r0n0f0b0
// ─────────────────────────────────────────────────────────────

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((x) => (amt < 0 ? x * (1 + amt) : x + (255 - x) * amt));
  return `#${ch.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
};

// ── Catálogo ────────────────────────────────────────────────
const SKINS = ['#FCE4D3', '#F4C9A8', '#E2AA80', '#C68B5F', '#9C6541', '#6E432A'];
const HAIR_COLORS = [
  ['Negro', '#2A2421', 0], ['Castaño', '#6A4229', 0], ['Rubio', '#E1B55E', 0], ['Pelirrojo', '#B5532C', 400],
  ['Platino', '#E9E3D6', 600], ['Rosa pastel', '#F3A7C8', 900], ['Lila', '#B9A3EA', 900], ['Azul cielo', '#86B9EC', 900],
  ['Menta', '#97D8C1', 900], ['Cereza', '#8E2C4B', 700],
];
const TOP_COLORS = [
  ['Blanco', '#F3F2EF'], ['Negro', '#2B2D33'], ['Marino', '#2F4A7A'], ['Rojo', '#D4534D'], ['Mostaza', '#E1B04B'],
  ['Verde', '#4F9D69'], ['Rosa pastel', '#F6B5CD'], ['Lila pastel', '#C8B5F1'], ['Menta', '#A6DFC8'], ['Melocotón', '#F8C3A4'],
  ['Celeste', '#A8D1F2'],
];
const BGS = [
  ['Cielo', 0, '#CFE3FF'], ['Menta', 0, '#CDEFE2'], ['Melocotón', 0, '#FFE0CC'], ['Lila', 400, '#E4DAFF'],
  ['Rosa', 400, '#FFD6E5'], ['Atardecer', 900, 'grad'], ['Azulejo', 1200, 'tile'], ['Noche estrellada', 1200, 'stars'],
  ['Corazones', 1200, 'hearts'], ['Nubes', 1000, 'clouds'],
];

export const SLOTS = [
  { key: 's', name: 'Piel', view: '45 35 110 110', items: SKINS.map((c, k) => ({ name: `Tono ${k + 1}`, price: 0, color: c })) },
  { key: 'h', name: 'Peinado', view: '0 0 200 200', items: [
    ['Corto', 0], ['Largo liso', 0], ['Coleta', 0], ['Melena bob', 600], ['Rizos', 900], ['Moño', 700],
    ['Trenzas', 1000], ['Afro', 900], ['Ondas largas', 1100], ['Dos coletas', 1000], ['Rapado', 0], ['Tupé', 800],
  ].map(([name, price]) => ({ name, price })) },
  { key: 'c', name: 'Color de pelo', view: '0 0 200 200', items: HAIR_COLORS.map(([name, color, price]) => ({ name, color, price })) },
  { key: 'e', name: 'Ojos', view: '60 70 80 45', items: [['Normales', 0], ['Felices', 0], ['Pestañas', 0], ['Brillantes', 500], ['Guiño', 500]].map(([name, price]) => ({ name, price })) },
  { key: 'm', name: 'Boca', view: '70 95 60 40', items: [['Sonrisa', 0], ['Carcajada', 0], ['Tímida', 0], ['Traviesa', 400], ['Labios rojos', 600]].map(([name, price]) => ({ name, price })) },
  { key: 't', name: 'Ropa', view: '10 110 180 90', items: [
    ['Camiseta', 0], ['Sudadera', 900], ['Cuello alto', 1000], ['Blusa con cuello', 1100], ['Chaqueta vaquera', 1300],
    ['Americana', 1600], ['Vestido de tirantes', 1400], ['Jersey con corazón', 1200], ['Kimono', 2000],
  ].map(([name, price]) => ({ name, price })) },
  { key: 'k', name: 'Color de ropa', view: '10 110 180 90', items: TOP_COLORS.map(([name, color]) => ({ name, color, price: 0 })) },
  { key: 'g', name: 'Gafas', view: '50 70 100 50', items: [['Sin gafas', 0], ['Redondas', 700], ['Cuadradas', 700], ['De sol', 1200], ['Corazón', 1600], ['Ojo de gato', 1300]].map(([name, price]) => ({ name, price })) },
  { key: 'a', name: 'Cabeza', view: '10 0 180 110', items: [
    ['Nada', 0], ['Gorro de lana', 900], ['Gorra', 800], ['Boina', 1000], ['Lazo', 700], ['Orejas de gato', 1200],
    ['Corona de flores', 1800], ['Sombrero de sol', 1700], ['Auriculares', 1400], ['Corona real', 4000],
  ].map(([name, price]) => ({ name, price })) },
  { key: 'r', name: 'Pendientes', view: '40 80 120 60', items: [['Sin pendientes', 0], ['Aros dorados', 700], ['Perlas', 900], ['Estrellas', 800], ['Corazones', 800]].map(([name, price]) => ({ name, price })) },
  { key: 'n', name: 'Collar', view: '55 125 90 60', items: [['Sin collar', 0], ['Cadena', 700], ['Perlas', 1200], ['Corazón', 1000]].map(([name, price]) => ({ name, price })) },
  { key: 'f', name: 'Barba', view: '55 85 90 65', items: [['Sin barba', 0], ['Barba corta', 0], ['Bigote', 0], ['Perilla', 0], ['Barba completa', 0]].map(([name, price]) => ({ name, price })) },
  { key: 'b', name: 'Fondo', view: '0 0 200 200', items: BGS.map(([name, price, bg]) => ({ name, price, bg })) },
];
const ORDER = ['s', 'e', 'm', 'h', 'c', 't', 'k', 'g', 'a', 'r', 'n', 'f', 'b'];
export const slot = (key) => SLOTS.find((x) => x.key === key);
export const DEFAULT_CODE = 's1e0m0h0c1t0k0g0a0r0n0f0b0';

// Caras para empezar (todas gratis)
export const PRESETS = [
  's0e2m0h1c2t0k6g0a0r0n0f0b4',
  's3e0m1h0c0t0k2g0a0r0n0f1b0',
  's1e1m0h2c1t0k7g0a0r0n0f0b3',
  's5e2m0h1c0t0k9g0a0r0n0f0b2',
  's2e0m1h10c0t0k5g0a0r0n0f4b1',
  's4e1m2h2c0t0k8g0a0r0n0f0b1',
];

export const isCode = (v) => typeof v === 'string' && /^([a-z]\d+)+$/.test(v);
export function parse(code) {
  const o = {};
  for (const k of ORDER) o[k] = 0;
  const src = isCode(code) ? code : DEFAULT_CODE;
  for (const [, k, n] of src.matchAll(/([a-z])(\d+)/g)) {
    const s = slot(k);
    if (s && +n < s.items.length) o[k] = +n;
  }
  return o;
}
export const stringify = (o) => ORDER.map((k) => `${k}${o[k] || 0}`).join('');

// ── Dibujo ──────────────────────────────────────────────────
const INK = '#2A2730';
let uid = 0;

function background(kind, id) {
  const b = BGS[kind];
  if (b[2] === 'grad') {
    return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9A8"/><stop offset="1" stop-color="#FFA9C9"/></linearGradient></defs><rect width="200" height="200" fill="url(#${id}g)"/>`;
  }
  if (b[2] === 'tile') {
    return `<defs><pattern id="${id}p" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#F4F7FD"/>
      <path d="M20 4c3 7 6 10 16 16-10 6-13 9-16 16-3-7-6-10-16-16C14 14 17 11 20 4z" fill="#9DB4E8"/><circle cx="20" cy="20" r="3" fill="#F4F7FD"/>
      <path d="M0 0h6M0 0v6M40 0h-6M40 0v6M0 40h6M0 40v-6M40 40h-6M40 40v-6" stroke="#9DB4E8" stroke-width="2"/></pattern></defs><rect width="200" height="200" fill="url(#${id}p)"/>`;
  }
  if (b[2] === 'stars') {
    const st = [[30, 30, 4], [160, 40, 3], [140, 120, 2.5], [40, 130, 3], [90, 20, 2], [175, 150, 3.5], [20, 80, 2], [110, 175, 2]];
    return `<rect width="200" height="200" fill="#2E3F7A"/>${st.map(([x, y, r]) => `<path d="M${x} ${y - r * 2}L${x + r * 0.6} ${y - r * 0.6}L${x + r * 2} ${y}L${x + r * 0.6} ${y + r * 0.6}L${x} ${y + r * 2}L${x - r * 0.6} ${y + r * 0.6}L${x - r * 2} ${y}L${x - r * 0.6} ${y - r * 0.6}Z" fill="#FFE49A"/>`).join('')}`;
  }
  if (b[2] === 'hearts') {
    const hs = [[28, 34], [168, 30], [150, 118], [30, 120], [96, 16], [176, 168], [18, 176], [70, 186]];
    return `<rect width="200" height="200" fill="#FFD3E3"/>${hs.map(([x, y]) => `<path transform="translate(${x} ${y}) scale(.7)" d="M0 6C-6 0-12 -2-12-8a6 6 0 0 1 12-2a6 6 0 0 1 12 2C12-2 6 0 0 6z" fill="#FF8FB8"/>`).join('')}`;
  }
  if (b[2] === 'clouds') {
    const cl = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><circle cx="0" cy="0" r="10"/><circle cx="12" cy="-4" r="13"/><circle cx="26" cy="2" r="9"/><rect x="-6" y="0" width="38" height="10" rx="5"/></g>`;
    return `<rect width="200" height="200" fill="#BFE0FF"/>${cl(18, 40, 1)}${cl(140, 26, 0.9)}${cl(150, 130, 1.1)}${cl(16, 150, 0.8)}`;
  }
  return `<rect width="200" height="200" fill="${b[2]}"/>`;
}

const FACE = 'M62 90C62 62 79 47 100 47C121 47 138 62 138 90C138 116 122 136 100 137C78 136 62 116 62 90Z';
const TORSO = 'M22 202C24 170 52 152 86 148L114 148C148 152 176 170 178 202Z';

function hair(style, col, layer) {
  const dk = shade(col, -0.18), lt = shade(col, 0.22);
  const p = (d, f = col) => `<path d="${d}" fill="${f}"/>`;
  const shine = (d) => `<path d="${d}" fill="none" stroke="${lt}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
  const curls = (pts, r, f = col) => pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr || r}" fill="${f}"/>`).join('');
  if (layer === 'back') {
    switch (style) {
      case 1: return p('M56 92C54 56 76 36 100 36C124 36 146 56 144 92L146 148L54 148Z', dk);
      case 3: return p('M56 92C54 58 76 38 100 38C124 38 146 58 144 92L144 128L56 128Z', dk);
      case 4: {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const t = Math.PI * (1.08 - (k / 12) * 1.16); pts.push([100 + 50 * Math.cos(t), 92 - 50 * Math.sin(t)]); }
        pts.push([52, 118], [50, 134], [148, 118], [150, 134], [58, 146], [142, 146]);
        return curls(pts, 15, dk);
      }
      case 5: return `<circle cx="100" cy="30" r="17" fill="${col}"/>${shine('M92 22Q100 16 108 22')}`;
      case 7: {
        const pts = [];
        for (let k = 0; k < 18; k++) { const t = (k / 18) * Math.PI * 2; pts.push([100 + 54 * Math.cos(t), 84 + 50 * Math.sin(t)]); }
        return `<circle cx="100" cy="84" r="56" fill="${col}"/>${curls(pts, 14)}`;
      }
      case 8: return p('M54 92C52 56 76 36 100 36C124 36 148 56 146 92L148 148L52 148Z', dk);
      case 9: return `${p('M36 88C30 100 30 122 42 134C50 140 58 132 56 120C54 108 56 96 60 88Z')}${p('M164 88C170 100 170 122 158 134C150 140 142 132 144 120C146 108 144 96 140 88Z')}
        <circle cx="58" cy="86" r="4" fill="#F17FA8"/><circle cx="142" cy="86" r="4" fill="#F17FA8"/>`;
      case 2: return `${p('M126 58C150 54 162 80 158 108C156 128 150 144 142 156C142 136 144 116 140 98C138 84 134 72 122 64Z')}<circle cx="128" cy="62" r="5" fill="#F17FA8"/>`;
      default: return '';
    }
  }
  switch (style) {
    case 0: return p('M58 96C54 62 72 38 101 38C130 38 148 60 142 96C139 84 136 76 130 70C120 76 104 74 90 68C82 70 72 74 66 82C62 86 60 90 58 96Z') + shine('M80 50Q100 42 120 50');
    case 1: return p('M60 98C56 60 76 40 101 40C126 40 146 60 140 98L144 176C136 182 126 182 120 176L124 112C122 94 118 80 112 70C100 78 84 80 72 74C70 86 74 100 78 112L80 176C74 182 64 182 56 176Z') + shine('M78 52Q96 44 112 50');
    case 2: return p('M60 92C58 60 78 40 100 40C122 40 142 60 140 92C136 74 124 62 108 60C98 62 80 66 70 76C64 82 62 86 60 92Z') + shine('M80 50Q98 43 116 50');
    case 3: return p('M62 86C60 56 80 42 100 42C120 42 140 56 138 86C134 82 130 80 126 82C122 76 118 74 114 78C108 72 104 72 100 76C96 72 92 72 86 78C82 74 78 76 74 82C70 80 66 82 62 86Z')
      + p('M54 90C54 108 56 120 54 128C62 133 72 133 80 129C76 116 72 102 68 88Z') + p('M146 90C146 108 144 120 146 128C138 133 128 133 120 129C124 116 128 102 132 88Z') + shine('M82 50Q100 44 118 50');
    case 4: {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const t = Math.PI * (1.02 - (k / 10) * 1.04); pts.push([100 + 40 * Math.cos(t), 76 - 30 * Math.sin(t)]); }
      return curls(pts, 12) + curls([[68, 86, 9], [132, 86, 9], [84, 62, 10], [116, 62, 10], [100, 58, 11]], 10);
    }
    case 5: return p('M60 92C58 60 78 42 100 42C122 42 142 60 140 92C136 74 124 62 100 60C76 62 64 74 60 92Z') + shine('M80 50Q100 44 120 50');
    case 6: {
      const braid = (x, dir) => Array.from({ length: 6 }, (_, k) => `<ellipse cx="${x + (k % 2 ? 3 : -3) * dir}" cy="${114 + k * 12}" rx="9" ry="8" fill="${k % 2 ? col : dk}"/>`).join('')
        + `<circle cx="${x}" cy="${186}" r="4.5" fill="#F17FA8"/>`;
      return braid(62, 1) + braid(138, -1) + p('M60 96C58 60 78 40 100 40C122 40 142 60 140 96C136 78 126 66 112 62L100 54L88 62C74 66 64 78 60 96Z') + shine('M78 54Q88 46 98 48M102 48Q112 46 122 54');
    }
    case 7: {
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = Math.PI * (0.94 - (k / 8) * 0.88); pts.push([100 + 36 * Math.cos(t), 80 - 26 * Math.sin(t)]); }
      return curls(pts, 9);
    }
    case 8: return p('M60 98C54 60 78 38 104 40C130 42 148 62 140 98C146 116 136 128 144 146C150 160 138 170 144 180C134 184 124 182 118 176C124 162 114 150 120 136C126 120 120 102 116 84C112 76 108 70 104 66C94 76 80 80 70 76C68 90 76 104 76 118C76 134 86 146 80 160C76 170 84 176 80 182C70 184 60 182 54 176C60 166 50 156 56 142C62 128 52 114 60 98Z') + shine('M82 50Q100 42 118 52');
    case 9: return p('M62 88C60 58 80 42 100 42C120 42 140 58 138 88C130 80 124 78 120 82C114 74 106 74 100 80C94 74 86 74 80 82C76 78 70 80 62 88Z') + shine('M82 50Q100 44 118 50');
    case 10: return `<path d="M64 86C62 58 80 46 100 46C120 46 138 58 136 86C132 72 118 64 100 64C82 64 68 72 64 86Z" fill="${col}" opacity=".88"/>`;
    case 11: return p('M60 94C56 60 72 40 96 32C114 28 134 34 142 52C148 66 144 82 140 94C138 82 134 74 128 70C118 74 104 72 94 66C84 70 74 76 66 84C64 88 62 90 60 94Z') + shine('M90 40Q112 32 132 44');
    default: return '';
  }
}

function top(style, color, skin) {
  const dk = shade(color, -0.16), lt = shade(color, 0.3);
  const base = `<path d="${TORSO}" fill="${color}"/><path d="M40 202C42 184 52 172 64 166" stroke="${dk}" stroke-width="3" fill="none" opacity=".5"/><path d="M160 202C158 184 148 172 136 166" stroke="${dk}" stroke-width="3" fill="none" opacity=".5"/>`;
  switch (style) {
    case 1: return `${base}<path d="M64 160C68 140 86 134 100 134C114 134 132 140 136 160C122 152 112 150 100 150C88 150 78 152 64 160Z" fill="${dk}"/>
      <path d="M93 156L91 182M107 156L109 182" stroke="${lt}" stroke-width="2.5" stroke-linecap="round"/><circle cx="91" cy="184" r="2.5" fill="${lt}"/><circle cx="109" cy="184" r="2.5" fill="${lt}"/>`;
    case 2: return `${base}<path d="M84 126L116 126L118 152C108 158 92 158 82 152Z" fill="${color}"/><path d="M84 126L116 126L118 152C108 158 92 158 82 152Z" fill="${dk}" opacity=".25"/>
      ${[88, 94, 100, 106, 112].map((x) => `<path d="M${x} 128V154" stroke="${dk}" stroke-width="1.4" opacity=".6"/>`).join('')}`;
    case 3: return `${base}<path d="M86 148C90 158 110 158 114 148" stroke="${dk}" stroke-width="2.5" fill="none"/>
      <path d="M100 152C92 148 82 148 78 154C76 164 88 170 99 163Z" fill="#FFFFFF" stroke="${shade('#FFFFFF', -0.12)}" stroke-width="1.5"/>
      <path d="M100 152C108 148 118 148 122 154C124 164 112 170 101 163Z" fill="#FFFFFF" stroke="${shade('#FFFFFF', -0.12)}" stroke-width="1.5"/>
      ${[172, 186].map((y) => `<circle cx="100" cy="${y}" r="2.2" fill="${dk}"/>`).join('')}`;
    case 4: return `${base}<path d="M86 148L100 178L114 148Z" fill="#FFFFFF"/><path d="M86 148L100 178L92 184L76 154Z" fill="${dk}"/><path d="M114 148L100 178L108 184L124 154Z" fill="${dk}"/>
      <path d="M100 180V202" stroke="${dk}" stroke-width="2"/><circle cx="104" cy="188" r="1.8" fill="${lt}"/><circle cx="104" cy="198" r="1.8" fill="${lt}"/>
      <path d="M50 176h20M130 176h20" stroke="${lt}" stroke-width="2" stroke-dasharray="3 3" opacity=".8"/>`;
    case 5: return `${base}<path d="M86 148L100 180L114 148Z" fill="#FFFFFF"/><path d="M97 156L103 156L105 182L100 188L95 182Z" fill="#C8434F"/>
      <path d="M86 148L100 182L90 188L72 156Z" fill="${dk}"/><path d="M114 148L100 182L110 188L128 156Z" fill="${dk}"/><circle cx="100" cy="196" r="2" fill="${lt}"/>`;
    case 6: return `<path d="${TORSO}" fill="${skin}"/><path d="M38 202C42 184 58 170 78 168L122 168C142 170 158 184 162 202Z" fill="${color}"/>
      <path d="M80 170L78 150M120 170L122 150" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M78 168Q100 176 122 168" stroke="${dk}" stroke-width="2" fill="none"/>
      ${[[70, 186], [100, 184], [130, 188], [86, 196], [116, 198]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${lt}"/>`).join('')}`;
    case 7: return `${base}<path d="M86 148C90 160 110 160 114 148" stroke="${dk}" stroke-width="5" fill="none"/>
      <path transform="translate(124 182) scale(.9)" d="M0 7C-7 1-12-2-12-8a6 6 0 0 1 12-2a6 6 0 0 1 12 2C12-2 7 1 0 7z" fill="${color === '#F3F2EF' ? '#F06D96' : '#FFFFFF'}"/>`;
    case 8: return `${base}${[[50, 186], [70, 172], [140, 176], [160, 192], [62, 198], [134, 196]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${lt}"/>`).join('')}
      <path d="M86 147L118 202L104 202L80 152Z" fill="${lt}"/><path d="M114 147L92 190" stroke="${dk}" stroke-width="7" stroke-linecap="round"/><path d="M114 147L92 190" stroke="${lt}" stroke-width="3" stroke-linecap="round"/>`;
    default: return `${base}<path d="M86 148C90 158 110 158 114 148" stroke="${dk}" stroke-width="3" fill="none"/>`;
  }
}

function eyes(style) {
  const lid = (x) => `<path d="M${x - 6.6} 93.4Q${x} 87.6 ${x + 6.6} 93.4" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const open = (x, big = false) => `<ellipse cx="${x}" cy="94" rx="${big ? 7 : 6}" ry="${big ? 6.4 : 5.4}" fill="#fff"/>
    <circle cx="${x + 0.4}" cy="94.4" r="${big ? 5 : 3.9}" fill="#5A3B2B"/><circle cx="${x + 0.4}" cy="94.4" r="${big ? 2.6 : 2}" fill="${INK}"/>
    <circle cx="${x + 1.9}" cy="92.6" r="${big ? 1.7 : 1.2}" fill="#fff"/>${big ? `<circle cx="${x - 1.6}" cy="96.6" r=".9" fill="#fff"/>` : ''}${lid(x)}`;
  const happy = (x) => `<path d="M${x - 6} 96Q${x} 89 ${x + 6} 96" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  const lashes = `<path d="M79.5 91.5L76.5 88.5M81 89.5L79 85.5M120.5 91.5L123.5 88.5M119 89.5L121 85.5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  switch (style) {
    case 1: return happy(86) + happy(114);
    case 2: return open(86) + open(114) + lashes;
    case 3: return open(86, true) + open(114, true) + lashes;
    case 4: return open(86) + happy(114);
    default: return open(86) + open(114);
  }
}

function mouth(style) {
  const lip = '#7A3B3B';
  switch (style) {
    case 1: return `<path d="M88 114Q100 132 112 114Z" fill="${lip}"/><path d="M90 115Q100 119 110 115L109 117Q100 121 91 117Z" fill="#fff"/><path d="M94 123Q100 127 106 123" stroke="#E3797F" stroke-width="3" stroke-linecap="round"/>`;
    case 2: return `<path d="M95 118Q100 121 105 118" stroke="${lip}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 3: return `<path d="M90 115Q100 126 110 115" stroke="${lip}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M101 120Q106 128 110 120" fill="#F07C8C"/>`;
    case 4: return `<path d="M89 117C93 112 98 114 100 116C102 114 107 112 111 117C107 124 93 124 89 117Z" fill="#D2385A"/><path d="M90 117Q100 119 110 117" stroke="#9E2443" stroke-width="1.2" fill="none"/>`;
    default: return `<path d="M90 115Q100 125 110 115" stroke="${lip}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }
}

function beard(style, col) {
  const mus = `<path d="M86 114C92 108 98 110 100 112C102 110 108 108 114 114C108 116 102 115 100 114C98 115 92 116 86 114Z" fill="${col}"/>`;
  switch (style) {
    case 1: return `<path d="M64 100C66 124 82 139 100 139C118 139 134 124 136 100C132 112 126 120 118 124C112 119 88 119 82 124C74 120 68 112 64 100Z" fill="${col}" opacity=".9"/>${mus}`;
    case 2: return `<path d="M82 115C88 106 98 108 100 111C102 108 112 106 118 115C112 118 104 116 100 114C96 116 88 118 82 115Z" fill="${col}"/>`;
    case 3: return `${mus}<path d="M92 124C93 135 107 135 108 124C104 127 96 127 92 124Z" fill="${col}"/>`;
    case 4: return `<path d="M62 96C62 126 80 150 100 150C120 150 138 126 138 96C134 110 128 118 120 122C112 117 88 117 80 122C72 118 66 110 62 96Z" fill="${col}"/>${mus}`;
    default: return '';
  }
}

function glasses(style) {
  const frame = '#2E2E36';
  switch (style) {
    case 1: return `<g fill="rgba(255,255,255,.18)" stroke="${frame}" stroke-width="2.6"><circle cx="86" cy="94" r="11"/><circle cx="114" cy="94" r="11"/></g><path d="M97 93Q100 90 103 93M75 92L63 89M125 92L137 89" stroke="${frame}" stroke-width="2.4" fill="none"/>`;
    case 2: return `<g fill="rgba(255,255,255,.18)" stroke="${frame}" stroke-width="2.6"><rect x="74" y="85" width="23" height="18" rx="4"/><rect x="103" y="85" width="23" height="18" rx="4"/></g><path d="M97 92H103M74 90L63 88M126 90L137 88" stroke="${frame}" stroke-width="2.4"/>`;
    case 3: return `<g fill="#1F2028" stroke="#111" stroke-width="2"><path d="M72 86H98V96C98 104 92 106 85 106C77 106 72 102 72 94Z"/><path d="M102 86H128V94C128 102 123 106 115 106C108 106 102 104 102 96Z"/></g>
      <path d="M98 89H102M72 88L63 87M128 88L137 87" stroke="#111" stroke-width="2.4"/><path d="M77 90L84 90M107 90L114 90" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/>`;
    case 4: { const h = (x) => `<path transform="translate(${x} 97)" d="M0 9C-9 2-14-2-14-8a7 7 0 0 1 14-2a7 7 0 0 1 14 2C14-2 9 2 0 9z" fill="rgba(255,105,160,.55)" stroke="#E3457E" stroke-width="2.4"/>`; return h(86) + h(114) + '<path d="M97 92Q100 89 103 92M72 90L63 88M128 90L137 88" stroke="#E3457E" stroke-width="2.4" fill="none"/>'; }
    case 5: return `<g fill="rgba(255,255,255,.15)" stroke="#8E2C4B" stroke-width="2.8"><path d="M72 90C72 86 78 86 86 87C93 88 98 88 98 92C98 100 92 104 85 104C78 104 73 98 72 90L68 84Z"/><path d="M128 90C128 86 122 86 114 87C107 88 102 88 102 92C102 100 108 104 115 104C122 104 127 98 128 90L132 84Z"/></g><path d="M98 91H102" stroke="#8E2C4B" stroke-width="2.4"/>`;
    default: return '';
  }
}

function headwear(style, accent) {
  switch (style) {
    case 1: return `<path d="M58 80C58 44 78 28 100 28C122 28 142 44 142 80Z" fill="#E0567A"/><path d="M56 70C70 64 130 64 144 70L144 86C130 80 70 80 56 86Z" fill="#B83F60"/>
      ${[64, 76, 88, 100, 112, 124, 136].map((x) => `<path d="M${x} 70V82" stroke="#9C3452" stroke-width="2"/>`).join('')}<circle cx="100" cy="24" r="11" fill="#F8E6EC"/>`;
    case 2: return `<path d="M60 76C60 44 78 32 100 32C122 32 140 44 140 76Z" fill="#3D6FD1"/><path d="M62 74C82 66 120 66 138 74C150 76 164 82 168 90C152 90 140 84 128 82C108 78 86 78 62 82Z" fill="#2B56A8"/><circle cx="100" cy="32" r="3.5" fill="#2B56A8"/><path d="M100 34V70" stroke="#2B56A8" stroke-width="1.5" opacity=".6"/>`;
    case 3: return `<path d="M54 68C56 40 96 28 128 36C152 42 154 62 140 70C120 64 82 62 54 68Z" fill="#C8434F"/><path d="M114 34L118 24" stroke="#C8434F" stroke-width="4" stroke-linecap="round"/><path d="M58 66C80 60 118 60 140 68" stroke="#9E3039" stroke-width="2" fill="none"/>`;
    case 4: return `<g transform="translate(128 50) rotate(18)"><path d="M0 0L-20-12L-20 12Z" fill="#F17FA8"/><path d="M0 0L20-12L20 12Z" fill="#F17FA8"/><circle r="5" fill="#E05A8E"/></g>`;
    case 5: return `<path d="M64 64L70 28L94 50Z" fill="#3B3640"/><path d="M70 56L73 38L86 50Z" fill="#F4A6C1"/><path d="M136 64L130 28L106 50Z" fill="#3B3640"/><path d="M130 56L127 38L114 50Z" fill="#F4A6C1"/><path d="M60 72C70 50 130 50 140 72" stroke="#3B3640" stroke-width="5" fill="none"/>`;
    case 6: {
      const fl = [[64, 66, '#F6A5C0'], [74, 52, '#FFE07A'], [88, 44, '#B9A3EA'], [100, 42, '#F6A5C0'], [112, 44, '#9ED9C3'], [126, 52, '#FFE07A'], [136, 66, '#B9A3EA']];
      return `<path d="M60 70C70 46 130 46 140 70" stroke="#6BAF7C" stroke-width="3" fill="none"/>` + fl.map(([x, y, c]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(5 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(5 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="4.2" fill="${c}"/>`).join('')}<circle r="3" fill="#FFF6D8"/></g>`).join('');
    }
    case 7: return `<ellipse cx="100" cy="64" rx="72" ry="16" fill="#E6C383"/><path d="M68 62C68 34 84 24 100 24C116 24 132 34 132 62Z" fill="#EDCF94"/><path d="M68 54C80 50 120 50 132 54L132 62C120 58 80 58 68 62Z" fill="${accent}"/><ellipse cx="100" cy="64" rx="72" ry="16" fill="none" stroke="#C9A462" stroke-width="2"/>`;
    case 8: return `<path d="M58 96C56 46 144 46 142 96" stroke="#2F3240" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="48" y="82" width="18" height="30" rx="8" fill="${accent}"/><rect x="134" y="82" width="18" height="30" rx="8" fill="${accent}"/><rect x="52" y="86" width="10" height="22" rx="5" fill="#2F3240"/><rect x="138" y="86" width="10" height="22" rx="5" fill="#2F3240"/>`;
    case 9: return `<path d="M68 56L72 26L86 42L100 20L114 42L128 26L132 56Z" fill="#F2C14E" stroke="#C99520" stroke-width="2" stroke-linejoin="round"/><rect x="68" y="50" width="64" height="9" rx="3" fill="#E0AE36"/><circle cx="100" cy="36" r="4" fill="#E0457B"/><circle cx="82" cy="46" r="3" fill="#4AA3E8"/><circle cx="118" cy="46" r="3" fill="#4AA3E8"/>`;
    default: return '';
  }
}

function earrings(style) {
  const at = (x) => {
    switch (style) {
      case 1: return `<circle cx="${x}" cy="112" r="5.5" fill="none" stroke="#E2B13C" stroke-width="2.4"/>`;
      case 2: return `<circle cx="${x}" cy="109" r="3.6" fill="#FBF7EE" stroke="#D9D1BF" stroke-width="1"/><circle cx="${x - 1}" cy="108" r="1.1" fill="#fff"/>`;
      case 3: return `<path transform="translate(${x} 111)" d="M0-6L1.8-1.8L6 0L1.8 1.8L0 6L-1.8 1.8L-6 0L-1.8-1.8Z" fill="#F2C14E"/>`;
      case 4: return `<path transform="translate(${x} 110) scale(.42)" d="M0 7C-7 1-12-2-12-8a6 6 0 0 1 12-2a6 6 0 0 1 12 2C12-2 7 1 0 7z" fill="#E0457B"/>`;
      default: return '';
    }
  };
  return at(61) + at(139);
}

function necklace(style) {
  const chain = '<path d="M86 147C90 163 110 163 114 147" stroke="#E2B13C" stroke-width="2" fill="none"/>';
  switch (style) {
    case 1: return chain + '<circle cx="100" cy="159" r="2.5" fill="#E2B13C"/>';
    case 2: return Array.from({ length: 11 }, (_, k) => { const t = k / 10; const x = (1 - t) ** 2 * 84 + 2 * (1 - t) * t * 100 + t * t * 116; const y = (1 - t) ** 2 * 147 + 2 * (1 - t) * t * 172 + t * t * 147; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#FBF7EE" stroke="#D9D1BF" stroke-width=".8"/>`; }).join('');
    case 3: return chain + '<path transform="translate(100 162) scale(.55)" d="M0 7C-7 1-12-2-12-8a6 6 0 0 1 12-2a6 6 0 0 1 12 2C12-2 7 1 0 7z" fill="#E0457B"/>';
    default: return '';
  }
}

// Devuelve el SVG del avatar. opts.view recorta una zona (para las miniaturas del vestidor)
export function svg(input, { view = '16 18 168 168', round = true, title = '' } = {}) {
  const o = typeof input === 'string' ? parse(input) : input;
  const id = `av${++uid}`;
  const skin = SKINS[o.s] || SKINS[1];
  const skinDk = shade(skin, -0.14);
  const hc = HAIR_COLORS[o.c]?.[1] || HAIR_COLORS[1][1];
  const tc = TOP_COLORS[o.k]?.[1] || TOP_COLORS[0][1];
  const accent = TOP_COLORS[o.k === 0 ? 6 : o.k]?.[1] || '#F17FA8';
  const head = `<ellipse cx="62" cy="96" rx="7" ry="10" fill="${skin}"/><ellipse cx="138" cy="96" rx="7" ry="10" fill="${skin}"/>
    <path d="M60 94Q63 90 64 98M140 94Q137 90 136 98" stroke="${skinDk}" stroke-width="1.6" fill="none"/>
    <path d="${FACE}" fill="${skin}"/>`;
  const neck = `<path d="M87 122L87 152C93 158 107 158 113 152L113 122Z" fill="${skin}"/><path d="M87 128C93 140 107 140 113 128L113 136C106 146 94 146 87 136Z" fill="${skinDk}"/>`;
  const brows = `<path d="M78 82Q86 77 94 81M106 81Q114 77 122 82" stroke="${shade(hc, -0.25)}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const face = `<circle cx="79" cy="110" r="6.5" fill="#FF7E8A" opacity=".2"/><circle cx="121" cy="110" r="6.5" fill="#FF7E8A" opacity=".2"/>
    ${eyes(o.e)}${brows}<path d="M99 100C97 106 98 109 102 109" stroke="${shade(skin, -0.28)}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const clip = round ? `<clipPath id="${id}c"><circle cx="100" cy="100" r="100"/></clipPath>` : '';
  return `<svg class="av-svg" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title || 'Avatar'}"><defs>${clip}</defs><g ${round ? `clip-path="url(#${id}c)"` : ''}>
    ${background(o.b, id)}
    ${hair(o.h, hc, 'back')}
    ${neck}${top(o.t, tc, skin)}${necklace(o.n)}
    ${head}${face}${beard(o.f, hc)}${mouth(o.m)}
    ${hair(o.h, hc, 'front')}${earrings(o.r)}${glasses(o.g)}${headwear(o.a, accent)}
  </g></svg>`;
}

// Para mostrar avatares antiguos (emoji) que aún estén en el ranking
export function any(value, opts) {
  return isCode(value) ? svg(value, opts) : `<span class="av-emoji">${String(value || '🙂').replace(/[<>&"]/g, '')}</span>`;
}
