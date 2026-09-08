# 365 — app nativa para pareja

App real en React Native/Expo: consignas diarias, toques con vibración,
bóveda de respuestas y calendario con métricas, sincronizado en vivo
entre un celular Android y uno iOS.

## Nota sobre este setup

Esto se preparó desde una sesión en la nube de Claude Code: instalé las
dependencias (`npm install`, agregando `expo-asset`, que faltaba en el
`package.json` original) y verifiqué que el bundler de Metro arranca sin
errores (`npx expo start --offline`). El contenedor de esta sesión corre
detrás de un proxy con lista blanca de dominios muy chica (no permite
llegar al servicio de túnel de Expo ni exponer puertos a internet), así
que **no puede quedar corriendo un servidor al que tu celular se conecte
desde acá**. Para usarla de verdad con `npx expo start`, corran los
comandos del Paso 2 en su propia computadora.

## Qué es real acá y qué no

- **Corre nativo en ambos celulares** vía Expo Go, gratis, sin cuenta de
  desarrollador. Esto sí es una app real, no una página web.
- **La sincronización de datos es en tiempo real** (Firestore): cuando
  una responde, la otra lo ve en vivo si tiene la app abierta.
- **El aviso cuando la app está cerrada es una notificación push real**
  (servicio de Expo, sin servidor propio).
- **Límite real de Apple**: el patrón de vibración personalizado
  (toque/caricia/latido) se siente exacto cuando la app está *abierta*
  en cualquiera de los dos celulares. Con la app *cerrada*, Android
  puede mantener un patrón custom por notificación; iOS usa la
  vibración estándar del sistema — no hay forma de evitar esto sin
  desarrollo nativo mucho más profundo (extensión de notificaciones),
  fuera del alcance de un proyecto Expo administrado.
- **Yo no pude compilar ni correr este proyecto** — no tengo acceso a
  un simulador de iOS/Android ni a un celular físico desde este chat.
  Revisé la sintaxis de cada archivo, pero probarlo end-to-end les
  toca a ustedes con los pasos de abajo. Si algo tira error, pegámelo
  tal cual aparece en la terminal y lo resolvemos.

## Paso 1 — Crear el proyecto de Firebase (gratis, ~10 min)

1. Andá a https://console.firebase.google.com y creá un proyecto nuevo
   (nombre libre, ej. "365-pareja").
2. Dentro del proyecto: **Build → Firestore Database → Crear base de
   datos**. Elegí modo *producción* y cualquier región.
3. En **Reglas** de Firestore, pegá esto para que solo ustedes puedan
   leer/escribir su propio código de pareja (regla simple, sin login,
   suficiente para uso personal):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /couples/{coupleId} {
         allow read, write: if true;
       }
     }
   }
   ```
   (Esto es abierto a cualquiera que sepa el código exacto de ustedes,
   como una contraseña. Para más seguridad más adelante se puede
   agregar autenticación, pero para arrancar es suficiente.)
4. En el ícono de engranaje → **Configuración del proyecto** → bajá
   hasta "Tus apps" → ícono `</>` (Web) → registrá una app (nombre
   libre). Firebase te va a mostrar un objeto `firebaseConfig`.
5. Copiá esos valores dentro de `firebase.js`, reemplazando los
   `"TU_API_KEY"`, `"TU_PROYECTO"`, etc.

## Paso 2 — Instalar y correr

Necesitan tener [Node.js](https://nodejs.org) instalado (cualquier
versión reciente). Desde la carpeta del proyecto:

```bash
npm install
npx expo start
```

Esto abre una terminal con un código QR.

- **Antes de escanear**, cada una instala la app **Expo Go** desde su
  tienda (App Store en iOS, Play Store en Android).
- **Android**: abrir Expo Go → Escanear QR.
- **iPhone**: abrir la app **Cámara** (no Expo Go) → apuntar al QR →
  toca la notificación que aparece arriba.
- Las dos deben estar en la misma red wifi que la computadora que
  corre `expo start` (o usar el modo túnel: `npx expo start --tunnel`
  si están en redes distintas).

## Paso 3 — Notificaciones push (opcional para probar, recomendado)

`registerForPushToken()` en `notifications.js` ya pide permiso y
guarda el token de cada celular en Firestore automáticamente al
entrar. Para que funcione con más confiabilidad (Expo Go tiene
soporte limitado de push en Android desde hace un par de versiones),
lo ideal a mediano plazo es armar una **build de desarrollo** propia:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
eas build --profile development --platform ios
```

Esto genera una app instalable (no Expo Go) con soporte completo de
push en ambas plataformas. Requiere una cuenta gratuita de Expo
(eas.dev) y, para iOS, una cuenta de desarrollador de Apple si quieren
instalarla sin cable — con cable (Xcode) no hace falta.

## Paso 4 — Usar la app

1. Cada una abre la app y en la primera pantalla escribe el mismo
   **código de espacio** (ej. `girasoles-2024`) — es como una
   contraseña compartida, no hace falta que sea complicado.
2. La primera persona que entra queda como rol A, pone su nombre y
   crea el espacio. La segunda entra con el mismo código, ve que ya
   hay alguien, y se identifica como "la otra persona".
3. Listo — ya están sincronizadas. La pestaña **Hoy** tiene la
   consigna del día y un botón para mandar un toque con mensaje sin
   salir de la pantalla. **Toques** tiene el modo completo (mantener
   presionado, historial). **Bóveda** archiva los días donde
   respondieron las dos. **Calendario** tiene el toggle entre progreso
   de consignas e intensidad de toques por día.

## Estructura de archivos

```
365-app/
├── App.js            # toda la UI y navegación por pestañas
├── firebase.js        ← PEGAR ACÁ su config de Firebase
├── notifications.js   # push + canales de vibración de Android
├── prompts.js          # motor de las 365 consignas
├── app.json           # configuración de Expo
└── package.json
```
