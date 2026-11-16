import { cityCrystals } from 'DB/Map/CityCrystals.js';
import QuestMarks from './QuestMarks.js';
import { mapExits } from 'DB/Map/MapExits.js';

function nearestCrystalMap(current) {
	const queue = [current];
	const seen = new Set(queue);
	for (const map of queue) {
		if (cityCrystals[map]) return map;
		for (const [, , next] of mapExits[map] || []) {
			if (seen.has(next)) continue;
			seen.add(next);
			queue.push(next);
		}
	}
	return null;
}
/**
 * UI/Components/Quest/QuestHelperCommon.js
 *
 * Shared factory for the Quest information (helper) windows.
 *
 * Collapses the QuestHelper version siblings into a single
 * createQuestHelper(config) factory. Each version file passes its own
 * htmlText/cssText plus capability flags describing its real differences:
 *   - QuestHelper   : renewal layout (`renewLayout`), poring icons, reward /
 *                     deadline panels, shares the `Quest` preference key.
 *   - QuestHelperV1 : classic layout, monster <select> with killed/limited
 *                     counters, own `QuestHelperV1` preference key.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import { classGuides } from 'UI/Components/WorldMap/ClassGuides.js';
import { questNpcTargets } from 'DB/Map/QuestNpcTargets.js';
import { questItemNeeds } from 'DB/Map/QuestItemNeeds.js';
import { questDrops, questMonsters, questShops } from 'DB/Map/QuestSources.js';

/**
 * Find where a quest can be navigated to: the quest's own NPC position when
 * the client data has one, else the job NPC for "Job Change to <Job>" quests.
 * @param {object} quest
 * @returns {{target: string, label: string, classGuide: boolean}|null}
 */
export function getQuestNaviTarget(quest) {
	if (quest.questID === 1013) {
		return { target: 'moc_prydb1,42,133', label: 'Comrade', classGuide: true };
	}
	if (quest.npc_navi && quest.npc_pos_x && quest.npc_pos_y) {
		return { target: `${quest.npc_navi},${quest.npc_pos_x},${quest.npc_pos_y}`, label: quest.title, classGuide: false };
	}
	const match = /^Job Change to ([A-Za-z -]+)/.exec(quest.title || '');
	const serverTarget = questNpcTargets[quest.questID];
	if (quest.questID >= 6015 && quest.questID <= 6018 && serverTarget) {
		return { target: serverTarget[0], label: serverTarget[1], classGuide: true };
	}
	if (serverTarget) {
		return { target: serverTarget[0], label: serverTarget[1], classGuide: !!match };
	}
	if (match) {
		const job = match[1].trim().toLowerCase().replace(/-/g, ' ');
		for (const guides of Object.values(classGuides)) {
			for (const guide of guides) {
				if (guide[0].toLowerCase() === job) {
					return { target: guide[3], label: `${guide[0]} · ${guide[1]}`, classGuide: true };
				}
			}
		}
	}
	return null;
}

/**
 * Where the quest's task itself happens, for quests whose goal is not an NPC hand-in.
 * Hand-written: quest ID -> [target, label].
 */
const questGoals = {
	1004: ['pay_fild08,32,74', 'Willows · Payon Field 08'],
	65012: ['izlu2dun,108,83', 'Byalan entrance'],
	65013: ['alb2trea,88,111', 'Sunken Ship entrance'],
	65010: ['prontera,156,22', 'Prontera South Gate'],
	65011: ['prt_fild05,274,208', 'Culvert Guide west of Prontera'],
	65009: ['mjolnir_03,24,258', 'Mount Mjolnir'],
	65008: ['prontera,218,211', 'Pet Groomer · Prontera'],
	65007: ['gef_tower,153,28', 'Geffen Dungeon entrance'],
	65005: ['pay_arche,36,131', 'Payon Cave entrance'],
	65000: ['moc_fild12,155,377', 'Southern Morroc Field'],
	65003: ['moc_ruins,54,161', 'Pyramid entrance'],
	65001: ['moc_fild12,155,377', 'Drops in Southern Morroc Field'],
	1001: ['prt_fild03,365,255', 'Father Rubalkabara'],
	1002: ['moc_fild07,41,355', 'Mother Mathilda'],
	1003: ['prt_fild00,208,218', 'Father Yosuke'],
	1005: ['geffen_in,164,112', 'Mixing Machine'],
	1006: ['geffen_in,164,112', 'Mixing Machine'],
	1007: ['geffen_in,164,112', 'Mixing Machine'],
	1008: ['geffen_in,164,112', 'Mixing Machine'],
	1013: ['moc_ruins,141,125', 'Mr. Irrelevant (takes you to the mushroom farm)']
};

/**
 * Step-by-step guides for quests that need several things from different places.
 * Hand-written from the server scripts. A step: text, navi [target, label] and the
 * items that prove it is done. `result` marks the step whose item replaces everything before it.
 */
function mageSteps(no, jellopy, fluff, milk, solvent, code, catalyst, result) {
	const loot = `${jellopy} Jellopy and ${fluff} Fluff`;
	const steps = [
		{
			text: `Collect ${loot}. Fabre drop Fluff, Poring and Fabre drop Jellopy. Both live just outside the west gate of Geffen.`,
			navi: ['gef_fild07,336,187', 'Fabre and Poring · west of Geffen'],
			items: [[909, jellopy], [914, fluff]]
		}
	];
	if (milk) {
		steps.push({
			text: `Buy ${milk} Milk from the Milk Vendor in Prontera (25 Zeny).`,
			navi: ['prontera,73,140', 'Milk Vendor'],
			items: [[519, milk]]
		});
	}
	if (solvent === 'payon') {
		steps.push({
			text: 'Get the Payon Solution from Dollshoi in Archer Village. He wants 50 Zeny and the Empty Test Tube the Mage Guildsman gave you.',
			navi: ['pay_arche,122,100', 'Dollshoi · Payon Solution'],
			items: [[1089, 1]]
		});
	} else if (solvent === 'morocc') {
		steps.push({
			text: 'Get the Morocc Solution from Ponka-Hontas at the pyramid entrance near Morroc. He wants 50 Zeny and the Empty Test Tube the Mage Guildsman gave you.',
			navi: ['moc_ruins,91,150', 'Ponka-Hontas · Morocc Solution'],
			items: [[1088, 1]]
		});
	}
	const solventName = solvent === 'payon' ? 'Payon Solution' : solvent === 'morocc' ? 'Morocc Solution' : 'No Solvent';
	steps.push({
		text: `Use the Mixing Machine in the Geffen Mage Guild. Solvent: "${solventName}". Amounts: Jellopy ${jellopy}, Fluff ${fluff}${milk ? `, Milk ${milk}` : ''}. Serial number: ${code}. Catalyst: "${catalyst}".`,
		navi: ['geffen_in,164,112', 'Mixing Machine'],
		items: [[result, 1]],
		result: true
	});
	steps.push({
		text: `Give Mixed Solution No. ${no} to the Mage Guildsman. He stands right next to the machine.`,
		navi: ['geffen_in,164,124', 'Mage Guildsman']
	});
	return steps;
}

function acolyteSteps(who, navi) {
	return [
		{ text: 'You applied with the Cleric in the Prontera Church (north-east corner of Prontera).', navi: ['prt_church,184,41', 'Cleric'] },
		{ text: `Visit ${who}, and talk to them. Nothing to fight or collect: it is a pilgrimage.`, navi },
		{ text: 'Go back to the Cleric in the Prontera Church. He makes you an Acolyte.', navi: ['prt_church,184,41', 'Cleric'] }
	];
}

function merchantSteps(recipient, navi, serials) {
	return [
		{
			text: `Get the package from the Merchant Guildsman in the storehouse, the room to the right of Chief Mahnsoo. Tell him your destination and the serial number Chief Mahnsoo gave you (${serials}).`,
			navi: ['alberta_in,28,29', 'Merchant Guildsman · storehouse'],
			any: [1081, 1082, 1091]
		},
		{
			text: `Deliver the package to ${recipient}. You get a voucher back.`,
			navi,
			any: [1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080],
			result: true
		},
		{
			text: 'Bring the voucher back to the Merchant Guildsman in the storehouse in Alberta.',
			navi: ['alberta_in,28,29', 'Merchant Guildsman · storehouse']
		},
		{
			text: 'Talk to Chief Mahnsoo. If you paid only 500 Zeny at the start, pay the other 500 now. Then you become a Merchant.',
			navi: ['alberta_in,53,43', 'Chief Mahnsoo']
		}
	];
}

const questSteps = {
	1001: acolyteSteps('Father Rubalkabara, in the fields north-east of Prontera', ['prt_fild03,365,255', 'Father Rubalkabara']),
	1002: acolyteSteps('Mother Mathilda, in the desert north of Morroc', ['moc_fild07,41,355', 'Mother Mathilda']),
	1003: acolyteSteps('Father Yosuke, on the bridge in the field north-west of Prontera', ['prt_fild00,208,218', 'Father Yosuke']),
	1004: [
		{ text: 'You applied with the Archer Guildsman in the Archer Village (north of Payon).', navi: ['payon_in02,64,71', 'Archer Guildsman'], check: () => true },
		{ text: 'Collect 25 points of Trunks from Willows, the walking tree stumps in the forest east of the Archer Village. Points per trunk: Fine-grained 5, Solid 3, Barren 2, plain Trunk 1.', navi: ['pay_fild08,32,74', 'Willows · Payon forest'], check: quest => !!getQuestItemProgress(quest)?.done, result: true },
		{ text: 'Bring the trunks back to the Archer Guildsman. He makes you an Archer.', navi: ['payon_in02,64,71', 'Archer Guildsman'] }
	],
	1013: [
		{ text: 'You signed up with the Thief Guide in the Pyramid basement.', navi: ['moc_prydb1,39,129', 'Thief Guide'], check: () => true },
		{ text: 'Talk to Mr. Irrelevant outside the Pyramid. He takes you to the mushroom farm.', navi: ['moc_ruins,141,125', 'Mr. Irrelevant'], check: () => QuestMarks.currentMap === 'job_thief1' },
		{ text: 'On the farm, collect 25 points of mushrooms: Orange Net Mushroom 3 points, Orange Gooey Mushroom 1 point. Watch out for the monsters between them.', check: quest => !!getQuestItemProgress(quest)?.done, result: true },
		{ text: 'Leave the farm through an exit and bring the mushrooms to Comrade in the Pyramid basement. He makes you a Thief.', navi: ['moc_prydb1,42,133', 'Comrade'] }
	],
	1005: mageSteps(1, 2, 3, 1, 'payon', 8472, 'Yellow Gemstone', 1071),
	1006: mageSteps(2, 3, 1, 1, null, 3735, 'Red Gemstone', 1085),
	1007: mageSteps(3, 6, 1, 0, 'payon', 2750, 'Blue Gemstone', 1086),
	1008: mageSteps(4, 2, 3, 0, 'morocc', 5429, '1carat Diamond', 1087),
	1009: merchantSteps('the Kafra Employee Blossom in Prontera (south-east corner of the city)', ['prontera,248,42', 'Kafra Employee Blossom'], '2485741 or 2328137'),
	1010: merchantSteps('the Guild Staff in the Geffen Mage Guild', ['geffen_in,155,122', 'Guild Staff'], '2989396 or 2191737'),
	1011: merchantSteps('the Student of the dyemaker in Morroc', ['morocc_in,140,102', 'Student'], '3012685 or 3487372'),
	1012: merchantSteps('the Kafra Employee on Byalan Island (boat from Izlude, 150 Zeny). Also give her the message from Chief Mahnsoo', ['izlu2dun,106,58', 'Kafra Employee · Byalan Island'], '3318702 or 3543625'),
	1014: [
		{ text: 'Sign up with the Swordman in the Izlude Swordman Guild.', navi: ['izlude_in,74,172', 'Swordman'] },
		{ text: 'Talk to the Swordman at the door on the left. He lets you into the waiting room.', navi: ['izlude_in,62,170', 'Swordman · test entrance'] },
		{ text: 'In the waiting room, talk to the Test Hall Staff to start. Cross all three courses within 10 minutes. Stay on the path: if you fall, you start that course again.' },
		{ text: 'After the third course, go back to the Swordman where you signed up.', navi: ['izlude_in,74,172', 'Swordman'] }
	]
};

/**
 * The guide of a quest with each step marked done or not, or null when the quest has none.
 * @param {object} quest
 * @returns {Array<{text: string, navi?: string[], done: boolean, current: boolean}>|null}
 */
/**
 * Job tests that run through several quest entries: the open step is the one that holds the current quest ID.
 * Hand-written from the server job scripts. A step: ids (quest IDs it covers), text, navi [target, label].
 */
const questChains = {};
function addChain(steps) {
	steps.forEach((step, index) => {
		for (const id of step.ids) {
			questChains[id] = { steps, index };
		}
	});
}

// Knight (jobs/2-1/knight.txt)
addChain([
	{ ids: [9000], text: 'You applied with the Chivalry Captain. Now talk to Sir Andrew in the same hall. At Job Lv 50 he skips his item test.', navi: ['prt_in,75,107', 'Sir Andrew'] },
	{ ids: [9001], alt: true, text: 'Collect five of each material in Objectives and sources, then return to Sir Andrew.', navi: ['prt_in,75,107', 'Sir Andrew'] },
	{ ids: [9002], alt: true, text: 'Collect five of each material in Objectives and sources, then return to Sir Andrew.', navi: ['prt_in,75,107', 'Sir Andrew'] },
	{ ids: [9003], text: 'Sir Siracuse asks eight questions. Answers: Flamberge / Provoke Lv.10 / Spear Boomerang Lv.3 / Zephyrus / 80 % of normal attack speed / Tell the Novice of a reasonable hunting area / Protect everyone in the front of the battle / Honor.', navi: ['prt_in,71,91', 'Sir Siracuse'] },
	{ ids: [9004, 9005, 9006], text: 'Sir Windsor sends you to the battle test. Enter the waiting room and defeat every monster in three rounds. Each round has a 3 minute limit, so bring potions.', navi: ['prt_in,79,94', 'Sir Windsor'] },
	{ ids: [9007, 9008], text: 'Lady Amy asks ten questions about manners. Answers: Open a chat room and wait / Check out the area and plan ahead / Defend while the party retreats / Ask your party\'s Priest to help / Decide with party who gets it / Open a chat room and wait / Give suggestions for a place to hunt / Lead the person to the exit / Would it be possible to get a heal please? / Ask around to find the owner.', navi: ['prt_in,69,107', 'Lady Amy'] },
	{ ids: [9009, 9010], text: 'Sir Edmond tests your patience. In his room, do not attack anything, whatever walks up to you. Just wait until you are sent back.', navi: ['prt_in,70,99', 'Sir Edmond'] },
	{ ids: [9011], text: 'Sir Gray asks why you want to be a Knight. Answers: To become stronger... / I can protect others. / There are those waiting for me. / My friends.', navi: ['prt_in,87,92', 'Sir Gray'] },
	{ ids: [9012], text: 'All tests passed. Go back to the Chivalry Captain: he makes you a Knight.', navi: ['prt_in,88,101', 'Chivalry Captain'] }
]);

// Crusader (jobs/2-2/crusader.txt)
const crusaderAfterItems = [
	{ ids: [3009, 3010], text: 'Patience test with the Man in Anguish (Murnak Mijoul) in the Prontera Castle. You must wear a Rosary: the Nun in the Prontera Church sells it. In his corridor, walk to the far end and do not kill a single monster.', navi: ['prt_castle,164,32', 'Man in Anguish'] },
	{ ids: [3011, 3012], text: 'Knowledge test with the Crusader Gabriel Valentine in the Prontera Church: one of three sets of ten questions. Set A: Holy / 25 % / Monk Hat / Zombie Prisoner / Drake / Orc Zombie Card / Childhood friends in the same village / Skeleton / Amulet Shield / Munak. Set B: Isis / Decussate Tsurugi / Golden Hammer / Marionette / Ghostring / Shield from Hell / Earth / Whisper / Increase defense against Ghost attacks by 30 % / Put Holy Water on a weapon and attack. Set C: Level 3 / 440 / 21 / Zephyrus / Level 2 / 80 % of normal speed / Only Acolytes can learn the skill / 31 / Curse / One preparing for the Holy War.', navi: ['prt_church,95,127', 'Crusader Gabriel Valentine'] },
	{ ids: [3013, 3014], text: 'Battle test with the Patron Knight (Bliant Piyord) in the Prontera Castle. Wear the Rosary and bring 1 Holy Water (Acolytes and Priests make it with Aqua Benedicta). Enter the waiting room, then fight your way through the hall and defeat every undead wave.', navi: ['prt_castle,35,151', 'Patron Knight'] },
	{ ids: [3015], text: 'All tests passed. Go back to the Senior Crusader: he makes you a Crusader.', navi: ['prt_castle,45,169', 'Senior Crusader'] }
];
addChain([
	...[
	[3006, 'Decayed Nail (Zombie, Payon Cave), Stinky Scale (Megalodon, Beach Dungeon), Worn-out Prison Uniform (Zombie Prisoner, Glast Heim prison) and Daenggie (Munak, Payon Cave)'],
	[3007, 'Skel-Bone (Soldier Skeleton and other skeletons), Orc Claw (Orc Zombie, Orc Dungeon), Manacles (Skeleton Prisoner, Glast Heim prison) and Short Daenggie (Bongun, Payon Cave)'],
	[3008, 'Horrendous Mouth (Ghoul, Glast Heim), Rotten Bandage (Mummy, Morroc Pyramid), Lantern (Skeleton Worker, Coal Mine) and Jack o\' Pumpkin (Jakk, Geffen Dungeon)']
	].map(([id, list]) => ({
		ids: [id],
		alt: true,
		text: `Bring the Senior Crusader in the Prontera Castle 10 of each: ${list}. Shortcut: with a Chivalry Emblem and a Hand of God in your inventory he skips this test.`,
		navi: ['prt_castle,45,169', 'Senior Crusader']
	})),
	...crusaderAfterItems
]);

// Priest (jobs/2-1/priest.txt)
addChain([
	{ ids: [8009], text: 'You applied with the High Bishop (Bishop Paul) in the Prontera Church. Talk to him again for the first test. At Job Lv 50 he skips the pilgrimage.', navi: ['prt_church,16,41', 'High Bishop'] },
	{ ids: [8010], text: 'Pilgrimage: visit three ascetics in exactly this order and talk to each. 1. Father Rubalkabara, north-east of Prontera. 2. Mother Mathilda, in the desert near Morroc. 3. Father Yosuke, north-west of Prontera. Then go back to the High Bishop.', navi: ['prt_fild03,365,255', 'Father Rubalkabara (first stop)'] },
	{ ids: [8011, 8012], text: 'Exorcism test: the High Bishop sends you to Father Peter. Defeat every Zombie in the hall within 5 minutes and take the warp at the end. Four demons then try to tempt you. Always refuse: "Out of my sight, demon!" and "Silence!" (Deviruchi), "No deal... Doppelganger." and "I\'ll never listen to you!" (Doppelganger), "God will protect me." and "Begone, vile fiend!" (Dark Lord), "No, Baphomet. You lose." (Baphomet). In the last hall, get past the Mummies to the exit.', navi: ['prt_church,16,41', 'High Bishop'] },
	{ ids: [8013, 8014], text: 'Vows with Sister Cecilia in the Prontera Church. Answers in order: Yes / No / Yes / Yes / No / No / Yes / I do.', navi: ['prt_church,27,24', 'Sister Cecilia'] },
	{ ids: [8015, 8016], text: 'All tests passed. Go back to the High Bishop: he makes you a Priest.', navi: ['prt_church,16,41', 'High Bishop'] }
]);

// Monk (jobs/2-2/monk.txt)
addChain([
	{ ids: [3016], text: 'You applied with the Guarding Monk at the St. Capitolina Abbey. Go inside to Sensei Moohae: he gives you one of seven collecting tasks.', navi: ['monk_in,99,58', 'Sensei Moohae'] },
	...[
		[3017, '5 Sticky Mucus (Poporing), 10 Earthworm Peeling (Hode, desert near Morroc) and 20 Green Herb (Green Plants)'],
		[3018, '20 Yoyo Tail (Yoyo, north-east of Prontera), 5 Iron Ore (Metaling, also general loot) and 3 Blue Herb (Blue Plants)'],
		[3019, '30 Stem (Mandragora, west of Prontera), 5 Jellopy (Poring) and 10 Worm Peeling (Andre and Deniro, Ant Hell)'],
		[3020, '5 Solid Shell (Hunter Fly, Geffen Dungeon), 20 Shell (Chonchon and Steel Chonchon) and 5 Zargon (Karakasa in Amatsu, Deviling, Gargoyle in Glast Heim)'],
		[3021, '5 Cyfar (Wild Rose, near Geffen), 10 White Herb (White Plants) and 10 Yellow Herb (Yellow Plants)'],
		[3022, '10 Tooth of Bat (Familiar), 5 Bear\'s Footskin (Bigfoot, Payon forest) and 20 Poison Spore (Poison Spore, Payon forest)'],
		[3023, '5 Porcupine Quill (Caramel, Mt. Mjolnir), 20 Cobweb (Argos, Mt. Mjolnir) and 10 Bug Leg (Argiope, Mt. Mjolnir)']
	].map(([id, list]) => ({ ids: [id], alt: true, text: `Bring Sensei Moohae: ${list}.`, navi: ['monk_in,99,58', 'Sensei Moohae'] })),
	{ ids: [3024, 3025], text: 'Touha, in the east of the abbey, speaks one of three pledges. Then pick its ten lines in the same order. Pledge 1: I seek the path / of enlightenment. / We monks / shall hold true / to what we believe / and will help protect others / through the teachings / we learn through our lives. / In nomine Patris, et Filii / et Spiritus Sancti. Pledge 2: I commit myself to / veritas and aequitas. / I will follow my path / to enlightenment and purity. / I will protect my / brothers with my life. / Evil shall never be / victorious while I breathe. / In nomine Patris, et Filii / et Spiritus Sancti. Pledge 3: And shepherds we shall be, / for thee my lord for thee. / Power hath descended forth / from the hand / so our feet may swiftly carry / out thy command. And we shall / flow a river forth to thee and / teeming with souls shall it ever be / In nomine Patris, et Filii / et Spiritus Sancti.', navi: ['prt_monk,251,255', 'Touha'] },
	{ ids: [3026], text: 'Talk to Boohae. Answers: "Touha sent me." / "We recited a holy pledge." / "He modified my body." Then choose your test: Gathering mushrooms or Marathon.', navi: ['prt_monk,57,179', 'Boohae'] },
	{ ids: [3027], text: 'Mushroom test: the Door Keeper lets you in, Bashu sends you to the garden. Collect 30 mushrooms of one kind (30 Orange Net Mushroom or 30 Orange Gooey Mushroom) and give them to Hyunmoo.', navi: ['prt_monk,199,169', 'Door Keeper'] },
	{ ids: [3028], text: 'Marathon test: the Door Keeper lets you in, Bashu sends you to the track. Run ten laps to the Supervisor. Stay on the path: a trap sends you back to the start. You may quit at the Apprentice Monk and do the mushrooms instead.', navi: ['prt_monk,199,169', 'Door Keeper'] },
	{ ids: [3029, 3031], text: 'Last test with Tomoon, in the deepest room behind the Door Keeper: he sends you into a maze. Kill every monster on your way and reach the end.', navi: ['prt_monk,199,169', 'Door Keeper'] },
	{ ids: [3032], text: 'Tomoon gave you a green potion. Go back to Sensei Moohae. If he asks for it, drink the potion and talk to him again: he makes you a Monk.', navi: ['monk_in,99,58', 'Sensei Moohae'] }
]);

/** Items a job test asks for, where the generated table has none: quest ID -> [[item, amount], ...] */
const extraItemNeeds = {
	9001: [[1040, 5], [7006, 5], [931, 5], [1057, 5], [903, 5], [1028, 5]],
	9002: [[1042, 5], [950, 5], [1032, 5], [966, 5], [7031, 5], [946, 5]],
	3006: [[957, 10], [959, 10], [1099, 10], [901, 10]],
	3007: [[932, 10], [1043, 10], [1098, 10], [1094, 10]],
	3008: [[958, 10], [930, 10], [1041, 10], [1062, 10]],
	3017: [[938, 5], [1055, 10], [511, 20]],
	3018: [[942, 20], [1002, 5], [510, 3]],
	3019: [[905, 30], [909, 5], [955, 10]],
	3020: [[943, 5], [935, 20], [912, 5]],
	3021: [[7053, 5], [509, 10], [508, 10]],
	3022: [[913, 10], [948, 5], [7033, 20]],
	3023: [[1027, 5], [1025, 20], [1042, 10]]
};

export function getQuestSteps(quest) {
	const chain = questChains[quest.questID];
	if (chain) {
		// "alt" steps are variants of the same task (different item lists): only the one you got is shown
		return chain.steps
			.map((step, index) => ({
				text: step.text,
				navi: step.navi,
				done: index < chain.index,
				current: index === chain.index,
				hidden: !!step.alt && index !== chain.index
			}))
			.filter(step => !step.hidden);
	}
	const steps = questSteps[quest.questID];
	if (!steps) {
		return null;
	}
	const tracked = steps.some(step => step.items || step.any || step.check);
	const out = steps.map(step => ({
		text: step.text,
		navi: step.navi,
		result: step.result,
		done: step.check ? !!step.check(quest) : step.any ? step.any.some(id => itemCount(id) > 0) : !!step.items && step.items.every(([id, amount]) => itemCount(id) >= amount),
		current: false
	}));
	// A finished result (the mixed solution) means everything before it is done, even though the ingredients are gone
	for (let i = out.length - 1, covered = false; i >= 0; --i) {
		out[i].done = out[i].done || covered;
		covered = covered || (out[i].result && out[i].done);
	}
	const current = tracked && out.find(step => !step.done);
	if (current) {
		current.current = true;
	}
	return out;
}

/**
 * @param {object} quest
 * @returns {{target: string, label: string, classGuide: boolean}|null}
 */
export function getQuestGoalTarget(quest) {
	// A step-by-step quest leads to the step that is open right now
	const step = (getQuestSteps(quest) || []).find(entry => entry.current);
	if (step && step.navi) {
		return { target: step.navi[0], label: step.navi[1], classGuide: true };
	}
	const goal = questGoals[quest.questID];
	return goal ? { target: goal[0], label: goal[1], classGuide: quest.questID < 65000 } : null;
}

/**
 * Start the arrow navigation to a quest target
 * @param {{target: string, label: string, classGuide: boolean}} navi
 */
const harborRoutes = [
	{ island: 'izlu2dun', dungeon: /^iz_dun/, city: 'izlude', outbound: 'izlude,201,181', inbound: 'izlu2dun,108,27', sailor: 'Sailor · Byalan Island (150 Zeny)' },
	{ island: 'alb2trea', dungeon: /^treasure/, city: 'alberta', outbound: 'alberta,189,151', inbound: 'alb2trea,39,50', sailor: 'Fisk · Sunken Ship (250 Zeny)' }
];

function resolveHarborWaypoint(navi, current) {
	const destination = navi.target.split(',')[0];
	for (const route of harborRoutes) {
		const offshore = map => map === route.island || route.dungeon.test(map);
		if (!offshore(current) && offshore(destination)) return { ...navi, target: route.outbound, label: route.sailor };
		if (offshore(current) && destination === route.city) return { ...navi, target: route.inbound, label: 'Return ferry to ' + route.city };
	}
	return navi;
}

const chivalryTargets = new Set([
	'prt_in,88,101', 'prt_in,75,107', 'prt_in,71,91', 'prt_in,79,94',
	'prt_in,69,107', 'prt_in,70,99', 'prt_in,87,92'
]);

export function isInChivalry(map) {
	const [x, y] = Session.Entity?.position || [];
	return map === 'prt_in' && x >= 63 && x <= 94 && y >= 86 && y <= 113;
}

export function startQuestNavigation(navi) {
	if (chivalryTargets.has(navi.target) && !isInChivalry(QuestMarks.currentMap)) {
		navi = { ...navi, target: 'prontera,45,346', label: 'Prontera Chivalry entrance (45, 346)' };
	}
	navi = resolveHarborWaypoint(navi, QuestMarks.currentMap);
	Navigation.uid = navi.target;
	const destination = navi.target.split(',')[0];
	const current = QuestMarks.currentMap;
	if (navi.target === 'payon_in02,64,71' && current !== 'payon_in02') {
		Navigation.setNaviInfo('pay_arche,145,165', 'Archer Guild entrance', { classGuide: true, serverPortals: true });
		return;
	}
	const crystalMap = current !== destination && cityCrystals[destination] && nearestCrystalMap(current);
	if (crystalMap) {
		Navigation.setNaviInfo([crystalMap, ...cityCrystals[crystalMap]].join(','), 'City Crystal → ' + (DB.getMapName(destination, '') || destination), { serverPortals: true });
		return;
	}
	Navigation.setNaviInfo(navi.target, navi.label, { classGuide: navi.classGuide, serverPortals: true });

}

/**
 * Items a quest wants collected. Hand-written: quest ID -> what counts and how much is needed.
 * items: [item ID, name, points each]
 */
const questItemGoals = {
	1004: {
		need: 25,
		unit: 'points',
		items: [[1066, 'Grade S trunk', 5], [1067, 'Grade A trunk', 3], [1068, 'Grade B trunk', 2], [1019, 'Grade C trunk', 1]]
	},
	1013: {
		need: 25,
		unit: 'points',
		items: [
			[1069, 'Orange Net Mushroom', 3],
			[1070, 'Orange Gooey Mushroom', 1]
		]
	}
};

/**
 * How far the player is with a collection quest, read from the inventory.
 * @param {object} quest
 * @returns {{lines: string[], have: number, need: number, done: boolean}|null} null when the quest collects nothing known
 */
function itemCount(id) {
	return (Inventory.list || []).reduce((count, item) =>
		item?.ITID === id ? count + (Number(item.count) || 1) : count, 0);
}

export function getQuestProgress(quest) {
	const items = getQuestItemProgress(quest);
	const hunts = Object.values(quest.hunt_list || {}).filter(hunt => Number(hunt.maxCount) > 0);
	const have = (items?.have ?? 0) + hunts.reduce((sum, hunt) => sum + Math.min(Number(hunt.huntCount) || 0, Number(hunt.maxCount)), 0);
	const need = (items?.need ?? 0) + hunts.reduce((sum, hunt) => sum + Number(hunt.maxCount), 0);
	const turnIn = getQuestNaviTarget(quest);
	const dialogueStep = [6015, 6017, 65002, 65004, 65006, 65017].includes(Number(quest.questID));
	const done = need > 0 ? (!items || items.done) && hunts.every(hunt => Number(hunt.huntCount) >= Number(hunt.maxCount)) : dialogueStep;
	const goal = getQuestGoalTarget(quest);
	return { have, need, done, goal, turnIn, target: done ? turnIn : goal || turnIn };
}

export function getQuestItemProgress(quest) {
	const goal = questItemGoals[quest.questID];
	if (!goal) {
		// Items the turn-in NPC takes, read from the server scripts
		const mageSolution = { 1005: 1071, 1006: 1085, 1007: 1086, 1008: 1087 }[quest.questID];
		const needs = mageSolution ? [[mageSolution, 1]] : [6016, 6018].includes(Number(quest.questID))
			? [[7053, 5], [1010, 1]]
			: extraItemNeeds[quest.questID] || questItemNeeds[quest.questID];
		if (!needs) {
			return null;
		}
		const lines = [];
		const objectives = [];
		let have = 0;
		let need = 0;
		let done = true;
		for (const [itemId, amount] of needs) {
			const count = itemCount(itemId);
			const info = DB.getItemInfo(itemId);
			const name = (info && info.identifiedDisplayName) || 'Item ' + itemId;
			have += Math.min(count, amount);
			need += amount;
			if (count < amount) {
				done = false;
			}
			lines.push(`${name}: ${Math.min(count, amount)} / ${amount}`);
			objectives.push({ itemId, name, count: Math.min(count, amount), amount });
		}
		return { lines, objectives, have, need, done };
	}
	let have = 0;
	const lines = [];
	const objectives = [];
	for (const [itemId, name, worth] of goal.items) {
		const count = itemCount(itemId);
		have += count * worth;
		lines.push(`${name}: ${count}` + (worth !== 1 ? ` (x${worth})` : ''));
		objectives.push({ itemId, name, count, worth });
	}
	const done = have >= goal.need;
	lines.push(`${Math.min(have, goal.need)} / ${goal.need} ${goal.unit}`);
	return { lines, objectives, have, need: goal.need, done };
}

// Recommended knight test sources, chosen from ordinary Pre-Renewal spawns.
const knightMaterials = {
	1040: [1121, 'mjo_dun02', 'Coal Mine B2'],
	7006: [1111, 'mjo_dun02', 'Coal Mine B2'],
	931: [1023, 'gef_fild10', 'Orc Village'],
	1057: [1114, 'mjolnir_12', 'Mount Mjolnir'],
	903: [1119, 'moc_fild17', 'Sograt Desert, south of Morroc'],
	1028: [1166, 'prt_fild10', 'Prontera Field'],
	1042: [1099, 'mjolnir_05', 'Mount Mjolnir'],
	950: [1044, 'iz_dun02', 'Byalan Dungeon, Floor 3 via the Izlude ferry'],
	1032: [1118, 'mjolnir_05', 'Mount Mjolnir'],
	966: [1074, 'cmd_fild02', 'Comodo region'],
	7031: [1138, 'moc_fild16', 'Sograt Desert, south of Morroc'],
	946: [1094, 'gef_fild09', 'Geffen Field']
};

const expeditionMaps = {
	65019: {1165: 'moc_fild16', 1041: 'moc_pryd02'},
	65020: {1372: 'yuno_fild06', 1367: 'mag_dun01'},
	65021: {1680: 'ra_fild05', 1776: 'ice_dun01'},
	65022: {1784: 've_fild07', 1154: 'in_sphinx4'},
	65023: {1192: 'gl_chyard', 1163: 'gl_knt01'},
	65024: {1504: 'nif_fild02', 1777: 'ice_dun03'}
};

const incomingExits = new Map();
for (const [map, exits] of Object.entries(mapExits)) {
	for (const [, , destination] of exits) {
		if (!incomingExits.has(destination)) incomingExits.set(destination, []);
		incomingExits.get(destination).push(map);
	}
}
const sourceRoutes = new Map();
const crystalLabels = {
	prontera: 'Prontera (Acolyte)', izlude: 'Izlude (Swordman)', morocc: 'Morroc (Thief)',
	geffen: 'Geffen (Mage)', pay_arche: 'Archer Village (Archer)',
	alberta: 'Alberta (Merchant)', aldebaran: 'Al De Baran'
};

function sourceTravel(destination, current) {
	if (!sourceRoutes.has(destination)) {
		const distance = new Map([[destination, 0]]);
		const queue = [destination];
		let arrival = null;
		for (const map of queue) {
			if (!arrival && cityCrystals[map]) arrival = map;
			for (const previous of incomingExits.get(map) || []) {
				if (distance.has(previous)) continue;
				distance.set(previous, distance.get(map) + 1);
				queue.push(previous);
			}
		}
		sourceRoutes.set(destination, { arrival, distance });
	}
	const { arrival, distance } = sourceRoutes.get(destination);
	return {
		arrival,
		teleport: !!arrival && (distance.get(current) ?? Infinity) > distance.get(arrival)
	};
}

function sourceRow(text, map, label, target) {
	const row = document.createElement('div');
	row.className = 'quest-source';
	row.textContent = text + ' ';
	const go = document.createElement('button');
	go.type = 'button';
	go.textContent = '➜ Route';
	const waypoint = target || map + ',-1,-1';
	const current = QuestMarks.currentMap;
	const ferry = resolveHarborWaypoint({ target: waypoint, label }, current);
	const ferryMap = ferry.target.split(',')[0];
	const { arrival, teleport } = sourceTravel(ferryMap, current);
	if (arrival && current !== map) {
		const crystalName = crystalLabels[arrival] || DB.getMapName(arrival, '') || arrival;
		const hint = document.createElement('small');
		hint.style.display = 'block';
		hint.textContent = teleport
			? `City Crystal → ${crystalName} (100 Zeny). Select Route again after arrival.`
			: `Closest City Crystal: ${crystalName}.`;
		row.append(hint);
	}
	go.addEventListener('click', event => {
		event.stopPropagation();
		const from = QuestMarks.currentMap;
		const next = resolveHarborWaypoint({ target: waypoint, label }, from);
		const travel = sourceTravel(next.target.split(',')[0], from);
		const origin = travel.teleport && nearestCrystalMap(from);
		Navigation.show();
		if (origin && origin !== travel.arrival) {
			const city = travel.arrival;
			Navigation.setNaviInfo([origin, ...cityCrystals[origin]].join(','),
				'City Crystal → ' + (crystalLabels[city] || DB.getMapName(city, '') || city), { serverPortals: true });
		} else {
			Navigation.setNaviInfo(next.target, next.label, { serverPortals: true });
		}
		Navigation.setMinimized(true);
	});
	row.append(go);
	return row;
}

function monsterSource(mobId, map, region, drops = false) {
	const [name, level] = questMonsters[mobId];
	const place = region || DB.getMapName(map, '') || map;
	return sourceRow(`${drops ? 'Drops from ' : ''}${name} (Lv ${level}) · ${place}${place === map ? '' : ' [' + map + ']'}`,
		map, name + ' · ' + place);
}

function huntMobId(hunt) {
	if (questMonsters[hunt.mobGID]) return hunt.mobGID;
	const name = hunt.mobName?.trim().toLowerCase();
	if (name) return Object.keys(questMonsters).find(id => questMonsters[id][0].toLowerCase() === name);
	return null;
}

export function renderQuestObjectives(container, quest) {
	const list = document.createElement('ul');
	list.className = 'quest-ui-monster-list quest-objectives';
	const itemProgress = getQuestItemProgress(quest);
	for (const item of itemProgress?.objectives || []) {
		const row = document.createElement('li');
		const name = document.createElement('strong');
		name.textContent = item.name + ': ' + item.count + (item.amount ? ' / ' + item.amount : ' (worth ' + item.worth + ' points)');
		row.append(name);
		const recommended = [9001, 9002].includes(Number(quest.questID)) && knightMaterials[item.itemId];
		if (recommended) row.append(monsterSource(...recommended, true));
		const options = document.createElement('details');
		const summary = document.createElement('summary');
		summary.textContent = recommended ? 'Other known sources' : 'Known sources';
		options.append(summary);
		for (const [seller, target] of (questShops[item.itemId] || []).slice(0, 3)) {
			const [map, x, y] = target.split(',');
			options.append(sourceRow('Sold by ' + seller + ' · ' + (DB.getMapName(map, '') || map) + ' (' + x + ', ' + y + ')',
				map, seller, target));
		}
		for (const mobId of (questDrops[item.itemId] || []).filter(id => id !== recommended?.[0]).slice(0, 3)) {
			const [, , zones] = questMonsters[mobId];
			options.append(monsterSource(mobId, zones[0], null, true));
		}
		if (options.children.length > 1) {
			options.open = !recommended;
			row.append(options);
		} else if (!recommended) {
			const note = document.createElement('div');
			note.textContent = 'No standard drop or shop is listed. Check the quest instructions for a scripted source.';
			row.append(note);
		}
		list.append(row);
	}
	for (const hunt of Object.values(quest.hunt_list || {})) {
		const mobId = huntMobId(hunt);
		const mob = questMonsters[mobId];
		const row = document.createElement('li');
		const name = document.createElement('strong');
		name.textContent = `${hunt.mobName || mob?.[0] || 'Monster'}: ${hunt.huntCount} / ${hunt.maxCount}`;
		row.append(name);
		const assigned = expeditionMaps[quest.questID]?.[mobId];
		const zone = assigned || (mob?.[2].includes(QuestMarks.currentMap) ? QuestMarks.currentMap : mob?.[2][0]);
		if (zone) row.append(monsterSource(mobId, zone));
		else {
			const note = document.createElement('div');
			note.textContent = 'No standard spawn is listed. Follow the quest instructions for this target.';
			row.append(note);
		}
		if (!assigned && mob?.[2].length > 1) {
			const options = document.createElement('details');
			const summary = document.createElement('summary');
			summary.textContent = 'Other hunting areas';
			options.append(summary);
			for (const area of mob[2].filter(area => area !== zone).slice(0, 3)) options.append(monsterSource(mobId, area));
			row.append(options);
		}
		list.append(row);
	}
	if (itemProgress?.objectives.some(item => item.worth)) {
		const total = document.createElement('li');
		total.textContent = itemProgress.lines.at(-1);
		list.append(total);
	}
	container.replaceChildren(list);
}

/**
 * Process text with color codes (^RRGGBB)
 * @param {string} text - The text to process
 * @returns {string} HTML with color spans
 */
function processColorCodes(text) {
	if (!text) {
		return '';
	}
	text = String(text);
	return text
		.replace(/\^([0-9A-Fa-f]{6})/g, (match, color) => `<span style="color:#${color}">`)
		.replace(/\^000000/g, '</span>');
}

/**
 * Process item tags in text (<ITEM>Name<INFO>ID</INFO></ITEM>)
 * @param {string} text - The text to process
 * @returns {string} HTML with processed item tags
 */
function processItemTags(text) {
	if (!text) {
		return '';
	}
	text = String(text);
	return text.replace(/<ITEM>([^<]+)<INFO>(\d+)<\/INFO><\/ITEM>/g, (match, itemName, itemId) => {
		return `<span class="item-link" data-item-id="${itemId}">${itemName}</span>`;
	});
}

/**
 * Process NAVI tags in text (<NAVI>Display Name<INFO>mapname,x,y,0,000,flag</INFO></NAVI>)
 * @param {string} text - The text to process
 * @returns {string} HTML with processed NAVI tags
 */
function processNAVITags(text) {
	if (!text) {
		return '';
	}
	text = String(text);
	return text.replace(/<NAVI>([^<]+)<INFO>([^<]+)<\/INFO><\/NAVI>/g, (match, displayName, naviInfo) => {
		return `<span class="navi-link" data-navi-info="${naviInfo}" data-navi-name="${displayName}">${displayName}</span>`;
	});
}

/**
 * Process all text formatting (color codes and item tags)
 * @param {string} text - The text to process
 * @returns {string} Fully processed HTML
 */
function processText(text) {
	if (!text) {
		return '';
	}
	text = processItemTags(text);
	text = processNAVITags(text);
	text = processColorCodes(text);
	return text;
}

/**
 * Create a QuestHelper component from a version-specific configuration.
 *
 * @param {object} config
 * @param {string} config.name - component name (kept per version)
 * @param {string} config.htmlText - raw HTML for this version
 * @param {string} config.cssText - raw CSS for this version
 * @param {string} config.preferencesKey - Preferences key (kept per version)
 * @param {boolean} [config.renewLayout] - renewal layout (poring, rewards, deadline)
 */
export function createQuestHelper(config) {
	const { name, htmlText, cssText, preferencesKey, renewLayout = false } = config;

	/**
	 * Create Component
	 */
	const QuestHelper = new GUIComponent(name, cssText);

	QuestHelper.render = () => htmlText;

	/**
	 * @var {Preferences} structure
	 */
	const _preferences = Preferences.get(
		preferencesKey,
		{
			x: 200,
			y: 200,
			show: false
		},
		1.0
	);

	/**
	 * Initialize the component (event listener, etc.)
	 */
	QuestHelper.init = function init() {
		const root = QuestHelper.getRoot();

		const closeBtn = root.querySelector(renewLayout ? '.quest-info-bottom-btn' : '.quest-info-close-btn');
		if (closeBtn) {
			closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
			closeBtn.addEventListener('click', () => onClickClose());
		}

		// Add click handler for item links (delegated)
		root.addEventListener('click', event => {
			const itemLink = event.target.closest('.item-link');
			if (itemLink) {
				const itemId = parseInt(itemLink.dataset.itemId, 10);
				if (!itemId) {
					return;
				}
				if (ItemInfo.uid === itemId) {
					ItemInfo.remove();
					return;
				}
				ItemInfo.append();
				ItemInfo.uid = itemId;
				ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
				return;
			}

			const naviLink = event.target.closest('.navi-link');
			if (naviLink) {
				const naviInfo = naviLink.dataset.naviInfo;
				const displayName = naviLink.dataset.naviName;
				if (!naviInfo) {
					return;
				}
				startQuestNavigation({ target: naviInfo, label: displayName, classGuide: naviLink.dataset.classGuide === '1' });
			}
		});

		this.draggable('.titlebar');

		if (renewLayout) {
			// Load poring images
			root.querySelectorAll('.quest-ui-img-poring').forEach(el => {
				Client.loadFile(`${DB.INTERFACE_PATH}renew_questui/img_poring.bmp`, data => {
					el.style.backgroundImage = `url(${data})`;
				});
			});

			// Load titlebar background
			Client.loadFile(`${DB.INTERFACE_PATH}renew_questui/bg_questsub.bmp`, data => {
				const titlebar = root.querySelector('.titlebar');
				if (titlebar) {
					titlebar.style.backgroundImage = `url(${data})`;
				}
			});
		} else {
			// Load titlebar background
			Client.loadFile(`${DB.INTERFACE_PATH}basic_interface/quest_window.bmp`, data => {
				const titlebar = root.querySelector('.titlebar');
				if (titlebar) {
					titlebar.style.backgroundImage = `url(${data})`;
				}
			});
		}
	};

	/**
	 * Once append to the DOM, start to position the UI
	 */
	QuestHelper.onAppend = function onAppend() {
		if (renewLayout) {
			this._host.style.left = `${Math.min(Math.max(0, _preferences.x + 382), Renderer.width - 342)}px`;
			this._host.style.top = `${Math.min(Math.max(0, _preferences.y), Renderer.height - 412)}px`;
		} else {
			this._host.style.left = `${Math.min(Math.max(0, _preferences.x + 382), Renderer.width - 350)}px`;
			this._host.style.top = `${Math.min(Math.max(0, _preferences.y), Renderer.height - 375)}px`;
		}
	};

	QuestHelper.setQuestInfo = renewLayout
		? function setQuestInfo(quest) {
				const root = QuestHelper.getRoot();
				if (!root) {
					return;
				}
				const titleEl = root.querySelector('.quest-info-title-panel-text');
				if (titleEl) {
					titleEl.innerHTML = processText(quest.title);
				}

				const descEl = root.querySelector('.quest-info-description-panel-text .quest-ui-text-span');
				if (descEl) {
					const description = Array.isArray(quest.description) ? quest.description.join('<br>') : quest.description;
					descEl.innerHTML = processText(description || quest.summary);
					const progress = getQuestProgress(quest);
					const naviLinks = [['Quest objective', progress.goal], ['Turn-in NPC', quest.questID === 65008 ? null : progress.turnIn]];
					descEl.append(document.createElement('br'));
					for (const [prefix, destination] of naviLinks) {
						const navi = destination && resolveHarborWaypoint(destination, QuestMarks.currentMap);
						if (!navi) {
							continue;
						}
						const link = document.createElement('button');
						link.type = 'button';
						link.style.cssText = 'margin:4px 0;padding:4px 8px;background:#f1d18e;color:#281e30;border:1px solid #a17a42;border-radius:4px;cursor:pointer';
						link.className = 'navi-link';
						link.dataset.naviInfo = destination.target;
						link.dataset.naviName = destination.label;
						link.dataset.classGuide = navi.classGuide ? '1' : '0';
						const [map, x, y] = navi.target.split(',');
						link.textContent = `➜ ${prefix}: ${navi.label} · ${DB.getMapName(map, '') || map} (${x}, ${y})`;
						descEl.append(document.createElement('br'), link);
						if (cityCrystals[map] && map !== QuestMarks.currentMap) {
							const tip = document.createElement('small');
							tip.textContent = map === 'pay_arche'
								? 'Fast travel: City Crystal → Archer Village (Archer), 100 Zeny. Then follow the local route.'
								: `Teleport via the City Crystal to ${DB.getMapName(map, '') || map} for 100 Zeny. Then follow the local route.`;
							descEl.append(document.createElement('br'), tip);
						}
					}

					// Step-by-step guide: what to get, where, and what is already done
					const steps = getQuestSteps(quest);
					if (steps) {
						const box = document.createElement('div');
						box.style.cssText = 'margin-top:8px;padding:6px 8px;background:#fbf4e2;border:1px solid #d6c08f;border-radius:6px;color:#281e30';
						const head = document.createElement('strong');
						head.textContent = 'Step by step';
						box.append(head);
						steps.forEach((step, index) => {
							const row = document.createElement('div');
							row.style.cssText = 'margin-top:6px;' + (step.done ? 'opacity:0.6;' : step.current ? 'font-weight:bold;' : '');
							row.textContent = `${step.done ? '\u2714' : step.current ? '\u25B6' : '\u2022'} ${index + 1}. ${step.text} `;
							if (step.navi && !step.done) {
								const go = document.createElement('button');
								go.type = 'button';
								go.className = 'navi-link';
								go.style.cssText = 'margin-left:2px;padding:1px 6px;background:#f1d18e;color:#281e30;border:1px solid #a17a42;border-radius:4px;cursor:pointer;font-weight:normal';
								go.dataset.naviInfo = step.navi[0];
								go.dataset.naviName = step.navi[1];
								go.dataset.classGuide = '1';
								go.textContent = '\u279C Show the way';
								row.append(go);
							}
							box.append(row);
						});
						descEl.append(box);
					}
				}

				const monsterEl = root.querySelector('.quest-info-monster-panel-text .quest-ui-text-span');
				if (monsterEl) renderQuestObjectives(monsterEl, quest);

				// Rewards read from the server NPC scripts, when the client data has none
				const serverReward = questNpcTargets[quest.questID] && questNpcTargets[quest.questID][4];
				if (serverReward) {
					if (!(quest.reward_exp_base > 0)) {
						quest.reward_exp_base = serverReward[0];
					}
					if (!(quest.reward_exp_job > 0)) {
						quest.reward_exp_job = serverReward[1];
					}
					if (!quest.reward_item_list.length) {
						quest.reward_item_list = serverReward[2].map(item => ({ ItemID: item[0], ItemNum: item[1] }));
					}
				}

				if (quest.reward_exp_base > 0) {
					const baseEl = root.querySelector('.quest-info-reward-li-base');
					if (baseEl) {
						baseEl.textContent = quest.reward_exp_base;
					}
				}
				if (quest.reward_exp_job > 0) {
					const jobEl = root.querySelector('.quest-info-reward-li-job');
					if (jobEl) {
						jobEl.textContent = quest.reward_exp_job;
					}
				}

				for (let i = 0; i < quest.reward_item_list.length; i++) {
					const it = DB.getItemInfo(quest.reward_item_list[i].ItemID);
					const item_li =
						`<li class="quest-reward-item-li"><div class="quest-reward-item" data-index="${quest.reward_item_list[i].ItemID}">` +
						`<div class="quest-icon"></div></div><div class="quest-reward-item-info"><span class="quest-reward-item-name">${processText(it.identifiedDisplayName)}</span><br><span>${quest.reward_item_list[i].ItemNum}</span></div></li>`;
					const itemListEl = root.querySelector('.quest-info-reward-li-item-list');
					if (itemListEl) {
						itemListEl.insertAdjacentHTML('beforeend', item_li);
					}
					Client.loadFile(`${DB.INTERFACE_PATH}renew_questui/img_questiocn.bmp`, data => {
						const el = root.querySelector(
							`.quest-reward-item[data-index="${quest.reward_item_list[i].ItemID}"]`
						);
						if (el) {
							el.style.backgroundImage = `url(${data})`;
						}
					});
					Client.loadFile(`${DB.INTERFACE_PATH}item/${it.identifiedResourceName}.bmp`, data => {
						const el = root.querySelector(
							`.quest-reward-item[data-index="${quest.reward_item_list[i].ItemID}"] .quest-icon`
						);
						if (el) {
							el.style.backgroundImage = `url(${data})`;
						}
					});
				}

				if (quest.end_time) {
					const d = new Date(0);
					d.setUTCSeconds(quest.end_time);
					const deadlineEl = root.querySelector('.quest-info-bottom-deadline-info-text');
					if (deadlineEl) {
						deadlineEl.textContent = `Deadline [${d.toLocaleString()}]`;
					}
				}
			}
		: function setQuestInfo(quest) {
				const root = QuestHelper.getRoot();
				if (!root) {
					return;
				}
				const titleEl = root.querySelector('.title');
				if (titleEl) {
					titleEl.innerHTML = processText(quest.title);
				}
				const summaryEl = root.querySelector('.summary');
				if (summaryEl) {
					summaryEl.innerHTML = processText(quest.summary);
				}
				const objectiveEl = root.querySelector('.objective');
				if (objectiveEl) {
					objectiveEl.innerHTML = processText(quest.description);
				}

				let list = '<select class="monster-select">';
				let first = true;
				for (const huntID in quest.hunt_list) {
					if (first) {
						const killedEl = root.querySelector('.killed');
						if (killedEl) {
							killedEl.textContent = quest.hunt_list[huntID].huntCount;
						}
						const limitedEl = root.querySelector('.limited');
						if (limitedEl) {
							limitedEl.textContent = quest.hunt_list[huntID].maxCount;
						}
						first = false;
					}
					list += `<option current="${quest.hunt_list[huntID].huntCount}" max="${quest.hunt_list[huntID].maxCount}">${processText(quest.hunt_list[huntID].mobName)}</option>`;
				}
				list += '</select>';
				const monsterEl = root.querySelector('.monster');
				if (monsterEl) {
					monsterEl.innerHTML = list;
				}

				const selectEl = root.querySelector('.monster-select');
				if (selectEl) {
					selectEl.addEventListener('change', e => onSelectMonster(e));
				}
				if (monsterEl) {
					const sources = document.createElement('div');
					renderQuestObjectives(sources, quest);
					monsterEl.append(sources);
				}
			};

	QuestHelper.clearQuestDesc = renewLayout
		? function clearQuestDesc() {
				const root = QuestHelper.getRoot();
				if (!root) {
					return;
				}
				const titleEl = root.querySelector('.quest-info-title-panel-text');
				if (titleEl) {
					titleEl.innerHTML = '';
				}
				const descEl = root.querySelector('.quest-info-description-panel-text .quest-ui-text-span');
				if (descEl) {
					descEl.innerHTML = '';
				}
				const monsterEl = root.querySelector('.quest-info-monster-panel-text .quest-ui-text-span');
				if (monsterEl) {
					monsterEl.innerHTML = '<ul class="quest-ui-monster-list"><ul>';
				}
				const baseEl = root.querySelector('.quest-info-reward-li-base');
				if (baseEl) {
					baseEl.textContent = '';
				}
				const jobEl = root.querySelector('.quest-info-reward-li-job');
				if (jobEl) {
					jobEl.textContent = '';
				}
				const deadlineEl = root.querySelector('.quest-info-bottom-deadline-info-text');
				if (deadlineEl) {
					deadlineEl.textContent = '';
				}
				const itemListEl = root.querySelector('.quest-info-reward-li-item-list');
				if (itemListEl) {
					itemListEl.innerHTML = '';
				}
			}
		: function clearQuestDesc() {
				const root = QuestHelper.getRoot();
				if (!root) {
					return;
				}
				const titleEl = root.querySelector('.title');
				if (titleEl) {
					titleEl.innerHTML = '';
				}
				const summaryEl = root.querySelector('.summary');
				if (summaryEl) {
					summaryEl.innerHTML = '';
				}
				const objectiveEl = root.querySelector('.objective');
				if (objectiveEl) {
					objectiveEl.innerHTML = '';
				}
				const monsterEl = root.querySelector('.monster');
				if (monsterEl) {
					monsterEl.innerHTML = '';
				}
				const killedEl = root.querySelector('.killed');
				if (killedEl) {
					killedEl.textContent = '';
				}
				const limitedEl = root.querySelector('.limited');
				if (limitedEl) {
					limitedEl.textContent = '';
				}
			};

	/**
	 * Clean up UI
	 */
	QuestHelper.clean = function clean() {
		QuestHelper.ui.hide();
		onClose();
	};

	/**
	 * Removing the UI from window, save preferences
	 */
	QuestHelper.onRemove = function onRemove() {};

	/**
	 * Show/Hide UI
	 */
	QuestHelper.toggle = function toggle() {
		const hostDisplay = this._host ? getComputedStyle(this._host).display : 'none';
		if (hostDisplay !== 'none') {
			this.ui.hide();
		} else {
			this.ui.show();
		}
	};

	function onClickClose() {
		QuestHelper.ui.hide();
	}

	/**
	 * Close the window
	 */
	function onClose() {
		QuestHelper.ui.hide();
	}

	function onSelectMonster(e) {
		const root = QuestHelper.getRoot();
		const selectedOption = e.currentTarget.options[e.currentTarget.selectedIndex];
		const killedEl = root.querySelector('.killed');
		if (killedEl) {
			killedEl.textContent = selectedOption.getAttribute('current');
		}
		const limitedEl = root.querySelector('.limited');
		if (limitedEl) {
			limitedEl.textContent = selectedOption.getAttribute('max');
		}
	}

	/**
	 * Export
	 */
	return UIManager.addComponent(QuestHelper);
}
