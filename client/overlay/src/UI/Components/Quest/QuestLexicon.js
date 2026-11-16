/**
 * UI/Components/Quest/QuestLexicon.js
 *
 * Quest Lexicon: look up any quest the server scripts know. Search by quest,
 * NPC or map name, filter class quests or your active quests, and follow
 * quest chains. Each entry shows the NPCs with route buttons, the items to
 * hand in, the reward and the level the quest giver asks for (red when your
 * character is below it).
 */
import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Session from 'Engine/SessionStorage.js';
import { questNpcTargets } from 'DB/Map/QuestNpcTargets.js';
import { questItemNeeds } from 'DB/Map/QuestItemNeeds.js';
import { questLexiconData } from 'DB/Map/QuestLexiconData.js';
import { startQuestNavigation } from './QuestHelperCommon.js';

const MAX_ROWS = 120;

const cssText = `
#QuestLexicon { width: 470px; height: 520px; display: flex; flex-direction: column; box-sizing: border-box;
	background: #192636; color: #f7eee1; border: 1px solid #e5bb69; border-radius: 6px; font-size: 12px; }
#QuestLexicon .titlebar { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px;
	background: #24364d; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 14px; cursor: move; }
#QuestLexicon button { border: 1px solid #e5bb69; border-radius: 4px; background: #f2cf88; color: #241b12;
	cursor: pointer; padding: 3px 7px; }
#QuestLexicon .filters { display: flex; gap: 6px; padding: 8px 10px 4px; }
#QuestLexicon button[aria-pressed='true'] { background: #59375d; color: #fff1ce; }
#QuestLexicon .filters input { flex: 1; padding: 5px; }
#QuestLexicon .filters select { padding: 4px; }
#QuestLexicon .count { padding: 0 10px 4px; color: #9fb2c8; }
#QuestLexicon .list { flex: 1; overflow: auto; margin: 0 10px 10px; }
#QuestLexicon article { border-bottom: 1px solid #526075; padding: 6px 0; }
#QuestLexicon article .head { cursor: pointer; display: flex; gap: 6px; align-items: baseline; }
#QuestLexicon article .head strong { font-size: 13px; color: #ffe19c; }
#QuestLexicon article.class-quest .head strong { color: #7be08f; }
#QuestLexicon article.locked .head strong { color: #ff6b6b; }
#QuestLexicon article .tag { color: #9fb2c8; }
#QuestLexicon article .active-tag { color: #5bd1ff; font-weight: bold; }
#QuestLexicon article .body { display: none; margin-top: 5px; line-height: 1.45; }
#QuestLexicon article.open .body { display: block; }
#QuestLexicon article .body p { margin: 4px 0; }
#QuestLexicon article .req { color: #ff6b6b; font-weight: bold; }
#QuestLexicon article .req.ok { color: #7be08f; }
#QuestLexicon article .chain { color: #9fd3ff; cursor: pointer; text-decoration: underline; }
`;

const htmlText = `
<div id="QuestLexicon">
	<div class="titlebar"><span>Quest Lexicon</span><button type="button" class="close">X</button></div>
	<div class="filters"><button type="button" class="all-tab" aria-pressed="true">All quests</button><button type="button" class="level-tab" aria-pressed="false">Level Quests</button></div>
	<div class="filters">
		<input class="search" type="search" placeholder="Search quest, NPC or map">
		<select class="filter">
			<option value="all">All quests</option>
			<option value="class">Class quests</option>
			<option value="active">My active quests</option>
			<option value="locked">Level too low</option>
		</select>
	</div>
	<details class="dungeon-codex" style="margin:6px 10px;padding:7px;border:1px solid #526075">
		<summary>Dungeon Codex · Adventure Guide</summary>
		<div class="dungeon-list" style="max-height:190px;overflow:auto"></div>
	</details>
	<div class="count"></div>
	<div class="list"></div>
</div>`;

const QuestLexicon = new GUIComponent('QuestLexicon', cssText);

QuestLexicon.render = () => htmlText;
const dungeonEntries = [{"name": "Morroc Pyramid", "target": "moc_ruins,54,161", "low": 15, "high": 25, "monsters": [["Familiar", 8, 50, ["Tooth Of Bat", "Falchion", "Ribbon"]], ["Poporing", 14, 20, ["Sticky Mucus", "Garlet", "Green Herb"]]]}, {"name": "Payon Cave", "target": "pay_arche,36,131", "low": 18, "high": 32, "monsters": [["Zombie", 15, 20, ["Decayed Nail", "Cardinal Jewel", "Sticky Mucus"]], ["Skeleton", 10, 35, ["Phracon", "Skel Bone", "Mace"]], ["Poporing", 14, 15, ["Sticky Mucus", "Garlet", "Green Herb"]]]}, {"name": "Prontera Culvert", "target": "prt_sewb1,135,248", "low": 12, "high": 24, "monsters": [["Thief Bug", 6, 30, ["Worm Peelings", "Leather Jacket", "Red Herb"]], ["Thief Bug Egg", 4, 80, ["Phracon", "Chrysalis", "Guard"]], ["Tarou", 11, 10, ["Rat Tail", "Animal's Skin", "Feather"]]]}, {"name": "Geffen Dungeon", "target": "gef_tower,153,28", "low": 38, "high": 55, "monsters": [["Hunter Fly", 42, 30, ["Rough Wind", "Steel", "Solid Shell"]], ["Poison Spore", 19, 25, ["Poison Spore", "Hat", "Green Herb"]], ["Poporing", 14, 15, ["Sticky Mucus", "Garlet", "Green Herb"]]]}];


/** Set by the quest log: returns the IDs of the quests the character has right now */
QuestLexicon.getActiveQuestIds = () => [];

let _entries = null;
let _openId = null;

function buildEntries() {
	const previous = {};
	for (const id in questLexiconData) {
		if (questLexiconData[id].next) {
			previous[questLexiconData[id].next] = Number(id);
		}
	}
	_entries = [];
	for (const key in questNpcTargets) {
		const id = Number(key);
		const info = DB.getQuestInfo(id);
		const target = questNpcTargets[id];
		const extra = questLexiconData[id] || {};
		const title = info.Title && info.Title !== 'Unknown Quest' ? info.Title : 'Quest ' + id;
		_entries.push({
			id,
			title,
			summary: info.Summary && info.Summary !== 'Uknown Quest' ? info.Summary : '',
			description: Array.isArray(info.Description) ? info.Description.join(' ') : info.Description || '',
			turnIn: { target: target[0], npc: target[1] },
			giver: { target: target[2], npc: target[3] },
			reward: target[4] || null,
			items: questItemNeeds[id] || null,
			level: extra.lv || 0,
			next: extra.next || 0,
			previous: previous[id] || 0,
			isClass: /^Job Change/.test(title),
			haystack: (title + ' ' + target[1] + ' ' + target[3] + ' ' + target[0] + ' ' + target[2] + ' ' + id).toLowerCase()
		});
	}
	_entries.sort((a, b) => a.id - b.id);
}

function stripCodes(text) {
	return String(text || '')
		.replace(/\^[0-9A-Fa-f]{6}/g, '')
		.replace(/<[^>]+>/g, '');
}

function itemName(id) {
	const info = DB.getItemInfo(id);
	return (info && info.identifiedDisplayName) || 'Item ' + id;
}

function routeButton(label, place, isClass) {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = 'Navigate';
	button.addEventListener('click', event => {
		event.stopPropagation();
		startQuestNavigation({ target: place.target, label: label + ': ' + place.npc, classGuide: isClass });
	});
	return button;
}

function line(text, className) {
	const p = document.createElement('p');
	if (className) p.className = className;
	p.textContent = text;
	return p;
}

function renderEntry(entry, myLevel, active) {
	const card = document.createElement('article');
	const locked = entry.level > 0 && myLevel > 0 && myLevel < entry.level;
	card.className = (entry.isClass ? 'class-quest ' : '') + (locked ? 'locked ' : '') + (_openId === entry.id ? 'open' : '');

	const head = document.createElement('div');
	head.className = 'head';
	const title = document.createElement('strong');
	title.textContent = entry.title;
	head.append(title);
	if (active.has(entry.id)) {
		const tag = document.createElement('span');
		tag.className = 'active-tag';
		tag.textContent = 'active';
		head.append(tag);
	}
	const tag = document.createElement('span');
	tag.className = 'tag';
	tag.textContent = (entry.level ? 'Lv ' + entry.level + '+ · ' : '') + entry.giver.npc + ' · ' + entry.giver.target.split(',')[0];
	head.append(tag);
	head.addEventListener('click', () => {
		_openId = _openId === entry.id ? null : entry.id;
		refresh();
	});
	card.append(head);

	if (_openId !== entry.id) {
		return card;
	}
	const body = document.createElement('div');
	body.className = 'body';
	if (entry.level) {
		body.append(
			line(
				'Requires Base Level ' + entry.level + (myLevel ? ' (you are ' + myLevel + ')' : ''),
				'req' + (locked ? '' : ' ok')
			)
		);
	}
	if (entry.summary) body.append(line(stripCodes(entry.summary)));
	if (entry.description) body.append(line(stripCodes(entry.description)));

	const giver = line('Given by: ' + entry.giver.npc + ' (' + entry.giver.target.replaceAll(',', ' ') + ') ');
	giver.append(routeButton('Quest giver', entry.giver, entry.isClass));
	body.append(giver);
	const turnIn = line('Turn in: ' + entry.turnIn.npc + ' (' + entry.turnIn.target.replaceAll(',', ' ') + ') ');
	turnIn.append(routeButton('Turn in', entry.turnIn, entry.isClass));
	body.append(turnIn);

	if (entry.items) {
		body.append(line('Hand in: ' + entry.items.map(([id, amount]) => amount + 'x ' + itemName(id)).join(', ')));
	}
	if (entry.reward) {
		const parts = [];
		if (entry.reward[0]) parts.push(entry.reward[0] + ' Base EXP');
		if (entry.reward[1]) parts.push(entry.reward[1] + ' Job EXP');
		for (const [id, amount] of entry.reward[2]) parts.push(amount + 'x ' + itemName(id));
		if (parts.length) body.append(line('Reward (before the server EXP rate): ' + parts.join(', ')));
	}
	for (const [label, otherId] of [['Before this', entry.previous], ['Next', entry.next]]) {
		const other = otherId && _entries.find(e => e.id === otherId);
		if (!other) continue;
		const link = line(label + ': ' + other.title, 'chain');
		link.addEventListener('click', () => {
			_openId = other.id;
			const root = QuestLexicon.getRoot();
			root.querySelector('.search').value = String(other.id);
			root.querySelector('.filter').value = 'all';
			refresh();
		});
		body.append(link);
	}
	body.append(line('Quest ID ' + entry.id, 'tag'));
	card.append(body);
	return card;
}

function refresh() {
	if (!_entries) buildEntries();
	const root = QuestLexicon.getRoot();
	const terms = root.querySelector('.search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const filter = root.querySelector('.filter').value;
	const levelTab = root.querySelector('.level-tab').getAttribute('aria-pressed') === 'true';
	const myLevel = (Session.Entity && Session.Entity.clevel) || 0;
	const active = new Set(QuestLexicon.getActiveQuestIds().map(Number));

	const matches = _entries.filter(entry => {
		if (levelTab && !(entry.id >= 65000 && entry.id <= 65013 && entry.id !== 65008)) return false;
		if (filter === 'class' && !entry.isClass) return false;
		if (filter === 'active' && !active.has(entry.id)) return false;
		if (filter === 'locked' && !(entry.level > 0 && myLevel > 0 && myLevel < entry.level)) return false;
		return terms.every(term => entry.haystack.includes(term));
	});

	const fragment = document.createDocumentFragment();
	for (const entry of matches.slice(0, MAX_ROWS)) {
		fragment.append(renderEntry(entry, myLevel, active));
	}
	root.querySelector('.list').replaceChildren(fragment);
	root.querySelector('.count').textContent =
		matches.length + ' of ' + _entries.length + ' quests' +
		(matches.length > MAX_ROWS ? ' · showing the first ' + MAX_ROWS + ', search to narrow down' : '');
}

QuestLexicon.init = function init() {
	const dungeonList = this.getRoot().querySelector('.dungeon-list');
	const showDungeons = () => {
		const level = Number(Session.Entity?.clevel) || 0;
		const distance = entry => level ? Math.max(entry.low - level, level - entry.high, 0) : 0;
		const ranked = [...dungeonEntries].sort((a, b) => distance(a) - distance(b));
		dungeonList.replaceChildren();
		for (const entry of ranked) {
			const card = document.createElement('article');
			const title = document.createElement('strong');
			title.textContent = entry.name + ' · Suggested Base Lv. ' + entry.low + '–' + entry.high;
			card.append(title);
			if (level) {
				const note = document.createElement('div');
				note.textContent = level < entry.low ? 'Above your current level' : level > entry.high ? 'Below your current level' : 'Within your level range';
				card.append(note);
			}
			for (const [name, mobLevel, count, loot] of entry.monsters) {
				const row = document.createElement('div');
				row.textContent = name + ' · Lv. ' + mobLevel + ' · ' + count + ' spawns · ' + loot.join(', ');
				card.append(row);
			}
			const route = document.createElement('button');
			route.type = 'button';
			route.textContent = 'Show route';
			route.onclick = () => startQuestNavigation({ target: entry.target, label: entry.name });
			card.append(route);
			dungeonList.append(card);
		}
	};
	this.getRoot().querySelector('.dungeon-codex').addEventListener('toggle', event => {
		if (event.currentTarget.open) showDungeons();
	});
	const root = this.getRoot();
	this._host.style.top = '90px';
	this._host.style.left = '300px';
	this.draggable('.titlebar');

	const closeBtn = root.querySelector('.close');
	closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
	closeBtn.addEventListener('click', () => QuestLexicon.remove());

	const search = root.querySelector('.search');
	search.addEventListener('mousedown', e => e.stopImmediatePropagation());
	search.addEventListener('input', () => refresh());
	const filter = root.querySelector('.filter');
	filter.addEventListener('mousedown', e => e.stopImmediatePropagation());
	filter.addEventListener('change', () => refresh());
	const allTab = root.querySelector('.all-tab');
	const levelTab = root.querySelector('.level-tab');
	for (const tab of [allTab, levelTab]) {
		tab.addEventListener('click', () => {
			allTab.setAttribute('aria-pressed', String(tab === allTab));
			levelTab.setAttribute('aria-pressed', String(tab === levelTab));
			filter.value = 'all';
			refresh();
		});
	}
};

QuestLexicon.onAppend = function onAppend() {
	refresh();
};

/** Open the lexicon, or close it when it is open */
QuestLexicon.toggle = function toggle() {
	if (this._host && this._host.parentNode) {
		this.remove();
	} else {
		this.append();
	}
};

export default UIManager.addComponent(QuestLexicon);
