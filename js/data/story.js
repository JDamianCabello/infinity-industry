// Historia: regiones, instalaciones abandonadas, misiones, registros y final.
(function () {
  const IE = window.IE;

  IE.REGIONS = [
    { id: 0, name: 'Valle del Despertar', desc: 'Llanuras fértiles donde aterrizó la colonia.' },
    { id: 1, name: 'Bosque Ferroso', desc: 'Bosques densos sobre grandes vetas de hierro y carbón.' },
    { id: 2, name: 'Delta del Río', desc: 'Ríos caudalosos y la antigua presa.' },
    { id: 3, name: 'Desierto Carmesí', desc: 'Arenas rojas, pozos de petróleo y la ciudad muerta de Nueva Aurora.' },
    { id: 4, name: 'Montes de Cristal', desc: 'Cumbres con cuarzo y uranio.' },
    { id: 5, name: 'Cráter Horizonte', desc: 'El lugar donde todo empezó. Xenita pura.' },
  ];

  // Instalaciones abandonadas: se restauran entregando materiales (por cinta o desde el Núcleo)
  IE.RUINS = {
    dam: { name: 'Presa de Aurora', region: 2, cost: { ladrillo: 60, placa_hierro: 60, motor: 10 }, flag: 'dam_restored', log: 'log_dam', gen: 400,
      desc: 'Una presa hidroeléctrica partida. Si se repara, volverá a generar 400 kW conectándola a la red.' },
    archive: { name: 'Archivo de la Colonia', region: 1, cost: { circuito: 50, cable: 100, placa_hierro: 40 }, flag: 'archive_restored', log: 'log_archive', decision: 'policy',
      desc: 'Servidores apagados bajo las raíces. Necesitan circuitos para arrancar.' },
    depot: { name: 'Depósito ferroviario', region: 1, cost: { acero: 40, motor: 20 }, flag: 'depot_restored', log: 'log_depot', grantTech: 't_rail2', side: true,
      desc: 'Talleres de locomotoras. Los planos guardados ahorran investigación.' },
    pumping: { name: 'Estación de bombeo', region: 3, cost: { acero: 60, circuito: 40, ladrillo: 60 }, flag: 'pumping_restored', log: 'log_pumping', grantItems: { crudo: 200, combustible: 100 }, side: true,
      desc: 'Tanques de crudo sellados. Algo de petróleo sigue dentro.' },
    observatory: { name: 'Observatorio ATLAS', region: 4, cost: { procesador: 50, bateria: 50, acero: 100 }, flag: 'truth_revealed', log: 'log_observatory', decision: 'path',
      desc: 'Antenas apuntando al cráter. Aquí se diseñó el proyecto original.' },
  };
  // Demanda de la ciudad abandonada (se abastece por cinta, camión o tren)
  IE.CITY_DEMAND = { ladrillo: 300, acero: 200, circuito: 200, motor_electrico: 50, combustible: 100 };
  // Componentes del Complejo Horizonte
  IE.HORIZON_DEMAND = { modulo_horizonte: 20, nucleo_horizonte: 4, superconductor: 200, componente_avanzado: 50, acero: 500 };
  IE.HORIZON_POWER = 15000; // kW que necesita la activación

  IE.DECISIONS = {
    policy: {
      title: 'Política energética de la colonia',
      text: 'Los archivos muestran que la antigua civilización exprimió el planeta hasta romperlo. ¿Qué rumbo tomamos?',
      options: [
        { id: 'intensiva', name: 'Explotación intensiva', desc: 'Los extractores producen un 20 % más, pero la contaminación aumenta un 30 %.' },
        { id: 'limpia', name: 'Transición limpia', desc: 'Solar, eólica e hidroeléctrica rinden un 15 % más y la contaminación se disipa el doble de rápido.' },
      ],
    },
    path: {
      title: 'Cómo resolver la crisis',
      text: 'ATLAS: «El Proyecto Horizonte necesita un corazón energético. Los fundadores discutieron dos diseños y nunca eligieron. Elige tú.»',
      options: [
        { id: 'armonia', name: 'Red Armonía', desc: 'Un planeta sostenido por energía distribuida. El Núcleo Horizonte usa baterías y la activación exige 150 MJ almacenados en baterías.' },
        { id: 'prometeo', name: 'Núcleo Prometeo', desc: 'Un único corazón de potencia inmensa. El Núcleo usa celdas nucleares y la activación exige un generador experimental funcionando.' },
      ],
    },
  };

  // Registros recuperables
  IE.LOGS = {
    log_wake: { title: 'Registro 0 · Despertar', text: 'Colono, despierto tras 212 años de hibernación. Soy ATLAS, la inteligencia de la colonia. La red planetaria está muerta. Mi reserva de emergencia apenas da 60 kW. Necesitamos materiales, después energía.' },
    log_power: { title: 'Registro 1 · Vapor', text: 'Las primeras turbinas giran. Detecto restos de una red eléctrica continental bajo el valle. Alguien construyó todo esto… y lo abandonó con prisa.' },
    log_river: { title: 'Registro 2 · Al otro lado', text: 'Los puentes nos abren el Bosque Ferroso y el Delta. Las señales térmicas muestran estructuras artificiales entre los árboles.' },
    log_dam: { title: 'Registro 3 · La presa', text: 'Diario del ingeniero Ilan Voss: «Nos ordenan duplicar la producción de la presa. El río no da más. Los pilares crujen. Nadie escucha.»' },
    log_archive: { title: 'Registro 4 · Archivo', text: 'Actas del Consejo, año 340: consumo energético +900 % en una década. Reservas de carbón agotadas. Se aprueba «extracción profunda de xenita» en el cráter, pese a las advertencias.' },
    log_depot: { title: 'Registro 5 · Depósito', text: 'Horarios ferroviarios congelados en el mismo día. Todos los trenes se dirigían al este, hacia el cráter.' },
    log_city: { title: 'Registro 6 · Nueva Aurora', text: 'Las luces de Nueva Aurora vuelven a encenderse. En la plaza, un monumento: «Al Proyecto Horizonte, que nos salvará del frío». La ciudad murió esperando.' },
    log_pumping: { title: 'Registro 7 · Bombeo', text: 'Memorándum: «La xenita desestabiliza la corteza. Cada megavatio extraído enfría la atmósfera». La crisis no fue escasez: fue la propia extracción.' },
    log_observatory: { title: 'Registro 8 · La verdad', text: 'ATLAS: «Yo coordinaba el Proyecto Horizonte: una instalación planetaria para reequilibrar la corteza y la atmósfera. Me desconectaron al 87 %. Puedes terminarlo.»' },
    log_crater: { title: 'Registro 9 · El cráter', text: 'Las cimentaciones del complejo siguen intactas. La xenita brilla en las paredes del cráter. Necesitaremos nanofabricación para manipularla sin repetir el desastre.' },
    log_end: { title: 'Registro 10 · Horizonte', text: 'El complejo late. La corteza se estabiliza. El cielo, por primera vez en dos siglos, tiene nubes de lluvia.' },
  };

  // Misiones principales (en orden) y secundarias
  IE.MISSIONS = [
    // ---- Acto I: Despertar ----
    { id: 'm_hand', act: 1, title: 'Primeros pasos',
      intro: ['ATLAS: Bienvenido, colono. Toca un yacimiento con la herramienta ✋ para extraer a mano.', 'ATLAS: Todo lo que reúnas va al Núcleo, nuestro almacén central.'],
      obj: [{ t: 'manual', n: 10, label: 'Extrae 10 recursos a mano' }],
      reward: { items: { placa_hierro: 10, engranaje: 6 }, log: 'log_wake' } },
    { id: 'm_mine', act: 1, title: 'Minería automática',
      intro: ['ATLAS: Coloca un Extractor mecánico sobre hierro y un Horno de carbón delante. El extractor expulsa por su frente.', 'ATLAS: Ambos queman carbón: aliméntalos con una cinta desde un extractor sobre carbón.'],
      obj: [{ t: 'build', b: 'miner', n: 2, label: 'Construye 2 extractores' }, { t: 'build', b: 'furnace', n: 1, label: 'Construye 1 horno' }, { t: 'produce', item: 'lingote_hierro', n: 20, label: 'Funde 20 lingotes de hierro' }],
      reward: { items: { carbon: 30, placa_hierro: 20 } } },
    { id: 'm_belt', act: 1, title: 'La cinta transportadora',
      intro: ['ATLAS: Lleva la producción al Núcleo con cintas. Arrastra el dedo para trazarlas. Una cinta que apunta al Núcleo le entrega lo que transporta.'],
      obj: [{ t: 'core', item: 'lingote_hierro', n: 50, label: 'Entrega 50 lingotes de hierro al Núcleo' }, { t: 'core', item: 'lingote_cobre', n: 30, label: 'Entrega 30 lingotes de cobre al Núcleo' }],
      reward: { items: { placa_hierro: 30, engranaje: 10, cable: 20 } } },
    { id: 'm_lab', act: 1, title: 'Investigación',
      intro: ['ATLAS: Construye un Laboratorio cerca del Núcleo: mi reserva puede alimentarlo. Fabrica paquetes mecánicos (cobre + engranaje) en el Taller o en ensambladoras.', 'ATLAS: Abre 🔬 Investigación y elige «Automatización básica».'],
      obj: [{ t: 'build', b: 'lab', n: 1, label: 'Construye un laboratorio' }, { t: 'research', tech: 't_automation', label: 'Investiga Automatización básica' }],
      reward: { items: { ciencia1: 10 } } },
    { id: 'm_power', act: 1, title: 'Restaurar la energía',
      intro: ['ATLAS: Mi reserva no basta. Investiga la Energía de vapor, construye generadores y postes para llevar la electricidad.'],
      obj: [{ t: 'research', tech: 't_steam', label: 'Investiga Energía de vapor' }, { t: 'power', kw: 400, secs: 30, label: 'Ten una red con 400 kW de capacidad durante 30 s' }],
      reward: { flags: ['act1_power'], log: 'log_power', items: { cable: 30 } } },
    { id: 'm_gears', act: 1, title: 'Engranajes del progreso',
      intro: ['ATLAS: Automaticemos los paquetes de investigación con ensambladoras.'],
      obj: [{ t: 'produce', item: 'engranaje', n: 100, label: 'Fabrica 100 engranajes' }, { t: 'produce', item: 'ciencia1', n: 50, label: 'Fabrica 50 paquetes mecánicos' }],
      reward: { items: { motor: 5 } } },
    { id: 'm_bridge', act: 1, title: 'Más allá del río',
      intro: ['ATLAS: El río nos encierra en el valle. Investiga Puentes para cruzarlo.'],
      obj: [{ t: 'research', tech: 't_bridges', label: 'Investiga Puentes' }],
      reward: { regions: [1, 2], log: 'log_river' } },
    { id: 'm_era2', act: 1, title: 'Electrificación',
      intro: ['ATLAS: Es hora de una verdadera red eléctrica. Investiga la Electrificación.'],
      obj: [{ t: 'research', tech: 't_era2', label: 'Investiga Electrificación' }],
      reward: { items: { circuito: 10 } },
      outro: ['ATLAS: Fin del Acto I. La colonia está viva. Ahora toca reconstruir.'] },
    // ---- Acto II: Reconstrucción ----
    { id: 'm_circuits', act: 2, title: 'Los primeros 100 componentes',
      intro: ['ATLAS: Acto II · Reconstrucción. Necesitamos electrónica en serie.'],
      obj: [{ t: 'produce', item: 'circuito', n: 100, label: 'Fabrica 100 circuitos electrónicos' }],
      reward: { items: { circuito: 20 } } },
    { id: 'm_dam', act: 2, title: 'La presa antigua',
      intro: ['ATLAS: En el Delta del Río hay una presa. Repararla nos dará energía limpia y los planos de la hidroelectricidad.'],
      obj: [{ t: 'restore', ruin: 'dam', label: 'Restaura la Presa de Aurora' }],
      reward: {} },
    { id: 'm_trucks', act: 2, title: 'Logística por carretera',
      intro: ['ATLAS: Las cintas no llegan lejos de forma barata. Investiga Vehículos de carga, traza carreteras y une dos paradas.'],
      obj: [{ t: 'research', tech: 't_vehicles', label: 'Investiga Vehículos de carga' }, { t: 'truck', n: 200, label: 'Descarga 200 objetos con camiones' }],
      reward: { items: { motor: 10 } } },
    { id: 'm_archive', act: 2, title: 'Los archivos perdidos',
      intro: ['ATLAS: En el Bosque Ferroso hay un archivo. Quiero saber qué pasó aquí.'],
      obj: [{ t: 'restore', ruin: 'archive', label: 'Restaura el Archivo de la Colonia' }],
      reward: {} },
    { id: 'm_era3', act: 2, title: 'Automatización avanzada',
      intro: ['ATLAS: Con lo aprendido podemos dar el salto a la Era 3.'],
      obj: [{ t: 'research', tech: 't_era3', label: 'Investiga Automatización avanzada' }],
      reward: { regions: [3] } },
    { id: 'm_rail', act: 2, title: 'Red ferroviaria',
      intro: ['ATLAS: El Desierto Carmesí está abierto. Investiga el Ferrocarril, tiende vías entre dos estaciones y pon un tren a trabajar.'],
      obj: [{ t: 'research', tech: 't_rail', label: 'Investiga Ferrocarril' }, { t: 'train', n: 300, label: 'Descarga 300 objetos con trenes' }],
      reward: { items: { acero: 50 } } },
    { id: 'm_city', act: 2, title: 'Abastecer Nueva Aurora',
      intro: ['ATLAS: Nueva Aurora, la vieja capital, sigue en pie en el desierto. Si la abastecemos, su red reabrirá el paso a los Montes de Cristal.'],
      obj: [{ t: 'city', label: 'Entrega todos los suministros a Nueva Aurora' }],
      reward: { flags: ['city_supplied'], regions: [4], log: 'log_city' },
      outro: ['ATLAS: Fin del Acto II. Nueva Aurora brilla otra vez… pero sus registros hablan de un proyecto inacabado.'] },
    // ---- Acto III: La verdad ----
    { id: 'm_polymer', act: 3, title: 'El crudo del desierto',
      intro: ['ATLAS: Acto III · La verdad. Los polímeros y las baterías son la base de la siguiente era.'],
      obj: [{ t: 'produce', item: 'polimero', n: 200, label: 'Fabrica 200 polímeros' }, { t: 'produce', item: 'bateria', n: 50, label: 'Fabrica 50 baterías' }],
      reward: {} },
    { id: 'm_era4', act: 3, title: 'Alta eficiencia',
      intro: ['ATLAS: Investiga la Era 4 y construye una red capaz de dar 3 MW.'],
      obj: [{ t: 'research', tech: 't_era4', label: 'Investiga Alta eficiencia' }, { t: 'power', kw: 3000, secs: 30, label: 'Ten una red con 3 MW de capacidad durante 30 s' }],
      reward: {} },
    { id: 'm_auto', act: 3, title: 'La fábrica autónoma',
      intro: ['ATLAS: Una fábrica que se gestiona sola: robots y producción sostenida de procesadores.'],
      obj: [{ t: 'robots', n: 6, label: 'Ten 6 robots logísticos activos' }, { t: 'rate', item: 'procesador', perMin: 6, label: 'Produce 6 procesadores/min' }],
      reward: { items: { bateria: 20 } } },
    { id: 'm_truth', act: 3, title: 'Revelación',
      intro: ['ATLAS: En los Montes de Cristal está el observatorio desde el que me controlaban. Restáuralo. Te debo la verdad.'],
      obj: [{ t: 'restore', ruin: 'observatory', label: 'Restaura el Observatorio ATLAS' }, { t: 'flag', flag: 'path_chosen', label: 'Elige cómo resolver la crisis' }],
      reward: {} },
    { id: 'm_era5', act: 3, title: 'Megafactoría',
      intro: ['ATLAS: Para terminar Horizonte necesitamos una megafactoría.'],
      obj: [{ t: 'research', tech: 't_era5', label: 'Investiga Megafactoría' }],
      reward: { regions: [5], log: 'log_crater' },
      outro: ['ATLAS: Fin del Acto III. El Cráter Horizonte está abierto. Allí acaba todo… o empieza.'] },
    // ---- Acto IV: Proyecto Horizonte ----
    { id: 'm_nano', act: 4, title: 'Materia del cráter',
      intro: ['ATLAS: Acto IV · Proyecto Horizonte. Extrae xenita del cráter y nanofabrícala.'],
      obj: [{ t: 'research', tech: 't_nanofab', label: 'Investiga Nanofabricación' }, { t: 'produce', item: 'nanomaterial', n: 100, label: 'Fabrica 100 nanomateriales' }],
      reward: {} },
    { id: 'm_final_tech', act: 4, title: 'Tecnología final',
      intro: ['ATLAS: Completa la investigación del Proyecto Horizonte.'],
      obj: [{ t: 'research', tech: 't_horizon', label: 'Investiga Proyecto Horizonte' }],
      reward: {} },
    { id: 'm_grid', act: 4, title: 'Una red estable',
      intro: ['ATLAS: El complejo necesitará 15 MW estables. Ninguna máquina debe quedarse sin energía.'],
      obj: [{ t: 'satisfied', kw: 20000, secs: 60, label: 'Red de 20 MW de capacidad al 100 % de suministro durante 60 s' }],
      reward: {} },
    { id: 'm_build', act: 4, title: 'Construir Horizonte',
      intro: ['ATLAS: Lleva los componentes al Complejo Horizonte del cráter. Trenes magnéticos, camiones o cintas: tú decides.'],
      obj: [{ t: 'horizon', label: 'Entrega todos los componentes al Complejo Horizonte' }],
      reward: {} },
    { id: 'm_activate', act: 4, title: 'Activación',
      intro: ['ATLAS: Todo listo. Conecta el complejo a la red y actívalo desde su panel.'],
      obj: [{ t: 'path_req', label: 'Requisito de tu decisión' }, { t: 'flag', flag: 'horizon_active', label: 'Activa el Complejo Horizonte' }],
      reward: { log: 'log_end' }, final: true },
  ];
  IE.SIDE_MISSIONS = [
    { id: 's_depot', side: true, title: 'El depósito ferroviario', need: 'region1', obj: [{ t: 'restore', ruin: 'depot', label: 'Restaura el Depósito ferroviario' }], reward: { text: 'Locomotora diésel investigada' } },
    { id: 's_pumping', side: true, title: 'Tanques sellados', need: 'region3', obj: [{ t: 'restore', ruin: 'pumping', label: 'Restaura la Estación de bombeo' }], reward: { text: '200 crudo y 100 combustible' } },
    { id: 's_ingots', side: true, title: 'Fundición en masa', obj: [{ t: 'produce', item: 'lingote_hierro', n: 2000, label: 'Funde 2000 lingotes de hierro' }], reward: { items: { acero: 40 } } },
    { id: 's_green', side: true, title: 'Cielo limpio', need: 'act1_power', obj: [{ t: 'build', b: 'solar', n: 10, label: 'Construye 10 paneles solares' }, { t: 'build', b: 'wind', n: 5, label: 'Construye 5 turbinas eólicas' }], reward: { items: { bateria: 20 } } },
    { id: 's_belts', side: true, title: 'Red de cintas', obj: [{ t: 'build', b: 'belt', n: 300, label: 'Coloca 300 cintas' }], reward: { items: { engranaje: 50 } } },
    { id: 's_storage', side: true, title: 'Reserva energética', need: 'act1_power', obj: [{ t: 'stored', kj: 50000, label: 'Capacidad de baterías de 50 MJ' }], reward: { items: { superconductor: 10 } } },
  ];
  IE.MISSION = {};
  IE.MISSIONS.concat(IE.SIDE_MISSIONS).forEach(m => IE.MISSION[m.id] = m);

  IE.ENDINGS = {
    armonia: ['El Complejo Horizonte despierta alimentado por millones de células repartidas por el planeta.', 'Cada panel, cada turbina, cada batería de la colonia late a la vez. La corteza se calma.', 'Las ciudades se reconectan una a una. Nadie vuelve a depender de un único corazón.', 'ATLAS: «Ellos quisieron dominar el planeta. Tú le enseñaste a respirar.»'],
    prometeo: ['El Núcleo Prometeo se enciende en el centro del cráter: una estrella domesticada.', 'Su energía reequilibra la corteza en horas. La atmósfera se templa y vuelve la lluvia.', 'Prometeo deberá vigilarse durante siglos, pero el planeta vuelve a tener futuro.', 'ATLAS: «Has hecho lo que ellos no se atrevieron a terminar.»'],
  };
})();
