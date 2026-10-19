// Árbol de investigación por eras.
// cost: unidades; cada unidad consume 1 paquete de cada tipo en `packs`.
(function () {
  const IE = window.IE;
  const ERA_PACKS = {
    1: ['ciencia1'],
    2: ['ciencia1', 'ciencia2'],
    3: ['ciencia1', 'ciencia2', 'ciencia3'],
    4: ['ciencia2', 'ciencia3', 'ciencia4'],
    5: ['ciencia3', 'ciencia4', 'ciencia5'],
    6: ['ciencia4', 'ciencia5', 'ciencia6'],
  };
  const ERA_TIME = { 1: 5, 2: 8, 3: 10, 4: 12, 5: 15, 6: 20 };
  IE.ERAS = [
    null,
    { name: 'Industria primitiva', color: '#c27a3a' },
    { name: 'Electrificación', color: '#e0b020' },
    { name: 'Automatización avanzada', color: '#3a8fe0' },
    { name: 'Alta eficiencia', color: '#a24ae0' },
    { name: 'Megafactoría', color: '#e0c23a' },
    { name: 'Tecnología final', color: '#f0f0f0' },
  ];

  const T = IE.TECH = {};
  function t(id, era, name, cost, pre, extra) {
    T[id] = Object.assign({ id, era, name, cost, pre: pre || [], packs: ERA_PACKS[era], time: ERA_TIME[era], desc: '' }, extra || {});
  }
  // Era 1
  t('t_automation', 1, 'Automatización básica', 10, [], { desc: 'Ensambladoras mecánicas.' });
  t('t_motors', 1, 'Motores mecánicos', 15, ['t_automation'], { desc: 'Receta de motor mecánico.' });
  t('t_steam', 1, 'Energía de vapor', 20, ['t_automation'], { desc: 'Máquinas de vapor y postes de madera.' });
  t('t_logistics1', 1, 'Logística I', 15, ['t_automation'], { desc: 'Divisores y cruces de cintas.' });
  t('t_storage', 1, 'Almacenaje', 10, [], { desc: 'Cajas metálicas.' });
  t('t_bridges', 1, 'Puentes', 25, ['t_logistics1'], { desc: 'Construir cintas, carreteras y vías sobre el agua.', flag: 'bridges' });
  t('t_era2', 1, 'Electrificación', 40, ['t_steam', 't_motors'], { desc: 'Abre la Era 2: circuitos y paquete eléctrico.', needFlag: 'act1_power', needText: 'Completa la misión «Restaurar la energía».' });
  // Era 2
  t('t_miner2', 2, 'Minería eléctrica', 30, ['t_era2'], { desc: 'Extractor eléctrico V2.' });
  t('t_furnace2', 2, 'Fundición industrial', 30, ['t_era2'], { desc: 'Horno V2: acero y silicio.' });
  t('t_belt2', 2, 'Cintas rápidas', 30, ['t_era2', 't_logistics1'], { desc: 'Cinta V2 y divisor rápido.' });
  t('t_assembler2', 2, 'Ensamblaje automático', 40, ['t_era2'], { desc: 'Ensambladora V2 y motores eléctricos.' });
  t('t_lab2', 2, 'Laboratorio eléctrico', 30, ['t_era2'], { desc: 'Laboratorio V2.' });
  t('t_combustion', 2, 'Combustión interna', 40, ['t_era2'], { desc: 'Generador de combustión y poste metálico.' });
  t('t_steam2', 2, 'Turbina de vapor', 30, ['t_era2'], { desc: 'Generador de vapor V2.' });
  t('t_solar', 2, 'Energía solar', 40, ['t_furnace2'], { desc: 'Paneles solares.' });
  t('t_wind', 2, 'Energía eólica', 30, ['t_era2'], { desc: 'Molinos eólicos.' });
  t('t_hydro', 2, 'Hidroelectricidad', 40, ['t_era2'], { desc: 'Centrales junto al agua.', needFlag: 'dam_restored', needText: 'Restaura la Presa de Aurora.' });
  t('t_vehicles', 2, 'Vehículos de carga', 40, ['t_assembler2'], { desc: 'Carreteras, paradas y carro de vapor.' });
  t('t_vehicles2', 2, 'Camiones diésel', 50, ['t_vehicles'], { desc: 'Camión V2.' });
  t('t_era3', 2, 'Automatización avanzada', 80, ['t_assembler2', 't_furnace2', 't_vehicles'], { desc: 'Abre la Era 3.', needFlag: 'archive_restored', needText: 'Restaura el Archivo de la Colonia.' });
  // Era 3
  t('t_arms', 3, 'Brazos robóticos', 50, ['t_era3'], { desc: 'Brazos V1/V2 y clasificador inteligente.' });
  t('t_rail', 3, 'Ferrocarril', 60, ['t_era3'], { desc: 'Vías, señales, estaciones, locomotora de vapor y vagones.' });
  t('t_rail2', 3, 'Locomotora diésel', 60, ['t_rail'], { desc: 'Locomotora V2.' });
  t('t_miner3', 3, 'Minería automatizada', 60, ['t_era3', 't_miner2'], { desc: 'Extractor V3.' });
  t('t_furnace3', 3, 'Fundición automatizada', 60, ['t_era3', 't_furnace2'], { desc: 'Horno V3.' });
  t('t_assembler3', 3, 'Fábricas modulares', 60, ['t_era3'], { desc: 'Ensambladora V3.' });
  t('t_lab3', 3, 'Laboratorio automatizado', 60, ['t_era3', 't_lab2'], { desc: 'Laboratorio V3.' });
  t('t_belt3', 3, 'Cintas exprés', 60, ['t_era3', 't_belt2'], { desc: 'Cinta V3 y distribuidor exprés.' });
  t('t_logistics3', 3, 'Logística avanzada', 50, ['t_era3'], { desc: 'Almacén 2x2 y muelle de carga.' });
  t('t_substation', 3, 'Subestaciones', 50, ['t_era3'], { desc: 'Poste V3.' });
  t('t_combustion2', 3, 'Diésel industrial', 60, ['t_combustion', 't_era3'], { desc: 'Generador de combustión V2.' });
  t('t_steam3', 3, 'Alta presión', 60, ['t_steam2', 't_era3'], { desc: 'Generador de vapor V3.' });
  t('t_hydro2', 3, 'Turbinas hidráulicas', 60, ['t_hydro', 't_era3'], { desc: 'Hidroeléctrica V2.' });
  t('t_oil', 3, 'Petróleo', 70, ['t_era3'], { desc: 'Bomba de crudo, refinería y combustible.', needFlag: 'region3', needText: 'Desbloquea el Desierto Carmesí.' });
  t('t_chem', 3, 'Química', 70, ['t_oil'], { desc: 'Planta química: polímeros y baterías.' });
  t('t_processors', 3, 'Procesadores', 80, ['t_chem', 't_assembler3'], { desc: 'Receta de procesador.' });
  t('t_era4', 3, 'Alta eficiencia', 120, ['t_processors', 't_rail'], { desc: 'Abre la Era 4.', needFlag: 'city_supplied', needText: 'Abastece Nueva Aurora.' });
  // Era 4
  t('t_robots', 4, 'Robots autónomos', 100, ['t_era4'], { desc: 'Puerto de robots logísticos.' });
  t('t_robots2', 4, 'Enjambre logístico', 150, ['t_robots'], { desc: 'Centro de robots V2.' });
  t('t_etrains', 4, 'Trenes eléctricos', 100, ['t_era4', 't_rail2'], { desc: 'Locomotora V3.' });
  t('t_evehicles', 4, 'Vehículos eléctricos', 80, ['t_era4', 't_vehicles2'], { desc: 'Camión V3.' });
  t('t_batteries', 4, 'Baterías industriales', 80, ['t_era4'], { desc: 'Bancos de baterías V1 y V2.' });
  t('t_solar2', 4, 'Solar mejorada', 80, ['t_era4', 't_solar'], { desc: 'Panel solar V2.' });
  t('t_solar3', 4, 'Solar avanzada', 120, ['t_solar2'], { desc: 'Panel solar V3.' });
  t('t_wind2', 4, 'Aerogeneradores', 80, ['t_era4', 't_wind'], { desc: 'Eólica V2.' });
  t('t_wind3', 4, 'Turbinas eólicas mejoradas', 120, ['t_wind2'], { desc: 'Eólica V3.' });
  t('t_smartgrid', 4, 'Redes inteligentes', 120, ['t_batteries', 't_substation'], { desc: 'Nodo de red inteligente, acumulador de red y prioridades energéticas.', flag: 'priorities' });
  t('t_control', 4, 'Sistemas de control', 100, ['t_era4'], { desc: 'Sistemas de control y clasificador de visión.' });
  t('t_arms3', 4, 'Brazos de pila', 80, ['t_era4', 't_arms'], { desc: 'Brazo V3.' });
  t('t_oil2', 4, 'Refinado catalítico', 100, ['t_era4'], { desc: 'Refinería V2, bomba V2 y licuefacción de carbón.' });
  t('t_chem2', 4, 'Química avanzada', 100, ['t_era4'], { desc: 'Planta química V2.' });
  t('t_hydro3', 4, 'Presas de alto rendimiento', 100, ['t_hydro2', 't_era4'], { desc: 'Hidroeléctrica V3.' });
  t('t_precision', 4, 'Fabricación de precisión', 150, ['t_control'], { desc: 'Fábrica de precisión: superconductores y componentes avanzados.' });
  t('t_era5', 4, 'Megafactoría', 200, ['t_precision', 't_smartgrid'], { desc: 'Abre la Era 5.', needFlag: 'truth_revealed', needText: 'Restaura el Observatorio ATLAS.' });
  // Era 5
  t('t_nuclear', 5, 'Fisión nuclear', 200, ['t_era5'], { desc: 'Reactor, centrifugadora y celdas.' });
  t('t_nuclear2', 5, 'Reactores de cuarta generación', 250, ['t_nuclear'], { desc: 'Reactor V2 y reciclaje de residuos.' });
  t('t_miner4', 5, 'Minería avanzada', 200, ['t_era5', 't_miner3'], { desc: 'Extractor V4.' });
  t('t_furnace4', 5, 'Hornos de inducción', 200, ['t_era5', 't_furnace3'], { desc: 'Horno V4.' });
  t('t_assembler4', 5, 'Ensamblaje de precisión', 200, ['t_era5', 't_assembler3'], { desc: 'Ensambladora V4.' });
  t('t_lab4', 5, 'Instituto de investigación', 200, ['t_era5', 't_lab3'], { desc: 'Laboratorio V4.' });
  t('t_heavyrail', 5, 'Trenes de alta capacidad', 150, ['t_era5'], { desc: 'Vagón V2.' });
  t('t_hub', 5, 'Centros logísticos', 150, ['t_era5'], { desc: 'Centro logístico y terminal automatizada.' });
  t('t_highpower', 5, 'Redes de alta potencia', 200, ['t_era5'], { desc: 'Turbinas supercríticas, turbina de gas y banco superconductor.' });
  t('t_solar4', 5, 'Colectores fotónicos', 200, ['t_solar3', 't_era5'], { desc: 'Panel solar V4.' });
  t('t_wind4', 5, 'Turbinas de altura', 200, ['t_wind3', 't_era5'], { desc: 'Eólica V4.' });
  t('t_nanofab', 5, 'Nanofabricación', 250, ['t_era5'], { desc: 'Nanofabricador y nanomaterial.', needFlag: 'region5', needText: 'Desbloquea el Cráter Horizonte.' });
  t('t_era6', 5, 'Tecnología final', 300, ['t_nanofab'], { desc: 'Abre la Era 6.' });
  // Era 6
  t('t_fusion', 6, 'Generación experimental', 300, ['t_era6'], { desc: 'Reactor de resonancia de xenita.' });
  t('t_fusion2', 6, 'Energía de punto cero', 400, ['t_fusion'], { desc: 'Generador experimental V2.' });
  t('t_maglev', 6, 'Transporte magnético', 300, ['t_era6'], { desc: 'Cintas magnéticas y trenes de levitación.' });
  t('t_autonomous', 6, 'Gestión industrial autónoma', 300, ['t_era6'], { desc: '+25 % velocidad y -15 % consumo en todas las máquinas. Brazo V4 y transporte autónomo.', flag: 'autonomous' });
  t('t_horizon', 6, 'Proyecto Horizonte', 500, ['t_era6'], { desc: 'Recetas del Módulo y el Núcleo Horizonte.' });

  IE.TECH_IDS = Object.keys(T);
  // Investigadas al empezar
  IE.START_TECH = [];
})();
