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
