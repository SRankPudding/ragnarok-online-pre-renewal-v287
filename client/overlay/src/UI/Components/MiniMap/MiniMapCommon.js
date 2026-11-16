import { cityCrystals } from 'DB/Map/CityCrystals.js';
/**
 * UI/Components/MiniMap/MiniMapCommon.js
 *
 * Shared MiniMap factory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import Renderer from 'Renderer/Renderer.js';
import Altitude from 'Renderer/Map/Altitude.js';
import KEYS from 'Controls/KeyEventHandler.js';
import MapControl from 'Controls/MapControl.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import QuestMarks from 'UI/Components/Quest/QuestMarks.js';
import ClassGuide from 'UI/Components/ClassGuide/ClassGuide.js';
import AtlasMap from 'UI/Components/WorldMap/AtlasMap.js';
const incubatorVendors = {"geffen": [[193, 152]], "izlude": [[164, 138]], "lighthalzen": [[222, 191]], "moc_ruins": [[118, 170]], "payon": [[177, 131]], "prontera": [[218, 211]], "yuno": [[197, 114]]};


import { drawExitLabels } from './ExitLabels.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';

function createFloorPlan() {
	const { width, height, TYPE } = Altitude;
	if (!width || !height) return null;

	const cells = document.createElement('canvas');
	cells.width = width;
	cells.height = height;
	const ctx = cells.getContext('2d');
	const pixels = ctx.createImageData(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!(Altitude.getCellType(x, y) & TYPE.WALKABLE)) continue;
			const offset = ((height - 1 - y) * width + x) * 4;
			pixels.data.set([168, 151, 120, 255], offset);
		}
	}
	ctx.putImageData(pixels, 0, 0);

	const map = document.createElement('canvas');
	map.width = map.height = 512;
	const output = map.getContext('2d');
	const scale = map.width / Math.max(width, height);
	output.fillStyle = '#241e27';
	output.fillRect(0, 0, map.width, map.height);
	output.imageSmoothingEnabled = false;
	output.drawImage(cells, (map.width - width * scale) / 2, (map.height - height * scale) / 2,
		width * scale, height * scale);
	return map;
}

/**
 * Create MiniMap component
 *
 * @param {object} config
 * @param {string} config.name component name (also used as preference key)
 * @param {string} config.htmlText
 * @param {string} config.cssText
 * @param {object} [config.worldMap] WorldMap module, enables the ".viewon" button
 * @param {boolean} [config.townInfoToggle] enables the ".object" button and townInfoShow preference
 * @param {boolean} [config.coordinates] display current coordinates
 * @param {boolean} [config.arrowShadow] render the player arrow with a shadow
 */
export function createMiniMap({
	name,
	htmlText,
	cssText,
	worldMap = null,
	townInfoToggle = false,
	coordinates = false,
	arrowShadow = false
}) {
	/**
	 * Create MiniMap component
	 */
	const MiniMap = new GUIComponent(name, cssText);

	/**
	 * Mouse cant cross this UI
	 */
	MiniMap.mouseMode = GUIComponent.MouseMode.STOP;

	/**
	 * @var {boolean} do not focus this UI
	 */
	MiniMap.needFocus = false;

	MiniMap.render = () => htmlText;

	/**
	 * @var {Preferences}
	 */
	const _preferencesDefault = {
		zoom: 0,
		opacity: 2
	};
	if (townInfoToggle) {
		_preferencesDefault.townInfoShow = true;
	}
	const _preferences = Preferences.get(name, _preferencesDefault, 1.0);

	/**
	 * @var {Object} member colors cache
	 */
	const _memberColors = {};

	/**
	 * @var {Array} party members marker
	 */
	const _party = [];

	/**
	 * @var {Array} guild members marker
	 */
	const _guild = [];

	/**
	 * @var {Array} others markers
	 */
	const _markers = [];
	let _canvasScale = 1;

	/**
	 * @var {Array} others towninfo
	 */
	let _towninfo = [];
	let visibleJobMarkers = [];
	const jobTeacherMarkers = {
		izlude: [[52,140,"Swordman Guild"]],
		izlude_in: [[74,172,"Swordman"]],
		prontera: [[237,317,"Acolyte Church"]],
		prt_church: [[184,41,"Acolyte"]],
		pay_arche: [[145,165,"Archer Guild"]],
		payon_in02: [[64,71,"Archer"]],
		geffen: [[61,180,"Mage Guild"]],
		geffen_in: [[164,124,"Mage"]],
		alberta: [[33,42,"Merchant Guild"],[30,65,"Ninja: Akagi"]],
		alberta_in: [[53,43,"Merchant"]],
		moc_ruins: [[54,161,"Thief Guild"]],
		moc_pryd01: [[90,109,"Thief Guild"]],
		moc_prydb1: [[39,129,"Thief"]],
		amatsu: [[149,140,"Ninja Guild"]],
		que_ng: [[30,65,"Ninja: Kuuga Gai"],[152,167,"Gunslinger"]],
		einbroch: [[136,199,"Gunslinger Guild"],[184,194,"Ninja: Suspicious Man"]],
	};

	/**
	 * Async image create helper
	 */
	function createAsyncImage() {
		const img = new Image();
		img.decoding = 'async';
		return img;
	}

	/**
	 * @var {Image} arrow image
	 */
	const _arrow = createAsyncImage();

	/**
	 * @var {Image} map information images
	 */
	const _toolDealer = createAsyncImage();
	const _weaponDealer = createAsyncImage();
	const _armorDealer = createAsyncImage();
	const _blacksmith = createAsyncImage();
	const _guide = createAsyncImage();
	const _inn = createAsyncImage();

	/**
	 * @var {HTMLImageElement|HTMLCanvasElement|null} minimap image
	 */
	let _map = null;
	let mapRequest = 0;

	/**
	 * @var {CanvasRenderingContext2D} canvas context
	 */
	let _ctx;

	/**
	 * @var {List} Zoom values
	 */
	const _zoomFactor = [1, 10, 6, 3, 2];

	/**
	 * Initialize minimap
	 */
	MiniMap.init = function init() {
		const root = this.getRoot();

		_ctx = root.querySelector('canvas').getContext('2d');
		// All drawing below is written for a 128px map; a bigger canvas is filled by scaling it
		const mapCanvas = root.querySelector('canvas');
		_canvasScale = mapCanvas.width / 128;
		mapCanvas.style.cursor = 'crosshair';
		mapCanvas.title = 'Click a location to auto-run or a quest marker to show its route. Right-click to clear.';
		mapCanvas.addEventListener('mousedown', event => event.stopPropagation());
		mapCanvas.addEventListener('click', event => routeMapClick(event, mapCanvas));
		mapCanvas.addEventListener('contextmenu', event => {
			event.preventDefault();
			event.stopPropagation();
			MapControl.stopWaypoint();
			Navigation.clear();
		});
		this.opacity = 2;

		// Move handle: drag the minimap anywhere, the place is remembered
		const moveHandle = root.querySelector('.move-handle');
		if (moveHandle) {
			this.draggable('.move-handle');
			// Always place by left/top: a host with both left and right set stretches and scatters the buttons
			const saved = typeof _preferences.x === 'number' && typeof _preferences.y === 'number';
			const canvasWidth = root.querySelector('canvas').width;
			const defaultLeft = Math.min(Math.round(window.innerWidth * 0.68), window.innerWidth - canvasWidth - 16);
			const left = saved ? _preferences.x : defaultLeft;
			const top = saved ? _preferences.y : Math.max(16, window.innerHeight - canvasWidth - 45);
			this._host.style.left = Math.max(24, Math.min(window.innerWidth - 60, left)) + 'px';
			this._host.style.top = Math.max(0, Math.min(window.innerHeight - 60, top)) + 'px';
			this._host.style.right = 'auto';
			moveHandle.addEventListener('mousedown', () => {
				const host = this._host;
				const onUp = () => {
					window.removeEventListener('mouseup', onUp, true);
					const rect = host.getBoundingClientRect();
					host.style.right = 'auto';
					_preferences.x = Math.round(rect.left);
					_preferences.y = Math.round(rect.top);
					_preferences.save();
				};
				window.addEventListener('mouseup', onUp, true);
			});
		}

		Client.loadFile(`${DB.INTERFACE_PATH}map/map_arrow.bmp`, dataURI => {
			_arrow.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/store.bmp`, dataURI => {
			_toolDealer.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/weaponshop.bmp`, dataURI => {
			_weaponDealer.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/armorshops.bmp`, dataURI => {
			_armorDealer.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/smithy.bmp`, dataURI => {
			_blacksmith.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/guide.bmp`, dataURI => {
			_guide.src = dataURI;
		});
		Client.loadFile(`${DB.INTERFACE_PATH}information/inn.bmp`, dataURI => {
			_inn.src = dataURI;
		});


		if (worldMap) {
			root.querySelector('.class-guides-menu')?.addEventListener('click', () => ClassGuide.toggle());
			const viewonBtn = root.querySelector('.viewon');
			if (viewonBtn) {
				viewonBtn.addEventListener('mousedown', () => {
					AtlasMap.toggle();
				});
			}
		}
	};

	/**
	 * Once append to HTML
	 */
	MiniMap.onAppend = function onAppend() {
		this.updateZoom(_preferences.zoom);
		this.toggleOpacity(_preferences.opacity + 1);

		Renderer.render(render);
	};

	/**
	 * Set map
	 *
	 * @param {string} mapname
	 */
	MiniMap.setMap = function setMap(mapname) {
		const request = ++mapRequest;
		_map = null;

		_towninfo = DB.getTownInfo(mapname.replace(/\..*/, ''));
		visibleJobMarkers = jobTeacherMarkers[mapname.split('.')[0]] || [];
		QuestMarks.currentMap = mapname.split('.')[0];
		const location = this.getRoot()?.querySelector('.map-location strong');
		if (location) location.textContent = DB.getMapName(QuestMarks.currentMap, '') || QuestMarks.currentMap;
		if (QuestMarks.refresh) {
			QuestMarks.refresh();
		}

		let path = DB.INTERFACE_PATH.replace('data/texture/', '') + 'map/' + mapname.replace(/\..*/, '.bmp');
		path = path.replace(/\//g, '\\');
		path = DB.mapalias[path] || path;

		const useFloorPlan = () => {
			if (request === mapRequest) _map = createFloorPlan();
		};
		Client.loadFile(`data/texture/${path}`, dataURI => {
			if (request !== mapRequest) return;
			const image = createAsyncImage();
			image.onload = () => {
				if (request === mapRequest) _map = image;
			};
			image.onerror = useFloorPlan;
			image.src = dataURI;
		}, useFloorPlan);
	};

	/**
	 * KeyDown Handler
	 *
	 * @param {object} event
	 * @return {boolean}
	 */
	MiniMap.onKeyDown = function onKeyDown(event) {
		if (event.which === KEYS.TAB && KEYS.CTRL) {
			this.toggleOpacity();
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};

	/**
	 * Once removed from HTML
	 */
	MiniMap.onRemove = function onRemove() {
		_party.length = 0;
		_guild.length = 0;
		_markers.length = 0;
	};

	/**
	 * Add a party mark to minimap
	 *
	 * @param {number} key account id
	 * @param {number} x position
	 * @param {number} y position
	 */
	MiniMap.addPartyMemberMark = function addPartyMemberMark(key, x, y) {
		for (let i = 0; i < _party.length; ++i) {
			if (_party[i].key === key) {
				_party[i].x = x;
				_party[i].y = y;
				_party[i].color = this.getMemberColor(key);
				return;
			}
		}

		_party.push({ key, x, y, color: this.getMemberColor(key) });
	};

	/**
	 * Get or generate a random color for a party member
	 */
	MiniMap.getMemberColor = function getMemberColor(key) {
		if (_memberColors[key]) {
			return _memberColors[key];
		}
		const r = Math.random;
		const color = `rgb(${(r() * 255) | 0},${(r() * 255) | 0},${(r() * 255) | 0})`;
		_memberColors[key] = color;
		return color;
	};

	/**
	 * Remove a party mark from minimap
	 *
	 * @param {number} key account id
	 */
	MiniMap.removePartyMemberMark = function removePartyMemberMark(key) {
		for (let i = 0; i < _party.length; ++i) {
			if (_party[i].key === key) {
				_party.splice(i, 1);
				break;
			}
		}
	};

	/**
	 * Add a guild mark to minimap
	 *
	 * @param {number} key account id
	 * @param {number} x position
	 * @param {number} y position
	 */
	MiniMap.addGuildMemberMark = function addGuildMemberMark(key, x, y) {
		for (let i = 0; i < _guild.length; ++i) {
			if (_guild[i].key === key) {
				_guild[i].x = x;
				_guild[i].y = y;
				return;
			}
		}

		_guild.push({ key, x, y });
	};

	/**
	 * Remove a guild mark from minimap
	 *
	 * @param {number} key account id
	 */
	MiniMap.removeGuildMemberMark = function removeGuildMemberMark(key) {
		for (let i = 0; i < _guild.length; ++i) {
			if (_guild[i].key === key) {
				_guild.splice(i, 1);
				break;
			}
		}
	};

	/**
	 * Add a npc mark to minimap
	 *
	 * @param {number} key id
	 * @param {number} x position
	 * @param {number} y position
	 * @param {Array} color
	 */
	MiniMap.addNpcMark = function addNPCMark(key, x, y, lcolor, time, label) {
		const color = [(lcolor & 0x00ff0000) >> 16, (lcolor & 0x0000ff00) >> 8, lcolor & 0x000000ff];

		for (let i = 0; i < _markers.length; ++i) {
			if (_markers[i].key === key) {
				_markers[i].x = x;
				_markers[i].y = y;
				_markers[i].color = `rgb(${color[0]},${color[1]},${color[2]})`;
				_markers[i].tick = Renderer.tick + time;
				_markers[i].label = label;
				return;
			}
		}

		_markers.push({
			key,
			x,
			y,
			color: `rgb(${color[0]},${color[1]},${color[2]})`,
			tick: Renderer.tick + time,
			label
		});
	};

	/**
	 * Remove a NPC mark from minimap
	 *
	 * @param {number} key id
	 */
	MiniMap.removeNpcMark = function removeNPCMark(key) {
		for (let i = 0; i < _markers.length; ++i) {
			if (_markers[i].key === key) {
				_markers.splice(i, 1);
				break;
			}
		}
	};

	if (coordinates) {
		/**
		 * Update Coords Values
		 *
		 * @param {number} x increment
		 * @param {number} y increment
		 */
		MiniMap.updateCoordinates = function updateCoordinates(x, y) {
			const root = this.getRoot();
			const coordX = root.querySelector('.coordinates .coord.x');
			const coordY = root.querySelector('.coordinates .coord.y');
			if (coordX) {
				coordX.textContent = Math.floor(x);
			}
			if (coordY) {
				coordY.textContent = Math.floor(y);
			}
		};
	}

	/**
	 * Change zoom
	 *
	 * @param {number} value increment
	 */
	MiniMap.updateZoom = function updateZoom(value) {
		_preferences.zoom = Math.max(0, Math.min(_zoomFactor.length - 1, _preferences.zoom + value));
		_preferences.save();
	};

	/**
	 * Change window opacity
	 */
	MiniMap.toggleOpacity = function toggleOpacity(opacity) {
		this.opacity = ((arguments.length ? opacity : this.opacity) + 2) % 3;
		_preferences.opacity = this.opacity;
		_preferences.save();

		switch (this.opacity) {
			case 0:
				this.ui.hide();
				break;

			case 1:
				_ctx.globalAlpha = 0.5;
				this.ui.show();
				break;

			case 2:
				_ctx.globalAlpha = 1.0;
				this.ui.show();
				break;
		}
	};

	/**
	 * Render GUI
	 */
	let mapProjection;

	function routeMapClick(event, canvas) {
		if (!mapProjection || mapProjection.map !== QuestMarks.currentMap) return;
		MapControl.stopWaypoint();
		const bounds = canvas.getBoundingClientRect();
		const px = (event.clientX - bounds.left) * 128 / bounds.width;
		const py = (event.clientY - bounds.top) * 128 / bounds.height;
		const { map, xOrigin, yOrigin, scale, width, height } = mapProjection;
		if (map === 'morocc' && Math.hypot(px - (xOrigin + 146 * scale), py - (yOrigin - 89 * scale)) < 4) {
			Navigation.uid = '';
			Navigation.setNaviInfo('morocc,146,89', 'Morroc Town Guard', { serverPortals: true });
			return;
		}
		if (map === 'izlude' && Math.hypot(px - (xOrigin + 109 * scale), py - (yOrigin - 151 * scale)) <= 5) {
			Navigation.uid = '';
			Navigation.setNaviInfo('izlude,109,151', 'Weapon and Armor Shop', { serverPortals: true });
			return;
		}
		let nearest;
		let best = 8;
		for (const mark of QuestMarks.list) {
			const distance = Math.hypot(px - (xOrigin + mark.x * scale), py - (yOrigin - mark.y * scale));
			if (distance < best) {
				nearest = mark;
				best = distance;
			}
		}
		if (nearest) {
			nearest.route();
			return;
		}
		const x = Math.round((px - xOrigin) / scale);
		const y = Math.round((yOrigin - py) / scale);
		if (x < 0 || y < 0 || x >= width || y >= height) return;
		Navigation.uid = '';
		Navigation.setNaviInfo(`${map},${x},${y}`, 'Minimap waypoint');
		MapControl.walkToWaypoint(x, y, () => Navigation.getWaypointPath(map, x, y));
	}

	const render = (function renderClosure() {
		const ZOOM_SIZE = 20;
		let max, start_x, start_y, zoom, f;
		let pos;
		let lastPaint = -Infinity;

		function projectX(x) {
			if (zoom === 1) {
				return (start_x + x * f) | 0;
			}
			return (64 + ((x - pos[0]) * f * 256) / (zoom * ZOOM_SIZE)) | 0;
		}

		function projectY(y) {
			if (zoom === 1) {
				return (start_y + 128 - y * f) | 0;
			}
			return (64 - ((y - pos[1]) * f * 256) / (zoom * ZOOM_SIZE)) | 0;
		}

		return function _render(tick) {
			const width = Altitude.width;
			const height = Altitude.height;
			let i, count;
			let dot;

			if (!Session.Entity || !Session.Entity.position || !_ctx) {
				return;
			}

			if (tick >= lastPaint && tick - lastPaint < 33) return;
			lastPaint = tick;
			zoom = _zoomFactor[_preferences.zoom];
			pos = Session.Entity.position;
			max = Math.max(width, height);
			f = (1 / max) * 128;
			start_x = ((max - width) / 2) * f;
			start_y = ((height - max) / 2) * f;
			const scale = zoom === 1 ? f : f * 256 / (zoom * ZOOM_SIZE);
			mapProjection = {
				map: QuestMarks.currentMap, width, height, scale,
				xOrigin: zoom === 1 ? start_x : 64 - pos[0] * scale,
				yOrigin: zoom === 1 ? start_y + 128 : 64 + pos[1] * scale
			};

			if (coordinates) {
				MiniMap.updateCoordinates(pos[0], pos[1]);
				const location = MiniMap.getRoot()?.querySelector('.map-location span');
				const coordinatesText = `${Math.floor(pos[0])}, ${Math.floor(pos[1])}`;
				if (location && location.textContent !== coordinatesText) location.textContent = coordinatesText;
			}

			_ctx.setTransform(_canvasScale, 0, 0, _canvasScale, 0, 0);
			_ctx.clearRect(0, 0, 128, 128);

			if (_map?.width) {
				if (zoom === 1) {
					_ctx.drawImage(_map, 0, 0, 128, 128);
				} else {
					_ctx.drawImage(
						_map,
						((start_x + pos[0] * f) * 4 - ZOOM_SIZE * zoom) | 0,
						((start_y + 128 - pos[1] * f) * 4 - ZOOM_SIZE * zoom) | 0,
						ZOOM_SIZE * zoom * 2,
						ZOOM_SIZE * zoom * 2,
						0,
						0,
						128,
						128
					);
				}
			}

			// Render town info icons
			if (_towninfo && (townInfoToggle ? _preferences.townInfoShow : _towninfo.length)) {
				count = _towninfo.length;
				for (i = 0; i < count; ++i) {
					dot = _towninfo[i];

					let img;
					switch (dot.Type) {
						case 0:
							img = _toolDealer;
							break;
						case 1:
							img = _weaponDealer;
							break;
						case 2:
							img = _armorDealer;
							break;
						case 3:
							img = _blacksmith;
							break;
						case 4:
							continue;
						case 5:
							img = _inn;
							break;
						case 6:
							if (dot.X != null && dot.Y != null) {
								const x = projectX(dot.X);
								const y = projectY(dot.Y);
								_ctx.save();
								_ctx.translate(x, y);
								const size = 7 / _canvasScale;
								_ctx.fillStyle = '#91ed93';
								_ctx.strokeStyle = '#163323';
								_ctx.lineWidth = 1.6 / _canvasScale;
								_ctx.beginPath();
								for (let point = 0; point < 10; point++) {
									const angle = point * Math.PI / 5 - Math.PI / 2;
									const radius = point % 2 ? size * 0.45 : size;
									_ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
								}
								_ctx.closePath();
								_ctx.stroke();
								_ctx.fill();
								_ctx.restore();
							}
							continue;
					}

					if (img?.complete && img.width) {
						_ctx.save();
						_ctx.translate(projectX(dot.X) + img.width / 2, projectY(dot.Y) + img.height / 2);
						_ctx.drawImage(img, -img.width, -img.height);
						_ctx.restore();
					}
				}
			}

			if (visibleJobMarkers.length) {
				_ctx.save();
				_ctx.font = `bold ${11 / _canvasScale}px sans-serif`;
				_ctx.strokeStyle = '#1c1110';
				_ctx.fillStyle = '#ffda79';
				_ctx.lineWidth = 2 / _canvasScale;
				for (const [x, y, label] of visibleJobMarkers) {
					const px = projectX(x);
					const py = projectY(y);
					if (px < 0 || px >= 128 || py < 0 || py >= 128) continue;
					_ctx.beginPath();
					_ctx.arc(px, py, 3, 0, 2 * Math.PI);
					_ctx.stroke();
					_ctx.fill();
					const left = Math.max(1, Math.min(px + 5, 127 - _ctx.measureText(label).width));
					const top = py < 12 ? py + 12 : py - 4;
					_ctx.strokeText(label, left, top);
					_ctx.fillText(label, left, top);
				}
				_ctx.restore();
			}

			// Render attached player arrow
			if (_arrow.complete && _arrow.width) {
				_ctx.save();
				_ctx.translate(projectX(pos[0]), projectY(pos[1]));
				_ctx.rotate(((Session.Entity.direction + 4) * 45 * Math.PI) / 180);

				if (arrowShadow) {
					_ctx.shadowColor = 'rgba(0, 0, 0, 1)';
					_ctx.shadowBlur = 5;
					_ctx.shadowOffsetX = 0;
					_ctx.shadowOffsetY = 0;
				}

				_ctx.drawImage(_arrow, -_arrow.width * 0.5, -_arrow.height * 0.5);

				if (arrowShadow) {
					_ctx.shadowColor = 'rgba(0, 0, 0, 0)';
					_ctx.shadowBlur = 0;
					_ctx.shadowOffsetX = 0;
					_ctx.shadowOffsetY = 0;
				}

				_ctx.restore();
			}

			// The active navigation route and its target, so the navigation window is not needed to follow it
			if (Navigation.drawRouteOn) {
				const projectPoint = (x, y) => ({ x: projectX(x), y: projectY(y) });
				_ctx.save();
				Navigation.drawRouteOn(_ctx, projectPoint);
				_ctx.restore();
				const destination = Navigation.getDestinationText();
				if (destination) {
					_ctx.save();
					_ctx.font = `bold ${11 / _canvasScale}px Arial, sans-serif`;
					_ctx.textAlign = 'left';
					_ctx.textBaseline = 'bottom';
					_ctx.lineWidth = 3 / _canvasScale;
					_ctx.strokeStyle = '#000000';
					_ctx.fillStyle = '#7df9ff';
					_ctx.strokeText(destination, 3, 126);
					_ctx.fillText(destination, 3, 126);
					_ctx.restore();
				}
			}

			// Draw exit arrows and their destinations
			drawExitLabels(_ctx, QuestMarks.currentMap, (x, y) => ({ x: projectX(x), y: projectY(y) }), 128, 128, 11 / _canvasScale);

			if (QuestMarks.currentMap === 'morocc' && !QuestMarks.list.some(mark => mark.x === 146 && mark.y === 89)) {
				_ctx.save();
				_ctx.translate(projectX(146), projectY(89));
				_ctx.fillStyle = '#bc8cff';
				_ctx.strokeStyle = '#20162c';
				_ctx.lineWidth = 1;
				_ctx.beginPath();
				_ctx.moveTo(-4, -4);
				_ctx.lineTo(4, -4);
				_ctx.lineTo(3, 2);
				_ctx.lineTo(0, 5);
				_ctx.lineTo(-3, 2);
				_ctx.closePath();
				_ctx.fill();
				_ctx.stroke();
				_ctx.restore();
			}
			if (QuestMarks.currentMap === 'izlude' && _weaponDealer.complete && _weaponDealer.naturalWidth) {
				const size = 18 / _canvasScale;
				_ctx.drawImage(_weaponDealer, projectX(109) - size / 2, projectY(151) - size / 2, size, size);
			}
			const crystal = cityCrystals[QuestMarks.currentMap];
			if (crystal) {
				const x = projectX(crystal[0]);
				const y = projectY(crystal[1]);
				_ctx.save();
				_ctx.translate(x, y);
				_ctx.fillStyle = '#65e5ff';
				_ctx.strokeStyle = '#10243b';
				_ctx.lineWidth = 1.2;
				_ctx.beginPath();
				_ctx.moveTo(0, -5);
				_ctx.lineTo(4, 0);
				_ctx.lineTo(0, 5);
				_ctx.lineTo(-4, 0);
				_ctx.closePath();
				_ctx.stroke();
				_ctx.fill();
				_ctx.restore();
			}

			const vendors = incubatorVendors[QuestMarks.currentMap];
			if (vendors) {
				_ctx.save();
				_ctx.fillStyle = '#ffd59a';
				_ctx.strokeStyle = '#30213a';
				_ctx.lineWidth = 1;
				for (const [x, y] of vendors) {
					const px = projectX(x);
					const py = projectY(y);
					_ctx.beginPath();
					_ctx.moveTo(px - 4, py + 1);
					_ctx.lineTo(px - 4, py - 4);
					_ctx.lineTo(px - 1, py - 2);
					_ctx.lineTo(px + 1, py - 2);
					_ctx.lineTo(px + 4, py - 4);
					_ctx.lineTo(px + 4, py + 1);
					_ctx.quadraticCurveTo(px, py + 6, px - 4, py + 1);
					_ctx.fill();
					_ctx.stroke();
					_ctx.fillStyle = '#30213a';
					_ctx.fillRect(px - 2, py, 1, 1);
					_ctx.fillRect(px + 1, py, 1, 1);
					_ctx.fillStyle = '#ffd59a';
				}
				_ctx.restore();
			}

			// Render quest marks: "!" quest goal, "?" turn-in NPC
			count = QuestMarks.list.length;
			if (count) {
				_ctx.save();
				_ctx.font = `bold ${16 / _canvasScale}px Arial, sans-serif`;
				_ctx.textAlign = 'center';
				_ctx.textBaseline = 'middle';
				_ctx.lineWidth = 3 / _canvasScale;
				_ctx.strokeStyle = '#000000';
				for (i = 0; i < count; ++i) {
					dot = QuestMarks.list[i];
					_ctx.strokeText(dot.label, projectX(dot.x), projectY(dot.y));
					_ctx.fillStyle = dot.color;
					_ctx.fillText(dot.label, projectX(dot.x), projectY(dot.y));
				}
				_ctx.restore();
			}

			// Quest signs sent by the server for NPCs ("!" available, "?" hand in): steady, like the quest marks
			_ctx.save();
			_ctx.font = `bold ${16 / _canvasScale}px Arial, sans-serif`;
			_ctx.textAlign = 'center';
			_ctx.textBaseline = 'middle';
			_ctx.lineWidth = 3 / _canvasScale;
			_ctx.strokeStyle = '#000000';
			for (i = 0; i < _markers.length; ++i) {
				dot = _markers[i];
				if (!dot.label || QuestMarks.list.some(mark => Math.abs(mark.x - dot.x) < 4 && Math.abs(mark.y - dot.y) < 4)) {
					continue;
				}
				_ctx.strokeText(dot.label, projectX(dot.x), projectY(dot.y));
				_ctx.fillStyle = dot.color;
				_ctx.fillText(dot.label, projectX(dot.x), projectY(dot.y));
			}
			_ctx.restore();

			// Render NPC mark
			if (tick % 1000 > 500) {
				count = _markers.length;

				for (i = 0; i < count; ++i) {
					dot = _markers[i];

					if (dot.tick < Renderer.tick) {
						_markers.splice(i, 1);
						i--;
						count--;
						continue;
					}

					if (dot.label) {
						continue;
					}

					_ctx.fillStyle = dot.color;
					_ctx.fillRect(projectX(dot.x) - 1, projectY(dot.y) - 4, 2, 8);
					_ctx.fillRect(projectX(dot.x) - 4, projectY(dot.y) - 1, 8, 2);
				}
			}

			// Render party members
			count = _party.length;
			for (i = 0; i < count; ++i) {
				dot = _party[i];
				_ctx.fillStyle = 'white';
				_ctx.fillRect(projectX(dot.x) - 3, projectY(dot.y) - 3, 6, 6);

				dot.color = MiniMap.getMemberColor(dot.key);

				_ctx.fillStyle = dot.color;
				_ctx.fillRect(projectX(dot.x) - 2, projectY(dot.y) - 2, 4, 4);
			}

			// Render guild members
			count = _guild.length;

			if (count) {
				_ctx.fillStyle = 'rgb(245,175,200)';
				_ctx.strokeStyle = 'white';
				_ctx.lineWidth = 2;
				for (i = 0; i < count; ++i) {
					dot = _guild[i];
					_ctx.beginPath();
					_ctx.moveTo(projectX(dot.x) + 0, projectY(dot.y) - 4);
					_ctx.lineTo(projectX(dot.x) + 4, projectY(dot.y) + 4);
					_ctx.lineTo(projectX(dot.x) - 4, projectY(dot.y) + 4);
					_ctx.lineTo(projectX(dot.x) + 0, projectY(dot.y) - 4);
				}
				_ctx.stroke();
				_ctx.fill();
			}
		};
	})();

	/**
	 * Create component and return it
	 */
	return UIManager.addComponent(MiniMap);
}
