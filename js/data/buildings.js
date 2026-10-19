// Definición de edificios y sus generaciones V1-V4.
// Cada nivel define coste, tecnología necesaria, estadísticas y aspecto.
// Los niveles antiguos siguen teniendo sentido: más baratos, menos consumo,
// algunos no necesitan electricidad o contaminan menos.
(function () {
  const IE = window.IE;

  // Paletas por generación (se aplican sobre los sprites reales de Kenney)
  IE.TIER_STYLE = [
    null,
    { label: 'V1', tint: '#8a5a2b', tintA: 0.28, light: '#ffb347', badge: '#8a5a2b' },   // rudimentario: óxido y latón
    { label: 'V2', tint: '#e0a020', tintA: 0.18, light: '#ffd84a', badge: '#c98a12' },   // eléctrico: franjas amarillas
    { label: 'V3', tint: '#2fbf71', tintA: 0.18, light: '#6dffb0', badge: '#22955a' },   // automatizado: sensores verdes
    { label: 'V4', tint: '#36c9ff', tintA: 0.24, light: '#a8f0ff', badge: '#1f8fd6' },   // avanzado: brillo cian
  ];

  const B = IE.BUILDINGS = {};
  function def(id, d) { d.id = id; B[id] = d; return d; }

  // ---------- Extracción ----------
  def('miner', {
    name: 'Extractor', cat: 'extraccion', kind: 'miner', desc: 'Extrae el recurso del terreno que cubre y lo expulsa por su frente.',
    tiers: [
      { name: 'Extractor mecánico', w: 2, h: 2, tech: null, rate: 0.35, fuel: true, power: 150, poll: 1, buf: 10,
        cost: { piedra: 6, engranaje: 3, placa_hierro: 4 }, spr: 'st_14', pros: 'No necesita electricidad. Barato.', cons: 'Lento, quema carbón o madera y contamina.' },
      { name: 'Extractor eléctrico', w: 2, h: 2, tech: 't_miner2', rate: 0.75, power: 90, buf: 12,
        cost: { placa_hierro: 8, circuito: 3, motor: 2 }, spr: 'st_13', pros: 'El doble de rápido, sin combustible.', cons: 'Necesita red eléctrica.' },
      { name: 'Extractor automatizado', w: 2, h: 2, tech: 't_miner3', rate: 1.5, power: 180, buf: 30, dualOut: true,
        cost: { acero: 8, motor_electrico: 3, circuito: 6 }, spr: 'st_13', arms: true, pros: 'Alta producción, expulsa por los dos lados frontales, gran búfer.', cons: 'Consume el doble que V2.' },
      { name: 'Extractor avanzado', w: 2, h: 2, tech: 't_miner4', rate: 3, power: 220, buf: 60, dualOut: true, reach: 1,
        cost: { acero: 12, sistema_control: 2, motor_electrico: 4 }, spr: 'st_14', pros: 'Producción masiva y alcance de 4x4 casillas.', cons: 'Muy caro; agota los yacimientos rápido.' },
    ],
  });
  def('pumpjack', {
    name: 'Bomba de crudo', cat: 'extraccion', kind: 'miner', onlyRes: 'crudo', desc: 'Extrae petróleo crudo en barriles. Debe colocarse sobre un pozo de petróleo.',
    tiers: [
      { name: 'Bomba de balancín', w: 2, h: 2, tech: 't_oil', rate: 0.6, power: 90, buf: 10, cost: { acero: 5, motor: 3, circuito: 3 }, spr: null, pros: 'Fuente de crudo.', cons: 'Necesita electricidad.' },
      { name: 'Bomba de inyección', w: 2, h: 2, tech: 't_oil2', rate: 1.4, power: 200, buf: 20, cost: { acero: 10, motor_electrico: 3, procesador: 1 }, spr: null, pros: 'Más del doble de caudal.', cons: 'Consume más.' },
    ],
  });

  // ---------- Logística ----------
  def('belt', {
    name: 'Cinta transportadora', cat: 'logistica', kind: 'belt', line: true, desc: 'Mueve objetos visibles en la dirección indicada. Arrastra para trazar.',
    tiers: [
      { name: 'Cinta lenta', w: 1, h: 1, tech: null, speed: 1.25, cap: 3, cost: { placa_hierro: 1 }, color: '#6b5a3a', pros: 'Muy barata.', cons: 'Lenta: unos 3,7 objetos/s.' },
      { name: 'Cinta rápida', w: 1, h: 1, tech: 't_belt2', speed: 2.5, cap: 4, cost: { placa_hierro: 1, engranaje: 1 }, color: '#a8801c', pros: '2x velocidad, más capacidad.', cons: 'Requiere engranajes.' },
      { name: 'Cinta exprés', w: 1, h: 1, tech: 't_belt3', speed: 4, cap: 4, cost: { acero: 1, circuito: 1 }, color: '#1f7a4a', pros: '16 objetos/s.', cons: 'Usa acero y circuitos.' },
      { name: 'Cinta magnética', w: 1, h: 1, tech: 't_maglev', speed: 6.5, cap: 5, cost: { superconductor: 1, acero: 1 }, color: '#1c6aa8', pros: 'Levitación: más de 30 objetos/s.', cons: 'Superconductores.' },
    ],
  });
  def('splitter', {
    name: 'Divisor', cat: 'logistica', kind: 'splitter', desc: 'Reparte lo que entra por detrás entre frente, izquierda y derecha.',
    tiers: [
      { name: 'Divisor', w: 1, h: 1, tech: 't_logistics1', rate: 6, cost: { placa_hierro: 4, engranaje: 2 }, pros: 'Reparto equitativo.', cons: 'Velocidad limitada.' },
      { name: 'Divisor rápido', w: 1, h: 1, tech: 't_belt2', rate: 14, cost: { placa_hierro: 4, circuito: 2 }, pros: 'Sigue el ritmo de cintas rápidas.', cons: '' },
      { name: 'Distribuidor exprés', w: 1, h: 1, tech: 't_belt3', rate: 30, cost: { acero: 2, circuito: 4 }, pros: 'Para cintas exprés y magnéticas.', cons: '' },
    ],
  });
  def('crossing', {
    name: 'Cruce', cat: 'logistica', kind: 'crossing', desc: 'Permite que dos cintas se crucen sin mezclarse.',
    tiers: [{ name: 'Cruce de cintas', w: 1, h: 1, tech: 't_logistics1', rate: 20, cost: { placa_hierro: 3, engranaje: 1 }, pros: 'Cruza flujos.', cons: '' }],
  });
  def('sorter', {
    name: 'Clasificador', cat: 'logistica', kind: 'sorter', desc: 'Envía el objeto filtrado a la izquierda y el resto al frente.',
    tiers: [
      { name: 'Clasificador inteligente', w: 1, h: 1, tech: 't_arms', rate: 12, filters: 1, power: 10, cost: { placa_hierro: 4, circuito: 4 }, pros: 'Separa un tipo de objeto.', cons: 'Necesita energía.' },
      { name: 'Clasificador de visión', w: 1, h: 1, tech: 't_control', rate: 30, filters: 3, power: 20, cost: { acero: 2, procesador: 1 }, pros: 'Hasta 3 filtros, muy rápido.', cons: '' },
    ],
  });
  def('arm', {
    name: 'Brazo robótico', cat: 'logistica', kind: 'arm', desc: 'Toma objetos de detrás y los deja delante (máquinas, almacenes o cintas).',
    tiers: [
      { name: 'Brazo básico', w: 1, h: 1, tech: 't_arms', period: 1.2, stack: 1, power: 15, cost: { placa_hierro: 2, engranaje: 2, circuito: 1 }, pros: 'Barato.', cons: 'Lento, sin filtro.' },
      { name: 'Brazo rápido', w: 1, h: 1, tech: 't_arms', period: 0.5, stack: 1, power: 30, filter: true, cost: { placa_hierro: 2, motor_electrico: 1, circuito: 2 }, pros: 'Rápido y con filtro.', cons: '' },
      { name: 'Brazo de pila', w: 1, h: 1, tech: 't_arms3', period: 0.5, stack: 4, power: 50, filter: true, cost: { acero: 2, motor_electrico: 1, procesador: 1 }, pros: 'Mueve 4 objetos por ciclo.', cons: 'Más consumo.' },
      { name: 'Brazo cuántico', w: 1, h: 1, tech: 't_autonomous', period: 0.25, stack: 6, power: 40, filter: true, cost: { superconductor: 2, sistema_control: 1 }, pros: '24 objetos/s con poco consumo.', cons: 'Muy caro.' },
    ],
  });
  def('chest', {
    name: 'Almacén', cat: 'logistica', kind: 'storage', desc: 'Guarda objetos. Puede expulsar un objeto filtrado por su frente.',
    tiers: [
      { name: 'Caja de madera', w: 1, h: 1, tech: null, cap: 200, cost: { madera: 4 }, spr: 'td_061', pros: 'Barata.', cons: 'Poca capacidad.' },
      { name: 'Caja metálica', w: 1, h: 1, tech: 't_storage', cap: 800, cost: { placa_hierro: 8 }, spr: 'td_084', pros: '4x capacidad.', cons: '' },
      { name: 'Almacén', w: 2, h: 2, tech: 't_logistics3', cap: 4000, cost: { acero: 10, ladrillo: 10 }, spr: 'st_11', pros: 'Gran capacidad, 2x2 casillas.', cons: 'Ocupa más espacio.' },
      { name: 'Centro logístico', w: 2, h: 2, tech: 't_hub', cap: 12000, power: 60, outRate: 3, cost: { acero: 20, procesador: 4, motor_electrico: 4 }, spr: 'st_12', pros: 'Enorme y expulsa 3 objetos por tick.', cons: 'Necesita energía para expulsar.' },
    ],
  });

  // ---------- Producción ----------
  def('furnace', {
    name: 'Horno', cat: 'produccion', kind: 'machine', mclass: 'furnace', autoRecipe: true, desc: 'Funde minerales. Elige la receta automáticamente o fíjala.',
    tiers: [
      { name: 'Horno de carbón', w: 2, h: 2, tech: null, speed: 0.5, fuel: true, power: 90, poll: 0.8, cost: { piedra: 10 }, spr: 'st_15', pros: 'Solo piedra, sin electricidad.', cons: 'Lento y quema combustible.' },
      { name: 'Fundición industrial', w: 2, h: 2, tech: 't_furnace2', speed: 1, power: 140, cost: { ladrillo: 10, placa_hierro: 6, circuito: 3 }, spr: 'st_16', pros: 'Eléctrico; puede fabricar acero y silicio.', cons: 'Necesita energía.' },
      { name: 'Fundición automatizada', w: 2, h: 2, tech: 't_furnace3', speed: 2, power: 240, cost: { acero: 10, ladrillo: 10, circuito: 6 }, spr: 'st_16', arms: true, pros: 'Doble velocidad.', cons: 'Gran consumo.' },
      { name: 'Horno de inducción', w: 2, h: 2, tech: 't_furnace4', speed: 4, power: 330, cost: { acero: 12, superconductor: 2, sistema_control: 1 }, spr: 'st_03', pros: '8 veces el V1 con eficiencia por unidad.', cons: 'Muy caro.' },
    ],
  });
  def('assembler', {
    name: 'Ensambladora', cat: 'produccion', kind: 'machine', mclass: 'assembler', desc: 'Fabrica componentes. Elige una receta.',
    tiers: [
      { name: 'Ensambladora mecánica', w: 2, h: 2, tech: 't_automation', speed: 0.5, power: 60, cost: { placa_hierro: 8, engranaje: 5 }, spr: 'st_04', pros: 'Bajo consumo.', cons: 'Lenta, solo recetas básicas.' },
      { name: 'Ensambladora automática', w: 2, h: 2, tech: 't_assembler2', speed: 0.8, power: 110, cost: { placa_hierro: 8, circuito: 4, motor: 2 }, spr: 'st_04', pros: 'Recetas eléctricas (motor eléctrico...).', cons: '' },
      { name: 'Fábrica modular', w: 2, h: 2, tech: 't_assembler3', speed: 1.3, power: 200, cost: { acero: 8, circuito: 8, motor_electrico: 2 }, spr: 'st_06', arms: true, pros: 'Recetas avanzadas, rápida.', cons: 'Más consumo.' },
      { name: 'Ensambladora de precisión', w: 2, h: 2, tech: 't_assembler4', speed: 2.2, power: 320, cost: { acero: 10, sistema_control: 2, superconductor: 2 }, spr: 'st_06', pros: 'Todas las recetas, muy rápida.', cons: 'Muy cara.' },
    ],
  });
  def('lab', {
    name: 'Laboratorio', cat: 'produccion', kind: 'lab', desc: 'Consume paquetes de investigación para avanzar la tecnología activa.',
    tiers: [
      { name: 'Laboratorio', w: 2, h: 2, tech: null, speed: 1, power: 60, cost: { placa_hierro: 10, engranaje: 4, cable: 6 }, spr: 'st_07', pros: '', cons: '' },
      { name: 'Laboratorio eléctrico', w: 2, h: 2, tech: 't_lab2', speed: 1.6, power: 120, cost: { placa_hierro: 10, circuito: 8 }, spr: 'st_07', pros: '+60 % velocidad.', cons: '' },
      { name: 'Laboratorio automatizado', w: 2, h: 2, tech: 't_lab3', speed: 2.6, power: 200, cost: { acero: 10, procesador: 4 }, spr: 'st_07', pros: 'Muy rápido.', cons: '' },
      { name: 'Instituto de investigación', w: 2, h: 2, tech: 't_lab4', speed: 4, power: 300, cost: { acero: 10, sistema_control: 3, superconductor: 3 }, spr: 'st_07', pros: 'Máxima velocidad.', cons: '' },
    ],
  });
  def('refinery', {
    name: 'Refinería', cat: 'produccion', kind: 'machine', mclass: 'refinery', desc: 'Destila el crudo en combustible y productos químicos.',
    tiers: [
      { name: 'Refinería', w: 3, h: 3, tech: 't_oil', speed: 1, power: 250, poll: 1.2, cost: { acero: 15, ladrillo: 15, circuito: 6 }, spr: 'st_05', pros: '', cons: 'Contamina.' },
      { name: 'Refinería catalítica', w: 3, h: 3, tech: 't_oil2', speed: 2, power: 420, poll: 0.8, cost: { acero: 20, procesador: 4 }, spr: 'st_05', pros: 'Doble velocidad, menos contaminación, licuefacción de carbón.', cons: '' },
    ],
  });
  def('chem', {
    name: 'Planta química', cat: 'produccion', kind: 'machine', mclass: 'chem', desc: 'Polímeros y baterías.',
    tiers: [
      { name: 'Planta química', w: 2, h: 2, tech: 't_chem', speed: 1, power: 210, cost: { acero: 6, circuito: 5, motor_electrico: 1 }, spr: 'st_06', pros: '', cons: '' },
      { name: 'Planta química avanzada', w: 2, h: 2, tech: 't_chem2', speed: 2, power: 350, cost: { acero: 10, procesador: 3 }, spr: 'st_06', pros: 'Doble velocidad.', cons: '' },
    ],
  });
  def('centrifuge', {
    name: 'Centrifugadora', cat: 'produccion', kind: 'machine', mclass: 'centrifuge', desc: 'Enriquece uranio en celdas de combustible y recicla residuos.',
    tiers: [
      { name: 'Centrifugadora', w: 2, h: 2, tech: 't_nuclear', speed: 1, power: 350, cost: { acero: 20, procesador: 5, ladrillo: 20 }, spr: 'st_07', pros: '', cons: '' },
      { name: 'Centrifugadora en cascada', w: 2, h: 2, tech: 't_nuclear2', speed: 2, power: 500, cost: { acero: 20, sistema_control: 2 }, spr: 'st_07', pros: 'Doble velocidad y reciclaje de residuos.', cons: '' },
    ],
  });
  def('precision', {
    name: 'Fábrica de precisión', cat: 'produccion', kind: 'machine', mclass: 'precision', desc: 'Superconductores y componentes avanzados.',
    tiers: [
      { name: 'Fábrica de precisión', w: 3, h: 3, tech: 't_precision', speed: 1, power: 600, cost: { acero: 30, procesador: 8, sistema_control: 2 }, spr: 'st_04', pros: '', cons: '' },
      { name: 'Fábrica de precisión cuántica', w: 3, h: 3, tech: 't_autonomous', speed: 2, power: 900, cost: { acero: 30, superconductor: 10, sistema_control: 4 }, spr: 'st_04', pros: 'Doble velocidad.', cons: '' },
    ],
  });
  def('nanofab', {
    name: 'Nanofabricador', cat: 'produccion', kind: 'machine', mclass: 'nanofab', desc: 'Manipula la materia a escala atómica.',
    tiers: [
      { name: 'Nanofabricador', w: 3, h: 3, tech: 't_nanofab', speed: 1, power: 1500, cost: { acero: 40, componente_avanzado: 4, superconductor: 10 }, spr: 'st_07', pros: '', cons: 'Enorme consumo.' },
      { name: 'Nanofabricador autónomo', w: 3, h: 3, tech: 't_autonomous', speed: 2, power: 2200, cost: { componente_avanzado: 8, nanomaterial: 10 }, spr: 'st_07', pros: 'Doble velocidad.', cons: '' },
    ],
  });

  // ---------- Energía ----------
  def('pole', {
    name: 'Poste eléctrico', cat: 'energia', kind: 'pole', desc: 'Conecta máquinas y generadores a la red dentro de su área.',
    tiers: [
      { name: 'Poste de madera', w: 1, h: 1, tech: 't_steam', supply: 2, link: 7, cost: { madera: 1, cable: 2 }, spr: 'st_10', pros: 'Barato.', cons: 'Área 5x5.' },
      { name: 'Poste metálico', w: 1, h: 1, tech: 't_combustion', supply: 3, link: 10, cost: { acero: 1, cable: 2 }, spr: 'st_10', pros: 'Área 7x7, más alcance.', cons: '' },
      { name: 'Subestación', w: 2, h: 2, tech: 't_substation', supply: 8, link: 18, cost: { acero: 8, circuito: 6, cable: 10 }, spr: 'st_12', pros: 'Área 18x18.', cons: 'Ocupa 2x2.' },
      { name: 'Nodo de red inteligente', w: 2, h: 2, tech: 't_smartgrid', supply: 12, link: 32, cost: { acero: 10, procesador: 4, superconductor: 2 }, spr: 'st_12', pros: 'Área 26x26, enlaces de 32 casillas.', cons: '' },
    ],
  });
  def('steam', {
    name: 'Generador de vapor', cat: 'energia', kind: 'gen', gen: 'fuel', desc: 'Quema carbón o madera para producir electricidad. Fiable pero contamina.',
    tiers: [
      { name: 'Máquina de vapor', w: 2, h: 2, tech: 't_steam', out: 300, eff: 0.5, poll: 1.5, cost: { placa_hierro: 10, engranaje: 5, piedra: 10 }, spr: 'st_02', pros: 'Energía estable.', cons: 'Rendimiento 50 %, contamina.' },
      { name: 'Turbina de vapor', w: 2, h: 2, tech: 't_steam2', out: 550, eff: 0.6, poll: 1.4, cost: { acero: 6, motor: 4, ladrillo: 10 }, spr: 'st_02', pros: 'Casi el doble.', cons: '' },
      { name: 'Turbina de alta presión', w: 2, h: 2, tech: 't_steam3', out: 900, eff: 0.72, poll: 1.2, cost: { acero: 10, motor_electrico: 4, circuito: 4 }, spr: 'st_02', pros: 'Más eficiente.', cons: '' },
      { name: 'Turbina supercrítica', w: 2, h: 2, tech: 't_highpower', out: 1500, eff: 0.85, poll: 1, cost: { acero: 16, sistema_control: 2, superconductor: 2 }, spr: 'st_02', pros: 'Rendimiento 85 %.', cons: 'Cara.' },
    ],
  });
  def('combustion', {
    name: 'Generador de combustión', cat: 'energia', kind: 'gen', gen: 'fuel', desc: 'Motor de combustión: rinde mucho más con combustible refinado.',
    tiers: [
      { name: 'Generador de combustión', w: 2, h: 2, tech: 't_combustion', out: 600, eff: 0.65, poll: 1.2, cost: { acero: 5, motor: 4, circuito: 4 }, spr: 'st_03', pros: 'Compacto y potente.', cons: 'Mejor con combustible (petróleo).' },
      { name: 'Generador diésel industrial', w: 2, h: 2, tech: 't_combustion2', out: 1100, eff: 0.75, poll: 1.1, cost: { acero: 10, motor_electrico: 4, circuito: 6 }, spr: 'st_03', pros: '', cons: '' },
      { name: 'Turbina de gas', w: 2, h: 2, tech: 't_highpower', out: 2000, eff: 0.85, poll: 0.9, cost: { acero: 15, sistema_control: 2, superconductor: 2 }, spr: 'st_03', pros: '2 MW.', cons: '' },
    ],
  });
  def('solar', {
    name: 'Panel solar', cat: 'energia', kind: 'gen', gen: 'solar', desc: 'Energía limpia que depende de la luz del día y de la contaminación.',
    tiers: [
      { name: 'Panel solar', w: 2, h: 2, tech: 't_solar', out: 60, cost: { placa_hierro: 5, cable: 10, circuito: 4 }, spr: 'st_08', pros: 'Gratis y limpio.', cons: 'Nada de noche.' },
      { name: 'Panel solar mejorado', w: 2, h: 2, tech: 't_solar2', out: 110, cost: { acero: 4, silicio: 6, circuito: 4 }, spr: 'st_08', pros: '', cons: '' },
      { name: 'Panel solar avanzado', w: 2, h: 2, tech: 't_solar3', out: 180, cost: { acero: 4, silicio: 10, procesador: 2 }, spr: 'st_08', pros: 'Capta luz difusa: 15 % de noche.', cons: '', night: 0.15 },
      { name: 'Colector fotónico', w: 2, h: 2, tech: 't_solar4', out: 280, cost: { superconductor: 2, silicio: 10, procesador: 2 }, spr: 'st_08', pros: '25 % de noche.', cons: '', night: 0.25 },
    ],
  });
  def('wind', {
    name: 'Turbina eólica', cat: 'energia', kind: 'gen', gen: 'wind', desc: 'Varía con el viento. Rinde más en montañas y llanuras abiertas.',
    tiers: [
      { name: 'Molino eólico', w: 2, h: 2, tech: 't_wind', out: 120, cost: { placa_hierro: 10, engranaje: 6, cable: 6 }, pros: 'Funciona de noche.', cons: 'Muy variable.' },
      { name: 'Aerogenerador', w: 2, h: 2, tech: 't_wind2', out: 220, minWind: 0.15, cost: { acero: 6, motor_electrico: 2, circuito: 4 }, pros: '', cons: '' },
      { name: 'Aerogenerador mejorado', w: 2, h: 2, tech: 't_wind3', out: 360, minWind: 0.3, cost: { acero: 8, polimero: 6, procesador: 2 }, pros: 'Palas de polímero: rinde con poco viento.', cons: '' },
      { name: 'Turbina de altura', w: 2, h: 2, tech: 't_wind4', out: 520, minWind: 0.45, cost: { acero: 10, superconductor: 2, polimero: 10 }, pros: 'Casi constante.', cons: '' },
    ],
  });
  def('hydro', {
    name: 'Central hidroeléctrica', cat: 'energia', kind: 'gen', gen: 'hydro', needWater: 3, desc: 'Debe tocar al menos 3 casillas de agua. Producción constante.',
    tiers: [
      { name: 'Rueda hidráulica', w: 2, h: 2, tech: 't_hydro', out: 250, cost: { ladrillo: 20, motor: 4, cable: 10 }, spr: 'st_06', pros: 'Constante y limpia.', cons: 'Solo junto al agua.' },
      { name: 'Turbina hidráulica', w: 2, h: 2, tech: 't_hydro2', out: 450, cost: { acero: 10, motor_electrico: 3, ladrillo: 20 }, spr: 'st_06', pros: '', cons: '' },
      { name: 'Presa de alto rendimiento', w: 2, h: 2, tech: 't_hydro3', out: 750, cost: { acero: 15, sistema_control: 1, ladrillo: 30 }, spr: 'st_06', pros: '', cons: '' },
    ],
  });
  def('battery', {
    name: 'Batería industrial', cat: 'energia', kind: 'battery', desc: 'Almacena excedentes y los devuelve en picos de demanda o de noche.',
    tiers: [
      { name: 'Banco de baterías', w: 2, h: 2, tech: 't_batteries', capKJ: 8000, rateKW: 400, cost: { bateria: 6, acero: 4, circuito: 2 }, spr: 'st_12', pros: '', cons: '' },
      { name: 'Acumulador industrial', w: 2, h: 2, tech: 't_batteries', capKJ: 25000, rateKW: 800, cost: { bateria: 15, acero: 8, circuito: 4 }, spr: 'st_12', pros: '3x capacidad.', cons: '' },
      { name: 'Acumulador de red', w: 2, h: 2, tech: 't_smartgrid', capKJ: 70000, rateKW: 2000, cost: { bateria: 30, procesador: 4, acero: 10 }, spr: 'st_12', pros: '', cons: '' },
      { name: 'Banco superconductor', w: 2, h: 2, tech: 't_highpower', capKJ: 200000, rateKW: 6000, cost: { superconductor: 10, bateria: 20, sistema_control: 2 }, spr: 'st_12', pros: 'Gigantesco.', cons: '' },
    ],
  });
  def('reactor', {
    name: 'Reactor nuclear', cat: 'energia', kind: 'gen', gen: 'nuclear', desc: 'Quema celdas sin parar mientras esté encendido y genera residuos que hay que retirar.',
    tiers: [
      { name: 'Reactor de fisión', w: 3, h: 3, tech: 't_nuclear', out: 5000, cellTime: 200, cost: { acero: 60, ladrillo: 60, sistema_control: 4, procesador: 10 }, spr: 'st_02', pros: '5 MW continuos.', cons: 'Produce residuos; desperdicia si no hay demanda.' },
      { name: 'Reactor de cuarta generación', w: 3, h: 3, tech: 't_nuclear2', out: 8000, cellTime: 300, cost: { acero: 80, sistema_control: 8, superconductor: 6 }, spr: 'st_02', pros: 'Más energía por celda.', cons: '' },
    ],
  });
  def('fusion', {
    name: 'Generador experimental', cat: 'energia', kind: 'gen', gen: 'fusion', desc: 'Resonancia de xenita: energía casi ilimitada.',
    tiers: [
      { name: 'Reactor de resonancia', w: 3, h: 3, tech: 't_fusion', out: 20000, fuelItem: 'xenita', fuelTime: 30, cost: { componente_avanzado: 10, nanomaterial: 20, superconductor: 20 }, spr: 'st_02', pros: '20 MW limpios.', cons: 'Consume xenita.' },
      { name: 'Reactor de punto cero', w: 3, h: 3, tech: 't_fusion2', out: 40000, fuelItem: 'xenita', fuelTime: 45, cost: { componente_avanzado: 20, nanomaterial: 40, sistema_control: 10 }, spr: 'st_02', pros: '40 MW.', cons: '' },
    ],
  });

  // ---------- Transporte ----------
  def('road', {
    name: 'Carretera', cat: 'transporte', kind: 'road', line: true, desc: 'Los camiones circulan por carreteras.',
    tiers: [{ name: 'Carretera', w: 1, h: 1, tech: 't_vehicles', cost: { piedra: 2 }, pros: '', cons: '' }],
  });
  def('truckstop', {
    name: 'Parada de camiones', cat: 'transporte', kind: 'depot', depot: 'truck', desc: 'Debe tocar una carretera. Carga y descarga camiones; acepta cintas.',
    tiers: [
      { name: 'Parada de camiones', w: 2, h: 2, tech: 't_vehicles', cap: 600, xfer: 10, cost: { placa_hierro: 10, ladrillo: 10 }, pros: '', cons: '' },
      { name: 'Muelle de carga', w: 2, h: 2, tech: 't_logistics3', cap: 2000, xfer: 30, cost: { acero: 10, motor_electrico: 2 }, pros: 'Transferencia 3x.', cons: '' },
    ],
  });
  def('rail', {
    name: 'Vía férrea', cat: 'transporte', kind: 'rail', line: true, desc: 'Arrastra para tender vías. Los trenes recorren físicamente cada casilla.',
    tiers: [{ name: 'Vía férrea', w: 1, h: 1, tech: 't_rail', cost: { acero: 1, piedra: 1 }, pros: '', cons: '' }],
  });
  def('signal', {
    name: 'Señal ferroviaria', cat: 'transporte', kind: 'rail', signal: true, desc: 'Divide la vía en bloques: solo un tren por bloque, evita colisiones.',
    tiers: [{ name: 'Señal de bloque', w: 1, h: 1, tech: 't_rail', cost: { acero: 1, circuito: 1 }, pros: '', cons: '' }],
  });
  def('trainstop', {
    name: 'Estación ferroviaria', cat: 'transporte', kind: 'depot', depot: 'train', desc: 'Debe tocar una vía. Carga y descarga trenes; acepta cintas.',
    tiers: [
      { name: 'Estación', w: 2, h: 2, tech: 't_rail', cap: 2000, xfer: 20, cost: { acero: 10, ladrillo: 20 }, pros: '', cons: '' },
      { name: 'Terminal automatizada', w: 2, h: 2, tech: 't_hub', cap: 8000, xfer: 80, cost: { acero: 20, sistema_control: 1 }, pros: '4x transferencia.', cons: '' },
    ],
  });
  def('robohub', {
    name: 'Centro de robots', cat: 'transporte', kind: 'robohub', desc: 'Robots autónomos que llevan ingredientes desde almacenes a máquinas y retiran la producción.',
    tiers: [
      { name: 'Puerto de robots', w: 2, h: 2, tech: 't_robots', robots: 6, rspeed: 5, radius: 14, power: 200, cost: { acero: 20, procesador: 6, bateria: 6 }, spr: 'st_09', pros: '', cons: '' },
      { name: 'Enjambre logístico', w: 2, h: 2, tech: 't_robots2', robots: 14, rspeed: 8, radius: 22, power: 400, cost: { acero: 20, sistema_control: 4, bateria: 10 }, spr: 'st_09', pros: 'Más robots, más rápidos y más alcance.', cons: '' },
    ],
  });

  // Vehículos (no son edificios, se compran en paradas/estaciones)
  IE.TRUCKS = [
    null,
    { name: 'Carro de vapor', tech: 't_vehicles', speed: 2.2, cap: 40, energy: 3000, use: 20, fuel: true, spr: 'car_black_5', bed: '#6b4a2a', cost: { placa_hierro: 15, motor: 3 } },
    { name: 'Camión diésel', tech: 't_vehicles2', speed: 3.5, cap: 100, energy: 8000, use: 35, fuel: true, spr: 'car_yellow_5', bed: '#c99a1a', cost: { acero: 10, motor: 4, circuito: 4 } },
    { name: 'Camión eléctrico', tech: 't_evehicles', speed: 4.5, cap: 150, energy: 6000, use: 30, charge: 300, spr: 'car_green_3', bed: '#1f7a4a', cost: { acero: 10, motor_electrico: 4, bateria: 6 } },
    { name: 'Transporte autónomo', tech: 't_autonomous', speed: 6, cap: 240, energy: 12000, use: 30, charge: 700, smart: true, spr: 'car_blue_1', bed: '#1c6aa8', cost: { acero: 10, sistema_control: 2, bateria: 10 } },
  ];
  IE.LOCOS = [
    null,
    { name: 'Locomotora de vapor', tech: 't_rail', speed: 4, maxWagons: 3, energy: 20000, use: 60, fuel: true, color: '#3a3a3a', accent: '#b5562f', cost: { acero: 20, motor: 6, ladrillo: 10 } },
    { name: 'Locomotora diésel', tech: 't_rail2', speed: 6.5, maxWagons: 5, energy: 40000, use: 80, fuel: true, color: '#c98a12', accent: '#3a3a3a', cost: { acero: 25, motor_electrico: 4, circuito: 6 } },
    { name: 'Locomotora eléctrica', tech: 't_etrains', speed: 9, maxWagons: 6, energy: 30000, use: 70, charge: 1500, color: '#1f7a4a', accent: '#e0e0e0', cost: { acero: 25, motor_electrico: 8, bateria: 10 } },
    { name: 'Tren de levitación magnética', tech: 't_maglev', speed: 15, maxWagons: 8, energy: 60000, use: 60, charge: 4000, color: '#e8f2ff', accent: '#36c9ff', cost: { superconductor: 20, sistema_control: 4, acero: 20 } },
  ];
  IE.WAGONS = [
    null,
    { name: 'Vagón de mercancías', tech: 't_rail', cap: 300, cost: { acero: 8, placa_hierro: 10 } },
    { name: 'Vagón de alta capacidad', tech: 't_heavyrail', cap: 800, cost: { acero: 20, motor_electrico: 1 } },
  ];

  // Instalaciones de la historia (no se construyen desde la barra)
  def('core', { name: 'Núcleo ATLAS', kind: 'core', special: true, desc: 'Corazón de la colonia: almacén central y reserva energética de emergencia.',
    tiers: [{ name: 'Núcleo ATLAS', w: 3, h: 3, out: 60, supply: 6, link: 9, spr: 'st_01' }] });
  def('ruin', { name: 'Instalación abandonada', kind: 'ruin', special: true, tiers: [{ name: 'Ruina', w: 3, h: 3 }] });
  def('city', { name: 'Nueva Aurora', kind: 'city', special: true, tiers: [{ name: 'Ciudad abandonada', w: 4, h: 4 }] });
  def('horizon', { name: 'Complejo Horizonte', kind: 'horizon', special: true, tiers: [{ name: 'Complejo Horizonte', w: 5, h: 5, power: 15000 }] });

  IE.CATEGORIES = [
    { id: 'extraccion', name: 'Extracción' },
    { id: 'logistica', name: 'Logística' },
    { id: 'produccion', name: 'Producción' },
    { id: 'energia', name: 'Energía' },
    { id: 'transporte', name: 'Transporte' },
  ];

  IE.tierOf = (ent) => B[ent.type].tiers[(ent.tier || 1) - 1];
})();
