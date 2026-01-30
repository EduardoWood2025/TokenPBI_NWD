import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors()); // opcional, según dónde lo consumas

const {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  PORT = 8080
} = process.env;

const AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/token';
const SCOPES  = 'data:read bucket:read viewables:read';

// cache ingenuo en memoria (opcional)
let cached = { token: null, exp: 0 };

async function getTwoLeggedToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && now < cached.exp - 60) {
    return { access_token: cached.token, expires_in: cached.exp - now };
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APS_CLIENT_ID,
      client_secret: APS_CLIENT_SECRET,
      scope: SCOPES
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  cached.token = json.access_token;
  cached.exp   = now + json.expires_in;
  return { access_token: json.access_token, expires_in: json.expires_in };
}

app.get('/api/token', async (_req, res) => {
  try {
    if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Faltan APS_CLIENT_ID/APS_CLIENT_SECRET' });
    }
    const tok = await getTwoLeggedToken();
    res.set('Cache-Control', 'no-store');
    res.json(tok);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () =>
  console.log(`APS Token Service escuchando en http://localhost:${PORT}`)
);