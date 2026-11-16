import { BrowserWindow } from 'electron';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function showPatchProgress(projectRoot, directory, startGame, runPatcher) {
	const splash = new BrowserWindow({
		width: 460,
		height: 280,
		resizable: false,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: '#151421',
		title: 'Ragnarok Online – Pre-Renewal',
		icon: path.join(directory, 'icon.png')
	});
	let result;
	const canRender = await Promise.race([
		splash.loadFile(path.join(directory, 'patch-window.html')).then(() => true, error => {
			console.error('[patcher] start window:', error.message);
			return false;
		}),
		delay(2500, false, { ref: false })
	]);
	if (splash.isDestroyed()) return;
	if (canRender) splash.show();
	try {
		await runPatcher(projectRoot, status => {
			result = status;
			if (canRender && !splash.isDestroyed()) {
				void splash.webContents.executeJavaScript(
					`window.showPatchStatus(${JSON.stringify(status)})`
				).catch(() => {});
			}
		});
	} catch (error) {
		console.error('[patcher] start-up:', error.message);
	}
	if (canRender && !splash.isDestroyed()) await delay(350);
	if (splash.isDestroyed()) return;
	startGame(result?.version ?? undefined);
	splash.destroy();
}
