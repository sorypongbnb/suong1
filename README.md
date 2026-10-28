# SUO Dashboard + Admin

Pages
- /        public dashboard (view only)
- /admin   login + data entry
- /api/health   setup check (shows "set" / "MISSING")

## Setup
1. Make a NEW empty GitHub repo, e.g. suo-dashboard.
2. Unzip. Open the unzipped folder and select EVERYTHING INSIDE it
   (api, lib, index.html, admin.html, data.json, vercel.json, package.json, README.md).
   Drag those into GitHub > "uploading an existing file" > Commit changes.
   The repo main page must show the api and lib folders at the top.
3. Vercel > Add New > Project > Import the repo.
   Framework Preset: Other. Leave Root/Build/Output empty. Deploy.
4. Vercel > Project > Settings > Environment Variables (Production):
     ADMIN_USER      your login name
     ADMIN_PASSWORD  your password
     GITHUB_TOKEN    GitHub fine-grained token, this repo only, Contents: Read and write
     GITHUB_REPO     your-github-name/suo-dashboard
5. Deployments > ... > Redeploy.
6. Open /api/health. Everything should say "set" and data_json "OK, 88 days".
7. Open /admin and log in.
