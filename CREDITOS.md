# Recursos gráficos integrados y licencias

Todos los archivos están **incluidos en el repositorio** (`assets/src/`) y empaquetados en
`assets/atlas.png` (con las coordenadas en `js/atlas_data.js`). El juego no descarga
ninguna imagen de internet durante la partida.

Cada carpeta conserva el `License.txt` original del autor.

| Paquete | Autor | Licencia | Origen | Archivos | Uso en el juego |
|---|---|---|---|---|---|
| RTS Pack: Sci-Fi | Kenney (kenney.nl) | **CC0 1.0** | https://kenney.nl/assets/sci-fi-rts | 16 estructuras y 20 elementos de entorno (versión *Retina* 128 px), 4 losetas | Núcleo ATLAS, extractores, hornos, ensambladoras, laboratorios, generadores, paneles solares, almacenes, subestaciones, ruinas, ciudad, complejo Horizonte, yacimientos (rocas y cristales), árboles alienígenas, terreno rojo y helado |
| Tower Defense (top-down) | Kenney | **CC0 1.0** | https://kenney.nl/assets/tower-defense-top-down | 28 losetas | Hierba, tierra, arena y roca; cajas de madera y metal; piedras; plataformas octogonales del complejo |
| Racing Pack | Kenney | **CC0 1.0** | https://kenney.nl/assets/racing-pack | 25 coches, 15 objetos | Cabinas de camiones V1–V4, árboles, rocas, barriles de crudo y combustible, manchas de petróleo |
| Particle Pack | Kenney | **CC0 1.0** | https://kenney.nl/assets/particle-pack | 21 partículas (reescaladas a 128 px) | Humo, vapor, chispas, llamas, luces nocturnas, destellos, remolino de energía experimental |

CC0 significa dominio público: se pueden usar, modificar y redistribuir en proyectos
personales y comerciales sin atribución obligatoria. Se acredita igualmente a Kenney.

## Ilustraciones propias dibujadas con Canvas

Para piezas que no existen en estos paquetes con perspectiva cenital compatible se han
dibujado ilustraciones con Canvas 2D, con la misma paleta plana de Kenney:

- Cintas transportadoras (rectas y curvas, con rodillos animados) en 4 colores de generación.
- Vías férreas (traviesas, raíles, curvas y cruces), señales con luz roja/verde y carreteras.
- Locomotoras V1–V4 y vagones (con carga visible usando cajas y minerales del atlas).
- Robots logísticos con rotores animados, brazos robóticos, aspas eólicas, balancín de la bomba de crudo.
- Iconos de objetos manufacturados (lingotes, placas, engranajes, cables, circuitos, motores, paquetes de investigación…).
- Plataformas y distintivos V1/V2/V3/V4 que se superponen a los sprites reales para diferenciar cada generación.
- Retrato de ATLAS y la cinemática final.

## Recursos evaluados y descartados

- *Kenney Factory Kit*: es un kit 3D; no encaja con un juego Canvas 2D cenital.
- *Kenney Pixel Vehicle Pack* y *Pixel Platformer Industrial Expansion*: vista lateral en pixel art; romperían la coherencia visual.
- *Awesome Car Pack* (Unlucky Studio, OpenGameArt, CC0): estilo realista que no casa con el estilo plano de Kenney.

## Cómo regenerar el atlas

```
pip install pillow
python3 tools/build_atlas.py
```
