import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "qszfkwshuhmedmzufalh";
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

const manifests = [
  ".zernio-deploy-zernio-connect-url.json",
  ".zernio-deploy-zernio-accounts-sync.json",
  ".zernio-deploy-zernio-accounts-list.json",
  ".zernio-deploy-zernio-accounts-disconnect.json",
  ".zernio-deploy-zernio-posts-create.json",
  ".zernio-deploy-zernio-posts-list.json",
  ".zernio-deploy-zernio-media-presign.json",
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing");
  process.exit(1);
}

const results = [];

for (const file of manifests) {
  const p = path.join(scriptsDir, file);
  const payload = JSON.parse(fs.readFileSync(p, "utf8"));
  const { name, entrypoint_path, files } = payload;
  const verify_jwt = true;

  const form = new FormData();
  const metadata = { name, entrypoint_path, verify_jwt };
  const y = files.find((f) => ["deno.json", "import_map.json"].includes(f.name));
  if (y) metadata.import_map_path = y.name;

  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );

  for (const f of files) {
    form.append(
      "file",
      new Blob([f.content], { type: "application/typescript" }),
      f.name,
    );
  }

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      results.push({ name, ok: false, status: res.status, error: data });
      console.log(JSON.stringify({ name, ok: false, status: res.status }));
      continue;
    }
    const status = data.status ?? data.version?.status ?? "unknown";
    results.push({ name, ok: true, status: res.status, functionStatus: status, id: data.id, version: data.version });
    console.log(JSON.stringify({ name, ok: true, functionStatus: status, id: data.id }));
  } catch (e) {
    results.push({ name, ok: false, error: String(e) });
    console.log(JSON.stringify({ name, ok: false, error: String(e) }));
  }
}

fs.writeFileSync(
  path.join(scriptsDir, ".zernio-deploy-results.json"),
  JSON.stringify(results, null, 2),
);
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
