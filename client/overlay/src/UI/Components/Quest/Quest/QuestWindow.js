/**
 * UI/Components/Quest/QuestWindow.js
 *
 * Manage interface for Quest Window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './QuestWindow.html?raw';
import cssText from './QuestWindow.css?raw';
import { getQuestItemProgress, getQuestProgress, getQuestSteps, renderQuestObjectives } from '../QuestHelperCommon.js';

import Session from 'Engine/SessionStorage.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import ClassGuide from 'UI/Components/ClassGuide/ClassGuide.js';
import { startQuestNavigation } from '../QuestHelperCommon.js';

function createNoviceGuide(root) {
	const panel = document.createElement('details');
	panel.className = 'novice-guide';
	panel.innerHTML = `<summary><strong>Your first job</strong><span class="novice-progress"></span></summary>
		<div class="novice-details">
		<p>Train to Novice Job Lv. 10 and spend 9 points on Basic Skill (Alt+S). Then choose a first job in Class Guides.</p>
		<p>Visit the Training Grounds for the tutorial or start adventuring right away.</p><p>Blue City Crystals connect the towns for 100 Zeny per trip. Destinations with a first-job trainer show the class in brackets.</p>
		<button type="button" class="quest-route novice-route">➜ Training Grounds</button>
		<button type="button" class="quest-route novice-classes">Class Guides</button></div>`;
	panel.addEventListener('mousedown', event => event.stopPropagation());
	panel.querySelector('.novice-route').onclick = () => {
		startQuestNavigation({ target: 'new_1-2,100,29', label: 'Training Grounds Receptionist' });
	};
	panel.querySelector('.novice-classes').onclick = () => ClassGuide.toggle();
	root.prepend(panel);
	return panel;
}

const _preferences = Preferences.get(
	'Quest',
	{
		x: 200,
		y: 200,
		show: false,
		showwindow: true
	},
	1.0
);

/**
 * Create Component
 */
const QuestWindow = new GUIComponent('QuestWindow', cssText);

QuestWindow.render = () => htmlText;

/**
 * Mouse can cross this UI
 */
QuestWindow.mouseMode = GUIComponent.MouseMode.CROSS;
let trackerScroll = 0;
const openObjectives = new Set();

/**
 * Initialize the component (event listener, etc.)
 */
QuestWindow.init = function init() {
	const root = this.getRoot();
	const trackerPanel = root.querySelector('#QuestWindow');
	// Keep the click from also walking the character to that spot
	root.addEventListener('mousedown', e => {
		if (e.target.closest('.quest-window-li')) {
			e.stopPropagation();
		}
	});
	root.addEventListener('click', e => {
		const li = e.target.closest('.quest-window-li');
		if (e.target.closest('.quest-class-guide')) {
			ClassGuide.showSecondJobs();
			return;
		}
		if (e.target.closest('.quest-objectives-toggle')) return;
		if (li && e.target.closest('.quest-route')) {
			QuestWindow.onRouteClick?.(li.dataset.questId);
			return;
		}
		if (li && QuestWindow.onQuestClick) {
			QuestWindow.onQuestClick(li.dataset.questId);
		}
	});
	root.addEventListener('wheel', e => {
		if (trackerPanel.scrollHeight > trackerPanel.clientHeight) e.stopPropagation();
	});
};

/**
 * Set by the Quest log: called with the quest ID when a tracker entry is clicked
 */
QuestWindow.onQuestClick = null;

QuestWindow.showReady = function showReady(quest, target) {
	const root = this.getRoot();
	if (!root) return;
	const banner = document.createElement('button');
	banner.type = 'button';
	banner.className = 'quest-ready-banner';
	banner.textContent = `${quest.title} · Return to ${target.label}`;
	banner.addEventListener('mousedown', event => event.stopPropagation());
	banner.addEventListener('click', () => this.onRouteClick?.(quest.questID));
	root.querySelector('.quest-ready-banner')?.remove();
	root.prepend(banner);
	setTimeout(() => banner.remove(), 8500);
};

/**
 * Once append to the DOM, start to position the UI
 */
let noviceTimer;
QuestWindow.onAppend = function onAppend() {
	const root = this.getRoot();
	const trackerPanel = root.querySelector('#QuestWindow');
	const update = () => {
		const tracker = trackerPanel.getBoundingClientRect();
		let cutoff = window.innerHeight;
		for (const panel of document.querySelectorAll('#MiniMapV2, #MiniMap, [id^="BasicInfoV"]')) {
			const rect = panel.getBoundingClientRect();
			if (rect.width && rect.height && rect.top > tracker.top && rect.left < tracker.right && rect.right > tracker.left) {
				cutoff = Math.min(cutoff, rect.top);
			}
		}
		const height = `${Math.max(0, Math.floor(cutoff - tracker.top - 8))}px`;
		if (trackerPanel.style.maxHeight !== height) trackerPanel.style.maxHeight = height;
		const entity = Session.Entity;
		let guide = root.querySelector('.novice-guide');
		if (!entity || entity.job !== 0) {
			guide?.remove();
			return;
		}
		guide ||= createNoviceGuide(root);
		const level = entity.joblevel || 1;
		const skill = SkillList.getSkillById(1)?.level || 0;
		if (level >= 10) {
			guide.classList.add('novice-complete');
			guide.querySelector('summary strong').textContent = 'Your first job · Complete';
			guide.querySelector('.novice-progress').textContent = skill >= 9
				? 'Choose your first job in the Job Codex.'
				: `Job Codex · Basic Skill ${skill}/9 before changing jobs`;
			guide.querySelector('.novice-route').hidden = true;
			const options = guide.querySelector('.novice-classes');
			options.textContent = 'Open Job Codex';
			return;
		}
		const progress = guide.querySelector('.novice-progress');
		const text =
			`Job Lv. ${level}/10 · Basic Skill ${skill}/9` +
			(level >= 10 && skill >= 9 ? ' · Choose a first job' : '');
		if (progress.textContent !== text) progress.textContent = text;
	};
	update();
	clearInterval(noviceTimer);
	noviceTimer = setInterval(update, 700);
	if (!_preferences.showwindow) {
		this.ui.hide();
	}
};

/**
 * Clean up UI
 */
QuestWindow.onRemove = () => clearInterval(noviceTimer);

QuestWindow.clean = function clean() {
	clearInterval(noviceTimer);
	QuestWindow.ui.hide();
};

/**
 * Set Quest list
 *
 * @param {Array} quests
 */
QuestWindow.setQuestList = function setQuestList(quests, questNotShowList) {
	let already_show = 0;
	for (const questID in quests) {
		if (!questNotShowList.includes(quests[questID].questID)) {
			if (!isInCooldown(quests[questID])) {
				if (quests[questID].active == 1 && already_show < 4) {
					QuestWindow.addQuestToUI(quests[questID]);
					already_show++;
				}
			}
		}
	}
	const trackerPanel = this.getRoot()?.querySelector('#QuestWindow');
	if (trackerPanel) trackerPanel.scrollTop = trackerScroll;
};

function isInCooldown(quest) {
	if (quest.end_time == 0) {
		return false;
	}
	const epoch_seconds = new Date() / 1000;
	if (quest.end_time > epoch_seconds) {
		return true;
	}
	return false;
}

QuestWindow.ClearQuestList = function ClearQuestList() {
	const root = this.getRoot();
	if (!root) {
		return;
	}
	const ul = root.querySelector('.quest-window-ul');
	if (ul) {
		trackerScroll = ul.closest('#QuestWindow').scrollTop;
		ul.innerHTML = '';
	}
};

QuestWindow.addQuestToUI = function addQuestToUI(quest) {
	const root = this.getRoot();
	if (!root) {
		return;
	}
	const title = quest.title.length > 25 ? `${quest.title.substr(0, 25)}...` : quest.title;
	const summary = quest.summary.length > 25 ? `${quest.summary.substr(0, 25)}...` : quest.summary;
	let list = '';
	for (const huntID in quest.hunt_list) {
		list += `<li>${quest.hunt_list[huntID].mobName} ( ${quest.hunt_list[huntID].huntCount} / ${quest.hunt_list[huntID].maxCount} )</li>`;
	}
	const progress = getQuestProgress(quest);
	// Step-by-step quests show the step that is open right now
	const steps = getQuestSteps(quest);
	const stepIndex = steps ? steps.findIndex(step => step.current) : -1;
	const itemProgress = getQuestItemProgress(quest);
	if (stepIndex >= 0 && !itemProgress) {
		list += `<li>Step ${stepIndex + 1}/${steps.length}: ${steps[stepIndex].text}</li>`;
	}
	if (itemProgress) list += `<li>Materials: ${Math.min(itemProgress.have, itemProgress.need)} / ${itemProgress.need}</li>`;
	const ul = root.querySelector('.quest-window-ul');
	if (ul) {
		ul.insertAdjacentHTML(
			'beforeend',
			`<li class="quest-window-li" data-quest-id="${quest.questID}"> <div class="quest-window-li-title">${title}
			${progress.target ? '<button type="button" class="quest-route quest-route-icon" title="Navigate to quest destination" aria-label="Navigate to quest destination">➜</button>' : ''}</div> <div class="quest-window-li-summary">${summary}</div> <div class="quest-window-li-monster"><ul>${list}</ul></div>
			${progress.need ? `<progress aria-label="Quest progress" max="${progress.need}" value="${Math.min(progress.have, progress.need)}"></progress>` : ''}
			${Number(quest.questID) === 65018 ? '<button type="button" class="quest-class-guide quest-route">Open Second Jobs</button>' : ''}
			${progress.target ? `<button type="button" class="quest-route">${progress.done ? '↪ Ready to turn in' : '➜ Track quest'}</button>` : ''}
			</li>`
		);
		if (itemProgress || Object.keys(quest.hunt_list || {}).length) {
			const details = document.createElement('details');
			details.className = 'quest-objectives-toggle';
			details.open = openObjectives.has(quest.questID);
			const summary = document.createElement('summary');
			summary.textContent = itemProgress ? 'Materials and routes' : 'Hunting areas and routes';
			summary.addEventListener('click', () => {
				if (details.open) openObjectives.delete(quest.questID);
				else openObjectives.add(quest.questID);
			});
			const objectives = document.createElement('div');
			renderQuestObjectives(objectives, quest);
			details.append(summary, objectives);
			ul.lastElementChild.append(details);
		}
	}
};

/**
 * Export
 */
export default UIManager.addComponent(QuestWindow);
