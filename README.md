# Azulejo — Sudoku difícil

Sudoku para jugar en Safari desde el iPhone, sin niveles fáciles: el nivel 1 ya exige técnicas avanzadas.

**Jugar:** https://blackmkount.github.io/sudoku/

## Cómo instalarlo en el iPhone

1. Abre el enlace en Safari.
2. Toca **Compartir** y luego **Añadir a pantalla de inicio**.
3. Ábrelo desde el icono: se juega a pantalla completa y funciona sin conexión.

## Categorías

Hay 200 niveles en cuatro categorías: tres en 9×9 y Diabólico en 12×12. Cada tablero tiene solución única y se clasificó resolviéndolo con técnicas humanas, de modo que la categoría indica la técnica más difícil que hace falta usar.

| Categoría | Tablero | Niveles | Técnica que exige |
|---|---|---|---|
| Difícil | 9×9 | 50 | Pares y tríos (desnudos u ocultos) |
| Experto | 9×9 | 50 | X-Wing, Swordfish y cuartetos |
| Maestro | 9×9 | 50 | XY-Wing y XYZ-Wing |
| Diabólico | 12×12, números del 1 al 12, cajas de 3×4 | 50 | Entre 4 y 24 cadenas forzadas por tablero |

Ningún tablero se puede resolver solo con únicos (el método de los sudokus fáciles). Dentro de cada categoría los niveles van de menos a más exigentes y se desbloquean al completar el anterior.

Además:

- **Desafío del día:** un tablero Maestro o Diabólico distinto cada día, igual para todos. Lleva la cuenta de tu racha.
- **Partida rápida:** una variante aleatoria de la categoría que elijas (mismos niveles, transformados con permutaciones que conservan la dificultad).

## Perfil, monedas y tienda

- **Perfil:** nombre y avatar. Sin cuenta se guarda en el teléfono; con cuenta, en la nube.
- **Estrellas:** 3 sin pistas ni errores, 2 sin pistas, 1 con pistas. Se ven en vivo durante la partida.
- **Monedas:** cada nivel da monedas según su categoría (Difícil 20, Experto 30, Maestro 45, Diabólico 80) y se duplican con tres estrellas. El desafío del día da 60 más un extra por racha y una pista de regalo. Al empezar recibes 50 monedas, 5 pistas y 1 vida extra.
- **Tienda:** pistas, vidas extra (para seguir tras el tercer error), 6 temas de color, 12 avatares y 2 efectos de victoria.
- **Logros:** 15 logros con premio en monedas.
- **Ranking:** cada nivel suma puntos según su categoría y tus estrellas (requiere cuenta).

## Funciones de juego

- Notas (lápiz), rellenar todas las notas y limpieza automática de notas al escribir.
- Deshacer ilimitado dentro de la partida.
- Pistas que enseñan: señalan la celda y explican la técnica (con las celdas del patrón en dorado); después pueden revelar el número.
- Guía de técnicas, de la más sencilla a la más difícil.
- Errores marcados en rojo y límite opcional de tres errores.
- Resaltado de fila, columna, caja y números iguales (incluidas las notas).
- Destello al completar una fila, columna o caja; sonidos suaves y vibración en iPhone (iOS 18 o posterior), ambos desactivables.
- Reloj con pausa, mejores tiempos y estadísticas.

## Activar las cuentas en la nube (Supabase)

El juego funciona sin esto, pero las cuentas, la sincronización entre dispositivos y el ranking necesitan un proyecto gratuito de Supabase.

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Crea las tablas de partidas guardadas y ranking, con reglas para que cada jugador solo pueda leer y escribir lo suyo. Si conectaste Supabase con GitHub (**Project Settings → Integrations**, directorio `.` y **Deploy to production** activado), se crean solas desde [`supabase/migrations`](supabase/migrations) al subir a `main`. Si no, pega ese archivo en **SQL Editor → New query** y pulsa **Run**.
3. En **Authentication → URL Configuration**, pon como **Site URL** `https://blackmkount.github.io/sudoku/` y añádela también en **Redirect URLs**. Así los enlaces de los correos (activar cuenta y recuperar contraseña) vuelven al juego.
4. Opcional, pero recomendable: en **Authentication → Sign In / Providers → Email**, desactiva **Confirm email**. Así la cuenta funciona al instante, sin esperar el correo. El correo integrado de Supabase solo envía unos pocos mensajes por hora.
5. En **Project Settings → API** (o **API Keys**), copia la **Project URL** y la clave pública (**anon** o **publishable**) en [`js/config.js`](js/config.js).

Las dos claves de `config.js` son públicas por diseño: la seguridad la ponen las reglas de la migración. Nunca pongas ahí la clave **service_role** ni la **secret**.

**Cómo se guarda:** cada dispositivo guarda en local y sube los cambios a la nube. Antes de subir, siempre trae lo que haya en la nube y lo combina. Monedas, pistas y vidas se cuentan por dispositivo, así que al combinar nada se duplica ni se pierde. El progreso se une quedándose con el mejor tiempo y las mejores estrellas de cada nivel.

Para probar las cuentas en local sin Supabase hay un servidor simulado:

```
python3 tools/mock-supabase.py 54321
```

Y en la consola del navegador (en `localhost`): `localStorage['azulejo.cloud.dev'] = JSON.stringify({url: 'http://localhost:54321', key: 'dev'})`.

## Estructura

```
index.html                 Pantallas y diálogos
css/style.css              Diseño
js/engine.js               Motor (9×9 y 12×12): solver, generador, calificador y pistas
js/levels.js               Banco de niveles generado
js/app.js                  Lógica del juego e interfaz
js/store.js                Estado del jugador, migraciones y combinación entre dispositivos
js/catalog.js              Tienda, temas, logros y recompensas
js/cloud.js                Cliente de Supabase (cuentas, guardado y ranking)
js/config.js               Claves del proyecto de Supabase
js/fx.js                   Sonido, vibración y efectos de victoria
supabase/migrations/       Tablas y reglas de seguridad (migración)
sw.js                      Caché para jugar sin conexión
tools/generate-levels.mjs  Generador del banco de niveles
tools/mock-supabase.py     Supabase simulado para pruebas
```

## Regenerar los niveles

```
node tools/generate-levels.mjs                   # todas las categorías
node tools/generate-levels.mjs --only diabolico  # solo una
```

El script genera tableros mínimos con simetría rotacional, comprueba que tengan solución única, los resuelve con técnicas humanas (únicos, candidatos bloqueados, pares, tríos, cuartetos, X-Wing, Swordfish, Jellyfish, XY-Wing, XYZ-Wing y cadenas forzadas) y elige 50 por categoría repartidos a lo largo de la curva de dificultad. Para Diabólico genera 1.500 tableros 12×12 válidos y se queda con los 50 del 15 % más difícil.

## Jugar en local

```
python3 -m http.server 8000
```

Y abre `http://localhost:8000`.

## Créditos

Tipografía Poppins, bajo licencia SIL Open Font License (ver `fonts/`).
