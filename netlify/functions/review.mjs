// Netlify serverless function: generates a weekly coaching review via the Claude Messages API.
// The Anthropic API key lives ONLY in the ANTHROPIC_API_KEY environment variable (Netlify site
// settings) — it is never sent to the browser. Callers must present a valid Firebase ID token
// for this project, so only the signed-in account can spend tokens.

import crypto from "node:crypto";

const PROJECT_ID = "freedom-planner-6fc3f";
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const SYSTEM = `You are a sharp, supportive performance coach reviewing one week of a trader's personal planner.
The data is provided as JSON: their progress toward a locked $7,000,000 "freedom number", weekly goals,
monthly/quarterly/annual goals, a daily habit/consistency tracker, daily tasks, and a "kill list" (one
thing they vowed NOT to do each day, with whether they held the line).

Write a concise, motivating but honest review. Tie observations back to the $7,000,000 freedom goal.
Be specific — reference the actual numbers, goals, habits, and slips in the data. Do not invent data
that isn't there. Respond with ONLY the review in markdown, no preamble or meta-commentary.

Use exactly these sections, each as a "## " heading:
## Wins
## What slipped
## Patterns
## 3 things to do better
## One focus for next week

Keep each section tight (a few bullets or 1–2 sentences). The final section is a single sentence.`;

// ---- Firebase ID token verification (RS256, Google securetoken certs) ----
let certCache = { certs: null, exp: 0 };

async function getCerts() {
  const now = Date.now();
  if (certCache.certs && now < certCache.exp) return certCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("could not fetch signing keys");
  const certs = await res.json();
  const m = (res.headers.get("cache-control") || "").match(/max-age=(\d+)/);
  certCache = { certs, exp: now + (m ? parseInt(m[1], 10) : 3600) * 1000 };
  return certs;
}

const b64urlBuf = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const b64urlJson = s => JSON.parse(b64urlBuf(s).toString("utf8"));

async function verifyFirebaseToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, sig] = parts;
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (header.alg !== "RS256") throw new Error("unexpected algorithm");
  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error("unknown signing key");
  const pub = new crypto.X509Certificate(pem).publicKey;
  if (!crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), pub, b64urlBuf(sig))) throw new Error("bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error("wrong audience");
  if (payload.iss !== "https://securetoken.google.com/" + PROJECT_ID) throw new Error("wrong issuer");
  if (!payload.sub) throw new Error("no subject");
  if (payload.exp <= now) throw new Error("token expired");
  if (payload.iat > now + 300) throw new Error("token issued in the future");
  return payload;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Server not configured (missing ANTHROPIC_API_KEY)." }, { status: 500 });

  // Require a valid Firebase ID token for this project — only the signed-in account may spend tokens.
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await verifyFirebaseToken(token);
  } catch (e) {
    return Response.json({ error: "Authentication failed: " + e.message }, { status: 401 });
  }

  // Optional extra deterrent: only enforced if REVIEW_SHARED_SECRET is set.
  const secret = process.env.REVIEW_SHARED_SECRET;
  if (secret && req.headers.get("x-review-key") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad JSON." }, { status: 400 }); }
  if (!body || !body.summary) return Response.json({ error: "Missing summary." }, { status: 400 });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [
          { role: "user", content: "Here is my week as JSON. Review it:\n\n" + JSON.stringify(body.summary, null, 2) },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return Response.json({ error: "Upstream error (" + r.status + ")", detail: detail.slice(0, 500) }, { status: 502 });
    }

    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return Response.json({ review: text, usage: data.usage });
  } catch (e) {
    return Response.json({ error: "Request failed: " + (e && e.message ? e.message : String(e)) }, { status: 502 });
  }
};
