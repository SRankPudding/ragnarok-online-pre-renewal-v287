// Job-change starts on the pinned Pre-Renewal server.
// Each record has an NPC destination and, when useful, an outdoor entrance.
export const classGuides = {
	'First jobs': [
		['Swordman', 'Swordman', 'Izlude', 'izlude_in,74,172', 'izlude,52,140'],
		['Acolyte', 'Cleric', 'Prontera Church', 'prt_church,184,41', 'prontera,237,317'],
		['Archer', 'Archer Guildsman', 'Archer Village, north of Payon', 'payon_in02,64,71', 'pay_arche,145,165', 'Hunt Willows in Payon Field 08 east of Payon for Trunks.'],
		['Mage', 'Mage Guildsman', 'Geffen', 'geffen_in,164,124', 'geffen,61,180'],
		['Merchant', 'Merchant', 'Alberta', 'alberta_in,53,43', 'alberta,33,42'],
		['Thief', 'Thief Guide', 'Pyramid basement', 'moc_prydb1,39,129', 'moc_ruins,54,161']
	],
	'Second jobs': [
		['Knight', 'Chivalry Captain', 'Prontera Chivalry', 'prt_in,88,101', 'prontera,45,346'],
		['Crusader', 'Senior Crusader', 'Prontera Castle', 'prt_castle,45,169'],
		['Priest', 'High Bishop', 'Prontera Church', 'prt_church,16,41', 'prontera,237,317'],
		['Monk', 'Guarding Monk', 'St. Capitolina Abbey', 'prt_monk,59,247'],
		['Hunter', 'Hunter Guildsman', 'Hugel', 'hu_in01,386,373', 'hugel,206,228'],
		['Bard', 'Wandering Bard', 'Comodo', 'comodo,226,123'],
		['Dancer', 'Aile', 'Comodo Theater', 'job_duncer,43,93', 'comodo,193,151', 'Talk to Bor Robin to enter.'],
		['Wizard', 'Wizard Guildsman', 'Geffen Tower', 'gef_tower,111,37', 'geffen,120,114'],
		['Sage', 'Dean of the Academy', 'Juno Academy', 'yuno_in02,38,61', 'yuno,87,321'],
		['Blacksmith', 'Guildsman', 'Einbroch', 'ein_in01,18,28', 'einbroch,255,107'],
		['Alchemist', 'Alchemist Guildsman', 'Al De Baran', 'alde_alche,27,185', 'aldebaran,65,53'],
		['Assassin', 'Guildsman', 'Assassin Guild', 'in_moc_16,19,33', 'moc_fild16,205,296'],
		['Rogue', 'Rogue Guildsman', 'Pharos Lighthouse', 'in_rogue,363,122', 'cmd_fild07,193,117']
	],
	'Expanded jobs': [
		['Ninja', 'Akagi', 'Alberta', 'alberta,30,65', '', 'Start here. Akagi can take you to Amatsu.'],
		['Ninja', 'Kuuga Gai', 'Ninja Guild, Amatsu', 'que_ng,30,65', 'amatsu,149,140'],
		['Ninja', 'Suspicious Man', 'Einbroch', 'einbroch,184,194', '', 'Visit him when Kuuga Gai asks you to.'],
		['Gunslinger', 'Master Miller', 'Gunslinger Guild, Einbroch', 'que_ng,152,167', 'einbroch,136,199'],
		['Taekwon', 'Phoenix', 'Payon', 'payon,157,141'],
		['Star Gladiator', 'Moohyun', 'Payon', 'payon,215,102'],
		['Soul Linker', 'Kid', 'Morroc', 'morocc_in,174,30'],
		['Super Novice', 'Tzerero', 'Al De Baran', 'aldeba_in,223,167']
	],
	'Rebirth and transcendent jobs': [
		['Rebirth', 'Metheus Sylphe', 'Juno Library', 'yuno_in02,88,164', 'yuno,87,321'],
		['Lord Knight', 'Lord Knight', 'Valhalla', 'valkyrie,44,39'],
		['High Priest', 'High Priest', 'Valhalla', 'valkyrie,44,42'],
		['High Wizard', 'High Wizard', 'Valhalla', 'valkyrie,44,47'],
		['Whitesmith', 'MasterSmith', 'Valhalla', 'valkyrie,44,50'],
		['Sniper', 'Sniper', 'Valhalla', 'valkyrie,44,55'],
		['Assassin Cross', 'Assassin Cross', 'Valhalla', 'valkyrie,44,58'],
		['Paladin', 'Paladin', 'Valhalla', 'valkyrie,53,39'],
		['Champion', 'Champion', 'Valhalla', 'valkyrie,53,42'],
		['Professor', 'Scholar', 'Valhalla', 'valkyrie,53,47'],
		['Creator', 'Biochemist', 'Valhalla', 'valkyrie,53,50'],
		['Clown', 'Minstrel', 'Valhalla', 'valkyrie,53,54'],
		['Gypsy', 'Gypsy', 'Valhalla', 'valkyrie,53,56'],
		['Stalker', 'Stalker', 'Valhalla', 'valkyrie,53,58']
	]
};

export const worldAnchors = {
	izlude_in: 'izlude', prt_church: 'prontera', prt_in: 'prontera', prt_castle: 'prontera',
	payon_in02: 'pay_arche', geffen_in: 'geffen', gef_tower: 'geffen', alberta_in: 'alberta',
	moc_prydb1: 'moc_ruins', moc_pryd01: 'moc_ruins', in_moc_16: 'moc_fild16',
	monk_in: 'prt_monk', hu_in01: 'hugel', job_duncer: 'comodo', yuno_in02: 'yuno',
	yuno_in05: 'yuno', ein_in01: 'einbroch', alde_alche: 'aldebaran', aldeba_in: 'aldebaran',
	in_rogue: 'cmd_fild07', morocc_in: 'morocc', job_soul: 'morocc', job_star: 'payon',
	job_sword1: 'izlude', job_knt: 'prontera', job_cru: 'prontera', job_prist: 'prontera',
	job_wiz: 'geffen', valkyrie: 'yuno', izlude_a: 'izlude'
};

export function getWorldAnchor(map, position) {
	// The Ninja and Gunslinger guilds share one interior map.
	if (map === 'que_ng') return position && position[0] >= 130 ? 'einbroch' : 'amatsu';
	return Object.hasOwn(worldAnchors, map) ? worldAnchors[map] : map;
}

export function renderClassGuides(container, query, onRoute) {
	const document = container.ownerDocument;
	const fragment = document.createDocumentFragment();
	const terms = query.trim().toLowerCase().split(/\s+/);
	for (const [group, guides] of Object.entries(classGuides)) {
		const matching = guides.filter(guide => terms.every(term => guide.join(' ').toLowerCase().includes(term)));
		if (!matching.length) continue;
		const heading = document.createElement('h3');
		heading.textContent = group;
		fragment.append(heading);
		for (const [job, npc, area, destination, entrance, note] of matching) {
			const card = document.createElement('article');
			const name = document.createElement('strong');
			name.textContent = job + ' · ' + npc;
			const location = document.createElement('p');
			location.textContent = area + ' · ' + destination.replaceAll(',', ' ');
			card.append(name, location);
			if (entrance || note) {
				const details = document.createElement('p');
				details.textContent = [entrance && 'Entrance · ' + entrance.replaceAll(',', ' '), note].filter(Boolean).join('. ');
				card.append(details);
			}
			const actions = document.createElement('div');
			for (const [target, label] of [[destination, 'Route to NPC'], [entrance, 'Route to entrance']]) {
				if (!target) continue;
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = label;
				button.addEventListener('click', () => onRoute(target, job + ' · ' + (target === destination ? npc : 'Entrance')));
				actions.append(button);
			}
			card.append(actions);
			fragment.append(card);
		}
	}
	if (!fragment.childNodes.length) {
		const empty = document.createElement('p');
		empty.textContent = 'No class guides match your search.';
		fragment.append(empty);
	}
	container.replaceChildren(fragment);
}
