/**
 * UI/Components/NpcMenu/NpcMenu.js
 *
 * Display npc menu
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import KEYS from 'Controls/KeyEventHandler.js';
import DB from 'DB/DBManager.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './NpcMenu.html?raw';
import cssText from './NpcMenu.css?raw';
import InputBox from 'UI/Components/InputBox/InputBox.js';

/**
 * Create NPC Menu component
 */
const NpcMenu = new GUIComponent('NpcMenu', cssText);

NpcMenu.render = () => htmlText;

/**
 * Freeze mouse — NPC menu blocks interaction
 */
NpcMenu.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * @var {number} index selected in menu
 */
let _index = 0;

/**
 * @var {number} NPC ID
 */
let _ownerID = 0;

/**
 * @var {number} time the current menu appeared (a double-click must not pick an option in the next menu)
 */
let _shownAt = 0;

/**
 * Pictures for menu entries, by label
 */
const _menuIcons = [
	[/^weapons?\b/i, '\u2694\uFE0F'],
	[/^(armou?r|shields?)\b/i, '\uD83D\uDEE1\uFE0F'],
	[/^metals?\b|\bores?\b/i, '\u26CF\uFE0F'],
	[/^potions?\b/i, '\uD83E\uDDEA'],
	[/^cooking\b|^food\b/i, '\uD83C\uDF72'],
	[/converters?\b/i, '\uD83D\uDD25'],
	[/guide\b/i, '\uD83D\uDCD6'],
	[/^refine\b/i, '\u2728'],
	[/^repair\b/i, '\uD83D\uDD27'],
	[/^(close|cancel|back|leave|nothing)\b/i, '\u21A9\uFE0F']
];

/**
 * Helper: escape HTML
 */
function _escapeHTML(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Initialize component
 */
NpcMenu.init = function init() {
	const root = NpcMenu.getRoot();

	const okBtn = root.querySelector('.ok');
	if (okBtn) {
		okBtn.addEventListener('click', () => validate());
	}

	const cancelBtn = root.querySelector('.cancel');
	if (cancelBtn) {
		cancelBtn.addEventListener('click', () => cancel());
	}

	this._host.style.top = `${Math.min(Math.max(12, Renderer.height - 545), Math.max(130, Renderer.height / 2 - 80))}px`;
	this._host.style.left = `${Math.max(Renderer.width / 3, 20)}px`;

	this.draggable();

	const content = root.querySelector('.content');
	if (content) {
		content.addEventListener('mousedown', e => {
			const div = e.target.closest('div[data-index]');
			if (div && content.contains(div)) {
				selectIndex(div);
			}
			e.stopImmediatePropagation();
		});

		// One click on a row picks it (the row is already selected by mousedown)
		content.addEventListener('click', e => {
			const div = e.target.closest('div[data-index]');
			if (div && content.contains(div) && Date.now() - _shownAt > 400) {
				selectIndex(div);
				validate();
			}
		});

		content.addEventListener('dblclick', e => {
			const div = e.target.closest('div[data-index]');
			if (div && content.contains(div) && Date.now() - _shownAt > 400) {
				validate();
			}
		});
	}
};

/**
 * Clean up events
 */
NpcMenu.onRemove = function onRemove() {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	if (content) {
		content.innerHTML = '';
	}
};

/**
 * Bind KeyDown event
 */
NpcMenu.onKeyDown = function onKeyDown(event) {
	if (InputBox._host && InputBox._host.style.display !== 'none' && InputBox.__active) {
		return true;
	}

	if (this._host.style.display === 'none') {
		return true;
	}

	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');

	switch (event.which) {
		case KEYS.SPACE:
		case KEYS.ENTER:
			validate();
			break;

		case KEYS.ESCAPE:
			cancel();
			break;

		case KEYS.UP: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.max(_index - 1, 0);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		case KEYS.DOWN: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.min(_index + 1, divs.length - 1);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		default:
			return true;
	}

	event.stopImmediatePropagation();
	return false;
};

/**
 * Initialize menu
 *
 * @param {string} menu
 * @param {number} gid - npc id
 */
NpcMenu.setMenu = function setMenu(menu, gid) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const list = menu.split(':');

	_ownerID = gid;
	_index = 0;
	_shownAt = Date.now();

	content.innerHTML = '';

	let j = 0;
	for (let i = 0, count = list.length; i < count; ++i) {
		if (list[i].length) {
			const div = document.createElement('div');
			const questOption = list[i] === 'Report to the guard' || list[i].startsWith('[Quest] ');
			const label = list[i].replace(/^\[Quest\] /, '');
			div.innerHTML = DB.formatMsgToHtml(_escapeHTML(label));
			if (questOption) {
				const icon = document.createElement('strong');
				icon.className = 'npc-quest-option';
				icon.textContent = '!';
				icon.title = 'Quest';
				div.prepend(icon);
			}
			div.dataset.index = j++;
			content.appendChild(div);
		}
	}

	// Known menu entries get a picture; a menu made of them is shown as tiles instead of a list
	let pictured = 0;
	content.querySelectorAll('div[data-index]').forEach(div => {
		const icon = _menuIcons.find(([pattern]) => pattern.test(div.textContent));
		if (icon) {
			const picture = document.createElement('span');
			picture.className = 'npc-option-icon';
			picture.textContent = icon[1];
			div.prepend(picture);
			pictured++;
		}
	});
	content.classList.toggle('tiles', pictured >= 4);

	const first = content.querySelector('div[data-index]');
	if (first) {
		first.classList.add('selected');
	}

	// Sit directly under the NPC dialogue (or beside it when there is no room below)
	const box = UIManager.components.NpcBox;
	if (box && box._host && box._host.isConnected && box._host.style.display !== 'none') {
		const rect = box._host.getBoundingClientRect();
		const below = rect.bottom + 6 + this._host.offsetHeight <= Renderer.height;
		const beside = rect.right + 6 + this._host.offsetWidth <= Renderer.width;
		if (below || beside) {
			this._host.style.top = `${below ? rect.bottom + 6 : rect.top}px`;
			this._host.style.left = `${below ? rect.left : rect.right + 6}px`;
		}
	}
};

/**
 * Submit an index
 */
function validate() {
	// The server kicks the player on choice 0 (clif_parse_NpcSelectMenu), so never send a choice that is not an item
	if (!Number.isInteger(_index) || _index < 0) {
		return;
	}
	NpcMenu.onSelectMenu(_ownerID, _index + 1);
}

/**
 * Pressed cancel, client send "255" as value
 */
function cancel() {
	NpcMenu.onSelectMenu(_ownerID, 255);
}

/**
 * Select an index, change background color
 */
function selectIndex(div) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const divs = content.querySelectorAll('div[data-index]');
	divs.forEach(d => d.classList.remove('selected'));
	div.classList.add('selected');

	_index = parseInt(div.dataset.index, 10);
}

/**
 * Abstract callback to define
 */
NpcMenu.onSelectMenu = function onSelectMenu(/* gid, index */) {};

/**
 * Create component and export it
 */
export default UIManager.addComponent(NpcMenu);
