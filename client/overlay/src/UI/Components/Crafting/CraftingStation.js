/**
 * UI/Components/Crafting/CraftingStation.js
 *
 * Crafting station: every recipe in one window that stays open. Recipes on the left,
 * the cauldron with the result and its ingredients on the right, back/forward like a browser.
 * Crafting itself is done by the server command "@srocraft <recipe index>".
 * The Crafting Guide is a second window that explains the system and where materials come from.
 */
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import { startQuestNavigation } from 'UI/Components/Quest/QuestHelperCommon.js';
import { craftingCategories, craftingRecipes, craftingSources } from 'DB/Map/CraftingData.js';

const format = new Intl.NumberFormat();
const categoryIcons = ['⚔️', '⛏️', '🧪', '🍲', '🔥'];
const recipesByResult = new Map();
const recipesByMaterial = new Map();
craftingRecipes.forEach(([id, , , ingredients], index) => {
	if (!recipesByResult.has(id)) recipesByResult.set(id, index);
	for (const [material] of ingredients) {
		if (!recipesByMaterial.has(material)) recipesByMaterial.set(material, new Set());
		recipesByMaterial.get(material).add(id);
	}
});

const css = `
.sro-craft, .sro-craft-guide { position: fixed; z-index: 110; box-sizing: border-box; display: flex; flex-direction: column;
	color: #f4e9d0; font: 13px/1.4 "Segoe UI", sans-serif; border: 1px solid #b9954a; border-radius: 12px;
	background: linear-gradient(160deg, #2a1d33f5, #17111ef5); box-shadow: 0 18px 50px #000a; overflow: hidden; }
.sro-craft { left: calc(50vw - 440px); top: calc(50vh - 290px); width: 880px; height: 580px; max-width: 98vw; max-height: 96vh; }
.sro-craft-guide { left: calc(50vw - 330px); top: calc(50vh - 280px); width: 660px; height: 560px; max-width: 98vw; max-height: 96vh; }
.sro-craft header, .sro-craft-guide header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; cursor: move;
	background: linear-gradient(#4a2a55, #34203f); border-bottom: 1px solid #b9954a; color: #f7d88f; font-weight: 600; font-size: 15px; }
.sro-craft header span, .sro-craft-guide header span { flex: 1; }
.sro-craft button, .sro-craft-guide button { font: inherit; cursor: pointer; color: #f4e9d0; border: 1px solid #b9954a88; border-radius: 7px;
	background: #ffffff14; padding: 4px 10px; }
.sro-craft button:hover:not(:disabled), .sro-craft-guide button:hover { background: #ffffff2e; }
.sro-craft button:disabled { opacity: 0.4; cursor: default; }
.sro-craft .body { flex: 1; display: grid; grid-template-columns: 300px 1fr; min-height: 0; }
.sro-craft .side { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid #b9954a55; padding: 10px; gap: 8px; }
.sro-craft .cats { display: flex; flex-wrap: wrap; gap: 4px; }
.sro-craft .cats button.on { background: #f3d98c; color: #2b1d14; border-color: #f3d98c; font-weight: 600; }
.sro-craft input[type=search] { font: inherit; padding: 5px 8px; border-radius: 7px; border: 1px solid #b9954a88; background: #0006; color: #fff6e0; }
.sro-craft label { display: flex; align-items: center; gap: 6px; color: #c9b27a; }
.sro-craft .list { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #b9954a transparent; }
.sro-craft .row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 7px; cursor: pointer; }
.sro-craft .row:hover { background: #ffffff14; }
.sro-craft .row.on { background: #f3d98c2e; box-shadow: inset 3px 0 0 #f3d98c; }
.sro-craft .row img, .sro-craft .slot img { width: 24px; height: 24px; image-rendering: pixelated; }
.sro-craft .row b { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sro-craft .row i { width: 9px; height: 9px; border-radius: 50%; background: #ffffff30; }
.sro-craft .row.can i { background: #7be08f; box-shadow: 0 0 6px #7be08f; }
.sro-craft .station { display: flex; flex-direction: column; align-items: center; padding: 14px 18px; gap: 10px; min-height: 0; overflow-y: auto; }
.sro-craft .station h2 { margin: 0; font-size: 18px; color: #f7d88f; text-align: center; }
.sro-craft .station small { color: #c9b27a; }
.sro-craft .pot { position: relative; width: 150px; height: 128px; flex: none; }
.sro-craft .pot::before { content: ''; position: absolute; left: 5px; right: 5px; top: 22px; bottom: 0; border-radius: 22px 22px 70px 70px / 18px 18px 74px 74px;
	background: radial-gradient(circle at 35% 25%, #6d6474, #2b2531 62%, #141018); border: 2px solid #8a7a52; box-shadow: 0 10px 22px #000a; }
.sro-craft .pot::after { content: ''; position: absolute; left: 0; right: 0; top: 12px; height: 26px; border-radius: 50%;
	background: radial-gradient(ellipse at center, #f6c35f 0, #b8641d 55%, #4a2410 100%); border: 3px solid #a08b5c; box-shadow: 0 0 22px #f6a53c88; }
.sro-craft .pot img { position: absolute; z-index: 1; left: 51px; top: 50px; width: 48px; height: 48px; image-rendering: pixelated; filter: drop-shadow(0 2px 4px #000); }
.sro-craft .pot.done { animation: sro-craft-pop 0.6s; }
@keyframes sro-craft-pop { 40% { transform: scale(1.08); filter: brightness(1.5); } }
.sro-craft .slots { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.sro-craft .slot { width: 104px; padding: 8px 6px; text-align: center; border-radius: 10px; border: 1px solid #7be08f88; background: #7be08f14; cursor: pointer; }
.sro-craft .slot.missing { border: 1px dashed #e0787888; background: #e0787812; }
.sro-craft .slot.missing img { filter: grayscale(1); opacity: 0.45; }
.sro-craft .slot div { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sro-craft .slot strong { display: block; color: #7be08f; }
.sro-craft .slot.missing strong { color: #ff9a9a; }
.sro-craft .slot em { font-style: normal; font-size: 11px; color: #c9b27a; }
.sro-craft .where { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 9px; background: #0005; border: 1px solid #b9954a55; }
.sro-craft .where p, .sro-craft-guide p { margin: 3px 0; }
.sro-craft .where button, .sro-craft-guide .list button { padding: 1px 8px; margin-left: 6px; }
.sro-craft footer { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-top: 1px solid #b9954a55; background: #0004; }
.sro-craft footer .fee { font-weight: 600; }
.sro-craft footer .fee.short { color: #ff9a9a; }
.sro-craft footer [role=status] { flex: 1; color: #c9b27a; }
.sro-craft footer .make { background: linear-gradient(#f9dd94, #d6a445); color: #2b1d14; border: 0; font-weight: 700; padding: 7px 18px; }
.sro-craft footer .make:hover:not(:disabled) { background: linear-gradient(#ffe9ae, #e2b253); }
.sro-craft-guide .tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 12px 0; }
.sro-craft-guide .tabs button.on { background: #f3d98c; color: #2b1d14; border-color: #f3d98c; font-weight: 600; }
.sro-craft-guide .list { flex: 1; overflow-y: auto; padding: 8px 14px 12px; scrollbar-width: thin; scrollbar-color: #b9954a transparent; }
.sro-craft-guide article { padding: 8px 10px; margin: 6px 0; border-radius: 9px; background: #ffffff0f; border: 1px solid #b9954a44; }
.sro-craft-guide article strong { color: #f7d88f; }
.sro-craft-guide article img { width: 24px; height: 24px; image-rendering: pixelated; vertical-align: middle; margin-right: 6px; }
.sro-craft-details { z-index: 111; left: max(1vw, calc(50vw - 225px)); top: max(2vh, calc(50vh - 230px));
	width: 450px; height: auto; max-height: min(84vh, 550px); }
.sro-craft-details .item-description { white-space: pre-line; }
.sro-craft-details h3 { margin: 12px 0 4px; color: #f7d88f; font-size: 13px; }
`;

let stylesheet;
let station;
let guide;
let itemDetails;
const positions = {};

function itemName(id) {
	const info = DB.getItemInfo(id);
	return (info && info.identifiedDisplayName) || 'Item ' + id;
}

function itemIcon(id) {
	const icon = document.createElement('img');
	icon.alt = '';
	const info = DB.getItemInfo(id);
	if (info && info.identifiedResourceName) {
		Client.loadFile(DB.INTERFACE_PATH + 'item/' + info.identifiedResourceName + '.bmp', data => {
			icon.src = data;
		});
	}
	return icon;
}

function owned(id) {
	return (Inventory.list || []).reduce((count, item) => (item?.ITID === id ? count + (Number(item.count) || 1) : count), 0);
}

function canMake(index) {
	const [, , fee, materials] = craftingRecipes[index];
	return Session.zeny >= fee && materials.every(([id, amount]) => owned(id) >= Math.max(1, amount));
}

function send(command) {
	const name = Session.Entity?.display?.name;
	if (!name || Session.FreezeUI) return false;
	const packet = new PACKET.CZ.REQUEST_CHAT();
	packet.msg = name + ' : ' + command;
	Network.sendPacket(packet);
	return true;
}

/** A floating panel like the Enchantment window: stops clicks reaching the map, draggable by its header */
function createPanel(className, title) {
	if (!stylesheet) {
		stylesheet = document.createElement('style');
		stylesheet.textContent = css;
		document.head.append(stylesheet);
	}
	const panel = document.createElement('section');
	panel.className = className;
	panel.tabIndex = -1;
	for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'keyup', 'keypress']) {
		panel.addEventListener(type, event => event.stopPropagation());
	}
	const header = document.createElement('header');
	const label = document.createElement('span');
	label.textContent = title;
	header.append(label);
	panel.append(header);
	const move = (left, top) => {
		positions[className] = [
			Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth)),
			Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight))
		];
		panel.style.left = positions[className][0] + 'px';
		panel.style.top = positions[className][1] + 'px';
	};
	let drag;
	header.onpointerdown = event => {
		if (!event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
		const rect = panel.getBoundingClientRect();
		drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
		header.setPointerCapture(event.pointerId);
	};
	header.onpointermove = event => {
		if (drag && event.isPrimary) move(event.clientX - drag.x, event.clientY - drag.y);
	};
	header.onlostpointercapture = () => {
		drag = null;
	};
	document.body.append(panel);
	if (positions[className]) move(...positions[className]);
	return { panel, header };
}

function button(text, onClick, title) {
	const element = document.createElement('button');
	element.type = 'button';
	element.textContent = text;
	if (title) element.title = title;
	element.addEventListener('click', onClick);
	return element;
}

/** Lines that say where a material comes from, with route buttons */
function sourceLines(id) {
	const lines = [];
	const recipe = recipesByResult.get(id);
	if (recipe !== undefined) {
		const line = document.createElement('p');
		line.textContent = 'Can be crafted here (' + craftingCategories[craftingRecipes[recipe][1]] + ').';
		lines.push(line);
	}
	const [monsters, shops] = craftingSources[id] || [[], []];
	for (const [npc, target] of shops) {
		const line = document.createElement('p');
		const map = target.split(',')[0];
		line.textContent = 'Sold by ' + npc + ' · ' + (DB.getMapName(map + '.rsw', '') || map);
		line.append(button('➜ Route', () => startQuestNavigation({ target, label: npc, classGuide: false })));
		lines.push(line);
	}
	for (const [monster, level, map] of monsters) {
		const line = document.createElement('p');
		const place = DB.getMapName(map + '.rsw', '') || map;
		line.textContent = 'Dropped by ' + monster + ' (Lv ' + level + ') · ' + place;
		line.append(button('➜ Route', () => {
			Navigation.show();
			Navigation.navigateToMap(map, monster + ' · ' + place);
			Navigation.setMinimized(true);
		}));
		lines.push(line);
	}
	if (!lines.length) {
		const line = document.createElement('p');
		line.textContent = 'No known monster or shop. It may come from a quest, a skill or the general loot.';
		lines.push(line);
	}
	return lines;
}

function inspectOnRightClick(element, id) {
	element.addEventListener('contextmenu', event => {
		event.preventDefault();
		event.stopPropagation();
		showItemDetails(id);
	});
}

function showItemDetails(id) {
	itemDetails?.remove();
	const { panel, header } = createPanel('sro-craft-guide sro-craft-details', itemName(id));
	itemDetails = panel;
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', itemName(id));
	const close = () => {
		panel.remove();
		itemDetails = null;
	};
	header.prepend(itemIcon(id));
	header.querySelector('img').style.cssText = 'width:24px;height:24px;image-rendering:pixelated';
	header.append(button('✕', close, 'Close item details'));
	panel.addEventListener('keydown', event => {
		if (event.key === 'Escape') close();
	});

	const body = document.createElement('div');
	body.className = 'list';
	const description = document.createElement('p');
	description.className = 'item-description';
	const raw = DB.getItemInfo(id)?.identifiedDescriptionName;
	const text = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
	description.textContent = text.replace(/\^[0-9a-f]{6}/gi, '').trim() || 'No item description available.';
	body.append(description);

	const results = recipesByMaterial.get(id);
	if (results?.size) {
		const heading = document.createElement('h3');
		heading.textContent = 'Used in recipes';
		const uses = document.createElement('p');
		uses.textContent = [...results].map(itemName).join(', ');
		body.append(heading, uses);
	}
	const heading = document.createElement('h3');
	heading.textContent = 'Where to get it';
	body.append(heading, ...sourceLines(id));
	panel.append(body);
	panel.focus({ preventScroll: true });
}

export function closeCrafting() {
	station?.close();
	itemDetails?.remove();
	itemDetails = null;
}

export function toggleCrafting() {
	if (station) {
		station.close();
		return;
	}
	const { panel, header } = createPanel('sro-craft', 'Crafting');
	let category = -1;
	let only = false;
	let query = '';
	let current = -1;
	let focusMaterial = 0;
	const history = [];
	let cursor = -1;
	let pending;
	let queue = 0;

	const back = button('◀', () => go(cursor - 1), 'Back');
	const forward = button('▶', () => go(cursor + 1), 'Forward');
	header.prepend(back, forward);
	header.append(
		button('📖 Guide', () => openCraftingGuide()),
		button('Repair All', () => {
			if (send('@srorepair')) status.textContent = 'Checking for damaged equipment...';
		}, 'Repair equipped and carried gear · 5,000 Zeny per damaged item'),
		button('Refine', () => {
			if (send('@srorefine')) closeCrafting();
		}, 'Classic + upgrades for weapon attack and armor defense. Costs ore and Zeny; unsafe upgrades can break gear.'),
		button('✕', closeCrafting, 'Close')
	);

	const body = document.createElement('div');
	body.className = 'body';
	const side = document.createElement('div');
	side.className = 'side';
	const cats = document.createElement('div');
	cats.className = 'cats';
	const search = document.createElement('input');
	search.type = 'search';
	search.placeholder = 'Search recipe or ingredient';
	const onlyLabel = document.createElement('label');
	const onlyBox = document.createElement('input');
	onlyBox.type = 'checkbox';
	onlyLabel.append(onlyBox, 'Only what I can make now');
	const list = document.createElement('div');
	list.className = 'list';
	side.append(cats, search, onlyLabel, list);
	const view = document.createElement('div');
	view.className = 'station';
	body.append(side, view);
	const footer = document.createElement('footer');
	const fee = document.createElement('span');
	fee.className = 'fee';
	const status = document.createElement('span');
	status.setAttribute('role', 'status');
	const makeOne = button('Craft', () => craft(1));
	makeOne.className = 'make';
	const makeTen = button('Craft x10', () => craft(10), 'Crafts up to ten, as long as you have the ingredients');
	footer.append(fee, status, makeTen, makeOne);
	panel.append(body, footer);

	[-1, 0, 1, 2, 3, 4].forEach(value => {
		const chip = button(value < 0 ? 'All' : categoryIcons[value] + ' ' + craftingCategories[value], () => {
			category = value;
			renderList();
		});
		chip.dataset.category = value;
		cats.append(chip);
	});
	search.addEventListener('input', () => {
		query = search.value.trim().toLowerCase();
		renderList();
	});
	onlyBox.addEventListener('change', () => {
		only = onlyBox.checked;
		renderList();
	});

	function renderList() {
		cats.querySelectorAll('button').forEach(chip => chip.classList.toggle('on', Number(chip.dataset.category) === category));
		list.replaceChildren();
		craftingRecipes.forEach(([id, recipeCategory, , materials], index) => {
			if (category >= 0 && recipeCategory !== category) return;
			const possible = canMake(index);
			if (only && !possible) return;
			const name = itemName(id);
			if (query && !name.toLowerCase().includes(query) &&
				!materials.some(([material]) => itemName(material).toLowerCase().includes(query))) return;
			const row = document.createElement('div');
			row.className = 'row' + (possible ? ' can' : '') + (index === current ? ' on' : '');
			const label = document.createElement('b');
			label.textContent = name;
			const dot = document.createElement('i');
			dot.title = possible ? 'You can make this now' : 'Something is missing';
			row.append(itemIcon(id), label, dot);
			row.title = 'Right-click: item details';
			inspectOnRightClick(row, id);
			row.addEventListener('click', () => open(index));
			list.append(row);
		});
		if (!list.children.length) {
			const empty = document.createElement('p');
			empty.textContent = 'No recipe matches.';
			list.append(empty);
		}
	}

	function renderStation() {
		view.replaceChildren();
		back.disabled = cursor <= 0;
		forward.disabled = cursor >= history.length - 1;
		if (current < 0) {
			const hint = document.createElement('h2');
			hint.textContent = 'Pick a recipe on the left';
			const text = document.createElement('small');
			text.textContent = 'A green dot means you have everything for it. Right-click a result or ingredient for details and sources.';
			view.append(hint, text);
			fee.textContent = '';
			makeOne.disabled = makeTen.disabled = true;
			return;
		}
		const [id, recipeCategory, price, materials] = craftingRecipes[current];
		const title = document.createElement('h2');
		title.textContent = itemName(id);
		const sub = document.createElement('small');
		sub.textContent = categoryIcons[recipeCategory] + ' ' + craftingCategories[recipeCategory] + ' · you own ' + owned(id);
		const pot = document.createElement('div');
		pot.className = 'pot';
		pot.title = 'Right-click: item details';
		pot.append(itemIcon(id));
		inspectOnRightClick(pot, id);
		inspectOnRightClick(title, id);
		const slots = document.createElement('div');
		slots.className = 'slots';
		for (const [material, amount] of materials) {
			const have = owned(material);
			const need = Math.max(1, amount);
			const slot = document.createElement('div');
			slot.className = 'slot' + (have < need ? ' missing' : '');
			slot.title = 'Click: sources · Right-click: item details';
			inspectOnRightClick(slot, material);
			const name = document.createElement('div');
			name.textContent = itemName(material);
			const count = document.createElement('strong');
			count.textContent = have + ' / ' + need;
			slot.append(itemIcon(material), name, count);
			if (!amount) {
				const kept = document.createElement('em');
				kept.textContent = 'tool, not used up';
				slot.append(kept);
			}
			slot.addEventListener('click', () => {
				focusMaterial = material;
				renderStation();
			});
			slots.append(slot);
		}
		view.append(title, sub, pot, slots);
		const missing = materials.find(([material, amount]) => owned(material) < Math.max(1, amount));
		const shown = focusMaterial && materials.some(([material]) => material === focusMaterial) ? focusMaterial : missing && missing[0];
		if (shown) {
			const where = document.createElement('div');
			where.className = 'where';
			const head = document.createElement('strong');
			head.textContent = 'Where to get ' + itemName(shown);
			where.append(head, ...sourceLines(shown));
			const recipe = recipesByResult.get(shown);
			if (recipe !== undefined) {
				where.append(button('Open its recipe', () => open(recipe)));
			}
			view.append(where);
		}
		fee.textContent = 'Fee: ' + format.format(price) + ' Zeny';
		fee.classList.toggle('short', Session.zeny < price);
		const possible = canMake(current);
		makeOne.disabled = makeTen.disabled = !possible || !!pending;
	}

	function open(index) {
		history.length = cursor + 1;
		history.push(index);
		go(history.length - 1);
	}

	function go(position) {
		if (position < 0 || position >= history.length) return;
		cursor = position;
		current = history[cursor];
		focusMaterial = 0;
		status.textContent = '';
		renderList();
		renderStation();
	}

	function craft(times) {
		if (current < 0 || pending || !canMake(current)) return;
		queue = times - 1;
		attempt();
	}

	function attempt() {
		const [id] = craftingRecipes[current];
		if (!send('@srocraft ' + current)) return;
		pending = { id, before: owned(id), deadline: performance.now() + 3000 };
		status.textContent = 'Crafting...';
		renderStation();
	}

	function onServerMessage(event) {
		const message = String(event.detail).replace(/\^[0-9a-f]{6}/gi, '').trim();
		if (message.startsWith('Repair: ')) {
			status.textContent = message.slice('Repair: '.length);
			return;
		}
		if (pending && /^Crafting: /.test(message) && !/^Crafting: Made /.test(message)) {
			pending = null;
			queue = 0;
			status.textContent = message.replace(/^Crafting: /, '');
			renderStation();
		}
	}

	// The inventory changes without telling this window: look twice a second
	let signature = '';
	const timer = window.setInterval(() => {
		if (pending) {
			if (owned(pending.id) > pending.before) {
				pending = null;
				status.textContent = 'Made ' + itemName(craftingRecipes[current][0]) + '.';
				const pot = view.querySelector('.pot');
				if (pot) {
					pot.classList.remove('done');
					void pot.offsetWidth;
					pot.classList.add('done');
				}
				if (queue > 0 && canMake(current)) {
					queue--;
					window.setTimeout(() => station && !pending && attempt(), 350);
				} else {
					queue = 0;
				}
			} else if (performance.now() > pending.deadline) {
				pending = null;
				queue = 0;
				status.textContent = 'No answer from the server. Check your inventory before trying again.';
			}
		}
		const next = Session.zeny + '|' + (Inventory.list || []).map(item => item?.ITID + ':' + item?.count).join(',') + '|' + !!pending;
		if (next !== signature) {
			signature = next;
			renderList();
			renderStation();
		}
	}, 400);

	window.addEventListener('ro-enchantment-message', onServerMessage);
	panel.addEventListener('keydown', event => {
		if (event.key === 'Escape') closeCrafting();
	});
	station = {
		open,
		close() {
			window.clearInterval(timer);
			window.removeEventListener('ro-enchantment-message', onServerMessage);
			panel.remove();
			station = null;
		}
	};
	renderList();
	renderStation();
}

/** Open the station on the recipe that makes an item */
function showRecipe(id) {
	const recipe = recipesByResult.get(id);
	if (recipe === undefined) return;
	if (!station) toggleCrafting();
	station.open(recipe);
}

const guideText = [
	['What crafting is', 'Crafting turns materials and a Zeny fee into an item. It always succeeds and works from anywhere: open Crafting, pick a recipe, press Craft. The window stays open, so you can craft several things in a row.'],
	['The station', 'Left: all recipes, by category. A green dot means you have everything. Right: the cauldron with the result and one slot per ingredient. A dashed red slot is something you are missing. Click a slot to see where that material comes from.'],
	['How the categories connect', 'Metals and ores come first: ores from monsters are smelted into Iron, Steel, Oridecon and Elunium. Weapons need those metals. Oridecon and Elunium are also what Refine uses to upgrade weapons and armour. Potions use herbs and bottles, Cooking uses monster ingredients and a cooking kit, Converters use scrolls and elemental stones.'],
	['Where materials come from', 'Three sources: monster drops (each material lists its best monsters), shops (bottles, kits and other basics) and the general loot: every monster can drop Rough Oridecon, Rough Elunium, Oridecon, Elunium, Iron, Steel, Iron Ore, Coal, Phracon and Emveretarcon. The Materials tab lists every material with a route.'],
	['Tools', 'Some recipes need a tool or a guide book, for example a cooking kit. A slot marked "tool, not used up" must be in your inventory but stays there.'],
	['Refine, repair and enchant', 'Repair All fixes damaged gear you wear and carry for 5,000 Zeny per damaged item. Refine raises the classic + level, increasing weapon attack or armor defense for ores and Zeny. Going past the safe limit can break gear. Enchantment adds a chosen stat and never breaks your gear.']
];

export function openCraftingGuide() {
	if (guide) {
		guide.close();
		return;
	}
	const { panel, header } = createPanel('sro-craft-guide', 'Crafting Guide');
	header.append(button('✕', () => guide.close(), 'Close'));
	const tabs = document.createElement('div');
	tabs.className = 'tabs';
	const list = document.createElement('div');
	list.className = 'list';
	panel.append(tabs, list);
	let active = 'How it works';

	function card(title, text) {
		const article = document.createElement('article');
		const head = document.createElement('strong');
		head.textContent = title;
		const body = document.createElement('p');
		body.textContent = text;
		article.append(head, body);
		return article;
	}

	function render() {
		tabs.querySelectorAll('button').forEach(tab => tab.classList.toggle('on', tab.textContent === active));
		list.replaceChildren();
		if (active === 'How it works') {
			list.append(...guideText.map(([title, text]) => card(title, text)));
		} else if (active === 'Materials') {
			const sorted = [...recipesByMaterial.keys()].sort((a, b) => itemName(a).localeCompare(itemName(b)));
			for (const material of sorted) {
				const article = document.createElement('article');
				const head = document.createElement('strong');
				head.append(itemIcon(material), itemName(material) + ' · you own ' + owned(material));
				inspectOnRightClick(head, material);
				const used = document.createElement('p');
				const results = [...recipesByMaterial.get(material)];
				used.textContent = 'Used for: ' + results.slice(0, 6).map(itemName).join(', ') + (results.length > 6 ? ' and ' + (results.length - 6) + ' more' : '');
				article.append(head, used, ...sourceLines(material));
				list.append(article);
			}
		} else {
			const category = craftingCategories.indexOf(active);
			craftingRecipes.forEach(([id, recipeCategory, price, ingredients]) => {
				if (recipeCategory !== category) return;
				const article = document.createElement('article');
				const head = document.createElement('strong');
				head.append(itemIcon(id), itemName(id) + ' · ' + format.format(price) + ' Zeny');
				inspectOnRightClick(head, id);
				const needs = document.createElement('p');
				ingredients.forEach(([material, amount], index) => {
					if (index) needs.append(', ');
					const ingredient = document.createElement('span');
					ingredient.textContent = (amount ? amount + 'x ' : '') + itemName(material) + (amount ? '' : ' (tool)');
					inspectOnRightClick(ingredient, material);
					needs.append(ingredient);
				});
				article.append(head, needs, button('Open in the station', () => showRecipe(id)));
				list.append(article);
			});
		}
		list.scrollTop = 0;
	}

	for (const name of ['How it works', 'Materials', ...craftingCategories]) {
		tabs.append(button(name, () => {
			active = name;
			render();
		}));
	}
	panel.addEventListener('keydown', event => {
		if (event.key === 'Escape') guide.close();
	});
	guide = {
		close() {
			panel.remove();
			guide = null;
		}
	};
	render();
}
