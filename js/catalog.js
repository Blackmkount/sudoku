// ─────────────────────────────────────────────────────────────
//  Catálogo: temas, avatares, efectos, consumibles, logros,
//  recompensas y guía de técnicas
// ─────────────────────────────────────────────────────────────

// Paletas. Cada tema define todas las variables de color de la interfaz.
const P = (o) => o;
export const PALETTES = {
  light: P({ scheme: 'light', bg: '#EEF2F8', surface: '#FFFFFF', ink: '#0E2A73', inkSoft: '#5B6A93', accent: '#1C46B2', accentStrong: '#163A96', onAccent: '#FFFFFF', line: '#CED8EC', box: '#1C46B2', peer: '#E6ECF8', same: '#CAD8F6', sel: '#A8C0F3', error: '#C23B22', errorBg: '#FBE6E1', gold: '#B8892B', hair: 'rgba(14,42,115,.12)', shade: '14,42,115' }),
  dark: P({ scheme: 'dark', bg: '#0A1430', surface: '#101D44', ink: '#E9EEFA', inkSoft: '#8E9CC4', accent: '#86A6FF', accentStrong: '#A9C0FF', onAccent: '#0A1430', line: '#22346A', box: '#5D80E3', peer: '#15265A', same: '#213D86', sel: '#2E52B0', error: '#FF8670', errorBg: '#3A1C2A', gold: '#E3B95A', hair: 'rgba(233,238,250,.1)', shade: '0,0,0' }),
  jade: P({ scheme: 'light', bg: '#E9F2EE', surface: '#FFFFFF', ink: '#0F3D31', inkSoft: '#557A6F', accent: '#137556', accentStrong: '#0E5E45', onAccent: '#FFFFFF', line: '#CBE0D7', box: '#137556', peer: '#E1EFE8', same: '#C3E2D4', sel: '#9AD1BA', error: '#C23B22', errorBg: '#FBE6E1', gold: '#B8892B', hair: 'rgba(15,61,49,.12)', shade: '15,61,49' }),
  terracota: P({ scheme: 'light', bg: '#F4EBE5', surface: '#FFFDFB', ink: '#4A2114', inkSoft: '#8A6255', accent: '#B0502C', accentStrong: '#924124', onAccent: '#FFFFFF', line: '#EAD5C9', box: '#B0502C', peer: '#F6E6DC', same: '#F0D0BF', sel: '#E6B196', error: '#B4232F', errorBg: '#FBE2E4', gold: '#A87A1F', hair: 'rgba(74,33,20,.12)', shade: '74,33,20' }),
  lavanda: P({ scheme: 'light', bg: '#EFEDF9', surface: '#FFFFFF', ink: '#2B1E5E', inkSoft: '#6E66A0', accent: '#5B45C9', accentStrong: '#4936A8', onAccent: '#FFFFFF', line: '#D9D4F0', box: '#5B45C9', peer: '#EAE6FA', same: '#D7CEF7', sel: '#B9A8F2', error: '#C23B22', errorBg: '#FBE6E1', gold: '#B8892B', hair: 'rgba(43,30,94,.12)', shade: '43,30,94' }),
  sevilla: P({ scheme: 'light', bg: '#FBEFF3', surface: '#FFFFFF', ink: '#5A1531', inkSoft: '#97607A', accent: '#C2185B', accentStrong: '#A0124A', onAccent: '#FFFFFF', line: '#F1D2DE', box: '#C2185B', peer: '#FBE6EE', same: '#F6CEDD', sel: '#EFA8C1', error: '#C2410C', errorBg: '#FDE7DB', gold: '#B8892B', hair: 'rgba(90,21,49,.12)', shade: '90,21,49' }),
  medianoche: P({ scheme: 'dark', bg: '#0B0E1A', surface: '#151A2C', ink: '#F3EBD9', inkSoft: '#A59D8A', accent: '#E2B04A', accentStrong: '#F0C66C', onAccent: '#1A1408', line: '#262C44', box: '#C99A3A', peer: '#1C2236', same: '#3A3220', sel: '#5A4A22', error: '#FF7A6B', errorBg: '#3A1E22', gold: '#E2B04A', hair: 'rgba(243,235,217,.1)', shade: '0,0,0' }),
  grafito: P({ scheme: 'dark', bg: '#121417', surface: '#1B1E23', ink: '#ECEFF3', inkSoft: '#98A0AB', accent: '#4FD1A5', accentStrong: '#7BE0BE', onAccent: '#08261C', line: '#2A2F36', box: '#3FB68E', peer: '#20262C', same: '#1F3D33', sel: '#285446', error: '#FF7A6B', errorBg: '#3A1E22', gold: '#E3B95A', hair: 'rgba(236,239,243,.1)', shade: '0,0,0' }),
};

export const THEMES = [
  { id: 'auto', name: 'Automático', desc: 'Porcelana de día y Cobalto de noche, según tu iPhone', price: 0, preview: ['light', 'dark'] },
  { id: 'light', name: 'Porcelana', desc: 'Azul cobalto sobre blanco', price: 0 },
  { id: 'dark', name: 'Cobalto', desc: 'Noche azul profunda', price: 0 },
  { id: 'jade', name: 'Jade', desc: 'Verde celadón, sereno', price: 250 },
  { id: 'terracota', name: 'Terracota', desc: 'Barro cocido y arcilla', price: 250 },
  { id: 'lavanda', name: 'Lavanda', desc: 'Violeta suave', price: 250 },
  { id: 'sevilla', name: 'Sevilla', desc: 'Rosa intenso de azulejo andaluz', price: 300 },
  { id: 'medianoche', name: 'Medianoche', desc: 'Oscuro con detalles dorados', price: 400 },
  { id: 'grafito', name: 'Grafito', desc: 'Gris carbón y verde menta', price: 400 },
];

export const AVATARS = [
  ...['🦉', '🐢', '🦊', '🐙', '🐼', '🐧'].map((e) => ({ id: e, price: 0 })),
  ...['🦄', '🐉', '🦁', '🐯', '🦋', '🐳', '🦚', '🦩'].map((e) => ({ id: e, price: 80 })),
  ...['👑', '💎', '🔥', '🌙'].map((e) => ({ id: e, price: 200 })),
];
export const FREE_AVATARS = AVATARS.filter((a) => !a.price).map((a) => a.id);

export const EFFECTS = [
  { id: 'glaze', name: 'Esmalte', desc: 'Una ola de color recorre el tablero', price: 0 },
  { id: 'confetti', name: 'Confeti de azulejos', desc: 'Lluvia de piezas de colores al resolver', price: 180 },
  { id: 'stars', name: 'Lluvia de estrellas', desc: 'Estrellas doradas desde lo alto', price: 220 },
];

export const CONSUMABLES = [
  { id: 'hint3', kind: 'hints', qty: 3, name: '3 pistas', desc: 'Señalan la próxima jugada y explican la técnica', price: 45 },
  { id: 'hint10', kind: 'hints', qty: 10, name: '10 pistas', desc: 'El paquete grande, con descuento', price: 120 },
  { id: 'life1', kind: 'lives', qty: 1, name: '1 vida extra', desc: 'Sigue jugando tras el tercer error', price: 40 },
  { id: 'life3', kind: 'lives', qty: 3, name: '3 vidas extra', desc: 'Para los Diabólicos con límite de errores', price: 100 },
];

// Regalo de bienvenida (se cuenta una sola vez aunque se sincronice)
export const WELCOME = { coins: 50, hints: 5, lives: 1 };

// Monedas base por categoría y puntos de ranking por estrella
export const REWARD = { dificil: 20, experto: 30, maestro: 45, diabolico: 80 };
export const POINTS = { dificil: 10, experto: 20, maestro: 30, diabolico: 60 };
export const STAR_MULT = [0, 1, 1.5, 2];
export const DAILY = { coins: 60, perStreakDay: 10, maxStreakBonus: 70, points: 30, hints: 1 };

// Logros: se comprueban con un resumen del jugador
export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primer azulejo', desc: 'Resuelve tu primer tablero', coins: 30, test: (x) => x.solved >= 1 },
  { id: 'ten', name: 'Constancia', desc: 'Resuelve 10 niveles', coins: 80, test: (x) => x.levels >= 10 },
  { id: 'fifty', name: 'Ceramista', desc: 'Resuelve 50 niveles', coins: 250, test: (x) => x.levels >= 50 },
  { id: 'hundred', name: 'Maestro alfarero', desc: 'Resuelve 100 niveles', coins: 500, test: (x) => x.levels >= 100 },
  { id: 'clean', name: 'Sin ayuda', desc: 'Resuelve un nivel sin pistas', coins: 40, test: (x) => x.twoStars >= 1 },
  { id: 'perfect', name: 'Perfección', desc: 'Consigue tres estrellas en un nivel', coins: 50, test: (x) => x.threeStars >= 1 },
  { id: 'perfect10', name: 'Mano firme', desc: 'Tres estrellas en 10 niveles', coins: 150, test: (x) => x.threeStars >= 10 },
  { id: 'experto', name: 'Experto', desc: 'Resuelve un nivel Experto', coins: 50, test: (x) => x.byTier.experto >= 1 },
  { id: 'maestro', name: 'Maestro', desc: 'Resuelve un nivel Maestro', coins: 80, test: (x) => x.byTier.maestro >= 1 },
  { id: 'diabolico', name: 'Doce por doce', desc: 'Resuelve un Diabólico 12×12', coins: 150, test: (x) => x.byTier.diabolico >= 1 },
  { id: 'tier', name: 'Colección completa', desc: 'Termina una categoría entera', coins: 500, test: (x) => x.fullTiers >= 1 },
  { id: 'streak3', name: 'Tres días seguidos', desc: 'Racha de 3 desafíos diarios', coins: 60, test: (x) => x.streak >= 3 },
  { id: 'streak7', name: 'Semana completa', desc: 'Racha de 7 desafíos diarios', coins: 200, test: (x) => x.streak >= 7 },
  { id: 'fast', name: 'Relámpago', desc: 'Resuelve un Difícil en menos de 6 minutos', coins: 60, test: (x) => x.fastDificil },
  { id: 'shopper', name: 'Coleccionista', desc: 'Compra un tema, avatar o efecto', coins: 30, test: (x) => x.cosmetics >= 1 },
];

// Guía de técnicas (de menor a mayor dificultad)
export const TECH_GUIDE = [
  { id: 'hiddenSingle', tier: 'Base', text: 'En una fila, columna o caja, un número solo tiene un sitio posible. Ahí va.' },
  { id: 'nakedSingle', tier: 'Base', text: 'A una celda solo le queda un candidato tras mirar su fila, su columna y su caja.' },
  { id: 'pointing', tier: 'Difícil', text: 'Si dentro de una caja un número solo puede ir en una fila (o columna), quítalo del resto de esa línea fuera de la caja.' },
  { id: 'claiming', tier: 'Difícil', text: 'Si en una fila (o columna) un número solo cae dentro de una caja, quítalo del resto de esa caja.' },
  { id: 'nakedPair', tier: 'Difícil', text: 'Dos celdas de una unidad con los mismos dos candidatos: esos dos números no pueden ir en ninguna otra celda de la unidad.' },
  { id: 'hiddenPair', tier: 'Difícil', text: 'Dos números que solo caben en las mismas dos celdas de una unidad: esas celdas no pueden tener otro candidato.' },
  { id: 'nakedTriple', tier: 'Difícil', text: 'Tres celdas que entre todas solo admiten tres números: esos números salen del resto de la unidad.' },
  { id: 'hiddenTriple', tier: 'Difícil', text: 'Tres números que solo caben en las mismas tres celdas: borra los demás candidatos de esas celdas.' },
  { id: 'xWing', tier: 'Experto', text: 'Un número aparece solo dos veces en dos filas, y en las mismas dos columnas: forma un rectángulo y sale del resto de esas columnas.' },
  { id: 'swordfish', tier: 'Experto', text: 'Un X-Wing con tres filas y tres columnas. El número queda atrapado y sale del resto de las columnas.' },
  { id: 'nakedQuad', tier: 'Experto', text: 'Cuatro celdas que entre todas solo admiten cuatro números: salen del resto de la unidad.' },
  { id: 'xyWing', tier: 'Maestro', text: 'Un pivote con candidatos A y B ve a dos pinzas (A,C) y (B,C). Pase lo que pase, una pinza será C: quita C de las celdas que ven a ambas.' },
  { id: 'xyzWing', tier: 'Maestro', text: 'Como el XY-Wing, pero el pivote tiene A, B y C. C sale de las celdas que ven al pivote y a las dos pinzas.' },
  { id: 'forcing', tier: 'Diabólico', text: 'Supón un candidato y sigue las consecuencias. Si llegas a una contradicción, ese candidato es falso.' },
];
