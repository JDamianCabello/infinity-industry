// Objetos y recetas.
(function () {
  const IE = window.IE;

  // icon: forma con la que se dibuja el objeto (ver assets.js)
  // spr: sprite real del atlas usado como base del icono cuando existe
  // fuel: energía en kJ si se puede quemar
  IE.ITEMS = {
    madera:          { name: 'Madera',               color: '#9a6a3a', icon: 'wood', fuel: 2000 },
    piedra:          { name: 'Piedra',               color: '#a8a8a0', icon: 'ore', spr: 'env_04' },
    carbon:          { name: 'Carbón',               color: '#2c2c30', icon: 'ore', spr: 'env_04', tint: '#1e1e22', fuel: 4000 },
    mineral_hierro:  { name: 'Mineral de hierro',    color: '#8fa3b8', icon: 'ore', spr: 'env_06' },
    mineral_cobre:   { name: 'Mineral de cobre',     color: '#d9773f', icon: 'ore', spr: 'env_19' },
    cuarzo:          { name: 'Cuarzo',               color: '#e8e0ff', icon: 'crystal', spr: 'env_11', tint: '#e9e4ff' },
    uranio:          { name: 'Uranio',               color: '#7dff5a', icon: 'crystal', spr: 'env_12', tint: '#5fe04a' },
    xenita:          { name: 'Xenita',               color: '#d36bff', icon: 'crystal', spr: 'env_12' },
    crudo:           { name: 'Petróleo crudo',       color: '#1b1b1b', icon: 'barrel', spr: 'obj_barrel_blue_down', tint: '#2a2a2a' },

    lingote_hierro:  { name: 'Lingote de hierro',    color: '#b9c6d3', icon: 'ingot' },
    lingote_cobre:   { name: 'Lingote de cobre',     color: '#e48a4a', icon: 'ingot' },
    ladrillo:        { name: 'Ladrillo',             color: '#b5562f', icon: 'brick' },
    acero:           { name: 'Acero',                color: '#7d8a99', icon: 'beam' },
    silicio:         { name: 'Silicio',              color: '#5b6b8c', icon: 'wafer' },

    placa_hierro:    { name: 'Placa de hierro',      color: '#c9d2dc', icon: 'plate' },
    engranaje:       { name: 'Engranaje',            color: '#aab4bf', icon: 'gear' },
    cable:           { name: 'Cable de cobre',       color: '#e0873f', icon: 'cable' },
    motor:           { name: 'Motor mecánico',       color: '#8b939b', icon: 'motor' },
    circuito:        { name: 'Circuito electrónico', color: '#3fae4f', icon: 'circuit' },
    motor_electrico: { name: 'Motor eléctrico',      color: '#3d7fd1', icon: 'motor', accent: '#5ab0ff' },
    combustible:     { name: 'Combustible',          color: '#e2b23a', icon: 'barrel', spr: 'obj_barrel_red_down', fuel: 12000 },
    quimicos:        { name: 'Productos químicos',   color: '#9be04a', icon: 'flask' },
    polimero:        { name: 'Polímero',             color: '#f2f2f2', icon: 'sheet' },
    bateria:         { name: 'Batería',              color: '#2e9be0', icon: 'battery' },
    procesador:      { name: 'Procesador',           color: '#2a6be0', icon: 'chip' },
    sistema_control: { name: 'Sistema de control',   color: '#e04a7a', icon: 'module' },
    superconductor:  { name: 'Superconductor',       color: '#5fe0ff', icon: 'coil' },
    celda_nuclear:   { name: 'Celda de combustible nuclear', color: '#6bff4a', icon: 'cell' },
    residuo_nuclear: { name: 'Residuo nuclear',      color: '#5a6b3a', icon: 'cell', accent: '#3a3a1a' },
    componente_avanzado: { name: 'Componente avanzado', color: '#ffb02e', icon: 'module', accent: '#ffe08a' },
    nanomaterial:    { name: 'Nanomaterial',         color: '#c05cff', icon: 'orb' },
    modulo_horizonte:{ name: 'Módulo Horizonte',     color: '#ffffff', icon: 'module', accent: '#9fe8ff' },
    nucleo_horizonte:{ name: 'Núcleo Horizonte',     color: '#ffe96b', icon: 'orb', accent: '#ffffff' },

    ciencia1: { name: 'Paquete de investigación mecánico',  color: '#e04a3a', icon: 'pack' },
    ciencia2: { name: 'Paquete de investigación eléctrico', color: '#3fbf4f', icon: 'pack' },
    ciencia3: { name: 'Paquete de automatización',          color: '#3a7fe0', icon: 'pack' },
    ciencia4: { name: 'Paquete de eficiencia',              color: '#a24ae0', icon: 'pack' },
    ciencia5: { name: 'Paquete de megafactoría',            color: '#e0c23a', icon: 'pack' },
    ciencia6: { name: 'Paquete de tecnología final',        color: '#f4f4f4', icon: 'pack' },
  };
  IE.ITEM_IDS = Object.keys(IE.ITEMS);
  IE.FUELS = IE.ITEM_IDS.filter(k => IE.ITEMS[k].fuel);

  // Recetas: m = clase de máquina, t = segundos a velocidad 1, tier = nivel mínimo
  // de la máquina, tech = tecnología que la desbloquea (null = disponible al inicio)
  const R = (id, name, m, t, inp, out, tier, tech, hand) => ({ id, name, m, t, in: inp, out, tier: tier || 1, tech: tech || null, hand: !!hand });
  IE.RECIPES = [
    // Fundición
    R('f_hierro', 'Lingote de hierro', 'furnace', 2.4, { mineral_hierro: 1 }, { lingote_hierro: 1 }),
    R('f_cobre', 'Lingote de cobre', 'furnace', 2.4, { mineral_cobre: 1 }, { lingote_cobre: 1 }),
    R('f_ladrillo', 'Ladrillos', 'furnace', 3, { piedra: 2 }, { ladrillo: 1 }),
    R('f_acero', 'Acero', 'furnace', 5, { mineral_hierro: 2, carbon: 1 }, { acero: 1 }, 2, 't_furnace2'),
    R('f_silicio', 'Silicio', 'furnace', 4, { cuarzo: 2 }, { silicio: 1 }, 2, 't_furnace2'),
    // Ensamblaje
    R('a_placa', 'Placa de hierro', 'assembler', 1, { lingote_hierro: 1 }, { placa_hierro: 1 }, 1, null, true),
    R('a_engranaje', 'Engranaje', 'assembler', 1, { placa_hierro: 2 }, { engranaje: 1 }, 1, null, true),
    R('a_cable', 'Cable de cobre', 'assembler', 0.75, { lingote_cobre: 1 }, { cable: 2 }, 1, null, true),
    R('a_ciencia1', 'Paquete mecánico', 'assembler', 5, { lingote_cobre: 1, engranaje: 1 }, { ciencia1: 1 }, 1, null, true),
    R('a_motor', 'Motor mecánico', 'assembler', 4, { placa_hierro: 1, engranaje: 2 }, { motor: 1 }, 1, 't_motors', true),
    R('a_circuito', 'Circuito electrónico', 'assembler', 1.5, { placa_hierro: 1, cable: 3 }, { circuito: 1 }, 1, 't_era2', true),
    R('a_ciencia2', 'Paquete eléctrico', 'assembler', 6, { circuito: 1, motor: 1 }, { ciencia2: 1 }, 1, 't_era2'),
    R('a_motor_e', 'Motor eléctrico', 'assembler', 6, { motor: 1, cable: 2, acero: 1 }, { motor_electrico: 1 }, 2, 't_assembler2'),
    R('a_ciencia3', 'Paquete de automatización', 'assembler', 12, { motor_electrico: 1, circuito: 2, acero: 1 }, { ciencia3: 2 }, 2, 't_era3'),
    R('a_procesador', 'Procesador', 'assembler', 8, { circuito: 2, polimero: 1, silicio: 1 }, { procesador: 1 }, 3, 't_processors'),
    R('a_ciencia4', 'Paquete de eficiencia', 'assembler', 15, { bateria: 1, procesador: 1, polimero: 1 }, { ciencia4: 2 }, 3, 't_era4'),
    R('a_control', 'Sistema de control', 'assembler', 12, { procesador: 2, motor_electrico: 1, acero: 1 }, { sistema_control: 1 }, 3, 't_control'),
    R('a_ciencia5', 'Paquete de megafactoría', 'assembler', 20, { componente_avanzado: 1, superconductor: 2 }, { ciencia5: 2 }, 4, 't_era5'),
    // Refinería y química
    R('r_destilacion', 'Destilación de crudo', 'refinery', 5, { crudo: 4 }, { combustible: 2, quimicos: 2 }, 1, 't_oil'),
    R('r_licuefaccion', 'Licuefacción de carbón', 'refinery', 8, { carbon: 5 }, { combustible: 1, quimicos: 1 }, 2, 't_oil2'),
    R('c_polimero', 'Polímero', 'chem', 4, { quimicos: 2, carbon: 1 }, { polimero: 2 }, 1, 't_chem'),
    R('c_bateria', 'Batería', 'chem', 5, { quimicos: 1, lingote_cobre: 1, placa_hierro: 1 }, { bateria: 1 }, 1, 't_chem'),
    // Nuclear
    R('n_celda', 'Celda de combustible nuclear', 'centrifuge', 20, { uranio: 10, acero: 1 }, { celda_nuclear: 1 }, 1, 't_nuclear'),
    R('n_reciclaje', 'Reciclaje de residuos', 'centrifuge', 30, { residuo_nuclear: 2 }, { uranio: 6 }, 2, 't_nuclear2'),
    // Precisión
    R('p_super', 'Superconductor', 'precision', 8, { lingote_cobre: 2, polimero: 1, silicio: 1 }, { superconductor: 1 }, 1, 't_precision'),
    R('p_componente', 'Componente avanzado', 'precision', 15, { sistema_control: 1, superconductor: 2, acero: 2 }, { componente_avanzado: 1 }, 1, 't_precision'),
    R('p_ciencia5', 'Paquete de megafactoría', 'precision', 16, { componente_avanzado: 1, superconductor: 2 }, { ciencia5: 2 }, 1, 't_era5'),
    // Nanofabricación
    R('x_nano', 'Nanomaterial', 'nanofab', 10, { xenita: 2, superconductor: 1 }, { nanomaterial: 1 }, 1, 't_nanofab'),
    R('x_ciencia6', 'Paquete de tecnología final', 'nanofab', 20, { nanomaterial: 2, procesador: 1 }, { ciencia6: 1 }, 1, 't_era6'),
    R('x_modulo', 'Módulo Horizonte', 'nanofab', 30, { nanomaterial: 5, componente_avanzado: 2, sistema_control: 2 }, { modulo_horizonte: 1 }, 1, 't_horizon'),
    // La receta del núcleo depende de la decisión del Acto III (ver story.js)
    R('x_nucleo_a', 'Núcleo Horizonte (Armonía)', 'nanofab', 60, { nanomaterial: 10, superconductor: 5, bateria: 10 }, { nucleo_horizonte: 1 }, 1, 't_horizon'),
    R('x_nucleo_p', 'Núcleo Horizonte (Prometeo)', 'nanofab', 60, { nanomaterial: 10, superconductor: 5, celda_nuclear: 2 }, { nucleo_horizonte: 1 }, 1, 't_horizon'),
  ];
  IE.RECIPE = {};
  IE.RECIPES.forEach(r => IE.RECIPE[r.id] = r);

  // Ciclos de laboratorio: cada unidad de investigación consume 1 paquete de cada tipo listado
  IE.PACKS = ['ciencia1', 'ciencia2', 'ciencia3', 'ciencia4', 'ciencia5', 'ciencia6'];
})();
