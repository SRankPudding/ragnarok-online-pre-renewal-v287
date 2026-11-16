/**
 * UI/Components/WorldMap/AtlasMap.js
 *
 * World map rebuilt as a zoomable atlas: every zone is a tile drawn from the
 * zone's own sharp minimap picture, with readable names, the player's exact
 * position, mouse-wheel zoom, drag to move, full screen or window size.
 * Opens with M or the minimap's map button. Zone layout comes from DB/Map/WorldMap.js.
 */
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import Altitude from 'Renderer/Map/Altitude.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Session from 'Engine/SessionStorage.js';
import MAPS from 'DB/Map/WorldMap.js';
import { isEpisodeInRange } from 'DB/Map/NavigationEra.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import { getWorldAnchor } from './ClassGuides.js';

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 1024;
const MAX_ZOOM = 10; // times the fit-to-window size
const LABEL_MIN_TILE_PX = 62; // zone names appear once a tile is at least this wide on screen

const cssText = `
#AtlasMap { position: absolute; inset: 0; display: flex; flex-direction: column; box-sizing: border-box;
	background: #0d141d; color: #f3ead9; border: 1px solid #c9a55a; font-family: Arial, sans-serif; overflow: hidden; }
#AtlasMap .bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1a2636;
	border-bottom: 1px solid #c9a55a; font-size: 13px; flex: none; }
#AtlasMap .bar .where { flex: 1; color: #ffe19c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#AtlasMap .bar select, #AtlasMap .bar button { border: 1px solid #c9a55a; border-radius: 4px; padding: 4px 9px;
	background: #f2cf88; color: #241b12; cursor: pointer; font-size: 12px; }
#AtlasMap .bar .hint { color: #9fb2c8; font-size: 11px; }
#AtlasMap .view { position: relative; flex: 1; overflow: hidden; cursor: grab; background: #0d141d; }
#AtlasMap .view.dragging { cursor: grabbing; }
#AtlasMap .stage { position: absolute; left: 0; top: 0; width: ${BASE_WIDTH}px; height: ${BASE_HEIGHT}px; }
#AtlasMap .stage .bg { position: absolute; inset: 0; background-size: 100% 100%; background-repeat: no-repeat;
	pointer-events: none; }
#AtlasMap .stage.with-tiles .bg { opacity: 0.6; }
#AtlasMap .stage:not(.with-tiles) .tile { background-image: none !important; border-color: rgba(255, 230, 160, 0.12); }
#AtlasMap .stage:not(.with-tiles) .tile:hover { background-color: rgba(255, 243, 196, 0.18); }
#AtlasMap .tile { position: absolute; box-sizing: border-box; border: 1px solid rgba(255, 230, 160, 0.28);
	background-size: 100% 100%; cursor: pointer; }
#AtlasMap .tile:hover { border-color: #fff3c4; box-shadow: 0 0 0 1px #fff3c4 inset; z-index: 3; }
#AtlasMap .tile.current { border: 2px solid #5bd1ff; z-index: 4; }
#AtlasMap .tile .name { position: absolute; left: 0; right: 0; bottom: 2px; justify-content: center; white-space: nowrap;
	font-size: 12px; font-weight: bold; color: #ffffff; text-shadow: 0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000;
	pointer-events: none; display: none; }
#AtlasMap .tile.labelled .name, #AtlasMap .tile:hover .name { display: flex; }
#AtlasMap .tile:hover .name { z-index: 5; color: #ffe19c; }
#AtlasMap .player { position: absolute; width: 0; height: 0; z-index: 20; pointer-events: none; }
#AtlasMap .player .dot { position: absolute; left: -7px; top: -7px; width: 14px; height: 14px; border-radius: 50%;
	background: #29b6ff; border: 2px solid #ffffff; box-shadow: 0 0 8px 3px rgba(41, 182, 255, 0.9);
	animation: atlasPulse 1.2s ease-in-out infinite; }
#AtlasMap .player .tag { position: absolute; left: 12px; top: -9px; white-space: nowrap; font-size: 12px; font-weight: bold;
	color: #ffffff; background: rgba(13, 20, 29, 0.85); border: 1px solid #29b6ff; border-radius: 4px; padding: 1px 5px; }
@keyframes atlasPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
`;

const htmlText = `
<div id="AtlasMap">
	<div class="bar">
		<select class="region"></select>
		<span class="where"></span>
		<span class="hint">Wheel: zoom · Drag: move · Click a zone: route · M / Esc: close</span>
		<button type="button" class="findme">Find me</button>
		<button type="button" class="fit">Whole map</button>
		<button type="button" class="style">Style</button>
		<button type="button" class="tiles"></button>
		<button type="button" class="size"></button>
		<button type="button" class="close">X</button>
	</div>
	<div class="view"><div class="stage"></div></div>
</div>`;

// size: 0 = full screen, 1 = large window, 2 = small window
// style: which background picture; tiles: draw each zone's own picture over it
const _preferences = Preferences.get('AtlasMap', { size: 0, style: 0, tiles: false }, 1.3);
// Background pictures for the Midgard region, in the order the Style button cycles through
const MIDGARD_STYLES = [{ label: 'Original map', file: 'worldmap.jpg' }];
const SIZES = [
	{ label: 'Full screen', left: '0', top: '0', width: '100%', height: '100%' },
	{ label: 'Large window', left: '12%', top: '9%', width: '76%', height: '82%' },
	{ label: 'Small window', left: '56%', top: '14%', width: '42%', height: '52%' }
];

const AtlasMap = new GUIComponent('AtlasMap', cssText);

AtlasMap.render = () => htmlText;
AtlasMap.mouseMode = GUIComponent.MouseMode.STOP;

let _region = null;
let _tiles = [];
let _scale = 1;
let _fitScale = 1;
let _tx = 0;
let _ty = 0;
let _dragged = false;
let _timer;

function episode() {
	const conf = Configs.get('worldMapSettings', { episode: 98 });
	const value = Number(conf && conf.episode);
	// Out-of-range or missing settings would filter every zone away
	return value >= 0 && value < 99 ? value : 98;
}

function regions() {
	const list = MAPS.filter(map => isEpisodeInRange(map, episode()));
	return list.length ? list : MAPS;
}

function sections(region) {
	const list = region.maps.filter(section => isEpisodeInRange(section, episode()));
	return list.length ? list : region.maps;
}

function playerLocation() {
	const map = (MapRenderer.currentMap || '').replace(/\.(gat|rsw)$/i, '').toLowerCase();
	const position = Session.Entity ? Session.Entity.position : null;
	return { map, position, anchor: getWorldAnchor(map, position) };
}

function zoneName(section) {
	const info = DB.getMapInfo(section.id + '.rsw');
	return (info && info.displayName) || section.name || section.id;
}

function isOpen() {
	return !!(AtlasMap._host && AtlasMap._host.parentNode);
}

/** Place the window: whole screen, or a centered window */
function applySize() {
	const host = AtlasMap._host;
	const size = SIZES[_preferences.size] || SIZES[0];
	host.style.position = 'fixed';
	host.style.left = size.left;
	host.style.top = size.top;
	host.style.width = size.width;
	host.style.height = size.height;
	// The button names the size the next click switches to
	AtlasMap.getRoot().querySelector('.size').textContent = SIZES[(_preferences.size + 1) % SIZES.length].label;
}

/** Zone pictures on or off (off: only the painted background, zones still clickable) */
function applyTiles() {
	const root = AtlasMap.getRoot();
	root.querySelector('.stage').classList.toggle('with-tiles', !!_preferences.tiles);
	root.querySelector('.tiles').textContent = _preferences.tiles ? 'Zone pictures: on' : 'Zone pictures: off';
}

function applyTransform() {
	const root = AtlasMap.getRoot();
	const view = root.querySelector('.view');
	const stage = root.querySelector('.stage');
	// Keep the map from being dragged completely out of sight
	const margin = 120;
	_tx = Math.min(view.clientWidth - margin, Math.max(margin - BASE_WIDTH * _scale, _tx));
	_ty = Math.min(view.clientHeight - margin, Math.max(margin - BASE_HEIGHT * _scale, _ty));
	// Real pixel sizes instead of a CSS scale: text and pictures stay sharp at every zoom
	stage.style.left = Math.round(_tx) + 'px';
	stage.style.top = Math.round(_ty) + 'px';
	stage.style.width = Math.round(BASE_WIDTH * _scale) + 'px';
	stage.style.height = Math.round(BASE_HEIGHT * _scale) + 'px';

	for (const tile of _tiles) {
		tile.el.classList.toggle('labelled', tile.section.width * _scale >= LABEL_MIN_TILE_PX);
	}
}

/** The zone's own minimap picture: sharp at any zoom, unlike the painted overview */
function loadTileImage(tile) {
	tile.loaded = true;
	let path = DB.INTERFACE_PATH.replace('data/texture/', '') + 'map/' + tile.section.id + '.bmp';
	path = path.replace(/\//g, '\\');
	path = DB.mapalias[path] || path;
	Client.loadFile(`data/texture/${path}`, dataURI => {
		if (dataURI) {
			tile.el.style.backgroundImage = `url(${dataURI})`;
		}
	});
}

function fitWholeMap() {
	const view = AtlasMap.getRoot().querySelector('.view');
	_fitScale = Math.min(view.clientWidth / BASE_WIDTH, view.clientHeight / BASE_HEIGHT) || 1;
	_scale = _fitScale;
	_tx = (view.clientWidth - BASE_WIDTH * _scale) / 2;
	_ty = (view.clientHeight - BASE_HEIGHT * _scale) / 2;
	applyTransform();
}

function zoomAt(viewX, viewY, factor) {
	const next = Math.min(_fitScale * MAX_ZOOM, Math.max(_fitScale * 0.9, _scale * factor));
	if (next === _scale) return;
	_tx = viewX - (viewX - _tx) * (next / _scale);
	_ty = viewY - (viewY - _ty) * (next / _scale);
	_scale = next;
	applyTransform();
}

/** Where the player is on the stage, in base pixels (null when on another region) */
function playerPoint() {
	if (!_region) return null;
	const { map, position, anchor } = playerLocation();
	const list = sections(_region);
	const exact = list.find(section => section.id === map);
	const tile = exact || list.find(section => section.id === anchor);
	if (!tile) return null;
	if (exact && position && Altitude.width && Altitude.height) {
		return {
			x: tile.left + (position[0] / Altitude.width) * tile.width,
			y: tile.top + (1 - position[1] / Altitude.height) * tile.height,
			exact: true,
			tile
		};
	}
	return { x: tile.left + tile.width / 2, y: tile.top + tile.height / 2, exact: false, tile };
}

function updatePlayer() {
	if (!isOpen()) return;
	const root = AtlasMap.getRoot();
	const { map, position } = playerLocation();
	const point = playerPoint();
	const marker = root.querySelector('.player');

	const info = DB.getMapInfo(map + '.rsw');
	const label = info && info.displayName ? `${info.displayName} (${map})` : map;
	const coords = position ? ` · ${Math.floor(position[0])}, ${Math.floor(position[1])}` : '';
	let where = map ? `You are here: ${label}${coords}` : 'Location unavailable';
	if (map && !point) where += ' · not on this map, pick another region';
	else if (point && !point.exact) where += ` · inside, near ${zoneName(point.tile)}`;
	root.querySelector('.where').textContent = where;

	for (const tile of _tiles) {
		tile.el.classList.toggle('current', !!point && tile.section === point.tile);
	}
	if (!marker) return;
	marker.style.display = point ? '' : 'none';
	if (point) {
		marker.style.left = (point.x / BASE_WIDTH) * 100 + '%';
		marker.style.top = (point.y / BASE_HEIGHT) * 100 + '%';
		marker.querySelector('.tag').textContent = point.exact ? 'You' : 'You (inside)';
	}
}

function centerOnPlayer() {
	const point = playerPoint();
	if (!point) {
		// Player is on another region: switch to the one that has the zone
		const { map, anchor } = playerLocation();
		const home = regions().find(region => sections(region).some(s => s.id === map || s.id === anchor));
		if (home && home !== _region) {
			showRegion(home);
			centerOnPlayer();
		}
		return;
	}
	const view = AtlasMap.getRoot().querySelector('.view');
	_scale = Math.max(_scale, _fitScale * 3);
	_tx = view.clientWidth / 2 - point.x * _scale;
	_ty = view.clientHeight / 2 - point.y * _scale;
	applyTransform();
}

function showRegion(region) {
	_region = region;
	const root = AtlasMap.getRoot();
	const stage = root.querySelector('.stage');
	root.querySelector('.region').value = region.id;
	const fragment = document.createDocumentFragment();
	// The painted overview is low resolution: keep it dim behind the sharp zone tiles
	const background = document.createElement('div');
	background.className = 'bg';
	const style = MIDGARD_STYLES[_preferences.style] || MIDGARD_STYLES[0];
	const picture = region.id === 'worldmap.jpg' ? style.file : region.id;
	background.style.backgroundImage = `url(${new URL('./Maps/' + picture, import.meta.url).href})`;
	applyTiles();
	fragment.append(background);
	_tiles = [];
	for (const section of sections(region)) {
		const el = document.createElement('div');
		el.className = 'tile';
		el.style.left = (section.left / BASE_WIDTH) * 100 + '%';
		el.style.top = (section.top / BASE_HEIGHT) * 100 + '%';
		el.style.width = (section.width / BASE_WIDTH) * 100 + '%';
		el.style.height = (section.height / BASE_HEIGHT) * 100 + '%';
		const displayName = zoneName(section);
		el.title = `${displayName} (${section.id})`;
		const name = document.createElement('span');
		name.className = 'name';
		name.textContent = displayName;
		el.append(name);
		el.addEventListener('click', () => {
			if (_dragged) return;
			Navigation.show();
			if (Navigation.navigateToMap) {
				Navigation.navigateToMap(section.id, displayName);
			}
			Navigation.focus();
		});
		fragment.append(el);
		_tiles.push({ section, el, name, loaded: false });
	}
	const marker = document.createElement('div');
	marker.className = 'player';
	marker.innerHTML = '<div class="dot"></div><div class="tag">You</div>';
	fragment.append(marker);
	stage.replaceChildren(fragment);
	root.querySelector('.hint').textContent =
		`${_tiles.length} zones · Wheel: zoom · Drag: move · Click a zone: route · M / Esc: close`;

	// Load every zone's sharp picture, a few at a time
	_tiles.forEach((tile, index) => {
		setTimeout(() => {
			if (tile.el.isConnected && !tile.loaded) loadTileImage(tile);
		}, index * 12);
	});

	fitWholeMap();
	updatePlayer();
}

AtlasMap.init = function init() {
	const root = this.getRoot();
	const view = root.querySelector('.view');
	const select = root.querySelector('.region');
	this.draggable('.bar');

	for (const region of regions()) {
		const option = document.createElement('option');
		option.value = region.id;
		option.textContent = region.name;
		select.append(option);
	}
	select.addEventListener('change', () => {
		const region = regions().find(r => r.id === select.value);
		if (region) showRegion(region);
	});
	root.querySelectorAll('.bar select, .bar button').forEach(el => {
		el.addEventListener('mousedown', e => e.stopPropagation());
	});
	root.querySelector('.close').addEventListener('click', () => AtlasMap.remove());
	root.querySelector('.findme').addEventListener('click', () => centerOnPlayer());
	root.querySelector('.fit').addEventListener('click', () => fitWholeMap());
	root.querySelector('.style').addEventListener('click', () => {
		_preferences.style = (_preferences.style + 1) % MIDGARD_STYLES.length;
		_preferences.save();
		if (_region) {
			const scale = _scale;
			const tx = _tx;
			const ty = _ty;
			showRegion(_region);
			_scale = scale;
			_tx = tx;
			_ty = ty;
			applyTransform();
		}
	});
	root.querySelector('.tiles').addEventListener('click', () => {
		_preferences.tiles = !_preferences.tiles;
		_preferences.save();
		applyTiles();
	});
	root.querySelector('.size').addEventListener('click', () => {
		_preferences.size = (_preferences.size + 1) % SIZES.length;
		_preferences.save();
		applySize();
		fitWholeMap();
		centerOnPlayer();
	});

	view.addEventListener(
		'wheel',
		e => {
			e.preventDefault();
			e.stopPropagation();
			const rect = view.getBoundingClientRect();
			zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.2 : 1 / 1.2);
		},
		{ passive: false }
	);
	view.addEventListener('mousedown', e => {
		if (e.button !== 0) return;
		e.preventDefault();
		let lastX = e.clientX;
		let lastY = e.clientY;
		let moved = 0;
		_dragged = false;
		const onMove = event => {
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			moved += Math.abs(dx) + Math.abs(dy);
			if (moved > 5) {
				_dragged = true;
				view.classList.add('dragging');
				_tx += dx;
				_ty += dy;
				lastX = event.clientX;
				lastY = event.clientY;
				applyTransform();
			}
		};
		const onUp = () => {
			window.removeEventListener('mousemove', onMove, true);
			window.removeEventListener('mouseup', onUp, true);
			view.classList.remove('dragging');
			// Let the click that ends a drag pass without routing
			setTimeout(() => {
				_dragged = false;
			}, 0);
		};
		window.addEventListener('mousemove', onMove, true);
		window.addEventListener('mouseup', onUp, true);
	});
};

AtlasMap.onAppend = function onAppend() {
	applySize();
	const { map, anchor } = playerLocation();
	const list = regions();
	const home = list.find(region => sections(region).some(s => s.id === map || s.id === anchor)) || list[0];
	if (home) {
		showRegion(home);
		centerOnPlayer();
	}
	clearInterval(_timer);
	_timer = setInterval(updatePlayer, 500);
};

AtlasMap.onRemove = function onRemove() {
	clearInterval(_timer);
};

AtlasMap.onResize = function onResize() {
	if (isOpen()) fitWholeMap();
};

/** Open the map, or close it when it is open */
AtlasMap.toggle = function toggle() {
	if (isOpen()) {
		this.remove();
	} else if (Session.Entity && MapRenderer.currentMap) {
		this.append();
	}
};

// M opens and closes the map, Esc closes it. Not while typing in chat or any input.
window.addEventListener(
	'keydown',
	event => {
		if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
		if (event.code === 'Escape' && isOpen()) {
			AtlasMap.remove();
			return;
		}
		if (event.code !== 'KeyM') return;
		let focused = document.activeElement;
		while (focused && focused.shadowRoot && focused.shadowRoot.activeElement) {
			focused = focused.shadowRoot.activeElement;
		}
		if (focused && (focused.isContentEditable || focused.matches('input, textarea, select, [role="textbox"]'))) {
			return;
		}
		if (!isOpen() && (!Session.Entity || !MapRenderer.currentMap || MapRenderer.loading || Session.FreezeUI)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		AtlasMap.toggle();
	},
	true
);

export default UIManager.addComponent(AtlasMap);
