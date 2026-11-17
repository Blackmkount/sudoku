# Azulejo — Sudoku difícil

Sudoku para jugar en Safari desde el iPhone, sin niveles fáciles: el nivel 1 ya exige técnicas avanzadas.

**Jugar:** https://blackmkount.github.io/sudoku/

## Cómo instalarlo en el iPhone

1. Abre el enlace en Safari.
2. Toca **Compartir** y luego **Añadir a pantalla de inicio**.
3. Ábrelo desde el icono: se juega a pantalla completa y funciona sin conexión.

## Categorías

Hay 200 niveles en cuatro categorías. Cada tablero tiene solución única y se clasificó resolviéndolo con técnicas humanas, de modo que la categoría indica la técnica más difícil que hace falta usar.

| Categoría | Niveles | Técnica que exige |
|---|---|---|
| Difícil | 50 | Pares y tríos (desnudos u ocultos) |
| Experto | 50 | X-Wing, Swordfish y cuartetos |
| Maestro | 50 | XY-Wing y XYZ-Wing |
| Diabólico | 50 | Cadenas forzadas (suposición y contradicción) |

Ningún tablero se puede resolver solo con únicos (el método de los sudokus fáciles). Dentro de cada categoría los niveles van de menos a más exigentes y se desbloquean al completar el anterior.

Además:

- **Desafío del día:** un tablero Maestro o Diabólico distinto cada día, igual para todos. Lleva la cuenta de tu racha.
- **Partida rápida:** una variante aleatoria de la categoría que elijas (mismos niveles, transformados con permutaciones que conservan la dificultad).

## Funciones

- Notas (lápiz), rellenar todas las notas y limpieza automática de notas al escribir.
- Deshacer ilimitado dentro de la partida.
- Pistas que enseñan: primero señalan la celda y explican la técnica (con las celdas del patrón resaltadas en dorado); si tocas otra vez, revelan el número.
- Errores marcados en rojo y límite opcional de tres errores.
- Resaltado de fila, columna, caja y números iguales (incluidas las notas).
- Reloj con pausa, progreso y mejores tiempos guardados en el dispositivo.
- Tema claro (Porcelana), oscuro (Cobalto) o automático.

## Estructura

```
index.html              Pantallas y diálogos
css/style.css           Diseño
js/engine.js            Motor: solver, generador, calificador y pistas
js/levels.js            Banco de niveles generado
js/app.js               Lógica del juego e interfaz
sw.js                   Caché para jugar sin conexión
tools/generate-levels.mjs  Generador del banco de niveles
```

## Regenerar los niveles

```
node tools/generate-levels.mjs [semilla]
```

El script genera tableros mínimos con simetría rotacional, comprueba que tengan solución única, los resuelve con técnicas humanas (únicos, candidatos bloqueados, pares, tríos, cuartetos, X-Wing, Swordfish, Jellyfish, XY-Wing, XYZ-Wing y cadenas forzadas) y elige 50 por categoría repartidos a lo largo de la curva de dificultad.

## Jugar en local

```
python3 -m http.server 8000
```

Y abre `http://localhost:8000`.

## Créditos

Tipografías Bodoni Moda e Instrument Sans, bajo licencia SIL Open Font License (ver `fonts/`).
