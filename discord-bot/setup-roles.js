/**
 * Script de setup — crea los roles Sub T1/T2/T3 en el servidor de Discord
 * y (si hay credenciales de Firebase) guarda los IDs en /config/discord.
 *
 * Uso:
 *   DISCORD_BOT_TOKEN=xxx node setup-roles.js
 *
 * Variables:
 *   DISCORD_BOT_TOKEN   (obligatoria) token del bot
 *   DISCORD_GUILD_ID    (opcional, default: servidor HG)
 *   FIREBASE_SERVICE_ACCOUNT + FIREBASE_DB_URL (opcionales, para guardar
 *   la config en Firebase automáticamente)
 */
const fetch = require('node-fetch');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1481427371574824973';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1513649897352466563';

if (!BOT_TOKEN) {
  console.error('Falta DISCORD_BOT_TOKEN. Uso: DISCORD_BOT_TOKEN=xxx node setup-roles.js');
  process.exit(1);
}

const ROLES = [
  { tier: '1', key: 'roleT1', name: 'Sub T1', color: 0xb8ff00 }, // verde ácido
  { tier: '2', key: 'roleT2', name: 'Sub T2', color: 0xff2d55 }, // glitch rojo
  { tier: '3', key: 'roleT3', name: 'Sub T3', color: 0xffd700 }, // dorado
];

async function discordRequest(path, options = {}) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Discord API ${r.status} en ${path}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  console.log(`Servidor: ${GUILD_ID}`);

  // Roles existentes — para no duplicar si ya están creados
  const existing = await discordRequest(`/guilds/${GUILD_ID}/roles`);
  const config = { clientId: CLIENT_ID, guildId: GUILD_ID };

  for (const def of ROLES) {
    const found = existing.find((r) => r.name === def.name);
    if (found) {
      console.log(`✓ "${def.name}" ya existe — ID: ${found.id}`);
      config[def.key] = found.id;
      continue;
    }
    const created = await discordRequest(`/guilds/${GUILD_ID}/roles`, {
      method: 'POST',
      body: JSON.stringify({
        name: def.name,
        color: def.color,
        hoist: true, // se muestran separados en la lista de miembros
        mentionable: false,
        permissions: '0',
      }),
    });
    console.log(`★ "${def.name}" creado — ID: ${created.id}`);
    config[def.key] = created.id;
  }

  console.log('\nConfiguración resultante:');
  console.log(JSON.stringify(config, null, 2));

  // Guardar en Firebase si hay credenciales
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_DB_URL) {
    const admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
    await admin.database().ref('/config/discord').set(config);
    console.log('\n✓ Config guardada en Firebase en /config/discord');
    process.exit(0);
  } else {
    console.log('\n(No se guardó en Firebase — cargá estos IDs en admin.html');
    console.log(' sección "DISCORD & SUSCRIPCIONES", o corré de nuevo con');
    console.log(' FIREBASE_SERVICE_ACCOUNT y FIREBASE_DB_URL definidas.)');
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
