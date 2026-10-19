# Industria Eterna

Juego de navegador de automatización industrial, evolución tecnológica y exploración,
pensado para jugar en el móvil. HTML + CSS + JavaScript con Canvas 2D, sin dependencias
ni servidor: toda la simulación ocurre en el dispositivo.

Llegas a un planeta abandonado. ATLAS, la IA de la colonia, despierta tras 212 años. Hay que
recuperar la producción, la energía y la logística, descubrir qué provocó el colapso y terminar
el **Proyecto Horizonte**, la instalación planetaria que resolverá la crisis.

## Cómo jugar en el móvil

**Opción A — GitHub Pages (recomendada).** En GitHub: *Settings → Pages → Build and deployment →
Deploy from a branch → `main` / `(root)` → Save*. Al cabo de un minuto el juego estará en
`https://<usuario>.github.io/infinity-industry/`. Ábrelo en el móvil y, si quieres, usa
«Añadir a la pantalla de inicio»: se instala como aplicación a pantalla completa y funciona sin
conexión tras la primera carga.

**Opción B — servidor local en tu red.** En el ordenador, dentro de la carpeta del proyecto:

```
python3 -m http.server 8000
```

y abre en el móvil `http://<IP-del-ordenador>:8000` (misma wifi).

**Opción C — sin servidor.** Abre `index.html` directamente con el navegador (también funciona
con `file://`, aunque así no se instala como aplicación).

La partida se guarda sola cada 30 s y al salir. Desde ☰ puedes guardar a mano, exportar o
importar la partida como archivo JSON o como código de texto.

## Controles

| Acción | Táctil | Teclado / ratón |
|---|---|---|
| Mover la cámara | arrastrar con un dedo (dos dedos al trazar) | WASD / flechas, arrastrar |
| Zoom | pellizcar | rueda, `+` `-` |
| Construir | elegir en la barra inferior y tocar el mapa | clic |
| Cintas, carreteras, vías | arrastrar el trazado | arrastrar |
| Girar antes de colocar | botón ↻ | `R` |
| Elegir generación V1–V4 | tocar la etiqueta «V1 ⇄» del edificio | |
| Extraer a mano / talar | herramienta ✋ (mantén pulsado para repetir) | `H` |
| Retirar (recupera materiales) | herramienta 🗑 (toca o arrastra) | `X` |
| Información de una máquina | tocarla | clic |
| Pausa / velocidad | ⏸ y 1x/2x/4x | espacio |

Vistas de análisis (columna derecha): ⚡ redes y cobertura eléctrica, 🚚 transporte y atascos,
🏭 estado de producción, ⚠ problemas y materiales que faltan.

## Qué incluye

**Fase 1 — base:** mapa de 200×140 casillas generado por regiones, cámara táctil, recursos
(piedra, carbón, hierro, cobre, cuarzo, uranio, xenita, petróleo), minería manual y
automática, cintas con objetos visibles, curvas e incorporaciones laterales, hornos,
ensambladoras, laboratorios, almacenes, energía de vapor y guardado.

**Fase 2 — progresión:** árbol de 72 tecnologías en 6 eras con prerrequisitos, costes en
6 tipos de paquetes y puertas de era ligadas a la historia. Mejoras **V1–V4** con estadísticas,
consumo, recetas, tamaño y aspecto distintos (por ejemplo, el extractor V1 quema carbón, el V2
es eléctrico, el V3 expulsa por dos salidas y el V4 alcanza 4×4 casillas; el almacén V3 pasa a
2×2). 32 recetas encadenadas: mineral → lingote → placa → engranaje → motor → motor eléctrico…;
cobre → cable → circuito → procesador → sistema de control; carbón + hierro → acero;
crudo → químicos → polímeros; uranio → celdas → residuos. Energía: vapor, combustión, solar
(día/noche y contaminación), eólica (viento variable y región), hidroeléctrica junto al agua,
baterías, nuclear (quema sin parar y genera residuos que hay que retirar) y generación
experimental. Redes por postes con alcance, prioridades, cortes y estadísticas. 25 misiones
principales en 4 actos, 6 secundarias, 11 registros y 2 decisiones con consecuencias.

**Fase 3 — logística y expansión:** carreteras, paradas y camiones V1–V4 con ruta, carga,
autonomía y repostaje/recarga; vías, estaciones, señales de bloque, locomotoras V1–V4 y vagones
de dos capacidades que recorren físicamente cada casilla, con horarios (hasta lleno / vacío /
tiempo) y prevención de colisiones; brazos robóticos, divisores, cruces y clasificadores;
robots logísticos autónomos; 6 regiones que se desbloquean con la historia; 5 instalaciones
abandonadas restaurables y la ciudad de Nueva Aurora.

**Fase 4 — final:** tecnología final, nanofabricación, Complejo Horizonte con entrega de
componentes, comprobación de requisitos en la simulación (energía libre en su red, decisión
tomada, tecnología, componentes), sincronización que retrocede si la red no llega al 100 %,
cinemática final, pantalla de victoria con resumen y modo libre posterior.

## Arquitectura

```
index.html            interfaz y orden de carga (scripts clásicos: funciona también con file://)
css/style.css         estilos móviles
js/core.js            espacio de nombres IE, constantes, RNG, ruido, formato, eventos
js/atlas_data.js      coordenadas del atlas (generado)
js/data/              datos del juego: objetos y recetas, edificios V1–V4, tecnologías, historia
js/world.js           generación del mapa por regiones, yacimientos, vegetación y ruinas
js/sim/state.js       estado, colocación/retirada, mejoras, inventario del Núcleo
js/sim/factory.js     cintas, divisores, cruces, clasificadores, extractores, máquinas, laboratorios, brazos
js/sim/power.js       redes eléctricas, despacho por fuentes, baterías, prioridades, reactores
js/sim/transport.js   camiones, trenes con bloques de señales, robots logísticos
js/sim/progress.js    investigación, misiones, decisiones, activación final, estadísticas, bucle step()
js/save.js            guardado versionado con migraciones, autoguardado, exportar/importar
js/assets.js          carga del atlas, tintado, composición de sprites por generación, iconos
js/render.js          render por capas: terreno cacheado por trozos, entidades, partículas, noche
js/input.js           gestos táctiles, ratón y teclado
js/ui.js              barra de construcción, paneles, modales, diálogos, notificaciones
js/main.js            arranque, bucle de simulación a paso fijo (20 Hz), autoguardado, cinemática
tools/build_atlas.py  empaqueta assets/src en assets/atlas.png
tests/sim_test.js     pruebas de la simulación sin navegador
```

La simulación es independiente de la velocidad de fotogramas (paso fijo de 1/20 s con límite
de pasos por fotograma) y no depende del DOM, por eso se puede probar con Node. El render
solo dibuja lo visible, cachea el terreno en trozos de 16×16 casillas y usa un mapa reducido
cuando el zoom es muy lejano. Con 8 000 cintas y más de 4 000 objetos en movimiento un tick
cuesta unos 0,35 ms en un ordenador de escritorio.

## Pruebas

```
node tests/sim_test.js
```

Construyen cadenas reales con la API del juego y comprueban: extractor → horno → cinta →
Núcleo; energía de vapor y cortes por falta de combustible; laboratorios; divisores y atascos;
mejoras V1→V4 y cambio de tamaño; camiones; trenes con señales; brazos, clasificadores, robots,
reactor con residuos y baterías; guardado/carga/código; misiones; que el final no se active sin
requisitos; y una campaña completa hasta la victoria.

## Recursos gráficos

Sprites CC0 de Kenney (Sci-Fi RTS, Tower Defense Top-Down, Racing Pack, Particle Pack),
incluidos localmente. Detalle de archivos, usos y licencias en [CREDITOS.md](CREDITOS.md).
