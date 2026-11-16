/**
 * UI/Background.js
 *
 * Background Manager
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Configs from 'Core/Configs.js';
import PACKETVER from 'Network/PacketVerManager.js';
import { animateElement } from 'Utils/HtmlHelper.js';

/**
 * @var {HTMLElement} Background overlay (used for transition)
 */
const _overlay = document.createElement('div');
Object.assign(_overlay.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1010',
	backgroundColor: 'black',
	opacity: '0'
});

const _container = document.createElement('div');
Object.assign(_container.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1',
	width: '100%',
	height: '100%',
	backgroundColor: 'black'
});

/**
 * @var {HTMLCanvasElement} Background canvas element
 */
const _canvas = document.createElement('canvas');
Object.assign(_canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '2' });

/**
 * @var {CanvasRenderingContext2D} Background context
 */
const _ctx = _canvas.getContext('2d');
const artwork = ['frontier', 'dark', 'forest', 'desert', 'harbor', 'winter', 'glamour', 'dungeon'];
let lastLoadingArtwork = -1;
const titleScenes = ['party-meadow', 'party-moon', 'party-harbor', 'winter', 'dungeon', 'harbor', 'desert', 'forest', 'dark'];
let titleScene = 0;
const titleControls = document.createElement('div');
titleControls.style.cssText = 'position:fixed;inset:auto 18px 36px;z-index:998;display:flex;justify-content:space-between;pointer-events:none';

function titleButton(label, action) {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = label;
	button.style.cssText = 'pointer-events:auto;cursor:pointer;padding:8px 14px;border:1px solid #ba9859;' +
		'border-radius:5px;background:#211b26;color:#ffe8b7;font:600 13px "Segoe UI",sans-serif';
	button.addEventListener('click', action);
	return button;
}

titleControls.append(
	titleButton('Next background', () => {
		titleScene = (titleScene + 1) % titleScenes.length;
		_container.replaceChildren();
		paintArtwork(titleScenes[titleScene], true);
	}),
	titleButton('Exit Game', () => window.close())
);

function paintArtwork(theme, animated) {
	const url = new URL(`./Theme/${theme}.webp`, import.meta.url).href;
	Object.assign(_container.style, {
		backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: theme.startsWith('party-') ? '78% center' : 'center',
		overflow: 'hidden'
	});
	if (!animated || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const haze = document.createElement('div');
	haze.style.cssText = 'position:absolute;inset:30% -20% -12%;pointer-events:none;' +
		'background:radial-gradient(ellipse at 22% 68%,#dddfff44,transparent 33%),' +
		'radial-gradient(ellipse at 72% 50%,#c1d8ff33,transparent 30%)';
	_container.append(haze);
	haze.animate([
		{ transform: 'translateX(-8%)', opacity: 0.4 },
		{ transform: 'translateX(8%)', opacity: 0.9 }
	], { duration: 14000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });

	const color = theme === 'party-moon' ? '#c3d9ff' : theme === 'party-harbor' ? '#fff6dc' : '#ffd998';
	for (let i = 0; i < 12; i++) {
		const mote = document.createElement('span');
		const size = 2 + i % 3;
		mote.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;' +
			`left:${4 + (i * 29) % 92}%;top:${35 + (i * 17) % 55}%;width:${size}px;height:${size}px;` +
			`background:${color};box-shadow:0 0 7px ${color}`;
		_container.append(mote);
		mote.animate([
			{ transform: 'translate(0, 0)', opacity: 0 },
			{ opacity: 0.8, offset: 0.3 },
			{ opacity: 0.45, offset: 0.72 },
			{ transform: `translate(${i % 2 ? 9 : -8}vw, -13vh)`, opacity: 0 }
		], { duration: 9000 + i * 420, delay: -i * 1210, iterations: Infinity });
	}
}

/**
 * Render background (or a black background if no image is loaded yet)
 */
function render() {
	_ctx.clearRect(0, 0, _canvas.width, _canvas.height);

	if (Background._progress > -1) {
		Background.setPercent(Background._progress);
	}
}

/**
 * Background Namespace
 */
class Background {
	/**
	 * Background loading progress
	 * @var {number} percent
	 */
	static _progress = -1;

	/**
	 * @var {object|null} current overlay animation handle
	 */
	static _overlayAnim = null;

	/**
	 * @var {Array} loading screen filenames
	 */
	static _loading = [];

	/**
	 * @var {object|null} removal in progress, dropped when a background is set during its fade
	 */
	static _removal = null;

	/**
	 * Initialize Background component
	 *
	 * @param {Array} loading - Array of loading filenames stored in clientinfo.xml
	 */
	static init(loading) {
		let i;

		Background._progress = 0;
		_canvas.style.zIndex = '1';

		render();

		if (loading) {
			Background._loading = loading;
			return;
		}

		// Generate default loadings
		Background._loading.length = 10;
		for (i = 1; i <= 10; ++i) {
			Background._loading[i - 1] = `loading${i < 10 ? '0' + i : i}.jpg`;
		}
	}

	/**
	 * Resize the background
	 */
	static resize(width, height) {
		_canvas.width = width;
		_canvas.height = height;
		Object.assign(_overlay.style, { width: width + 'px', height: height + 'px' });
		Object.assign(_container.style, { width: width + 'px', height: height + 'px' });

		_ctx.clearRect(0, 0, width, height);

		render();
	}

	/**
	 * Set an image as background
	 *
	 * @param {string|Array<string>} filename
	 * @param {function} callback once the image is loaded (optional)
	 */
	static setImage(filename, callback) {
		const exist = !!_container.parentNode;
		Background._progress = -1;
		Background._removal = null;

		_container.innerHTML = '';
		titleControls.remove();
		_container.style.backgroundImage = 'none';
		render();

		if (typeof filename === 'string' && filename.startsWith('@loading:')) {
			paintArtwork(filename.slice('@loading:'.length), false);
			if (exist && callback) callback();
		} else if (filename === '@title' || filename === 'bgi_temp.bmp') {
			paintArtwork(titleScenes[titleScene], true);
			document.body.append(titleControls);
			if (exist && callback) callback();
		} else if (Array.isArray(filename)) {
			let loadedCount = 0;
			const total = filename.length;
			const divs = [];

			// Pre-create the grid cells in exact order
			for (let i = 0; i < total; i++) {
				const div = document.createElement('div');
				Object.assign(div.style, {
					width: '25%',
					height: '33.333%',
					float: 'left',
					backgroundSize: '100% 100%'
				});
				divs.push(div);
				_container.appendChild(div);
			}

			filename.forEach((file, index) => {
				const fullPath = DB.INTERFACE_PATH + file;

				Client.loadFile(
					fullPath,
					url => {
						divs[index].style.backgroundImage = `url(${url})`;

						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					},
					() => {
						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					}
				);
			});
		} else {
			const fullPath = DB.INTERFACE_PATH + filename;
			// Get and load Image
			Client.loadFile(
				fullPath,
				url => {
					Object.assign(_container.style, {
						backgroundImage: `url(${url})`,
						backgroundSize: '100% 100%'
					});
					if (exist && callback) callback();
				},
				() => {
					if (exist && callback) callback();
				}
			);
		}

		// Add transition only if the background isn't here
		if (!exist) {
			transition(() => {
				document.body.appendChild(_container);
				document.body.appendChild(_canvas);
				if (callback) {
					callback();
				}
			});
		}
	}

	/**
	 * Helper method to return the right login background filename(s) based on packet version.
	 */
	static getLoginBackgroundName() {
		if (PACKETVER.value >= 20221207) {
			return 't_login.jpg';
		}
		if (PACKETVER.value >= 20181114) {
			return [
				't_\xB9\xE8\xB0\xE61-1.bmp',
				't_\xB9\xE8\xB0\xE61-2.bmp',
				't_\xB9\xE8\xB0\xE61-3.bmp',
				't_\xB9\xE8\xB0\xE61-4.bmp',
				't_\xB9\xE8\xB0\xE62-1.bmp',
				't_\xB9\xE8\xB0\xE62-2.bmp',
				't_\xB9\xE8\xB0\xE62-3.bmp',
				't_\xB9\xE8\xB0\xE62-4.bmp',
				't_\xB9\xE8\xB0\xE63-1.bmp',
				't_\xB9\xE8\xB0\xE63-2.bmp',
				't_\xB9\xE8\xB0\xE63-3.bmp',
				't_\xB9\xE8\xB0\xE63-4.bmp'
			];
		}
		return 'bgi_temp.bmp';
	}

	/**
	 * Add versioned login background
	 *
	 * @param {function} callback once the background is display (optional)
	 */
	static setLoginBackground(callback) {
		Background.setImage('@title', callback);
	}

	/**
	 * Add loading background
	 *
	 * @param {function} callback once the loading is display (optional)
	 */
	static setLoading(callback) {
		lastLoadingArtwork = (lastLoadingArtwork + 1 + Math.floor(Math.random() * (artwork.length - 1))) % artwork.length;

		Background.setImage('@loading:' + artwork[lastLoadingArtwork], () => {
			_canvas.style.zIndex = '999';
			Background.setPercent(0.0);

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Remove background
	 *
	 * @param {function} callback once the overlay hide the window (optional)
	 */
	static remove(callback) {
		titleControls.remove();
		const removal = { zIndex: [_container.style.zIndex, _canvas.style.zIndex] };
		Background._removal = removal;

		// Whatever is put on screen during the fade (the map behind, its
		// windows, the touch controls at 1000) stays under the image until
		// the screen is black.
		_container.style.zIndex = '1008';
		_canvas.style.zIndex = '1009';

		transition(() => {
			// A background set during the fade replaces the one this call was removing:
			// it stays, back at the depth it had before the fade.
			if (Background._removal !== removal) {
				[_container.style.zIndex, _canvas.style.zIndex] = removal.zIndex;
			} else {
				Background._removal = null;
				_container.style.zIndex = '0';
				_canvas.style.zIndex = '0';
				if (_container.parentNode) _container.parentNode.removeChild(_container);
				if (_canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
				_container.innerHTML = '';
				_container.style.backgroundImage = 'none';
			}

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Adding progress bar to background
	 *
	 * @param {number} percent
	 */
	static setPercent(percent) {
		Background._progress = Math.min(Math.floor(percent), 100);

		const width = 380;
		const height = 18;
		const x = Math.floor((_canvas.width - width) * 0.5);
		const y = Math.floor(_canvas.height * 0.75);
		const pill = (left, top, w, h) => {
			_ctx.beginPath();
			_ctx.roundRect(left, top, w, h, h / 2);
		};

		_ctx.save();

		// Gold frame around a dark track
		_ctx.fillStyle = '#b9954a';
		pill(x - 2, y - 2, width + 4, height + 4);
		_ctx.fill();
		_ctx.fillStyle = '#1d1426';
		pill(x, y, width, height);
		_ctx.fill();

		// Gold progress, clipped to the track
		pill(x, y, width, height);
		_ctx.clip();
		const gold = _ctx.createLinearGradient(0, y, 0, y + height);
		gold.addColorStop(0, '#f9dd94');
		gold.addColorStop(1, '#d6a445');
		_ctx.fillStyle = gold;
		_ctx.fillRect(x, y, Math.floor(percent * width * 0.01), height);

		// Percent
		_ctx.font = 'bold 12px "Segoe UI", sans-serif';
		_ctx.textAlign = 'center';
		_ctx.textBaseline = 'middle';
		_ctx.lineWidth = 3;
		_ctx.strokeStyle = '#1d1426';
		_ctx.strokeText(percent + '%', x + width / 2, y + height / 2 + 1);
		_ctx.fillStyle = '#fff6e0';
		_ctx.fillText(percent + '%', x + width / 2, y + height / 2 + 1);

		_ctx.restore();
	}
}

/**
 * Play with the overlay
 *
 * @param {function} callback once the overlay hide the window
 */
function transition(callback) {
	const transitionDuration = Configs.get('transitionDuration') ? Configs.get('transitionDuration') : 500;

	if (Background._overlayAnim) {
		Background._overlayAnim.stop();
	}

	// A transition that starts while another is under way carries on from
	// where the overlay is. When a map loads before the fade to its loading
	// image is over, Background.remove runs inside that fade's callback, with
	// the screen already black: there is nothing left to fade.
	let duration = transitionDuration;
	if (_overlay.parentNode) {
		if (parseFloat(_overlay.style.opacity) >= 0.99) {
			duration = 1;
		}
	} else {
		_overlay.style.opacity = '0.01';
		document.body.appendChild(_overlay);
	}

	const anim = animateElement(_overlay, { opacity: 1.0 }, duration, () => {
		callback();

		// The callback started a transition of its own, which now fades back
		if (Background._overlayAnim !== anim) {
			return;
		}

		Background._overlayAnim = animateElement(_overlay, { opacity: 0.01 }, transitionDuration, () => {
			if (_overlay.parentNode) {
				_overlay.parentNode.removeChild(_overlay);
			}
		});
	});
	Background._overlayAnim = anim;
}

/**
 * Export
 */
export default Background;
