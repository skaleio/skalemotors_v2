#!/usr/bin/env node
/**
 * Empaqueta archivos de Edge Functions Zernio para deploy vía Supabase Management API.
 * Uso: SUPABASE_ACCESS_TOKEN=xxx node scripts/deploy-zernio-edge.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fnRoot = path.join(root, "supabase", "functions");

const PROJECT_REF = "qszfkwshuhmedmzufalh";
const FUNCTIONS = [
  "zernio-connect-url",
  "zernio-accounts-sync",
  "zernio-accounts-list",
  "zernio-accounts-disconnect",
  "zernio-posts-create",
  "zernio-posts-list",
  "zernio-media-presign",
];

const SHARED = [
  "cors.ts",
  "zernioHttp.ts",
  "zernioAuth.ts",
  "zernioClient.ts",
  "zernioProfiles.ts",
  "zernioRbac.ts",
];

function read(rel) {
  return fs.readFileSync(path.join(fnRoot, rel), "utf8");
}

function bundleFor(slug) {
  const files = [
    {
      name: `functions/${slug}/index.ts`,
      content: read(`${slug}/index.ts`),
    },
  ];
  for (const s of SHARED) {
    files.push({
      name: `functions/_shared/${s}`,
      content: read(`_shared/${s}`),
    });
  }
  return files;
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN (supabase login o variable de entorno)");
  process.exit(1);
}

for (const slug of FUNCTIONS) {
  const body = {
    name: slug,
    entrypoint_path: `functions/${slug}/index.ts`,
    verify_jwt: true,
    files: bundleFor(slug),
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${slug}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error(`FAIL ${slug}:`, res.status, text);
    process.exit(1);
  }
  console.log(`OK ${slug}`);
}

console.log("Deploy Zernio functions complete.");
