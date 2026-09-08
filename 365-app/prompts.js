// 365.js — generador de consignas diarias
// Mismo motor que la versión web: 7 categorías rotativas, combinatoria A x B
// garantiza que ninguna de las 365 consignas se repita.

const CATS = [
  {
    key: "recuerdo",
    label: "Recuerdo",
    A: [
      "la primera vez que sintieron que esto era distinto a todo lo demás",
      "un día cualquiera que terminó siendo inolvidable",
      "algo gracioso que las hizo reír hasta que les doliera la panza",
      "una vez que se cuidaron sin que nadie lo pidiera",
      "un lugar que visitaron juntas y quedó grabado para siempre",
      "una charla de madrugada que no querían que termine",
      "el momento en que supieron que esto iba en serio",
      "un gesto pequeño de la otra que nunca olvidaron",
    ],
    B: [
      "Contalo con todo el detalle que puedas.",
      "Resumilo en una sola palabra y explicá por qué.",
      "Describilo como si fuera una escena de película.",
      "Grabá un audio corto contándolo, si querés.",
      "Escribilo en tres líneas, ni una más.",
      "Decí qué sentiste en ese momento exacto.",
      "Contá qué cambiarías de ese recuerdo y qué no tocarías nunca.",
    ],
    build: (a, b) => `Recuerden juntas ${a}. ${b}`,
  },
  {
    key: "aspiracion",
    label: "A lo que aspiramos",
    A: [
      "un lugar al que sueñan viajar juntas",
      "cómo se imaginan de acá a diez años",
      "una tradición que les gustaría inventar entre las dos",
      "algo que todavía no se animaron a decirse sobre el futuro",
      "un proyecto que les gustaría construir juntas",
      "un domingo ideal dentro de unos años",
      "algo de la vida de la otra que admiran y quieren para ustedes también",
      "la versión de esta relación que más las ilusiona",
    ],
    B: [
      "Descríbanlo con el mayor detalle posible.",
      "Elegí tres palabras que lo definan.",
      "Contá qué sentís cuando lo imaginás.",
      "Escribilo como si ya estuviera pasando.",
      "Decí qué necesitarían para llegar ahí.",
      "Compartilo sin filtrar nada, aunque suene ambicioso.",
      "Contá qué te asusta y qué te emociona de esa idea.",
    ],
    build: (a, b) => `Piensen en ${a}. ${b}`,
  },
  {
    key: "foto",
    label: "Una foto",
    A: [
      "algo que te haga acordar a tu pareja aunque ella no esté ahí",
      "el lugar exacto donde estás en este momento",
      "tus manos haciendo algo cotidiano",
      "algo de un color que te llame la atención cerca tuyo",
      "algo que guardás hace tiempo y tiene una historia",
      "el cielo de hoy, tal cual está",
      "un objeto que te recuerde a un momento juntas",
      "algo que te hizo sonreír hoy sin razón aparente",
    ],
    B: [
      "Elegila sin pensarlo dos veces.",
      "Elegila desde un ángulo poco habitual.",
      "Que sea algo bien de cerca.",
      "Contá en una línea por qué la elegirías.",
      "Imaginala en blanco y negro.",
      "Que sea algo sin editar, tal cual es.",
      "Elegila pensando en que tu pareja la va a ver recién cuando las dos respondan.",
    ],
    build: (a, b) => `Hoy la consigna es una foto: ${a}. ${b}`,
  },
  {
    key: "sonido",
    label: "Un sonido",
    A: [
      "un sonido que te calma",
      "la voz de tu pareja diciendo algo específico",
      "el sonido del lugar donde estás ahora",
      "una canción que te recuerda a este vínculo",
      "un silencio que valorás",
      "el sonido de algo que hacen juntas seguido",
      "un ruido cotidiano que te gusta más de lo que debería",
      "el sonido que te gustaría escuchar al llegar a casa",
    ],
    B: [
      "Describilo con palabras, sin usar la palabra lindo.",
      "Contá qué recuerdo te trae.",
      "Nombralo, si tiene nombre.",
      "Explicá por qué ese sonido y no otro.",
      "Decí en qué momento del día lo escuchás más.",
      "Describilo como si se lo contaras a alguien que nunca lo escuchó.",
      "Decí si podés grabarlo o si va a quedar solo en palabras.",
    ],
    build: (a, b) => `Hoy la consigna es un sonido: ${a}. ${b}`,
  },
  {
    key: "pregunta",
    label: "Pregunta random",
    A: [
      "¿Qué aprendiste de tu pareja sin que ella te lo enseñara a propósito?",
      "¿Qué costumbre tuya creés que heredaste de esta relación?",
      "¿Cuál es tu definición de un buen día, hoy?",
      "¿Qué palabra usarías para describir esta etapa de ustedes?",
      "¿Qué es algo que te gustaría que tu pareja supiera y nunca le dijiste?",
      "¿Cuándo fue la última vez que te sentiste plenamente vos misma con ella?",
      "¿Qué das por sentado y hoy querés agradecer?",
      "¿Qué necesitás hoy que quizás no pediste?",
    ],
    B: [
      "Respondé sin pensarlo más de diez segundos.",
      "Respondé con honestidad, aunque incomode un poco.",
      "Respondé como si nadie más fuera a leerlo.",
      "Respondé en una sola frase.",
      "Respondé y agregá un ejemplo concreto.",
      "Respondé pensando en esta semana, no en general.",
      "Respondé lo primero que sentiste, no lo primero que pensaste.",
    ],
    build: (a, b) => `${a} ${b}`,
  },
  {
    key: "poema",
    label: "Poema",
    A: [
      "algo del cuerpo de tu pareja",
      "un momento cotidiano que compartieron",
      "lo que sentís cuando ella no está",
      "una comparación entre ella y algo de la naturaleza",
      "cómo las mira el mundo cuando están juntas",
      "una despedida cualquiera de un día cualquiera",
      "el ruido que hace cuando duerme, ríe o se enoja",
      "algo que nunca le dijiste en voz alta",
    ],
    B: [
      "Escribí cuatro líneas, nada más.",
      "Que no rime, mejor si es un poco raro.",
      "Escribilo como si fuera una carta corta.",
      "Usá solo palabras simples, nada rebuscado.",
      "Escribilo en menos de un minuto, sin corregir.",
      "Escribilo como si lo fueras a leer en voz alta.",
      "Elegí una sola metáfora y quedate ahí.",
    ],
    build: (a, b) => `Escribí unas líneas sobre ${a}. ${b}`,
  },
  {
    key: "expresion",
    label: "Una expresión",
    A: [
      "una dedicatoria corta, como para el final de un libro sobre ustedes",
      "un agradecimiento por algo específico de esta semana",
      "una disculpa pendiente, grande o chiquita",
      "un piropo que nunca le dijiste",
      "una promesa pequeña y cumplible para esta semana",
      "algo que admirás de cómo atraviesa sus días",
      "una frase para que ella lea justo antes de dormir",
      "el motivo por el que la elegís, otra vez, hoy",
    ],
    B: [
      "Escribilo directo, sin vueltas.",
      "Escribilo como si fuera la última vez que se lo decís.",
      "Decilo en voz alta primero y después transcribilo.",
      "No lo edites, mandalo tal cual salió.",
      "Agregale un detalle bien específico, no genérico.",
      "Pensá en un momento puntual de esta semana.",
      "Cerralo con una sola palabra que lo resuma todo.",
    ],
    build: (a, b) => `Hoy toca escribir ${a}. ${b}`,
  },
];

function buildPrompts() {
  const order = CATS.map((c) => c.key);
  const byKey = Object.fromEntries(CATS.map((c) => [c.key, c]));
  const counters = Object.fromEntries(order.map((k) => [k, 0]));
  const prompts = [];
  let day = 1;
  while (day <= 365) {
    for (const key of order) {
      if (day > 365) break;
      const cat = byKey[key];
      const n = counters[key]++;
      const a = cat.A[n % cat.A.length];
      const b = cat.B[n % cat.B.length];
      prompts.push({
        day,
        category: key,
        label: cat.label,
        text: cat.build(a, b),
      });
      day++;
    }
  }
  return prompts;
}

export const PROMPTS = buildPrompts();

export function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.min(365, Math.floor(diff / 86400000));
}

export function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export const GESTURES = [
  { id: "toque", label: "Toque suave", pattern: [0, 40] },
  { id: "caricia", label: "Caricia lenta", pattern: [0, 300, 100, 300, 100, 300] },
  { id: "latido", label: "Latido", pattern: [0, 120, 90, 120, 260, 120, 90, 120] },
  { id: "abrazo", label: "Abrazo", pattern: [0, 220, 100, 220, 100, 420] },
];
