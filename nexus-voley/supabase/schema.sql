-- ============================================================
-- NEXUS VOLEY — Supabase Schema
-- Ejecutar completo en SQL Editor de Supabase
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PERFILES DE USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT CHECK (role IN ('player', 'coach')) DEFAULT 'player',
  position TEXT,
  age INTEGER,
  height NUMERIC,
  weight NUMERIC,
  team TEXT,
  level TEXT DEFAULT 'intermedio',
  experience INTEGER DEFAULT 0,
  jump_record NUMERIC DEFAULT 0,
  reach NUMERIC DEFAULT 0,
  goals TEXT,
  injuries TEXT,
  equipment TEXT[] DEFAULT '{}',
  -- Datos extendidos de jugador
  attack_style TEXT,           -- diagonal, linea, ambos
  preferred_side TEXT,         -- derecha, izquierda, ambos
  weaknesses TEXT[] DEFAULT '{}',
  wants_to_improve TEXT,
  eats_blocks BOOLEAN DEFAULT false,
  power_hitter BOOLEAN DEFAULT true,
  -- Preferencias de la app
  theme_color TEXT DEFAULT '#6366F1',
  dark_mode TEXT DEFAULT 'auto',  -- auto, dark, light
  onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS jump_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  type TEXT DEFAULT 'vertical',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHAT — HISTORIAL
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHAT — MEMORIA RESUMIDA (actualizada automáticamente)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_memory (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  summary TEXT DEFAULT '',
  key_errors TEXT[] DEFAULT '{}',
  key_improvements TEXT[] DEFAULT '{}',
  active_issues TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TORNEOS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WELLNESS
-- ============================================================
CREATE TABLE IF NOT EXISTS wellness_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  legs INTEGER CHECK (legs BETWEEN 1 AND 10),
  stress INTEGER CHECK (stress BETWEEN 1 AND 10),
  sleep NUMERIC,
  pain INTEGER CHECK (pain BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RUTINAS SEMANALES
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLUBS (para coaches)
-- ============================================================
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  color TEXT DEFAULT '#6366F1',
  code TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIEMBROS DEL CLUB
-- ============================================================
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, player_id)
);

-- ============================================================
-- JUGADAS TÁCTICAS
-- ============================================================
CREATE TABLE IF NOT EXISTS tactical_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE BASE (RAG — Base de conocimiento de vóley)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT,
  source TEXT,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- FUNCIÓN: Búsqueda semántica en knowledge base
-- ============================================================
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(768),
  match_count INT DEFAULT 4,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.category,
    kb.source,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE (filter_category IS NULL OR kb.category = filter_category)
    AND kb.embedding IS NOT NULL
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jump_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactical_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Perfiles: solo el propio
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Saltos: solo los propios
CREATE POLICY "jumps_own" ON jump_records FOR ALL USING (auth.uid() = user_id);

-- Chat: solo los propios
CREATE POLICY "chat_own" ON chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "memory_own" ON chat_memory FOR ALL USING (auth.uid() = user_id);

-- Torneos: solo los propios
CREATE POLICY "tournaments_own" ON tournaments FOR ALL USING (auth.uid() = user_id);

-- Wellness: solo los propios
CREATE POLICY "wellness_own" ON wellness_checks FOR ALL USING (auth.uid() = user_id);

-- Rutinas: solo las propias
CREATE POLICY "routines_own" ON weekly_routines FOR ALL USING (auth.uid() = user_id);

-- Clubs: coach ve los suyos
CREATE POLICY "clubs_coach" ON clubs FOR ALL USING (auth.uid() = coach_id);

-- Miembros: coach ve los de su club
CREATE POLICY "members_coach" ON club_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND coach_id = auth.uid()));
-- Jugador ve sus propias membresías
CREATE POLICY "members_player" ON club_members FOR SELECT
  USING (auth.uid() = player_id);

-- Jugadas: coach ve las suyas
CREATE POLICY "plays_coach" ON tactical_plays FOR ALL USING (auth.uid() = coach_id);

-- Knowledge base: lectura pública para todos los autenticados
CREATE POLICY "knowledge_read" ON knowledge_base FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- FUNCIÓN: Crear perfil automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO chat_memory (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- KNOWLEDGE BASE — Datos iniciales de vóley
-- (Sin embeddings por ahora — se generan vía función seed)
-- ============================================================

INSERT INTO knowledge_base (content, category, source) VALUES

-- BIOMECÁNICA DEL REMATE
('El remate de vóley requiere una secuencia biomecánica precisa. La carrera de aproximación tiene 3-4 pasos para diestros: izquierda-derecha-izquierda o derecha-izquierda-derecha-izquierda. El último paso debe ser largo y bajo, generando el impulso horizontal. Los brazos bajan hacia atrás en el penúltimo paso y suben explosivamente en la batida, generando 8-12cm adicionales de altura. El punto de contacto ideal está con el brazo completamente extendido, entre 30-50cm por encima de la cabeza. La muñeca hace un snap hacia abajo generando topspin. Los errores más comunes son: brazo semiflexionado al contacto (pierde 30-40% de potencia), no rotación de cadera, lanzamiento incorrecto del armador no anticipado. Un rematador de élite impacta la pelota a 100-120 km/h.',
'biomecánica', 'FIVB Technical Manual'),

-- BATIDA Y SALTO VERTICAL
('El salto vertical en vóley se divide en salto estático (SJ), salto con contramovimiento (CMJ) y salto con carrera (RJ). El CMJ es entre 10-15% superior al SJ gracias al ciclo estiramiento-acortamiento muscular. El RJ con carrera de aproximación supera al CMJ entre 15-25% por la transferencia de energía cinética horizontal a vertical. Los músculos principales del salto son cuádriceps, glúteos y gemelos. Los gemelos contribuyen en el 20% final del impulso (plantar flexión). Un programa pliométrico de 8-12 semanas (3 sesiones/semana) puede aumentar el CMJ entre 4-7cm en atletas intermedios y 2-4cm en avanzados. Los ejercicios más efectivos son: Drop jumps (caída de cajón + salto inmediato), Depth jumps, Broad jumps y Hurdle hops. El tiempo de contacto en tierra debe ser mínimo — cuanto más rápido, más aprovechás el ciclo estiramiento-acortamiento.',
'biomecánica', 'Journal of Strength and Conditioning Research'),

-- RECEPCIÓN
('La recepción en plataforma requiere posición base con pies separados al ancho de hombros más 10cm, rodillas en 110-120°, peso en puntas de pie, centro de gravedad bajo. Los antebrazos forman la plataforma en el tercio interno (entre muñeca y codo), codos extendidos, muñecas cruzadas o una mano dentro de la otra. El movimiento hacia la pelota siempre inicia con los pies — la plataforma sigue a los pies, nunca al revés. Ante saques flotantes el error crítico es moverse antes que la pelota baje: debe esperarse el pico de la trayectoria para luego moverse. La dirección de la recepción se controla por el ángulo de la plataforma, no por el movimiento de los brazos. Una recepción perfecta llega a 30cm de la posición habitual del armador sin que éste se mueva. Los liberos de élite tienen tiempo de reacción de 180-220ms.',
'biomecánica', 'Volleyball Coaching Worldwide'),

-- BLOQUEO
('El bloqueo efectivo requiere posición base a 20-30cm de la red, de frente, peso en puntas de pie. La lectura del ataque se basa en el hombro del atacante: hombro abierto hacia la izquierda indica pase al central o hacia el cuarto, hombro derecho adelante indica diagonal o atrás. Los ojos del bloqueador deben estar en el atacante, no en el armador ni en la pelota. El desplazamiento lateral se hace con paso chassé — nunca cruzar los pies. La penetración de manos sobre la red es legal y fundamental: las manos deben cruzar el plano de la red apuntando hacia la cancha rival. Los dedos tensos y separados forman una barrera sólida. Un bloqueo bien cerrado reduce el ángulo de ataque del oponente en un 60-70%. La comunicación entre bloqueadores (llamadas de zona) es más importante que la altura individual.',
'biomecánica', 'FIVB Coaches Manual'),

-- SISTEMA DE JUEGO 5-1
('El sistema 5-1 tiene 1 armador que siempre arma (5 rematadores). Ventajas: consistencia del armador, mejor comunicación atacante-armador, el armador siempre conoce su posición. El armador debe estar siempre en posición 2 (derecha de la red) para armar con mayor comodidad. La distribución de ataques ideal es 45% al 4 (punta izquierda), 30% al opuesto/zona 2, 15% al central, 10% atrás. En presión (20+) el porcentaje al zona 4 baja y sube el de zona 2 porque el opuesto recibe menos y está más fresco. Las combinaciones más efectivas son: Bic (central más punta desde atrás), Pipe (ataque por zona 6 atrás), Kitten (combinación central-punta a alta velocidad). La velocidad del armado en élite es 0.8-1.2 metros/segundo.',
'táctica', 'FIVB Coaching Science'),

-- NUTRICIÓN PARA VÓLEY
('La nutrición del jugador de vóley elite sigue un protocolo específico. Pre-partido (3-4h antes): comida alta en carbohidratos (pasta, arroz, batata), proteína moderada, poca grasa y fibra para facilitar digestión. Ejemplos: arroz con pollo grillado sin piel, pasta con salsa de tomate. 60-90 minutos antes: snack de fácil digestión — banana, dátiles, gel energético o galletitas de arroz. Durante el partido: 30-60g de carbohidratos por hora en partidos de +60 minutos, bebida isotónica (sodio 400-700mg/L, potasio 150-300mg/L). Post-partido (ventana de 30 min): 20-30g de proteína + carbohidratos de índice glucémico alto para reponer glucógeno. La deshidratación del 2% del peso corporal reduce el rendimiento en un 20%. Un jugador de 70kg pierde 1-2L de sudor por hora en clima cálido — Paraguay promedios de 30°C+ en competencia.',
'nutrición', 'International Society of Sports Nutrition'),

-- HIDRATACIÓN EN CLIMA CÁLIDO (Paraguay)
('Paraguay tiene clima subtropical con temperaturas de 28-38°C en época de competencias (septiembre-noviembre para JEEN). Esto aumenta las pérdidas de sudor a 1.5-2.5L/hora en competición. Protocolo de hidratación: 500ml de agua 2h antes, 300ml durante el calentamiento, 150-200ml cada 15-20min durante el partido, reponer 150% de lo perdido en las 2h post-partido. Los electrolitos son críticos: la pérdida de sodio causa calambres musculares, la pérdida de potasio causa fatiga prematura. Las bebidas isotónicas son superiores al agua pura en esfuerzos de +60 minutos. Señales de deshidratación: orina oscura, dolor de cabeza, fatiga inusual, calambres. En entrenamientos al aire libre en verano paraguayo, hidratarse cada 10 minutos es necesario aunque no se sienta sed.',
'nutrición', 'Ministerio de Salud PY + Sports Science'),

-- PSICOLOGÍA DEPORTIVA Y CLUTCH
('El rendimiento en momentos clave (20+ en vóley, tie-break) depende del manejo del estrés agudo. La técnica de respiración 4-7-8 (inspirar 4s, aguantar 7s, exhalar 8s) activa el sistema nervioso parasimpático en 60-90 segundos, reduciendo la frecuencia cardíaca y el cortisol. La visualización pre-competitiva de 5-10 minutos aumenta el rendimiento en habilidades técnicas entre 20-45% según estudios de neurociencia deportiva. El self-talk positivo específico ("piernas firmes, timing exacto") es más efectivo que el genérico ("soy bueno"). La rutina pre-partido siempre igual (misma música, mismos pasos, mismo ritual) programa al cerebro para el "modo competición". El reencuadre cognitivo convierte los nervios en energía: "estoy emocionado" activa los mismos neurotransmisores que "estoy nervioso" pero con orientación positiva.',
'psicología', 'Journal of Applied Sport Psychology'),

-- PREVENCIÓN DE LESIONES EN VÓLEY
('Las lesiones más comunes en vóley son: esguince de tobillo (45% de todas las lesiones), tendinopatía rotuliana (20%), dolor lumbar (15%), lesiones de hombro (10%). Prevención de tobillo: ejercicios de propiocepción 3x/semana (equilibrio en un pie, tabla de balance, saltos laterales cortos), vendaje funcional o tobillera en jugadores con historial. El programa de prevención de rodilla de Bahr (2006) redujo en 50% la incidencia de tendinopatía rotuliana en jugadores de vóley. Incluye sentadillas excéntricas con decline, estiramiento dinámico pre-entrenamiento, foam roller post-entrenamiento. La tendinopatía rotuliana tiene señal de alerta: dolor escala VAS >3/10 al día siguiente del entrenamiento. Ante ese umbral, reducir volumen de saltos en 30-50%. El hombro del rematador requiere 3 series de rotaciones internas/externas con elástico liviano antes de cada sesión de remate.',
'lesiones', 'British Journal of Sports Medicine'),

-- POSICIÓN PUNTA ATACANTE
('El punta atacante (zona 4) es el principal rematador del equipo. Características físicas ideales: altura 185-200cm hombres, 175-190cm mujeres, alcance de ataque >310cm hombres, salto vertical >60cm. Sus responsabilidades: recepción del saque en formación W o U, ataque desde zona 4 (cruzado y línea), bloqueo de zona 4, cobertura del remate propio. El ataque diagonal (zona 1 del rival) es el más común (60% de los ataques) porque tiene mayor ángulo de cancha. La línea (zona 5) se usa cuando el bloqueo cierra la diagonal. Los puntas de élite tienen porcentaje de éxito en remate del 50-65% en competición internacional. El error más común del punta joven es no leer el bloqueo antes de la batida — debe decidir diagonal/línea/corto MIENTRAS corre, no en el salto.',
'posiciones', 'FIVB Coaching Manual'),

-- POSICIÓN LIBERO
('El líbero es el especialista defensivo, identificable por su camiseta diferente. No puede atacar por encima de la red ni bloquear. Sus habilidades primarias son: recepción (debe ser el mejor del equipo), defensa en piso (roll, dive, extensiones), lectura del ataque rival. El líbero ideal tiene reflejos rápidos (tiempo de reacción <200ms), baja altura (no importa) pero extrema agilidad lateral, y visión periférica excelente. Su posición en defensa es zona 6 (centro) en sistema básico o 5/1 en sistemas avanzados. La comunicación del líbero ("mío", "tuyo", "afuera") es crítica para evitar colisiones. Los mejores líberos del mundo (Jenia Grebennikov, Erik Shoji) tienen eficiencia de recepción del 70-75% perfecta.',
'posiciones', 'FIVB Technical Commission'),

-- POSICIÓN CENTRAL
('El central (zona 3) es el bloqueador principal y el atacante rápido. Debe ser el jugador más alto del equipo (190-205cm+ en hombres). Sus ataques son siempre rápidos: el "1" (ataque al primer tiempo del armador), el "slide" (ataque en diagonal desde atrás), el "bic" (combinación con el punta). La velocidad del central en el "quick set" (ataque de primer tiempo) es tan alta que el bloqueador tiene 0.4-0.6 segundos para reaccionar — por eso es tan difícil de bloquear. El central también cubre todo el ancho de la red en bloqueo, usando el paso chassé. En defensa cuando el equipo rival saca, el central se ubica en zona 3 para cubrir el ataque central rival. El error más común: central que salta antes de ver el armado — debe leer el pase primero.',
'posiciones', 'FIVB Coaches Manual'),

-- JEEN PARAGUAY
('Los Juegos Estudiantiles de la Enseñanza Nacional (JEEN) de Paraguay son la competencia deportiva escolar más importante del país, organizada por el Ministerio de Educación. En vóley, compiten categorías U17 y U19 por departamento. El Alto Paraná es uno de los departamentos más competitivos del país junto a Central y Asunción. Las fases son: departamental (clasificación), regional y nacional. Los equipos clasifican según resultados departamentales. El nivel técnico varía mucho entre escuelas — los colegios nacionales del centro de CDE suelen tener ventaja por infraestructura. Las estrategias que funcionan en JEEN: saque flotante largo (la recepción estudiantil es débil), combinaciones rápidas central-punta (pocos equipos saben bloquearlas), y servicios a jugadoras débiles identificadas en el calentamiento.',
'contexto-local', 'Ministerio de Educación Paraguay'),

-- PERIODIZACIÓN DEL ENTRENAMIENTO
('La periodización del entrenamiento de vóley sigue ciclos. Macrociclo anual: pre-temporada (8-12 semanas, base física), preparación específica (6-8 semanas, técnica y táctica), período competitivo (variable, mantener forma), transición (2-4 semanas, recuperación activa). Microciclo semanal típico de período competitivo: Lunes-fuerza; Martes-técnica específica; Miércoles-táctica de equipo; Jueves-velocidad y potencia; Viernes-partido de entrenamiento o simulación; Sábado-recuperación activa; Domingo-descanso completo. La carga debe periodizarse: semanas de carga alta (RPE 7-8/10) alternadas con semanas de descarga (RPE 4-5/10). Semana de torneo: reducir volumen 40-50%, mantener intensidad, priorizar técnica y táctica sobre física.',
'entrenamiento', 'Tudor Bompa - Periodization Theory'),

-- SAQUE FLOTANTE
('El saque flotante o float serve es el más efectivo a nivel estudiantil y amateur. La pelota se golpea sin spin, lo que hace que el aire la mueva impredeciblemente (efecto Magnus reducido). Técnica: posición con pie contrario al brazo hábil adelante, lanzamiento sin rotación a 15-20cm frente al hombro, golpe con base de palma o muñon de muñeca en el centro exacto de la pelota, movimiento corto y sin acompañamiento. La muñeca queda bloqueada — no debe cerrar. Las zonas objetivo más difíciles: esquina zona 1 (entre el libero y el jugador derecho), zona 6 profunda (obliga a recepcionar muy lejos del armador), y zona 5 con flotante cortado (difícil de anticipar). El porcentaje de ace en nivel amateur con flotante bien ejecutado es del 8-12%.',
'técnica', 'FIVB Technical Coaching'),

-- ENTRENAMIENTO DE FUERZA PARA VÓLEY
('El entrenamiento de fuerza para vóley debe ser específico para los patrones de movimiento del deporte. Ejercicios fundamentales: sentadilla profunda con barra (para fuerza de piernas en batida), peso muerto (cadena posterior para estabilidad en landing), press de hombros (para fuerza de remate), remo con mancuernas (equilibrio escapular), hip thrust (glúteos para la fase de despegue). La periodización de fuerza para vóley va de fuerza máxima (3-5 reps) en pre-temporada a potencia (3-6 reps explosivas) en temporada competitiva. Los pliométricos complementan la fuerza: depth jumps (4x6, máximo 2x/semana), hurdle hops (3x8), broad jumps (3x6). El ratio fuerza-peso es más importante que la fuerza absoluta: un jugador de 70kg que hace sentadilla de 120kg tiene mejor relación que uno de 90kg que hace 130kg.',
'entrenamiento', 'National Strength and Conditioning Association');
