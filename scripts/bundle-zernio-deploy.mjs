import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fnRoot = path.join(__dirname, "..", "supabase", "functions");

const NEED = {
  "zernio-connect-url": ["cors.ts", "zernioHttp.ts", "zernioAuth.ts", "zernioClient.ts", "zernioProfiles.ts", "zernioRbac.ts"],
  "zernio-accounts-sync": ["cors.ts", "zernioAuth.ts", "zernioClient.ts", "zernioProfiles.ts", "zernioRbac.ts"],
  "zernio-accounts-list": ["cors.ts", "zernioAuth.ts", "zernioRbac.ts"],
  "zernio-accounts-disconnect": ["cors.ts", "zernioAuth.ts", "zernioRbac.ts"],
  "zernio-posts-create": ["cors.ts", "zernioAuth.ts", "zernioRbac.ts", "zernioClient.ts"],
  "zernio-posts-list": ["cors.ts", "zernioAuth.ts", "zernioRbac.ts"],
  "zernio-media-presign": ["cors.ts", "zernioAuth.ts", "zernioClient.ts"],
};

for (const slug of Object.keys(NEED)) {
  const files = [
    {
      name: `functions/${slug}/index.ts`,
      content: fs.readFileSync(path.join(fnRoot, slug, "index.ts"), "utf8"),
    },
  ];
  for (const s of NEED[slug]) {
    files.push({
      name: `functions/_shared/${s}`,
      content: fs.readFileSync(path.join(fnRoot, "_shared", s), "utf8"),
    });
  }
  const out = path.join(__dirname, `.zernio-deploy-${slug}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({
      name: slug,
      entrypoint_path: `functions/${slug}/index.ts`,
      verify_jwt: true,
      files,
    }),
  );
  console.log("bundled", slug, files.length);
}
