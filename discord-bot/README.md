# HG Discord Bot

Servicio chico que escucha los webhooks de **MercadoPago** y, cuando una
suscripción queda `authorized`, le asigna automáticamente el rol de Discord
correspondiente (**Sub T1 / Sub T2 / Sub T3**) al usuario que vinculó su
cuenta de Discord en `perfil.html`.

## Cómo funciona

1. El usuario vincula su cuenta de Discord desde **Mi Perfil** (botón
   "VINCULAR DISCORD"). Esto guarda `{id, username, discriminator, avatar}`
   en `/profiles/{uid}/discord` de Firebase.
2. MercadoPago manda un webhook a `/webhook/mercadopago` cuando cambia el
   estado de una suscripción (`preapproval`).
3. El bot consulta a la API de MercadoPago el detalle de la suscripción
   (`payer_email`, `preapproval_plan_id`, `status`).
4. Mapea el `preapproval_plan_id` a un tier (1, 2 o 3) usando las variables
   `MP_PLAN_TIER_2` / `MP_PLAN_TIER_3` (Tier 1 es gratis, no tiene plan de MP).
5. Busca en `/users` de Firebase el `uid` cuyo `email` coincide con
   `payer_email`.
6. Guarda `/profiles/{uid}/subscription = {tier, status, planId, updatedAt}`.
7. Si el usuario ya vinculó Discord (`/profiles/{uid}/discord/id`) y el
   estado es `authorized`, le asigna el rol del tier en el servidor de
   Discord (y le saca los roles de otros tiers si los tenía).

## 1. Crear la app/bot de Discord

1. Andá a https://discord.com/developers/applications → **New Application**.
2. En **OAuth2 → General**, copiá el **Client ID** — eso va en `admin.html`
   (sección Discord & Suscripciones) para que `perfil.html` arme el link de
   vinculación.
3. En **OAuth2 → Redirects**, agregá la URL de `perfil.html` de tu sitio,
   por ejemplo `https://www.hg-vl.com/perfil.html`.
4. En **Bot**, creá un bot, copiá el **Token** (va en `DISCORD_BOT_TOKEN`) y
   activá el intent que necesites (no hace falta ninguno privilegiado para
   asignar roles).
5. Generá un link de invitación con permisos **Manage Roles** y agregalo a tu
   servidor:
   ```
   https://discord.com/api/oauth2/authorize?client_id=TU_CLIENT_ID&permissions=268435456&scope=bot
   ```
   Importante: el rol del bot debe quedar **por encima** de los roles
   `Sub T1/T2/T3` en la jerarquía del servidor, si no, no va a poder
   asignarlos.

## 2. Conseguir los IDs de Discord

Activá el "Modo desarrollador" en Discord (Configuración → Avanzado), y con
clic derecho copiá:

- **Guild ID** (clic derecho sobre el nombre del servidor) → `DISCORD_GUILD_ID`
- **Role ID** de cada rol `Sub T1`, `Sub T2`, `Sub T3` (Configuración del
  servidor → Roles → clic derecho en cada rol) → `DISCORD_ROLE_T1/2/3`

Cargá el Client ID, Guild ID y los tres Role IDs también en el panel de
**admin.html** (sección "Discord & Suscripciones"), para que `perfil.html`
sepa a dónde redirigir a los usuarios.

## 3. Credenciales de Firebase

1. Firebase Console → ⚙️ Configuración del proyecto → **Cuentas de
   servicio** → **Generar nueva clave privada**.
2. Pegá el contenido completo del JSON descargado (en una sola línea) en la
   variable `FIREBASE_SERVICE_ACCOUNT`.
3. Asegurate de que las reglas de `/users` tengan `.indexOn: "email"` para
   que la búsqueda por email funcione.

## 4. Configurar el webhook de MercadoPago

1. En tu cuenta de MercadoPago → **Tus integraciones** → la app
   correspondiente → **Notificaciones webhooks**.
2. Agregá la URL pública de este servicio:
   `https://TU_DOMINIO/webhook/mercadopago`
   (opcionalmente con `?secret=...` si configurás `MP_WEBHOOK_SECRET`).
3. Suscribite a los eventos de **suscripciones** (`preapproval`).
4. Cargá tu `MP_ACCESS_TOKEN` (Credenciales de producción → Access Token).

## 5. Variables de entorno

Copiá `.env.example` a `.env` y completá todos los valores.

## 6. Correr localmente

```bash
npm install
npm start
```

## 7. Deploy (Render / Railway)

1. Subí esta carpeta como repo (o usá un monorepo con "root directory" =
   `discord-bot`).
2. Build command: `npm install` — Start command: `npm start`.
3. Cargá todas las variables de `.env.example` en el panel de variables de
   entorno del servicio.
4. Una vez deployado, copiá la URL pública y configurala como webhook en
   MercadoPago (paso 4).

## Notas

- Tier 1 es gratis y no tiene `preapproval_plan_id` — no dispara webhooks de
  MercadoPago, así que no se le asigna rol automáticamente por esta vía
  (se puede asignar manualmente, o agregar lógica adicional si en el futuro
  Tier 1 también requiere alta vía MercadoPago).
- Si un usuario cancela o pausa su suscripción, MercadoPago manda otro
  webhook con `status` distinto de `authorized`; el bot actualiza
  `/profiles/{uid}/subscription` pero **no quita** el rol automáticamente.
  Si querés que también lo retire, se puede extender `processPreapproval`
  para llamar a `assignTierRole` con un tier `null`/vacío cuando
  `status !== 'authorized'`.
