# MAFIA · Carta + pago online · Guía de despliegue

Este proyecto reemplaza el contenido de tu repo `dedalogic/cartamafia`. Trae:

- **La carta nueva** (diseño v47) con fotos, logo y tipografía como archivos reales.
- **Pago online con Mercado Pago** (Checkout API + Orders API + Payment Brick), con validación de precios en el servidor.
- **Pedido por WhatsApp** tal como estaba (sigue siendo una opción para el cliente).
- **Panel de caja** en `/caja` para que la cajera vea los pedidos pagados y los comande en Fudo.
- **Disponibilidad** (`/admin`) y la carpeta `.well-known` (Apple Pay) intactas.

> Regla de oro de tu documento: **no se toca producción hasta validar en `mercadopago-test`.** Todo lo de abajo se prueba primero en el Deploy Preview.

---

## 1. Subirlo a GitHub (rama `mercadopago-test`)

1. Clona el repo y cámbiate a la rama de pruebas (o créala desde `main`):
   `git checkout mercadopago-test`
2. **Borra** lo viejo de la raíz y copia este proyecto encima. Ya no se usan: `index.html` antiguo, las fotos sueltas (`*.jpg`, `*.png`, `*.jpeg`), `logo.png`, `Pesto Mafio.ttf`, `panel-demo.html`, `fotos-nombres.txt`, `LEEME.txt`. Ahora las fotos están en `fotos/`, el logo en `assets/` y la tipografía en `fonts/`.
3. **Deja fuera `netlify/functions/mp-create-fintoc.mjs`** si existe en tu rama (Fintoc está pausado por el ticket WCS-54513; el archivo queda en el historial de git y se puede recuperar). Usaba funciones auxiliares antiguas y haría fallar el despliegue.
4. `git add -A && git commit -m "Carta v47 + pago online + caja" && git push`
5. Abre/actualiza el PR hacia `main` **sin hacer merge**. Netlify crea el Deploy Preview (`https://deploy-preview-N--mafiamenu.netlify.app`).

## 2. Variables de entorno en Netlify

*Site configuration → Environment variables.* Las secretas no van en el código ni en el chat.

| Variable | Producción | Deploy Preview | Para qué |
|---|---|---|---|
| `MAFIA_MP_TEST_ENABLED` | `false` | `true` | Enciende el pago online. Con `false` la carta funciona solo con WhatsApp, igual que hoy. |
| `MERCADOPAGO_ACCESS_TOKEN` | — | credencial **TEST** | Secreta. Solo la leen las funciones. |
| `MERCADOPAGO_PUBLIC_KEY` | — | clave pública **TEST** | Se entrega al navegador para el formulario de pago. |
| `MERCADOPAGO_WEBHOOK_SECRET` | — | secret del webhook TEST | Verifica que los avisos vienen de Mercado Pago. |
| `MAFIA_ADMIN_PASSWORD` | tu clave | tu clave | Entra a `/caja` y `/admin`. |
| `MAFIA_DELIVERY_FEE` | (opcional) | (opcional) | Costo de delivery en pesos, sin puntos. **Si no la pones, el delivery cuesta $3.500 fijo.** Si cambias el valor, cambia también `delivery: { fee:3500 }` en el `CONFIG` de `index.html` para que el texto de la carta coincida. |
| `MAFIA_MP_AMOUNT_FORMAT` | — | (no la pongas) | Solo si Mercado Pago rechaza el formato del monto; ver "Solución de problemas". |

Después de cambiar variables hay que **volver a desplegar** el Preview.

## 3. Webhook en Mercado Pago

*Mercado Pago Developers → tu aplicación **Mafia WEB** → Webhooks → modo TEST.*

- URL: `https://deploy-preview-N--mafiamenu.netlify.app/.netlify/functions/mp-webhook`
- Evento: **Order (Mercado Pago)**
- Copia el secret generado a `MERCADOPAGO_WEBHOOK_SECRET`.
- Revisa que esté vivo abriendo esa URL en el navegador: debe decir `"Webhook activo"`, `secret_configured: true`, `access_token_configured: true`.

## 4. Probar el pago (TEST)

1. Abre el Deploy Preview, agrega algo, elige **Retiro en local** → Continuar → **Pagar online**.
2. Tarjeta de prueba: Visa `4168 8188 4444 7115` · vence `11/30` · CVV `123` · titular `APRO` · documento `123456789` · correo `test@testuser.com`.
3. Verás "Procesando pago" → "Pago aprobado" → el comprobante con el número de pedido `#0001`, `#0002`… (solo cifras).
4. Entra a `/caja` con tu clave: el pedido aparece en **Nuevos** con PAGADO ✓.
5. Prueba también: un titular distinto de `APRO` (rechazo con mensaje claro y reintento sin duplicar pedido), delivery (suma `MAFIA_DELIVERY_FEE`), y cerrar y reabrir "Mis pedidos".

## 4b. Qué ve el cliente después de pagar

- Un comprobante con banda verde **PAGO CONFIRMADO**, el número grande y una línea de avance **Pagado → Preparando → Listo → Entregado** que se actualiza sola cada pocos segundos, según lo que marquen las cajeras en `/caja`.
- Al cerrar el comprobante ("Volver a la carta"), aparece abajo el botón **Mi pedido #0001 · Preparando** mientras el pedido esté en curso: lo vuelve a abrir cuando quiera. El botón desaparece al marcarse Entregado.
- El botón "atrás" del celular cierra el comprobante sin sacar al cliente de la carta.
- "Mis pedidos" (en el carrito) guarda los últimos pedidos pagados **en ese mismo dispositivo**. Si el cliente cambia de celular o borra los datos del navegador, no los ve.
- El número de pedido es correlativo (0001, 0002…) y no se reinicia solo. Los pedidos de prueba hechos antes de este cambio conservan su código antiguo.

## 4d. Datos que pide el pago (versión rápida)

- Paso "Tus datos": solo **nombre, teléfono** y dirección (si es delivery). Depto e indicaciones quedan en un desplegable opcional.
- El **correo** solo se pide si el cliente elige pagar con tarjeta, dentro de esa opción. Con la app de Mercado Pago no se pide.
- Pantalla de pago: dos botones iguales con logo, **Mercado Pago** y **Visa / Mastercard**. El formulario de tarjeta aparece solo si se toca el segundo (logos en `assets/pay-mp.webp` y `assets/pay-cards.webp`).

## 4c. Botón "Pagar con Mercado Pago" (cuenta o app)

- En la pantalla de pago aparece arriba un botón azul **Pagar con Mercado Pago**; debajo sigue el pago con tarjeta.
- Al tocarlo el cliente va a Mercado Pago (si tiene la app, el celular suele abrirla), paga con su cuenta o sus tarjetas guardadas y vuelve a la carta, que muestra el ticket.
- No necesita llaves nuevas: usa las mismas variables de Netlify.
- **En Mercado Pago Developers → Webhooks** deben estar marcados **Order (Mercado Pago)** y **Pagos (legacy)**, con la URL `https://TU-SITIO/.netlify/functions/mp-webhook`.
- Seguridad: el monto lo calcula el servidor; el pedido se marca pagado solo si el pago está `approved` + `accredited` y por el MISMO monto. Si el aviso tarda, la carta consulta directamente a Mercado Pago.
- Medios excluidos: boleta/ticket, cajero y transferencia. Sin cuotas. El link de pago vence en 60 minutos.
- Si Mercado Pago no devuelve al cliente a la carta, la URL base se puede fijar con la variable opcional `MAFIA_PUBLIC_URL` (ej. `https://mi-sitio.netlify.app`).
- Para probar: usa un **comprador de prueba** (Developers → Cuentas de prueba) con saldo. Tu cuenta real y su Face ID no sirven en modo prueba.
- Si dos pagos aprobados llegan para el mismo pedido, la caja lo deja registrado en `duplicate_payments` para revisarlo en Mercado Pago.

## 5. Cómo funciona el pago (resumen)

1. La carta manda al servidor **solo** las claves de los productos y cantidades (nunca precios).
2. El servidor recalcula todo con `menu-data.js`, revisa disponibilidad, suma el delivery, guarda la orden como pendiente y le asigna `#MAF-XXXX`.
3. Crea la Order en Mercado Pago con una `X-Idempotency-Key` **nueva en cada intento**.
4. La orden pasa a pagada solo si Mercado Pago confirma `processed` + `accredited` **y** el monto pagado es igual al de la orden. Lo decide el webhook o, si éste demora, la consulta del propio cliente (misma regla, consultando directo a Mercado Pago).
5. El pedido aparece en `/caja`. `fudo_sent` queda en `false`: se comanda a mano en Fudo (Fudo no habilitó la API de pedidos externos).

## 6. Panel de pedidos (`/caja`)

Lista simple a la izquierda y detalle del pedido a la derecha (en el celular, al tocar un pedido se abre el detalle). Pestañas: **Nuevos → Preparación → Listos → Entregados**.

- Mientras haya pedidos **sin aceptar** suena una alarma cada 5 segundos, el título de la pestaña parpadea y aparece un aviso "N pedidos por aceptar". Se apaga al apretar **Aceptar pedido** (se guarda la hora de aceptación).
- Flujo de la cajera: ve el pedido, lo ingresa en Fudo y aprueba con **Aceptar pedido**.
- El sonido se activa al entrar con la clave. Si se recarga la página, hay que tocar "activar el sonido" (el navegador lo exige). Mantiene la pantalla encendida mientras el sonido esté activo.
- El detalle muestra nombre, teléfono, correo, dirección, productos con opciones, observaciones y totales. Abajo: Llamar, WhatsApp al cliente, Imprimir, Volver al estado anterior y "Datos de pago" con el número de pedido y el ID de Mercado Pago (útil para devoluciones).
- Si Mercado Pago llegara a cobrar dos veces el mismo pedido, aparece una alerta roja.
- Se actualiza solo cada 7 segundos. El aviso de emergencia por WhatsApp (vía n8n) queda para una etapa posterior.

## 7. Cambiar precios, platos y textos

Todo el menú está en **`menu-data.js`** (precios sin punto: `price:7990`). La carta y el servidor leen ese mismo archivo, así que un precio nunca puede quedar distinto entre lo que se ve y lo que se cobra. Los datos del local (WhatsApp, rango de delivery informado, popup) están en el bloque `CONFIG` al inicio del `<script>` de `index.html`. El popup viene **apagado** (`popup.activo:false`).

Si cambias el `id` de un plato, revisa `/admin` (disponibilidad), que lee el catálogo automáticamente desde el menú.

## 8. Costo de delivery con Google

`netlify/functions/_mafia-delivery.mjs` es el punto de conexión: hoy usa la tarifa fija `MAFIA_DELIVERY_FEE`. Cuando exista el módulo de Google Places, reemplaza el cuerpo de `computeDeliveryFee({ address })` para que devuelva `{ ok:true, fee }`. El módulo de pago solo necesita subtotal, delivery y total; el ticket y el panel ya los muestran. En la carta, `mp-test-config` entrega hoy una tarifa única; cuando el cálculo sea por dirección habrá que pedirlo antes de mostrar el total (pendiente de ese módulo).

## 9. Pasar a producción (cuando todo esté validado)

1. Credenciales **de producción** de Mercado Pago en las variables de *Production* y un webhook de producción apuntando a `https://somosmafia.cl/.netlify/functions/mp-webhook`.
2. `MAFIA_MP_TEST_ENABLED=true` en Production (el nombre dice TEST pero es el interruptor general).
3. Haz una compra real pequeña y verifica que aparezca en `/caja` y en tu cuenta de Mercado Pago.
4. Recién ahí, merge del PR a `main`.
5. PostHog: revisa dominios permitidos para `somosmafia.cl`.

## 10. Lo que NO está activo (a propósito)

- **Apple Pay y Google Pay**: banderas en `false` (`WALLETS` en `index.html` y respuesta de `mp-test-config`). No se promete Google Pay hasta confirmar con Mercado Pago Chile.
- **Fintoc / transferencia online**: pausado por el ticket **WCS-54513**. No se incluyó código de Fintoc.
- **Fudo automático**: solo si Fudo habilita pedidos externos; el panel de caja seguirá sirviendo de respaldo.
- **Cuotas**: el formulario de pago permite 1 cuota para que el monto pagado sea exactamente el del pedido.

## 11. Solución de problemas

- **"X-Idempotency-Key already used"**: la carta genera un identificador nuevo en cada envío del formulario (`attempt_id`). Si lo ves, revisa que no haya un script que reenvíe la misma petición.
- **Mercado Pago rechaza el monto (error 400 con `total_amount`)**: pon `MAFIA_MP_AMOUNT_FORMAT = decimal` (envía `"7990.00"` en vez de `"7990"`) y vuelve a desplegar. Esto no pudo verificarse aquí sin tus credenciales.
- **Webhook 401**: el `MERCADOPAGO_WEBHOOK_SECRET` no coincide con el del panel de Mercado Pago o se cambió sin redesplegar.
- **Simulador de webhook con ID falso devuelve 502**: es lo esperado (la Order no existe).
- **No aparece la opción "Pagar online"**: `MAFIA_MP_TEST_ENABLED` no es `true`, falta token o clave pública, o no se redesplegó. Abre `/.netlify/functions/mp-test-config` para ver el estado.
- **El delivery no deja pagar online**: falta `MAFIA_DELIVERY_FEE`.
- **Pago "en revisión"**: el cliente ve un aviso para no pagar de nuevo y un enlace a WhatsApp con su número de pedido; se resuelve solo cuando llega el webhook.

## 12. Probar en tu computador (sin credenciales)

```
npm install
npm test        # 22 pruebas automáticas del servidor (precios, pago, webhook, caja)
npm run demo    # carta + caja con Mercado Pago simulado en http://localhost:8888
```
En la demo la caja usa la clave `caja123`. El formulario de tarjeta real de Mercado Pago necesita internet y credenciales TEST; la demo simula las respuestas del servidor, no el formulario.

## 13. Seguridad

- El Access Token y el secret del webhook **solo** existen en Netlify; el navegador recibe únicamente la clave pública.
- El total siempre lo calcula el servidor. El cliente solo puede ver su propio pedido con una clave secreta que se genera para él.
- `/caja` y `/admin` están protegidos por clave y marcados `noindex`. Usa una clave larga. No hay límite de intentos de clave: si quieres más protección, activa la protección por contraseña de Netlify sobre `/caja/*`.
