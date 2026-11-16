/**
 * UI/Components/WinStats/WinStatsCommon.js
 *
 * Shared factory for all WinStats versions.
 * Migrated to GUIComponent with native DOM APIs.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault, AoShinHo
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Session from 'Engine/SessionStorage.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import ClassGuide from 'UI/Components/ClassGuide/ClassGuide.js';
import { statBasics } from 'UI/Components/ClassGuide/StatsGuide.js';

const statusDescriptions = {
	...Object.fromEntries(statBasics.map(([name, description], i) => [3112 + i, name + ' — ' + description])),
	3118: 'ATK — Physical attack power.',
	3119: 'DEF — Reduces incoming physical damage.',
	3120: 'HIT — Helps physical attacks connect.',
	3121: 'CRIT — Affects the chance of a critical hit.',
	3122: 'Stat Points — Spend these to increase base stats.',
	3123: 'Status values include the bonuses from your equipped gear.',
	3124: 'MATK — Magic attack power.',
	3125: 'MDEF — Reduces incoming magic damage.',
	3126: 'FLEE — Helps dodge physical attacks.',
	3127: 'ASPD — Attack speed for normal attacks.'
};

/**
 * Factory: creates a WinStats GUIComponent
 *
 * @param {string}  name      - component name
 * @param {string}  htmlText  - raw HTML
 * @param {string}  cssText   - raw CSS
 * @param {boolean} hasTraits - whether this version has trait stats
 */
export function createWinStats({ name, htmlText, cssText, hasTraits }) {
	const Component = new GUIComponent(name, cssText);
	Component.render = () => htmlText.replace(/data-text="(311[2-9]|312[0-7])"><\/span>/g,
		(match, id) => statusDescriptions[id] ? '>' + statusDescriptions[id] + '</span>' : match);

	const _preferences = Preferences.get('WinStats', { x: 0, y: 233, show: false, reduce: false }, 1.0);

	let _root;
	let equipmentStatus;

	// ─── Helpers ───────────────────────────────────────

	function setText(selector, value) {
		const el = _root.querySelector(selector);
		if (el) el.textContent = value;
		const mirror = equipmentStatus?.querySelector(selector);
		if (mirror) mirror.textContent = value;
	}

	function setUpVisibility(selector, visible) {
		const el = _root.querySelector(selector);
		if (el) {
			el.style.opacity = visible ? 1 : 0;
			el.style.pointerEvents = visible ? 'initial' : 'none';
		}
		const mirror = equipmentStatus?.querySelector(selector);
		if (mirror) {
			mirror.style.opacity = visible ? 1 : 0;
			mirror.style.pointerEvents = visible ? 'initial' : 'none';
		}
	}

	// ─── Stat button map ──────────────────────────────

	const statButtonMap = {
		str: 13,
		agi: 14,
		vit: 15,
		int: 16,
		dex: 17,
		luk: 18
	};

	const traitButtonMap = {
		pow: 219,
		sta: 220,
		wis: 221,
		spl: 222,
		con: 223,
		crt: 224
	};

	// ─── init ──────────────────────────────────────────

	Component.init = function init() {
		this.statuspoint = 0;
		this.t_statuspoint = 0;

		this.draggable('.titlebar');

		_root = this.getRoot();
		const guide = document.createElement('button');
		guide.className = 'status-guide';
		guide.type = 'button';
		guide.textContent = 'Stats Guide';
		guide.style.cssText = 'display:block;width:100%;padding:4px;background:#24364d;color:#f7eee1;border:1px solid #b88b47;cursor:pointer';
		guide.addEventListener('mousedown', event => event.stopPropagation());
		guide.addEventListener('click', () => ClassGuide.showStats());
		_root.querySelector('.common_stats')?.after(guide);

		// Base stat up buttons
		const upButtons = _root.querySelectorAll('.up button');
		upButtons.forEach(btn => {
			btn.addEventListener('mousedown', () => {
				const id = statButtonMap[btn.className];
				if (id) Component.onRequestUpdate(id, 1);
			});
		});

		// Trait stat up buttons
		if (hasTraits) {
			const tUpButtons = _root.querySelectorAll('.t_up button');
			tUpButtons.forEach(btn => {
				btn.addEventListener('mousedown', () => {
					const id = traitButtonMap[btn.className];
					if (id) Component.onRequestUpdate(id, 1);
				});
			});
		}

		// Titlebar mini
		const miniBtn = _root.querySelector('.titlebar .mini');
		if (miniBtn) {
			miniBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
			miniBtn.addEventListener('click', () => {
				const panel = _root.querySelector('.panel');
				if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
			});
		}

		// Titlebar close
		const closeBtn = _root.querySelector('.titlebar .close');
		if (closeBtn) {
			closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
			closeBtn.addEventListener('click', () => {
				this._host.style.display = 'none';
			});
		}

		// View traits toggle
		if (hasTraits) {
			const viewTraitsBtn = _root.querySelector('.view_traits');
			if (viewTraitsBtn) {
				viewTraitsBtn.addEventListener('mousedown', () => toggleTraits());
			}
		}
	};

	Component.attachEquipmentStatus = function attachEquipmentStatus(mount) {
		if (!this.__loaded) this.prepare();
		if (equipmentStatus?.host === mount) return;
		const original = _root.querySelector('#WinStats');
		if (!original) return;

		equipmentStatus = mount.shadowRoot || mount.attachShadow({ mode: 'open' });
		const copy = original.cloneNode(true);
		copy.querySelector('.titlebar')?.remove();
		copy.querySelector('.traits_component')?.remove();
		copy.querySelector('.view_traits')?.remove();
		copy.querySelector('#winstat_footer')?.remove();
		const panel = copy.querySelector('.panel');
		if (panel) panel.style.display = '';
		const styles = document.createElement('style');
		styles.textContent = cssText + `
			:host { display:block; inset:auto !important; height:auto; }
			:host([hidden]) { display:none; }
			#WinStats { position:relative; width:100%; height:auto; color:#2b1d14; }
			#WinStats .panel { width:100%; height:auto; background:transparent; }
			#WinStats .common_stats { position:relative; min-height:114px; background:transparent; color:#2b1d14; box-shadow:none; }
			#WinStats .common_stats .group { top:8px; }
			#WinStats .common_stats .up { top:4px; }
			#WinStats .status-guide { width:calc(100% - 16px) !important; margin:0 8px 8px;
				background:#f3d98c !important; color:#2b1d14 !important; border:1px solid #a67c1e !important;
				border-radius:5px; }
		`;
		copy.querySelectorAll('.up button').forEach(button => {
			button.addEventListener('mousedown', event => {
				event.stopPropagation();
				const id = statButtonMap[button.className];
				if (id && button.style.pointerEvents !== 'none') Component.onRequestUpdate(id, 1);
			});
		});
		copy.querySelector('.status-guide')?.addEventListener('click', () => ClassGuide.showStats());
		copy.addEventListener('mousedown', event => event.stopPropagation());
		copy.addEventListener('mouseup', event => event.stopPropagation());
		equipmentStatus.replaceChildren(styles, copy);
	};

	// ─── stack ─────────────────────────────────────────

	Component.stack = [];

	// ─── Embed mode ────────────────────────────────────

	const EMBED_CSS = `
		.titlebar { display: none !important; }
		.group { top: 6px !important; }
		.column1 { top: 5px !important; }
		.column2 { top: 5px !important; }
		.up { top: 2px !important; }
	`;

	let _embedStyleEl = null;
	let _embedAnchor = null;
	let _embedObserver = null;

	Component.embed = function embed(anchorHost) {
		// Ensure component is prepared (has _shadow/_host)
		if (!this.__loaded) {
			this.prepare();
		}
		// Ensure component is in the DOM
		if (!this._host.parentNode) {
			document.body.appendChild(this._host);
		}

		// Disconnect previous observer if re-embedding
		if (_embedObserver) {
			_embedObserver.disconnect();
			_embedObserver = null;
		}

		_embedAnchor = anchorHost;

		// Inject embed CSS into shadow
		if (!_embedStyleEl) {
			_embedStyleEl = document.createElement('style');
			_embedStyleEl.textContent = EMBED_CSS;
		}
		if (!_embedStyleEl.parentNode) {
			this._shadow.appendChild(_embedStyleEl);
		}

		// Position below anchor
		const syncPosition = () => {
			const rect = anchorHost.getBoundingClientRect();
			this._host.style.left = rect.left + 'px';
			this._host.style.top = rect.top + rect.height + 'px';
		};
		syncPosition();

		// Observe anchor movement
		_embedObserver = new MutationObserver(syncPosition);
		_embedObserver.observe(anchorHost, { attributes: true, attributeFilter: ['style'] });

		this._host.style.display = '';
	};

	Component.unembed = function unembed() {
		if (_embedStyleEl && _embedStyleEl.parentNode) {
			_embedStyleEl.parentNode.removeChild(_embedStyleEl);
		}
		if (_embedObserver) {
			_embedObserver.disconnect();
			_embedObserver = null;
		}
		_embedAnchor = null;
		this._host.style.display = 'none';
	};

	Component.isEmbedded = function isEmbedded() {
		return _embedAnchor !== null;
	};

	// ─── toggle ────────────────────────────────────────
	Component.toggle = function toggle() {
		// If embedded, unembed instead of normal toggle
		if (_embedAnchor) {
			this.unembed();
			return;
		}

		if (this._host.style.display === 'none') {
			this._host.style.display = '';
			this.focus();
		} else {
			this._host.style.display = 'none';
		}
	};

	// ─── onAppend ──────────────────────────────────────

	Component.onAppend = function onAppend() {
		for (let i = 0, count = this.stack.length; i < count; ++i) {
			this.update.apply(this, this.stack[i]);
		}
		this.stack.length = 0;

		if (!_embedAnchor) {
			this._host.style.top =
				Math.min(Math.max(0, _preferences.y), Renderer.height - (this._host.offsetHeight || 140)) + 'px';
			this._host.style.left =
				Math.min(Math.max(0, _preferences.x), Renderer.width - (this._host.offsetWidth || 280)) + 'px';
		}

		if (!_preferences.show && !_embedAnchor) {
			this._host.style.display = 'none';
		}
	};

	const _origFix = Component._fixPositionOverflow;
	Component._fixPositionOverflow = function () {
		if (!_embedAnchor) _origFix.call(this);
	};

	// ─── update ────────────────────────────────────────

	Component.update = function update(type, val) {
		let str;

		if (!this.__loaded) {
			this.stack.push(arguments);
			return;
		}

		switch (type) {
			// ── Status points ──
			case 'statuspoint':
				this.statuspoint = val;
				_root.querySelectorAll('.requirements div').forEach(div => {
					const req = parseInt(div.textContent, 10);
					setUpVisibility('.up .' + div.className, req > 0 && req <= val);
				});
				setText('.' + type, val);
				break;

			// ── Trait points ──
			case 'trait_point':
				this.t_statuspoint = val;
				_root.querySelectorAll('.t_requirements div').forEach(div => {
					const req = parseInt(div.textContent, 10);
					setUpVisibility('.t_up .' + div.className, req > 0 && req <= val);
				});
				setText('.trait_point', val);
				break;

			// ── Simple text values ──
			case 'guildname':
			case 'atak':
			case 'matak':
			case 'def':
			case 'mdef':
			case 'hit':
			case 'flee':
			case 'critical':
			case 'patk':
			case 'smatk':
			case 'hplus':
			case 'crate':
			case 'res':
			case 'mres':
				setText('.' + type, val);
				break;

			// ── ASPD ──
			case 'aspd':
				setText('.' + type, Math.floor(200 - val / 10));
				break;

			// ── Plus values ──
			case 'matak2':
				if (!Session.isRenewal) {
					setText('.' + type, '~ ' + val);
					break;
				}
			// falls through
			case 'atak2':
			case 'def2':
			case 'mdef2':
			case 'flee2':
				str = val < 0 ? '- ' + -val : '+ ' + val;
				setText('.' + type, str);
				break;

			// ── Base stats ──
			case 'str':
			case 'agi':
			case 'vit':
			case 'int':
			case 'dex':
			case 'luk':
			// ── Trait stats ──
			case 'pow':
			case 'sta':
			case 'wis':
			case 'spl':
			case 'con':
			case 'crt':
				setText('.stats .' + type, val);
				break;

			// ── Base bonus ──
			case 'str2':
			case 'agi2':
			case 'vit2':
			case 'int2':
			case 'dex2':
			case 'luk2':
			// ── Trait bonus ──
			case 'pow2':
			case 'sta2':
			case 'wis2':
			case 'spl2':
			case 'con2':
			case 'crt2':
				str = val < 0 ? '- ' + -val : val > 0 ? '+' + val : '';
				setText('.bonus .' + type.replace('2', ''), str);
				break;

			// ── Base requirements ──
			case 'str3':
			case 'agi3':
			case 'vit3':
			case 'int3':
			case 'dex3':
			case 'luk3':
				setText('.requirements .' + type.replace('3', ''), val);
				setUpVisibility('.up .' + type.replace('3', ''), val > 0 && val <= this.statuspoint);
				break;

			// ── Trait requirements ──
			case 'pow3':
			case 'sta3':
			case 'wis3':
			case 'spl3':
			case 'con3':
			case 'crt3':
				setText('.t_requirements .' + type.replace('3', ''), val);
				setUpVisibility('.t_up .' + type.replace('3', ''), val > 0 && val <= this.t_statuspoint);
				break;
		}
	};

	// ─── toggleTraits ─────────────────────────────

	function toggleTraits() {
		const traitsEl = _root.querySelector('.traits_component');
		const selfBtn = _root.querySelector('.view_traits');
		if (!traitsEl) return;

		const isVisible = traitsEl.style.display !== 'none';
		traitsEl.style.display = isVisible ? 'none' : '';
		const state = isVisible ? 'on' : 'off';

		Client.loadFile(DB.INTERFACE_PATH + 'statuswnd/expand_' + state + '_normal.bmp', function (data) {
			if (selfBtn) selfBtn.style.backgroundImage = 'url(' + data + ')';
		});
	}

	// ─── onShortCut ────────────────────────────────────

	Component.onShortCut = function onShortCut(key) {
		switch (key.cmd) {
			case 'TOGGLE':
				this.toggle();
				break;
		}
	};

	// ─── onRemove ──────────────────────────────────────

	Component.onRemove = function onRemove() {
		if (_preferences) {
			// Don't save embed-relative position/show as standalone preferences
			if (!_embedAnchor) {
				_preferences.show = this._host.style.display !== 'none';
				_preferences.x = parseInt(this._host.style.left, 10);
				_preferences.y = parseInt(this._host.style.top, 10);
			}
			const panel = _root.querySelector('.panel');
			_preferences.reduce = panel ? panel.style.display === 'none' : false;
			_preferences.save();
		}
	};

	// ─── Abstract ──────────────────────────────────────

	Component.onRequestUpdate = function onRequestUpdate(/*id, amount*/) {};

	return UIManager.addComponent(Component);
}
