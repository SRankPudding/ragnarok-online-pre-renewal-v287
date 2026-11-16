// applications/electron/preload.mjs
import { contextBridge, ipcRenderer } from 'electron';
import net from 'node:net';
import { gameHost } from './server-address.mjs';

contextBridge.exposeInMainWorld('electronAPI', {
	isElectron: true, serverHost: gameHost,
	gameLogin: (action, username, password) => ipcRenderer.invoke('community-game-login', action, username, password),

	// ─── TCP Socket ─────────────────────────────────────────
	createSocket(host, port) {
		if (host !== gameHost || ![6900, 6121, 5121].includes(Number(port))) {
			throw new Error('Only community RO game ports are allowed');
		}
		const socket = net.connect(port, host);

		return {
			onConnect(cb) {
				socket.on('connect', cb);
			},
			onError(cb) {
				socket.on('error', cb);
			},
			onData(cb) {
				socket.on('data', buf => cb(new Uint8Array(buf)));
			},
			onClose(cb) {
				socket.on('close', cb);
			},
			write(arrayBuffer) {
				socket.write(new Uint8Array(arrayBuffer));
			},
			end() {
				socket.end();
			},
			destroy() {
				socket.destroy();
			}
		};
	}
});
