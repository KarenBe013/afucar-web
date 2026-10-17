# Cambios a aplicar en el Apps Script (backend)

El backend de la web es un Google Apps Script que **no está en este repositorio**, así que
estos cambios hay que pegarlos a mano en el editor de Apps Script y volver a implementar
(Implementar → Administrar implementaciones → editar → *Nueva versión*).

## 1. Guardar la foto de la cédula al registrarse

Ahora el formulario de registro (`index.html`) manda, en la acción `registrarUsuario`:

| Campo         | Qué es                                                                 |
|---------------|------------------------------------------------------------------------|
| `foto_ci`     | `{ base64, nombreArchivo, mimeType }`: foto de la cédula (socios y todos los convenios) |
| `comprobante` | Igual que antes: carné de secretario/a, o carta de socio / recibo de sueldo del convenio. Para socios y legisladores trae la misma foto de la cédula. |

Agregá estas dos funciones auxiliares (usá el ID de la carpeta de Drive donde ya guardás los comprobantes):

```js
function guardarArchivoRegistro_(archivo, email, sufijo) {
  if (!archivo || !archivo.base64) return '';
  const blob = Utilities.newBlob(
    Utilities.base64Decode(archivo.base64),
    archivo.mimeType,
    email + '-' + sufijo + '-' + archivo.nombreArchivo
  );
  const carpeta = DriveApp.getFolderById(ID_CARPETA_COMPROBANTES); // ← tu carpeta
  return carpeta.createFile(blob).getUrl();
}

// Escribe un valor en la columna con ese encabezado; si la columna no existe, la crea.
function escribirColumnaPorEncabezado_(hoja, fila, encabezado, valor) {
  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  let col = encabezados.indexOf(encabezado) + 1;
  if (col === 0) {
    col = hoja.getLastColumn() + 1;
    hoja.getRange(1, col).setValue(encabezado);
  }
  hoja.getRange(fila, col).setValue(valor);
}
```

Y dentro de `registrarUsuario`, **después** de agregar la fila del usuario nuevo en la hoja de usuarios:

```js
const fila = hoja.getLastRow();
escribirColumnaPorEncabezado_(hoja, fila, 'link_foto_ci',
  guardarArchivoRegistro_(body.foto_ci, body.email, 'cedula'));
```

Revisá también que el `comprobante` se guarde siempre que venga (`if (body.comprobante)`), y no solo
cuando la institución tiene `requiere_comprobante = SI`: ahora se pide para todos los convenios salvo Legislador.

## 2. Devolver `link_foto_ci` al panel de administración

`obtenerSolicitudesPendientes` y la lista de socios tienen que incluir `link_foto_ci` en cada usuario.
Si arman el objeto leyendo los encabezados de la hoja, sale solo. Si listan los campos a mano,
agregá `link_foto_ci`.

El panel muestra la vista previa con `https://drive.google.com/thumbnail?id=...`. Funciona
si en el navegador estás logueada con la cuenta de Google dueña de la carpeta (no hace falta que los
archivos sean públicos, y no conviene que lo sean porque son cédulas).

## 3. Precio de 25 personas para convenios y terceros

El servidor calcula el precio de la reserva, así que hay que replicar la regla nueva del simulador:

- 25 personas se habilita para: **socios, legisladores, secretarios, Afucase, Afucoa y reservas para terceros**.
- Para todos ellos, menos socios (que siguen con su tarifa), el precio final es:

| Franja                          | Precio  |
|---------------------------------|---------|
| Lunes a jueves · 10 a 16 hs     | $ 3.850 |
| Viernes a domingo · 10 a 16 hs  | $ 5.100 |
| Lunes a jueves · 19 a 01 hs     | $ 4.900 |
| Viernes a domingo · 19 a 01 hs  | $ 5.500 |

```js
const CONVENIOS_CON_25 = ['legislador', 'secretario', 'afucase', 'afucoa'];
const TARIFA_25_CONVENIO = [3850, 5100, 4900, 5500]; // mismo orden de franjas que la web
```

## 4. Generar la constancia de socio desde el panel admin

El panel (`admin.html`, sección "Generar constancia de socio") manda un POST con:

| Campo            | Qué es                                              |
|------------------|-----------------------------------------------------|
| `accion`         | `'generarComprobantePorAdmin'`                      |
| `emailAdmin`     | El email de la admin logueada                       |
| `nombreCompleto` | Nombre y apellido, escrito a mano                   |
| `numeroSocio`    | Número de socio, escrito a mano                     |
| `fecha`          | `'AAAA-MM-DD'` (puede venir vacío → usar hoy)       |

y espera de vuelta `{ url: '<link al PDF>' }` o `{ error: '<mensaje>' }`, igual que
`generarComprobanteSocio`. **Si esta acción no existe en el Apps Script, el botón no puede funcionar.**

La forma más simple es reutilizar lo que ya hace `generarComprobanteSocio`:

1. Dentro de `generarComprobanteSocio`, separá la parte que arma el PDF (copiar la plantilla,
   reemplazar nombre / número / fecha, exportar a PDF y guardarlo en Drive) en una función propia
   que reciba los datos ya resueltos:

   ```js
   // Arma el PDF de la constancia y devuelve el link. Es el mismo código que ya está en
   // generarComprobanteSocio, solo que recibe los datos en vez de buscarlos por email.
   function crearPdfConstancia_(nombreCompleto, numeroSocio, fecha) {
     // ... (pegar acá el código actual que genera el PDF, usando estos tres valores)
     return archivoPdf.getUrl();
   }
   ```

   y que `generarComprobanteSocio` la llame con los datos que busca del usuario.

2. Agregá la acción nueva:

   ```js
   function generarComprobantePorAdmin(body) {
     if (!esAdmin_(body.emailAdmin)) {           // ← la misma verificación que usan las otras acciones de admin
       return { error: 'No autorizado.' };
     }
     const nombreCompleto = String(body.nombreCompleto || '').trim();
     const numeroSocio = String(body.numeroSocio || '').trim();
     if (!nombreCompleto || !numeroSocio) {
       return { error: 'Faltan el nombre o el número de socio.' };
     }
     // La fecha llega como 'AAAA-MM-DD'; se arma en hora local para que no cambie de día.
     let fecha = new Date();
     if (body.fecha) {
       const [a, m, d] = body.fecha.split('-').map(Number);
       fecha = new Date(a, m - 1, d);
     }
     return { url: crearPdfConstancia_(nombreCompleto, numeroSocio, fecha) };
   }
   ```

3. En `doPost`, sumala al lado de las demás acciones:

   ```js
   case 'generarComprobantePorAdmin':
     return responderJson_(generarComprobantePorAdmin(body)); // ← como respondan las otras acciones
   ```

4. **Implementar → Administrar implementaciones → editar → Nueva versión.** Sin este paso
   la URL `/exec` sigue usando el código viejo, aunque el cambio esté guardado.
