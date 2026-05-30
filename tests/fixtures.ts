import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import http from 'http';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  serverUrl: string;
}>({
  serverUrl: async ({}, use) => {
    // Spin up a simple HTTP static server to bypass Chromium's extension file:// access policies
    const server = http.createServer((req, res) => {
      const reqPath = req.url?.split('?')[0] || '';
      const rootDir = path.resolve(__dirname, '..');
      let filePath: string;
      try {
        filePath = path.resolve(rootDir, `.${decodeURIComponent(reqPath)}`);
      } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      if (
        filePath.startsWith(`${rootDir}${path.sep}`) &&
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile()
      ) {
        const ext = path.extname(filePath);
        const contentType = ext === '.html' ? 'text/html' : 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('File Not Found');
      }
    });

    // Listen on a dynamic port to avoid collision
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 0);
      });
    });

    await use(`http://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  },
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../dist');
    if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
      throw new Error(`Extension build not found at ${pathToExtension}. Run 'npm run build' first.`);
    }

    // Create a temporary unique profile directory for the Chromium run
    const userDataDir = path.join(__dirname, `../.chrome-profile-test-${Math.random().toString(36).substring(7)}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Headed mode is required for extensions to load properly in Chromium
      permissions: ['clipboard-read', 'clipboard-write'],
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);

    await context.close();

    // Clean up the temporary browser profile directory
    try {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    } catch {
      // Suppress directory cleanup errors
    }
  },
  extensionId: async ({ context }, use) => {
    // Retrieve the background service worker to extract the extension ID
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
