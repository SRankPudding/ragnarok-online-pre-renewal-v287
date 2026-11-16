// applications/electron/patcher.mjs
//
// Start-up patcher: compares the game code (engine/src) with the list published
// on the update site and downloads what changed, before the game window opens.
//
// It only runs when update-config.json exists next to this file:
//   { "url": "https://example.com/ro-update/" }
// The site holds manifest.json and a files/ folder (built by the update tool).
// Safety: https only, every file is checked against its SHA-256 from the
// manifest, and nothing outside engine/src is ever written.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_TIMEOUT_MS = 8000;
const FILE_TIMEOUT_MS = 30000;
const PATCH_TIMEOUT_MS = 45000;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

function download(url, timeoutMs, signal, onBytes) {
	return new Promise((resolve, reject) => {
		const request = https.get(url, {
			signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
			headers: { 'Cache-Control': 'no-cache' }
		}, response => {
			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error('HTTP ' + response.statusCode + ' for ' + url));
				return;
			}
			const chunks = [];
			let size = 0;
			response.on('data', chunk => {
				size += chunk.length;
				if (size > MAX_FILE_BYTES) {
					request.destroy(new Error('File too large: ' + url));
					return;
				}
				chunks.push(chunk);
				onBytes?.(size);
			});
			response.on('end', () => resolve(Buffer.concat(chunks)));
			response.on('error', reject);
		});
		request.on('error', reject);
	});
}

async function fetchWithRetry(url, timeout, signal, check, onBytes) {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			signal.throwIfAborted();
			const data = await download(url, timeout, signal, onBytes);
			return check(data);
		} catch (error) {
			if (attempt === 2 || signal.aborted) throw error;
			await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
		}
	}
}

function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {string} projectRoot the engine folder
 * @returns {Promise<number>} how many files were updated
 */
export function installedVersion(projectRoot) {
	try {
		const version = fs.readFileSync(path.join(projectRoot, 'version.txt'), 'utf8').trim();
		return /^[0-9]+(?:\.[0-9]+){1,3}$/.test(version) ? version : null;
	} catch {
		return null;
	}
}

export async function runPatcher(projectRoot, report = () => {}) {
	const configPath = path.join(here, 'update-config.json');
	if (!fs.existsSync(configPath)) {
		return 0;
	}
	const previousVersion = installedVersion(projectRoot);
	report({ phase: 'checking' });
	let base;
	try {
		base = String(JSON.parse(fs.readFileSync(configPath, 'utf8')).url || '');
	} catch {
		base = '';
	}
	if (!base.startsWith('https://')) {
		console.error('[patcher] update-config.json needs an https:// url');
		report({ phase: 'failed', version: previousVersion });
		return 0;
	}
	if (!base.endsWith('/')) base += '/';

	const srcRoot = path.join(projectRoot, 'src');
	let updated = 0;
	let staging;
	const signal = AbortSignal.timeout(PATCH_TIMEOUT_MS);
	try {
		const manifest = await fetchWithRetry(base + 'manifest.json', MANIFEST_TIMEOUT_MS, signal,
			data => JSON.parse(data.toString('utf8')));
		if (!/^[0-9]+(?:\.[0-9]+){1,3}$/.test(manifest?.version) ||
			!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) ||
			Object.keys(manifest.files).length === 0) {
			throw new Error('Invalid patch manifest');
		}
		const pending = [];
		const files = manifest.files;

		for (const relative of Object.keys(files)) {
			signal.throwIfAborted();
			const { sha256: wanted, size } = files[relative] ?? {};
			// Only game code, and never a path that climbs out of it
			if (!/^engine\/src\/[^\\:*?"<>|]+$/.test(relative) || relative.includes('..') || !/^[0-9a-f]{64}$/.test(wanted) ||
				!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_BYTES) {
				throw new Error('Invalid patch file entry');
			}
			const target = path.normalize(path.join(projectRoot, relative.slice('engine/'.length)));
			if (!target.startsWith(srcRoot + path.sep)) {
				throw new Error('Patch file is outside src');
			}
			const existing = await fs.promises.readFile(target).catch(error => {
				if (error.code !== 'ENOENT') throw error;
				return null;
			});
			if (existing?.length === size && sha256(existing) === wanted) {
				continue;
			}
			pending.push({ relative, target, wanted, size });
		}
		const total = pending.reduce((sum, file) => sum + file.size, 0);
		let received = 0;
		let lastProgress = 0;
		const progress = bytes => report({ phase: 'downloading', version: manifest.version, bytes, total });
		if (pending.length) progress(0);
		if (pending.length) staging = fs.mkdtempSync(path.join(projectRoot, '.patch-'));
		for (const [index, { relative, wanted, size }] of pending.entries()) {
			const url = base + 'files/' + relative.split('/').map(encodeURIComponent).join('/') + '?sha=' + wanted;
			const data = await fetchWithRetry(url, FILE_TIMEOUT_MS, signal, bytes => {
				if (bytes.length !== size || sha256(bytes) !== wanted) {
					throw new Error('Checksum or size mismatch: ' + relative);
				}
				return bytes;
			}, bytes => {
				const now = Date.now();
				if (now - lastProgress >= 80) {
					lastProgress = now;
					progress(received + Math.min(size, bytes));
				}
			});
			fs.writeFileSync(path.join(staging, String(index)), data);
			received += size;
		}
		signal.throwIfAborted();
		for (const [index, { target }] of pending.entries()) {
			fs.mkdirSync(path.dirname(target), { recursive: true });
			if (updated === 0) fs.rmSync(path.join(projectRoot, 'version.txt'), { force: true });
			fs.renameSync(path.join(staging, String(index)), target);
			updated++;
		}
		if (pending.length) progress(total);
		fs.writeFileSync(path.join(projectRoot, 'version.txt'), manifest.version);
		report({ phase: 'current', version: manifest.version });
		console.log('[patcher] version ' + (manifest.version || '?') + ', ' + updated + ' file(s) updated');
	} catch (error) {
		// No internet or site down: start with what is installed
		console.error('[patcher] update skipped: ' + error.message);
		report({ phase: 'failed', version: installedVersion(projectRoot) });
	} finally {
		if (staging) await fs.promises.rm(staging, { recursive: true, force: true }).catch(error => {
			console.error('[patcher] temporary files:', error.message);
		});
	}
	return updated;
}
