import { app, BrowserWindow, ipcMain, protocol, safeStorage, session } from 'electron';
import { URL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { installedVersion, runPatcher } from './patcher.mjs';
import { showPatchProgress } from './patch-window.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.RO_CLIENT_PROFILE) {
	fs.mkdirSync(process.env.RO_CLIENT_PROFILE, { recursive: true });
	app.setPath('userData', process.env.RO_CLIENT_PROFILE);
}

app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-raf-throttling');
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-frame-rate-limit');

const projectRoot = path.resolve(__dirname, '..', '..');

// MIME types required for ES module loading — Chromium enforces strict
// MIME checking for <script type="module"> and dynamic import().
const MIME_TYPES = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif',
	'.bmp': 'image/bmp',
	'.svg': 'image/svg+xml',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.wasm': 'application/wasm',
	'.tga': 'image/targa',
	'.lub': 'application/octet-stream',
	'.lua': 'application/octet-stream',
	'.spr': 'application/octet-stream',
	'.act': 'application/octet-stream',
	'.grf': 'application/octet-stream'
};

// Register custom protocol so ES modules work without CORS issues.
// file:// blocks <script type="module"> imports; app:// serves them
// with a proper origin and correct MIME types.
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true
		}
	}
]);

function createWindow(version = installedVersion(projectRoot)) {
	const win = new BrowserWindow({
		width: 1024,
		height: 768,
		fullscreen: true,
		frame: false,
		icon: path.join(__dirname, 'icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
			contextIsolation: true,
			nodeIntegration: false,
			nodeIntegrationInWorker: true,
			sandbox: false
		}
	});

	if (process.argv.includes('--dev')) {
		process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
		win.loadURL('http://localhost:3000/applications/electron/index.html');
		win.webContents.openDevTools();
	} else {
		win.loadURL('app://localhost/applications/electron/index.html');
	}

	win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	win.webContents.on('will-navigate', (event, url) => {
		if (!url.startsWith('app://localhost/')) event.preventDefault();
	});

	if (version) {
		win.webContents.once('dom-ready', () => {
			void win.webContents.executeJavaScript(`(() => {
				const label = document.createElement('div');
				label.textContent = ${JSON.stringify('Patch v' + version)};
				label.style.cssText = 'position:fixed;bottom:8px;right:10px;z-index:100000;padding:3px 7px;background:#12121e;color:#f3dba1;border-radius:3px;font:12px system-ui;pointer-events:none';
				document.body.append(label);
			})()`).catch(() => {});
		});
	}

	win.on('close', () => {
		app.exit(0);
	});
}

app.whenReady().then(() => {
	const savedLogin = path.join(app.getPath('userData'), 'game-login.bin');
	ipcMain.handle('community-game-login', (event, action, username, password) => {
		if (event.senderFrame?.url !== 'app://localhost/applications/electron/index.html' ||
			event.senderFrame.parent || process.platform !== 'win32' || !safeStorage.isEncryptionAvailable()) {
			return null;
		}
		if (action === 'forget') {
			fs.rmSync(savedLogin, { force: true });
			return true;
		}
		if (typeof username !== 'string' || username.length < 1 || username.length > 24) return null;
		if (action === 'read') {
			try {
				const saved = JSON.parse(safeStorage.decryptString(fs.readFileSync(savedLogin)));
				return saved.username === username && typeof saved.password === 'string' ? saved.password : null;
			} catch {
				return null;
			}
		}
		if (action === 'save' && typeof password === 'string' && password.length > 0 && password.length <= 24) {
			const encrypted = safeStorage.encryptString(JSON.stringify({ username, password }));
			const temporary = savedLogin + '.tmp';
			fs.writeFileSync(temporary, encrypted);
			fs.renameSync(temporary, savedLogin);
			return true;
		}
		return null;
	});

	session.defaultSession.webRequest.onBeforeRequest(
		{ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
		(_details, callback) => callback({ cancel: true })
	);
	// Also emulates Vite's ?raw suffix: when a module imports e.g.
	// './Intro.html?raw', we return a JS module that exports the file
	// content as a string (instead of serving raw HTML/CSS which Chromium
	// rejects as non-JS MIME for module scripts).
	// Handle app:// requests by reading local files with correct MIME types.
	protocol.handle('app', request => {
		const url = new URL(request.url);
		const isRaw = url.searchParams.has('raw');
		const isUrl = url.searchParams.has('url');
		const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
		const filePath = path.normalize(path.join(projectRoot, relativePath));

		// Prevent path traversal outside project root
		if (!filePath.startsWith(projectRoot + path.sep) && filePath !== projectRoot) {
			console.error(`[app://] Forbidden (path traversal): ${request.url} → ${filePath}`);
			return new Response('Forbidden', { status: 403 });
		}

		try {
			if (!fs.existsSync(filePath)) {
				console.error(`[app://] 404: ${request.url} → ${filePath}`);
				return new Response('Not Found', { status: 404 });
			}

			const data = fs.readFileSync(filePath);

			// ?url → emulate Vite's ?url suffix. For .wasm files, return a
			// data URI (base64) because emscripten's Na function detects
			// data: URIs to decode locally without fetch/streaming.
			// For other assets, return the app:// URL so consumers can
			// fetch the binary directly.
			if (isUrl) {
				const ext = path.extname(filePath).toLowerCase();
				if (ext === '.wasm') {
					const dataUri = 'data:application/octet-stream;base64,' + data.toString('base64');
					const js = `export default ${JSON.stringify(dataUri)};`;
					return new Response(js, {
						headers: { 'Content-Type': 'text/javascript' }
					});
				}
				const assetUrl = 'app://localhost/' + relativePath;
				const js = `export default ${JSON.stringify(assetUrl)};`;
				return new Response(js, {
					headers: { 'Content-Type': 'text/javascript' }
				});
			}

			// ?raw → wrap file content in a JS module (Vite compat)
			if (isRaw) {
				const text = data.toString('utf-8');
				const escaped = JSON.stringify(text);
				const js = `export default ${escaped};`;
				return new Response(js, {
					headers: { 'Content-Type': 'text/javascript' }
				});
			}

			const ext = path.extname(filePath).toLowerCase();
			const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
			let body = data;

			// Transform JS files to resolve bare specifiers (roBrowser aliases)
			if (mimeType === 'text/javascript' && !isRaw) {
				let content = data.toString('utf8');
				content = content.replace(
					/from\s+['"](Core|Loaders|Utils|Network|DB|Renderer|UI|App|Audio|Controls|Plugins|Preferences|Engine|Vendors)\/(.*?)['"]/g,
					"from '/src/$1/$2'"
				);
				body = Buffer.from(content);
			}

			return new Response(body, {
				headers: { 'Content-Type': mimeType }
			});
		} catch (e) {
			console.error(`[app://] Error: ${request.url} →`, e);
			return new Response(e.message, { status: 500 });
		}
	});

	if (fs.existsSync(path.join(__dirname, 'update-config.json'))) {
		void showPatchProgress(projectRoot, __dirname, createWindow, runPatcher);
	} else {
		createWindow();
	}
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
		// Fallback: force exit if quit takes too long
		setTimeout(() => process.exit(0), 1000);
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
