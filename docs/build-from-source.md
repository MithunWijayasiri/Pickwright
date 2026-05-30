# Build From Source

Most users should install Pickwright from the [Releases page](https://github.com/MithunWijayasiri/Pickwright/releases/latest) — see the [README](../README.md#installation). Build from source only if you want the latest unreleased changes or are developing the extension.

## Step 1 — Clone and build

```bash
git clone https://github.com/MithunWijayasiri/Pickwright.git
cd Pickwright
npm install
npm run build
```

This produces a `dist/` folder — that's the unpacked extension you load into your browser. The same `dist/` works in both Chrome and Firefox.

## Step 2 — Load into Chrome

1. Open Chrome and go to **`chrome://extensions`**
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the project (e.g. `C:\Github\Pickwright\dist`)
5. Pickwright appears in your extensions list — pin it via the puzzle-piece icon in the toolbar for easy access

> **Note:** You must reload the extension (`chrome://extensions` → refresh icon) and refresh the target page any time you rebuild.

## Step 2 (alt) — Load into Firefox

1. Open Firefox and go to **`about:debugging#/runtime/this-firefox`**
2. Click **Load Temporary Add-on…**
3. Select the **`dist/manifest.json`** file (not the folder) inside the project
4. Pickwright appears under **Temporary Extensions** and is pinned to the toolbar

> **Note:** Temporary add-ons are removed when Firefox restarts — reload them the same way after each restart. After rebuilding, click **Reload** on the add-on in `about:debugging` and refresh the target page. Requires Firefox 121 or later.
