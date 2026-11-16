/**
 * UI/Components/ClassGuide/ClassGuide.js
 *
 * Class Guides window: one tab per job tier, each entry with its requirement
 * and route buttons. Data comes from WorldMap/ClassGuides.js.
 */
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import { classGuides } from 'UI/Components/WorldMap/ClassGuides.js';
import { statBasics, builds, endgame } from './StatsGuide.js';
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import { dungeonCodex } from 'DB/Map/DungeonCodexData.js';
import { cityCrystals } from 'DB/Map/CityCrystals.js';
import { isInChivalry, startQuestNavigation } from 'UI/Components/Quest/QuestHelperCommon.js';

const cssText = `
#ClassGuide { width: 380px; height: 460px; display: flex; flex-direction: column; box-sizing: border-box;
	background: #192636; color: #f7eee1; border: 1px solid #e5bb69; border-radius: 6px; font-size: 12px; }
#ClassGuide .titlebar { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px;
	background: #24364d; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 14px; cursor: move; }
#ClassGuide .close { border: 1px solid #e5bb69; border-radius: 4px; background: #f2cf88; color: #241b12;
	cursor: pointer; padding: 1px 7px; font-weight: bold; }
#ClassGuide .tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 10px 0; }
#ClassGuide .tabs button { border: 1px solid #526075; border-radius: 4px 4px 0 0; padding: 5px 8px;
	background: #24364d; color: #f7eee1; cursor: pointer; }
#ClassGuide .tabs button.active { background: #f2cf88; color: #241b12; border-color: #e5bb69; font-weight: bold; }
#ClassGuide .tier-note { margin: 8px 10px 0; color: #ffe19c; line-height: 1.4; }
#ClassGuide .list { flex: 1; overflow: auto; margin: 6px 10px 10px; }
#ClassGuide article { border-bottom: 1px solid #526075; padding: 7px 0; }
#ClassGuide article strong { font-size: 13px; }
#ClassGuide article p { margin: 4px 0; line-height: 1.4; }
#ClassGuide article .requires { color: #9fd3ff; }
#ClassGuide { width: 640px; height: 580px; }
#ClassGuide .tabs button { background: #f4e9d0; color: #4a2a55; border-color: #b9954a; font-weight: 600; }
#ClassGuide .tabs button.active { background: #4a2a55; color: #f7d88f; border-color: #34203f; }
#ClassGuide h3 { margin: 12px 0 4px; font-size: 13px; color: #4a2a55; border-bottom: 2px solid #b9954a; padding-bottom: 3px; }
#ClassGuide .class-card { border: 1px solid #d6c08f; border-radius: 8px; background: #fbf4e2; padding: 8px 10px; margin: 8px 0; }
#ClassGuide .class-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#ClassGuide .class-head strong { font-size: 15px; color: #34203f; }
#ClassGuide .class-head span { flex: 1; min-width: 180px; }
#ClassGuide .class-branches { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-top: 8px; }
#ClassGuide .class-branch { border-left: 3px solid #b9954a; background: #f4e9d0; border-radius: 0 6px 6px 0; padding: 6px 8px; }
#ClassGuide .class-branch p { margin: 3px 0; }
#ClassGuide .job-steps { margin: 6px 0 8px; padding-left: 24px; }
#ClassGuide .job-steps li { margin: 4px 0; line-height: 1.45; }
#ClassGuide .job-steps summary, #ClassGuide details > summary { cursor: pointer; font-weight: 600; }
#ClassGuide .dungeon { border: 1px solid #d6c08f; border-radius: 8px; background: #fbf4e2; margin: 6px 0; padding: 6px 10px; }
#ClassGuide .dungeon.fits { border-color: #4a2a55; box-shadow: inset 4px 0 0 #4a2a55; }
#ClassGuide .dungeon summary { cursor: pointer; }
#ClassGuide .dungeon summary strong { font-size: 13px; color: #34203f; }
#ClassGuide .dungeon summary em { float: right; font-style: normal; font-weight: 600; padding: 1px 8px; border-radius: 10px; background: #4a2a55; color: #f7d88f; }
#ClassGuide .dungeon button { margin: 8px 0 2px; border: 1px solid #a67c1e; border-radius: 4px; padding: 4px 8px; background: #f3d98c; color: #2b1d14; cursor: pointer; }
#ClassGuide .dungeon-floor { margin-top: 8px; padding: 6px 8px; border-left: 3px solid #b9954a; background: #f4e9d0; border-radius: 0 6px 6px 0; }
#ClassGuide .dungeon-floor p { margin: 3px 0; line-height: 1.4; }
#ClassGuide select { width: 100%; padding: 6px; background: #24364d; color: #f7eee1; border: 1px solid #e5bb69; }
#ClassGuide article button { margin: 3px 4px 0 0; border: 1px solid #e5bb69; border-radius: 4px; padding: 4px 7px;
	background: #f2cf88; color: #241b12; cursor: pointer; }
`;

const htmlText = `
<div id="ClassGuide">
	<div class="titlebar"><span>Class Guides</span><button type="button" class="close">X</button></div>
	<div class="tabs"></div>
	<div class="tier-note"></div>
	<div class="list"></div>
</div>`;

/** What each tier needs in general (Pre-Renewal) */
const tierNotes = {
	'First jobs': 'Novice Job Lv 10 with Basic Skill Lv 9. Open a class below to find its trainer.',
	Classes: 'Every class and where it can go. The Route buttons lead to the job NPC.',
	Dungeons: 'Where to hunt: level, monsters, loot and the way there.',
	Paths: 'From your first job to the endgame, step by step. Pre-Renewal ends with the transcendent jobs.',
	'Second jobs': 'Start as the matching first job at Job Lv 40 or higher. Spend your remaining skill points before the final job change. Use Start route again after reaching a town or entering a building.',
	'Expanded jobs': 'Side paths. They start from Novice or Taekwon instead of the normal first and second jobs.',
	'Rebirth and transcendent jobs':
		'Standard second jobs can rebirth at Base Lv 99 and Job Lv 50. Start in Juno, level again as High Novice, then follow your original class path.'
};

const secondJobTravel = {
	Knight: ['prontera', 'Prontera (Acolyte)', 'Enter the Chivalry at (45, 346) in northwest Prontera.'],
	Crusader: ['prontera', 'Prontera (Acolyte)', 'Enter Prontera Castle through the north gate.', 'prontera,156,360'],
	Priest: ['prontera', 'Prontera (Acolyte)', 'Enter the church in the northeast.'],
	Monk: ['prontera', 'Prontera (Acolyte)', 'Leave through the east gate and walk through prt_fild06, prt_fild02 and prt_fild03 to St. Capitolina Abbey.', '', ['prt_fild06', 'prt_fild02', 'prt_fild03']],
	Hunter: ['yuno', 'Yuno', 'Talk to the Airship Staff in west Yuno at (14, 262). Take the domestic airship to Hugel and enter the Hunter Guild at (206, 228).', 'yuno,14,262', ['hugel', 'hu_fild06', 'airplane', 'y_airport']],
	Bard: ['comodo', 'Comodo', 'Meet the Wandering Bard in town.'],
	Dancer: ['comodo', 'Comodo', 'Talk to Bor Robin (193, 151) and choose “Go to the Job Change Area.”'],
	Wizard: ['geffen', 'Geffen (Mage)', 'Enter the tower at (120, 114) in the center of town and follow the stairs to the guild.'],
	Sage: ['yuno', 'Yuno', 'Enter the Sage Academy.'],
	Blacksmith: ['einbroch', 'Einbroch', 'Enter the Blacksmith Guild.'],
	Alchemist: ['aldebaran', 'Al De Baran', 'Enter the Alchemist Guild.'],
	Assassin: ['morocc', 'Morroc (Thief)', 'Walk to moc_fild16 and enter the Assassin Guild.', '', ['moc_fild16']],
	Rogue: ['comodo', 'Comodo', 'Head east through the beach cave and continue to Pharos Lighthouse in cmd_fild07.', '', ['beach_dun3', 'cmd_fild01', 'cmd_fild06', 'cmd_fild07']]
};

const secondJobApplications = {
	Knight: ['Choose “I want to change my job to a Knight” and confirm your application.', 'Start with Sir Andrew at (75, 107). At Job Lv 50 he waives the item test. Return to the Captain after all tests.'],
	Crusader: ['Choose “I want to prepare for the Holy War!” and accept the test.', 'The Senior Crusader gives you the first collection task. A Chivalry Emblem and Hand of God together let you skip that task.'],
	Priest: ['Choose “I want to be a Priest” and accept the test.', 'If assigned the pilgrimage, visit Rubalkabara, Mathilda and Yosuke in that order. Return to the High Bishop.'],
	Monk: ['Choose “I wish to become a monk” at the abbey gate.', 'Continue to Sensei Moohae inside the abbey (monk_in 99, 58) for your collection list.'],
	Hunter: ['Tell the Guildsman that you are here to change jobs, then choose “Yes~ Let’s start now.”', 'After the interview and item test, follow your examiner’s directions to the Archer Guild or Central Palace in Payon.'],
	Bard: ['Choose “You have a nice voice” and then “Of course!”', 'Bring back a flower the bard accepts, such as a Hinalle. He then gives you the next part of the test.'],
	Dancer: ['Choose “Fill out the application.”', 'Bring the items on your assigned list and 10,000 Zeny. Once Aile accepts them, speak to Bijou (95, 93).'],
	Wizard: ['Choose “I want to become a Wizard” and confirm.', 'At Job Lv 50 the Guildsman waives the collection task. Continue with the Gloomy Wizard (102, 24).'],
	Sage: ['Choose “I would like to be a Sage.”', 'Go to the Academy Staff (yuno_in03 154, 35) and choose “I want to enroll in the school.” The staff explains the fee and alternatives.'],
	Blacksmith: ['Choose “Fill out Application” at the guild.', 'Next speak to the second Guildsman (ein_in01 201, 27) for the quiz and delivery assignment.'],
	Alchemist: ['Choose “I want to become an Alchemist,” then “I would like to apply.”', 'Bring 50,000 Zeny for the application fee. The Guildsman gives you an assigned item list before you continue.'],
	Assassin: ['Speak to the first Guildsman and accept the Assassin job test.', 'Continue inside to the second Guildsman (in_moc_16 25, 90) for the next part.'],
	Rogue: ['Talk to Markie, the Rogue Guildsman, and follow her introduction to register.', 'Return to Markie for the written test before moving to the collection and maze tests.']
};

/** Which job you must be before each job change */
const requirements = {
	Swordman: 'Novice, Job Lv 10', Acolyte: 'Novice, Job Lv 10', Archer: 'Novice, Job Lv 10',
	Mage: 'Novice, Job Lv 10', Merchant: 'Novice, Job Lv 10', Thief: 'Novice, Job Lv 10',
	Knight: 'Swordman, Job Lv 40+', Crusader: 'Swordman, Job Lv 40+',
	Priest: 'Acolyte, Job Lv 40+', Monk: 'Acolyte, Job Lv 40+',
	Hunter: 'Archer, Job Lv 40+', Bard: 'Archer (male), Job Lv 40+', Dancer: 'Archer (female), Job Lv 40+',
	Wizard: 'Mage, Job Lv 40+', Sage: 'Mage, Job Lv 40+',
	Blacksmith: 'Merchant, Job Lv 40+', Alchemist: 'Merchant, Job Lv 40+',
	Assassin: 'Thief, Job Lv 40+', Rogue: 'Thief, Job Lv 40+',
	Ninja: 'Novice, Job Lv 10', Gunslinger: 'Novice, Job Lv 10', Taekwon: 'Novice, Job Lv 10',
	'Star Gladiator': 'Taekwon, Job Lv 40+', 'Soul Linker': 'Taekwon, Job Lv 40+',
	'Super Novice': 'Novice, Base Lv 45 and Job Lv 10',
	Rebirth: 'Any second job, Base Lv 99 and Job Lv 50',
	'Lord Knight': 'High Swordman (was Knight), Job Lv 40+', Paladin: 'High Swordman (was Crusader), Job Lv 40+',
	'High Priest': 'High Acolyte (was Priest), Job Lv 40+', Champion: 'High Acolyte (was Monk), Job Lv 40+',
	'High Wizard': 'High Mage (was Wizard), Job Lv 40+', Professor: 'High Mage (was Sage), Job Lv 40+',
	Whitesmith: 'High Merchant (was Blacksmith), Job Lv 40+', Creator: 'High Merchant (was Alchemist), Job Lv 40+',
	Sniper: 'High Archer (was Hunter), Job Lv 40+', Clown: 'High Archer (was Bard), Job Lv 40+',
	Gypsy: 'High Archer (was Dancer), Job Lv 40+',
	'Assassin Cross': 'High Thief (was Assassin), Job Lv 40+', Stalker: 'High Thief (was Rogue), Job Lv 40+'
};

const ClassGuide = new GUIComponent('ClassGuide', cssText);

ClassGuide.render = () => htmlText;

let _activeTab = 'Classes';
let selectedBuild = 0;

function guideCard(title, description) {
	const card = document.createElement('article');
	const heading = document.createElement('strong');
	heading.textContent = title;
	const text = document.createElement('p');
	text.textContent = description;
	card.append(heading, text);
	return card;
}

function renderStats(list) {
	const select = document.createElement('select');
	select.setAttribute('aria-label', 'Class stat guide');
	builds.forEach(([name], index) => select.add(new Option(name, String(index))));
	select.selectedIndex = selectedBuild;
	const summary = document.createElement('div');
	function showBuild() {
		selectedBuild = select.selectedIndex;
		const [, priorities, tip] = builds[selectedBuild];
		summary.replaceChildren(guideCard(priorities, tip));
	}
	select.addEventListener('change', showBuild);
	showBuild();
	list.append(select, summary, ...statBasics.map(([name, description]) => guideCard(name, description)));
}

/**
 * The whole road of each starting class in Pre-Renewal: [title, choice, steps[]].
 * Checked against the job scripts of this server (job change from Job Lv 40, rebirth at 99/50 in Juno).
 */
const classPaths = [
	['Swordman', 'Knight or Crusader', [
		'Knight: fast two-handed sword or spear fighter on a Peco Peco. Later: Lord Knight.',
		'Crusader: shield tank with holy skills and party protection. Later: Paladin.'
	]],
	['Mage', 'Wizard or Sage', [
		'Wizard: the strongest area spells in the game. Later: High Wizard.',
		'Sage: support caster with auto-spells, dispel and elemental fields. Later: Professor.'
	]],
	['Archer', 'Hunter, or Bard (male) / Dancer (female)', [
		'Hunter: bow damage with a falcon and traps. Later: Sniper.',
		'Bard (male characters): songs that strengthen the party. Later: Clown.',
		'Dancer (female characters): dances that weaken enemies and help the party. Later: Gypsy.'
	]],
	['Acolyte', 'Priest or Monk', [
		'Priest: the main healer and buffer, strong against undead. Later: High Priest.',
		'Monk: fist fighter with combos and Asura Strike. Later: Champion.'
	]],
	['Merchant', 'Blacksmith or Alchemist', [
		'Blacksmith: axe fighter who forges and upgrades weapons. Later: Whitesmith.',
		'Alchemist: potion maker with a Homunculus companion. Later: Creator, with Acid Demonstration.'
	]],
	['Thief', 'Assassin or Rogue', [
		'Assassin: katar or dual daggers, crits and poison. Later: Assassin Cross.',
		'Rogue: copies skills, strips gear, bow or dagger. Later: Stalker.'
	]],
	['Taekwon', 'Star Gladiator or Soul Linker', [
		'Star Gladiator: kick fighter who is strongest on chosen maps and days.',
		'Soul Linker: caster who gives other classes powerful spirit buffs.',
		'Expanded path: there is no rebirth. Base Lv 99 is the end of the road.'
	]],
	['Ninja, Gunslinger, Super Novice', 'No second job', [
		'These classes keep their job until Base Lv 99 (Job Lv 70 for Ninja and Gunslinger, 99 for Super Novice).',
		'Expanded path: there is no rebirth.'
	]]
];

const pathSteps = [
	['0. Level 1 to 50: follow the quests', 'Questing is by far the fastest way up. The main story (orange quests) from Morroc over Payon to Geffen brings you to Base Lv 50 and Job Lv 40 very quickly, with gear and Zeny on the way. Grinding is not needed before that.'],
	['1. First job (you are here around Base 50)', 'Reach Job Lv 40 to unlock the second job. Job Lv 50 gives 10 more first-job skill points. They are lost if you change earlier, because your Job Level restarts at 1.'],
	['2. Choose your second job', 'Each first job has two second jobs (Archer has three, by gender). The choice is permanent. Your Base Level stays, your Job Level restarts at 1. The way to every job NPC is in the "Classes" tab.'],
	['3. Level to Base 99 and Job 50', 'Learn the new skills, upgrade and enchant your gear, and work through the Dungeon Codex tab.'],
	['4. Rebirth in Juno', 'At Base 99 and Job 50: pay 1,285,000 Zeny to Metheus Sylphe in the Juno library, read the Book of Ymir and meet the Valkyrie. She only accepts you with 0 Zeny, 0 weight, no cart, falcon or Peco Peco and no unspent skill points. Put your items into Kafra storage and spend or hand over your remaining Zeny first.'],
	['5. High Novice and High first job', 'You start again at Base 1 with 100 bonus stat points. At Job Lv 10 you become the "High" version of your first job, with more HP and SP.'],
	['6. Transcendent job (the last class)', 'At Job Lv 40-50 you become the advanced form of the second job you had before the rebirth, for example Knight becomes Lord Knight. It has new skills and goes up to Job Lv 70.'],
	['7. Endgame', 'Pre-Renewal ends here: there are no third jobs. From now on it is about gear, cards, MVP bosses, deep dungeons, PvP and War of Emperium.']
];

/**
 * Every class with its paths: [first job, what it is, [[second job, transcendent job, what it is], ...]].
 * Route buttons come from the NPC list in WorldMap/ClassGuides.js.
 */
const classTrees = [
	['Swordman', 'Melee fighter with the most HP.', [
		['Knight', 'Lord Knight', 'Fast sword or spear fighter on a Peco Peco.'],
		['Crusader', 'Paladin', 'Shield tank with holy skills who protects the party.']
	]],
	['Mage', 'Spell caster with strong elemental magic.', [
		['Wizard', 'High Wizard', 'The strongest area spells in the game.'],
		['Sage', 'Professor', 'Support caster: auto-spells, dispel, elemental fields.']
	]],
	['Archer', 'Ranged damage with a bow.', [
		['Hunter', 'Sniper', 'Bow damage with a falcon and traps.'],
		['Bard', 'Clown', 'Male characters only. Songs that strengthen the party.'],
		['Dancer', 'Gypsy', 'Female characters only. Dances that weaken enemies.']
	]],
	['Acolyte', 'Healer and supporter.', [
		['Priest', 'High Priest', 'Main healer and buffer, strong against undead.'],
		['Monk', 'Champion', 'Fist fighter with combos and Asura Strike.']
	]],
	['Merchant', 'Trader with a cart and extra Zeny.', [
		['Blacksmith', 'Whitesmith', 'Axe fighter who forges and upgrades weapons.'],
		['Alchemist', 'Creator', 'Potion maker with a Homunculus companion.']
	]],
	['Thief', 'Fast, evasive dagger fighter.', [
		['Assassin', 'Assassin Cross', 'Katar or dual daggers, crits and poison.'],
		['Rogue', 'Stalker', 'Copies skills, strips gear, bow or dagger.']
	]]
];

const expandedTrees = [
	['Taekwon', 'Kick fighter. Has second jobs, but no rebirth.', [
		['Star Gladiator', '', 'Strongest on the maps and days it chooses.'],
		['Soul Linker', '', 'Caster who gives other classes spirit buffs.']
	]],
	['Ninja', 'Throwing weapons and ninja magic. No second job, no rebirth. Job Lv up to 70.', []],
	['Gunslinger', 'Guns at range. No second job, no rebirth. Job Lv up to 70.', []],
	['Super Novice', 'A Novice who learns most first-job skills. Needs Base Lv 45. No second job, no rebirth.', []]
];

function guideEntries(job) {
	return Object.values(classGuides).flat().filter(entry => entry[0] === job);
}

function classRoute(entry) {
	const [job, npc, area, destination, entrance] = entry;
	const current = (MapRenderer.currentMap || '').split('.')[0];
	const travel = secondJobTravel[job];
	if (!travel) {
		const target = job === 'Archer' && current !== 'payon_in02' && entrance ? entrance : destination;
		route(target, job + ' · ' + (target === entrance ? 'Guild entrance' : npc));
		return;
	}
	const [city, crystalName, , waypoint, walkingMaps = []] = travel;
	const destinationMap = destination.split(',')[0];
	const targetMap = entrance?.split(',')[0] || destinationMap;
	if (current !== city && current !== destinationMap && current !== targetMap && !walkingMaps.includes(current)) {
		Navigation.show();
		startQuestNavigation({ target: waypoint || (targetMap === city ? entrance || destination : [city, ...cityCrystals[city]].join(',')),
			label: 'City Crystal → ' + crystalName, classGuide: true });
		Navigation.setMinimized(true);
		return;
	}
	if (job === 'Hunter' && current === 'airplane') return;
	if (job === 'Hunter' && current === 'y_airport') {
		route('y_airport,145,63', 'Hunter · Domestic Boarding for Hugel');
		return;
	}
	const gateway = job === 'Crusader' || (job === 'Hunter' && current === 'yuno') ? waypoint : entrance;
	const inside = job === 'Knight' ? isInChivalry(current) : current === destinationMap;
	const target = inside ? destination : gateway || destination;
	route(target, job + ' · ' + (target === destination ? npc : job === 'Hunter' && current === 'yuno' ? 'Airship Staff' : area + ' entrance'));
}

function travelDirections(entry, compact = false) {
	const [job, npc, , destination, entrance] = entry;
	const travel = secondJobTravel[job];
	if (!travel) return '';
	const [, crystalName, approach, waypoint] = travel;
	const [, x, y] = (waypoint || entrance || destination).split(',');
	const [map, npcX, npcY] = destination.split(',');
	const steps = document.createElement('ol');
	steps.className = 'job-steps';
	for (const text of [
		'If you are outside the starting city, take the City Crystal to ' + crystalName + ' (100 Zeny).',
		approach + (approach.includes('(') || (!entrance && !waypoint) ? '' : ' Entrance: (' + x + ', ' + y + ').'),
		'Speak to ' + npc + ' (' + map + ' ' + npcX + ', ' + npcY + '). ' + secondJobApplications[job][0],
		secondJobApplications[job][1]
	]) {
		const step = document.createElement('li');
		step.textContent = text;
		steps.append(step);
	}
	if (!compact) return steps;
	const details = document.createElement('details');
	const summary = document.createElement('summary');
	summary.textContent = 'Travel and application';
	details.append(summary, steps);
	return details;
}

function routeButton(job, text) {
	const entries = guideEntries(job);
	if (!entries.length) return '';
	const fragment = document.createDocumentFragment();
	entries.forEach((entry, index) => {
		const [, npc, area] = entry;
		const button = document.createElement('button');
		button.type = 'button';
		button.title = npc + ' \u00B7 ' + area;
		button.textContent = entries.length > 1 ? `\u279C ${index + 1}. ${npc}` : text || '\u279C Route';
		button.addEventListener('click', () => classRoute(entry));
		fragment.append(button);
	});
	return fragment;
}

function classCard([job, about, branches]) {
	const card = document.createElement('article');
	card.className = 'class-card';
	const head = document.createElement('div');
	head.className = 'class-head';
	const name = document.createElement('strong');
	name.textContent = job;
	const text = document.createElement('span');
	const origin = guideEntries(job)[0]?.[2];
	text.textContent = origin ? about + ' Start in ' + origin + '.' : about;
	head.append(name, text, routeButton(job));
	card.append(head);
	if (branches.length) {
		const grid = document.createElement('div');
		grid.className = 'class-branches';
		for (const [second, trans, what] of branches) {
			const box = document.createElement('div');
			box.className = 'class-branch';
			const title = document.createElement('strong');
			title.textContent = second;
			const info = document.createElement('p');
			const trainer = guideEntries(second)[0]?.[2];
			info.textContent = trainer ? what + ' Job quest starts in ' + trainer + '.' : what;
			const entry = guideEntries(second)[0];
			box.append(title, info, entry ? travelDirections(entry, true) : '', routeButton(second, '\u279C Route to ' + second));
			if (trans) {
				const later = document.createElement('p');
				later.className = 'requires';
				later.textContent = 'After Rebirth: ' + trans;
				box.append(later, routeButton(trans, '\u279C Route to ' + trans));
			}
			grid.append(box);
		}
		card.append(grid);
	}
	return card;
}

function sectionTitle(text) {
	const title = document.createElement('h3');
	title.textContent = text;
	return title;
}

function renderClasses(list) {
	list.append(
		sectionTitle('Standard classes: Novice \u2192 first job \u2192 second job \u2192 Rebirth \u2192 final job'),
		...classTrees.map(classCard),
		sectionTitle('Expanded classes: separate paths without Rebirth'),
		...expandedTrees.map(classCard)
	);
}

/**
 * Dungeon Codex: every dungeon with suggested level, monsters, loot and a route to the entrance.
 * Sorted by level; the ones that fit the character's level are marked and opened.
 */
function renderDungeons(list) {
	const level = Number(Session.Entity?.clevel) || 0;
	const intro = guideCard(
		level ? 'Your Base Level: ' + level : 'Dungeon Codex',
		'Dungeons are sorted from easy to hard. "Good for you now" fits your level, "Next step" is the one to grow into. The suggested level is for the first floor up to the deepest floor.'
	);
	list.append(intro);
	let nextMarked = false;
	for (const [name, target, low, high, floors] of dungeonCodex) {
		const firstFloor = floors[0];
		const fits = level && level >= firstFloor[1] && level <= high;
		const next = level && !fits && level < firstFloor[1] && !nextMarked;
		if (next) nextMarked = true;
		const card = document.createElement('details');
		card.className = 'dungeon' + (fits ? ' fits' : '');
		const summary = document.createElement('summary');
		const title = document.createElement('strong');
		title.textContent = name;
		const range = document.createElement('span');
		range.textContent = ' · Base Lv ' + low + '–' + high + ' · ' + floors.length + (floors.length > 1 ? ' floors' : ' floor');
		summary.append(title, range);
		if (fits || next) {
			const badge = document.createElement('em');
			badge.textContent = fits ? 'Good for you now' : 'Next step';
			summary.append(badge);
		}
		card.append(summary);
		// Filled when opened: the full list is long
		card.addEventListener('toggle', () => {
			if (!card.open || card.dataset.filled) return;
			card.dataset.filled = '1';
			if (target) {
				const go = document.createElement('button');
				go.type = 'button';
				go.textContent = '➜ Route to the entrance';
				go.addEventListener('click', () => startQuestNavigation({ target, label: name + ' entrance', classGuide: false }));
				card.append(go);
			} else {
				const note = document.createElement('p');
				note.className = 'requires';
				note.textContent = 'No walking route: this dungeon is entered through an NPC or a quest.';
				card.append(note);
			}
			floors.forEach(([map, from, to, monsters], index) => {
				const floor = document.createElement('div');
				floor.className = 'dungeon-floor';
				const head = document.createElement('strong');
				head.textContent = `Floor ${index + 1} · ${DB.getMapName(map + '.rsw', '') || DB.getMapName(map, '') || map} · Base Lv ${from}–${to}`;
				floor.append(head);
				for (const [monster, monsterLevel, count, mvp, drops] of monsters) {
					const row = document.createElement('p');
					const label = document.createElement('b');
					label.textContent = `${mvp ? '☠ MVP ' : ''}${monster} · Lv ${monsterLevel} · x${count}`;
					row.append(label, drops.length ? ' — ' + drops.join(', ') : '');
					floor.append(row);
				}
				card.append(floor);
			});
		});
		list.append(card);
	}
}

function renderPaths(list) {
	const hint = guideCard('Where is my job NPC?', 'Open Classes and choose a branch. Each second-job card shows the starting town and the Route button for that NPC.');
	list.append(
		...pathSteps.map(([title, description]) => guideCard(title, description)),
		hint
	);
	list.append(
		...classPaths.map(([job, choice, lines]) => {
			const card = guideCard(job + ' → ' + choice, '');
			card.querySelector('p').remove();
			for (const line of lines) {
				const row = document.createElement('p');
				row.textContent = '• ' + line;
				card.append(row);
			}
			return card;
		})
	);
}

function route(target, label) {
	Navigation.show();
	Navigation.setNaviInfo(target, label, { classGuide: true });
	// The route is drawn on the minimap: keep the navigation window small
	Navigation.setMinimized(true);
}

function renderTab() {
	const root = ClassGuide.getRoot();
	root.querySelectorAll('.tabs button').forEach(button => {
		button.classList.toggle('active', button.dataset.tab === _activeTab);
	});
	root.querySelector('.tier-note').textContent = tierNotes[_activeTab] || '';

	const list = root.querySelector('.list');
	if (_activeTab === 'Stats' || _activeTab === 'Endgame' || _activeTab === 'Paths' || _activeTab === 'Classes' || _activeTab === 'Dungeons') {
		list.replaceChildren();
		if (_activeTab === 'Stats') renderStats(list);
		else if (_activeTab === 'Classes') renderClasses(list);
		else if (_activeTab === 'Dungeons') renderDungeons(list);
		else if (_activeTab === 'Paths') renderPaths(list);
		else list.append(...endgame.map(([title, description]) => guideCard(title, description)));
		list.scrollTop = 0;
		return;
	}
	const fragment = document.createDocumentFragment();
	for (const [job, npc, area, destination, entrance, note] of classGuides[_activeTab] || []) {
		const card = document.createElement('article');
		const name = document.createElement('strong');
		name.textContent = job + ' · ' + npc;
		card.append(name);
		if (requirements[job]) {
			const requires = document.createElement('p');
			requires.className = 'requires';
			requires.textContent = 'Requires: ' + requirements[job];
			card.append(requires);
		}
		const location = document.createElement('p');
		location.textContent = area + ' · ' + destination.replaceAll(',', ' ');
		card.append(location, travelDirections([job, npc, area, destination, entrance]));
		if (note) {
			const details = document.createElement('p');
			details.textContent = note;
			card.append(details);
		}
		for (const [target, label] of [[destination, secondJobTravel[job] ? 'Start route' : 'Route to NPC'], [entrance, 'Route to entrance']]) {
			if (!target) continue;
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = label;
			button.addEventListener('click', () => {
				if (target === destination && secondJobTravel[job]) classRoute([job, npc, area, destination, entrance]);
				else route(target, job + ' · ' + (target === destination ? npc : 'Entrance'));
			});
			card.append(button);
		}
		fragment.append(card);
	}
	list.replaceChildren(fragment);
	list.scrollTop = 0;
}

ClassGuide.init = function init() {
	const root = this.getRoot();
	this._host.style.top = '120px';
	this._host.style.left = '260px';
	this.draggable('.titlebar');

	const closeBtn = root.querySelector('.close');
	closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
	closeBtn.addEventListener('click', () => ClassGuide.remove());

	const tabs = root.querySelector('.tabs');
	for (const tab of ['Classes', 'Second jobs', 'Paths', 'Dungeons', 'Stats', 'Endgame']) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.tab = tab;
		button.textContent = tab.replace('Paths', 'Road to the endgame').replace('Dungeons', 'Dungeon Codex');
		button.addEventListener('click', () => {
			_activeTab = tab;
			renderTab();
		});
		tabs.append(button);
	}
};

ClassGuide.onAppend = function onAppend() {
	renderTab();
};

ClassGuide.showPaths = function showPaths() {
	_activeTab = 'Paths';
	if (!this._host?.parentNode) this.append();
	else renderTab();
};

ClassGuide.showSecondJobs = function showSecondJobs() {
	_activeTab = 'Second jobs';
	if (!this._host?.parentNode) this.append();
	else {
		renderTab();
		this.focus();
	}
};

ClassGuide.showStats = function showStats() {
	_activeTab = 'Stats';
	if (!this._host?.parentNode) this.append();
	else renderTab();
};

/**
 * Open the window, or close it when it is already open
 */
ClassGuide.toggle = function toggle() {
	if (this._host && this._host.parentNode) {
		this.remove();
	} else {
		this.append();
	}
};

export default UIManager.addComponent(ClassGuide);
