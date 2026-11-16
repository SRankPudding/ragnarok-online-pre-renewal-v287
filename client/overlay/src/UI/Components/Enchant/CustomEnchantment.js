import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import EquipLocation from 'DB/Items/EquipmentLocation.js';

import ItemType from 'DB/Items/ItemType.js';
import Sound from 'Audio/SoundManager.js';
import { stats, effects, readEnchant } from './EnchantBonus.js';
const gearSlots = EquipLocation.ARMOR | EquipLocation.WEAPON | EquipLocation.SHIELD |
	EquipLocation.HEAD_TOP | EquipLocation.HEAD_MID | EquipLocation.HEAD_BOTTOM |
	EquipLocation.GARMENT | EquipLocation.SHOES | EquipLocation.ACCESSORY1 | EquipLocation.ACCESSORY2;
const format = new Intl.NumberFormat();
let active;
let position;
let nextAttempt = 0;

function enchantOf(item) {
	const enchant = readEnchant(item);
	if (enchant) return enchant;
	const card = item?.slot?.card4 || 0;
	if ((item?.location & EquipLocation.ARMOR) && DB.getItemInfo(item.ITID).slotCount < 4 &&
		card >= 4700 && card <= 4752 && card % 10 <= 2) {
		return { stat: Math.floor((card - 4700) / 10), level: card % 10 + 1 };
	}
	return { stat: -1, level: 0 };
}

function priceFor(targetLevel) {
	return targetLevel < 8 ? 1000 : 2000;
}

export function closeEnchantment() {
	active?.close();
}

export function toggleEnchantment() {
	if (active) return closeEnchantment();
	const panel = document.createElement('section');
	panel.setAttribute('aria-label', 'Enchantment');
	panel.innerHTML = `
		<style>
			.sro-enchant { position:fixed; z-index:110; top:118px; right:12px; width:min(380px,calc(100vw - 24px));
				box-sizing:border-box; padding:15px; border:1px solid #9f7947; color:#eddfc4;
				background:linear-gradient(155deg,#31271d,#141418 60%); box-shadow:0 10px 30px #000b,inset 0 0 0 3px #151315;
				font:13px system-ui,sans-serif; }
			.sro-enchant header,.sro-enchant footer {display:flex; justify-content:space-between; align-items:center; gap:10px}
			.sro-enchant header {cursor:move;touch-action:none;user-select:none}
			.sro-enchant h2 {margin:0; font:600 21px Cinzel,Georgia,serif; color:#f3d59b}
			.sro-enchant button {font:inherit; background:#231f21; border:1px solid #755c3c; color:#f4e3be; padding:6px 9px; cursor:pointer}
			.sro-enchant button:hover:not(:disabled),.sro-enchant button[aria-pressed=true] {border-color:#f0c57e;background:#493522}
			.sro-enchant button:disabled {opacity:.45;cursor:default}
			.sro-enchant main {display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:12px;margin:12px 0}
			.sro-enchant .piece {min-height:88px;display:grid;place-items:center;align-content:center;gap:5px;text-align:center}
			.sro-enchant .piece img {width:30px;height:30px;object-fit:contain;image-rendering:pixelated}
			.sro-enchant .stats {display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
			.sro-enchant .tools {display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
			.sro-enchant .upgrade {background:linear-gradient(#68492a,#382619);font-weight:700}
			.sro-enchant p {margin:8px 0 0;min-height:18px}
		</style>
		<header><h2>Enchantment</h2><button type="button" class="close" aria-label="Close">×</button></header>
		<main><button type="button" class="piece" aria-label="Armor slot"></button><div class="stats" aria-label="Choose a stat"></div></main>
		<div class="tools"><button type="button" class="bag">Inventory</button><button type="button" class="takeoff">Unequip armor</button><button type="button" class="clear">Clear slot</button></div>
		<footer><span class="price"></span><button type="button" class="upgrade">Upgrade</button><button type="button" class="reroll" hidden>Reroll · 5,000 Zeny</button></footer>
		<p role="status"></p>`;
	panel.className = 'sro-enchant';
	for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu']) {
		panel.addEventListener(type, event => event.stopPropagation());
	}
	const get = name => panel.querySelector(name);
	const piece = get('.piece');
	const status = get('[role=status]');
	let selected;
	let stat = -1;
	let pending;
	let timer;
	let sendTimer;

	function onServerMessage(event) {
		if (!pending || pending.unequip || !pending.sent) return;
		const message = event.detail.replace(/\^[0-9a-f]{6}/gi, '').trim();
		if (!/^(Enchantment failed\.|Enchantment: (Not enough Zeny\.|This item is no longer eligible))/.test(message)) return;
		window.clearInterval(timer);
		pending = null;
		status.textContent = message;
		render();
	}

	function sendAttempt(packet) {
		const send = () => {
			pending.sent = true;
			nextAttempt = performance.now() + 500;
			Network.sendPacket(packet);
			waitForItem();
		};
		const delay = nextAttempt - performance.now();
		if (delay > 0) sendTimer = window.setTimeout(send, delay);
		else send();
	}

	function currentItem() {
		const item = selected && Inventory.getItemByIndex(selected.index);
		return item?.ITID === selected?.ITID ? item : null;
	}

	function render() {
		const item = currentItem();
		const { level, stat: locked, effect } = enchantOf(item);
		if (locked >= 0) stat = locked;
		const cost = item && level < 10 && priceFor(level + 1);
		piece.replaceChildren();
		if (item) {
			const info = DB.getItemInfo(item.ITID);
			const icon = document.createElement('img');
			icon.alt = '';
			const name = document.createElement('strong');
			name.textContent = info.identifiedDisplayName;
			const bonus = document.createElement('span');
			bonus.textContent = level ? stats[stat] + ' +' + (level === 10 ? '12' : level) : 'Unenchanted';
			piece.append(icon, name, bonus);
			if (effect) {
				const line = document.createElement('span');
				line.textContent = effects[effect];
				piece.append(line);
			}
			Client.loadFile(DB.INTERFACE_PATH + 'item/' + info.identifiedResourceName + '.bmp', data => { icon.src = data; });
		} else piece.textContent = 'Drop weapon or gear here';
		const chance = level < 4 ? 100 : 50 - (level + 1) * 2;
		get('.price').textContent = cost ? format.format(cost) + ' Zeny · +' + (level + 1) + ' · ' + chance + '%' :
			item ? 'Maximum +10' : 'Choose a piece of gear';
		piece.style.borderColor = level === 10 ? '#e75959' : '';
		get('.upgrade').disabled = !cost || stat < 0 || Boolean(pending);
		get('.upgrade').hidden = level === 10;
		get('.reroll').hidden = level !== 10 || item?.type !== ItemType.WEAPON;
		get('.reroll').disabled = Boolean(pending);
		get('.clear').disabled = !selected || Boolean(pending);
		get('.takeoff').disabled = Boolean(pending);
		for (const [index, tile] of Array.from(get('.stats').children).entries()) {
			tile.disabled = !item || Boolean(pending) || (locked >= 0 && locked !== index);
			tile.setAttribute('aria-pressed', String(stat === index));
		}
	}

	function selectItem(item) {
		if (pending) return;
		if (!item || !(item.location & gearSlots) || !item.IsIdentified || item.IsDamaged) {
			status.textContent = 'Choose an identified, eligible piece of gear from Inventory.';
			return;
		}
		selected = { index: item.index, ITID: item.ITID };
		stat = -1;
		status.textContent = '';
		render();
	}

	for (const [index, name] of stats.entries()) {
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.textContent = name;
		tile.onclick = () => { stat = index; render(); };
		get('.stats').append(tile);
	}
	piece.ondragover = event => {
		if (window._OBJ_DRAG_?.from === 'Inventory') event.preventDefault();
	};
	piece.ondrop = event => {
		event.preventDefault();
		event.stopPropagation();
		const drag = window._OBJ_DRAG_;
		if (drag?.from === 'Inventory') selectItem(Inventory.getItemByIndex(drag.data.index));
	};
	piece.onclick = () => Inventory.append();
	get('.bag').onclick = () => Inventory.append();
	get('.clear').onclick = () => { selected = null; stat = -1; status.textContent = ''; render(); };
	get('.takeoff').onclick = () => {
		const item = Equipment.getEquippedArmor();
		if (!item) {
			status.textContent = 'You are not wearing body armor.';
			return;
		}
		pending = { index: item.index, ITID: item.ITID, unequip: true };
		status.textContent = 'Taking off armor…';
		Equipment.onUnEquip(item.index);
		waitForItem();
		render();
	};
	get('.upgrade').onclick = () => {
		const player = Session.Entity;
		const item = currentItem();
		if (pending || !player?.display?.name || !item || stat < 0) return;
		const { level, stat: existingStat } = enchantOf(item);
		if (level >= 10) return;
		if (Session.zeny < priceFor(level + 1)) {
			status.textContent = 'Not enough Zeny.';
			return;
		}
		const packet = new PACKET.CZ.REQUEST_CHAT();
		const expected = level ? existingStat * 10 + level : 0;
		packet.msg = player.display.name + ' : @sroenchantui ' + [item.index, item.ITID, expected, stat].join(' ');
		pending = { index: item.index, ITID: item.ITID, level: level + 1, stat };
		status.textContent = 'Applying enchantment…';
		sendAttempt(packet);
		render();
	};
	get('.reroll').onclick = () => {
		const player = Session.Entity;
		const item = currentItem();
		const enchant = readEnchant(item);
		if (pending || !player?.display?.name || item?.type !== ItemType.WEAPON || enchant?.level !== 10) return;
		if (Session.zeny < 5000) {
			status.textContent = 'Not enough Zeny.';
			return;
		}
		const packet = new PACKET.CZ.REQUEST_CHAT();
		const expected = enchant.stat * 10 + 10 + enchant.effect * 100;
		packet.msg = player.display.name + ' : @sroenchantui ' + [item.index, item.ITID, expected, -1].join(' ');
		pending = { index: item.index, ITID: item.ITID, level: 10, stat: enchant.stat, oldEffect: enchant.effect };
		status.textContent = 'Rolling a new weapon effect…';
		sendAttempt(packet);
		render();
	};

	function waitForItem() {
		const deadline = performance.now() + 2500;
		timer = window.setInterval(() => {
			const item = Inventory.getItemByIndex(pending.index);
			const enchant = enchantOf(item);
			if (item?.ITID === pending.ITID &&
				(pending.unequip || (enchant.level === pending.level && enchant.stat === pending.stat &&
					(pending.oldEffect === undefined || enchant.effect !== pending.oldEffect)))) {
				window.clearInterval(timer);
				const unequip = pending.unequip;
				const reroll = pending.oldEffect !== undefined;
				pending = null;
				if (unequip) selectItem(item);
				else {
					status.textContent = reroll ? 'Weapon effect changed.' : 'Enchantment upgraded.';
					render();
					Sound.play('effect/number_change.wav', 0.65);
					if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
						const glow = enchant.level === 10 ? '#f05757' : '#e7b35f';
						piece.animate([{ transform:'scale(1)', boxShadow:'0 0 0 #e7b35f00' },
							{ transform:'scale(1.06)', boxShadow:'0 0 28px ' + glow + ', inset 0 0 22px ' + glow + '77' },
							{ transform:'scale(1)', boxShadow:'0 0 0 #e7b35f00' }], 650);
					}
				}
			} else if (performance.now() >= deadline) {
				window.clearInterval(timer);
				pending = null;
				status.textContent = 'No confirmation received. Check your chat and equipment.';
				render();
			}
		}, 80);
	}

	window.addEventListener('ro-enchantment-message', onServerMessage);
	active = { close() {
		window.clearInterval(timer);
		window.clearTimeout(sendTimer);
		window.removeEventListener('ro-enchantment-message', onServerMessage);
		panel.remove();
		active = null;
	} };
	get('.close').onclick = closeEnchantment;
	panel.onkeydown = event => { if (event.key === 'Escape') closeEnchantment(); };
	document.body.append(panel);
	function move(left, top) {
		position = [
			Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth)),
			Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight))
		];
		panel.style.left = position[0] + 'px';
		panel.style.top = position[1] + 'px';
		panel.style.right = 'auto';
	}
	if (position) move(...position);
	const header = get('header');
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
	header.onlostpointercapture = () => { drag = null; };
	render();
	piece.focus();
}
