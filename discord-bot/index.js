/**
 * HG Discord Bot — webhook receiver for MercadoPago subscriptions.
 * On a confirmed/active preapproval, looks up the payer by email in Firebase,
 * reads their linked Discord ID from /profiles/{uid}/discord, and assigns
 * the corresponding "Sub T1/T2/T3" role in the Discord guild.
 */
const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_ROLE_T1,
  DISCORD_ROLE_T2,
  DISCORD_ROLE_T3,
  FIREBASE_DB_URL,
  FIREBASE_SERVICE_ACCOUNT,
  MP_PLAN_TIER_2,
  MP_PLAN_TIER_3,
  MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET,
  PORT,
} = process.env;

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT en el entorno.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: FIREBASE_DB_URL,
});
const db = admin.database();

const TIER_ROLES = {
  '1': DISCORD_ROLE_T1,
  '2': DISCORD_ROLE_T2,
  '3': DISCORD_ROLE_T3,
};

const ALL_TIER_ROLES = Object.values(TIER_ROLES).filter(Boolean);

function tierFromPlanId(planId) {
  if (planId === MP_PLAN_TIER_2) return '2';
  if (planId === MP_PLAN_TIER_3) return '3';
  return null;
}

async function fetchPreapproval(preapprovalId) {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MercadoPago API ${r.status}`);
  return r.json();
}

async function findUidByEmail(email) {
  const snap = await db.ref('/users').orderByChild('email').equalTo(email).get();
  const data = snap.val();
  const uid = data ? Object.keys(data)[0] : null;
  return uid || null;
}

async function discordRequest(path, options = {}) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!r.ok && r.status !== 204) {
    const body = await r.text();
    throw new Error(`Discord API ${r.status}: ${body}`);
  }
  return r.status === 204 ? null : r.json();
}

async function assignTierRole(discordUserId, tier) {
  const targetRole = TIER_ROLES[tier];
  if (!targetRole) return;

  // Quitar roles de otros tiers
  for (const roleId of ALL_TIER_ROLES) {
    if (roleId === targetRole) continue;
    try {
      await discordRequest(`/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      // el usuario puede no tener el rol — ignorar
    }
  }

  // Asignar el rol del tier actual
  await discordRequest(`/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}/roles/${targetRole}`, {
    method: 'PUT',
  });
}

async function processPreapproval(preapprovalId) {
  const preapproval = await fetchPreapproval(preapprovalId);
  const { status, payer_email: payerEmail, preapproval_plan_id: planId } = preapproval;

  const tier = tierFromPlanId(planId);
  if (!tier) {
    console.log(`Plan ${planId} no mapeado a un tier conocido.`);
    return;
  }

  const uid = await findUidByEmail(payerEmail);
  if (!uid) {
    console.log(`No se encontró usuario de Firebase con email ${payerEmail}.`);
    return;
  }

  const subRef = db.ref(`/profiles/${uid}/subscription`);
  await subRef.set({ tier, status, planId, updatedAt: Date.now() });

  if (status !== 'authorized') {
    console.log(`Suscripción ${preapprovalId} con estado "${status}" — no se asigna rol.`);
    return;
  }

  const discordSnap = await db.ref(`/profiles/${uid}/discord/id`).get();
  const discordId = discordSnap.val();
  if (!discordId) {
    console.log(`Usuario ${uid} no vinculó su Discord todavía.`);
    return;
  }

  await assignTierRole(discordId, tier);
  console.log(`Rol Tier ${tier} asignado a ${discordId} (uid ${uid}).`);
}

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.send('HG Discord Bot — OK'));

app.post('/webhook/mercadopago', async (req, res) => {
  if (MP_WEBHOOK_SECRET) {
    const secret = req.query.secret || req.headers['x-webhook-secret'];
    if (secret !== MP_WEBHOOK_SECRET) return res.sendStatus(401);
  }

  // Responder rápido — MercadoPago reintenta si no recibe 200/201
  res.sendStatus(200);

  try {
    const { type, action, data } = req.body || {};
    const isPreapproval = type === 'preapproval' || type === 'subscription_preapproval' || (action || '').includes('preapproval');
    if (!isPreapproval || !data || !data.id) return;
    await processPreapproval(data.id);
  } catch (e) {
    console.error('Error procesando webhook:', e);
  }
});

const port = PORT || 3000;
app.listen(port, () => console.log(`HG Discord Bot escuchando en el puerto ${port}`));
