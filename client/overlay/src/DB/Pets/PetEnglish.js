// English reactions for each pet action, independent of the client's asset language.
const reactions = [
	['Thanks for the meal!', 'That was delicious!'],
	['Let’s hunt together!', 'I’ll keep an eye on the loot!'],
	['Watch out!', 'Careful, I’m right behind you!'],
	['Come back soon!', 'I’ll be waiting for you.'],
	['I’m right here!', 'Where are we going next?'],
	['Ta-da!', 'Did you see that?'],
	['Congratulations on leveling up!', 'You did it!'],
	['Look what I can do!', 'Time for a little trick!'],
	['Watch me!', 'How was that?'],
	['One more trick!', 'That was fun!'],
	['Welcome back!', 'Ready for another adventure?']
];

export function petReaction(data) {
	const message = String(data);
	// The wire format is the monster ID, two hunger digits and an action of one or two digits.
	const fields = /^\d{4}0([0-4])(10|[0-9])$/.exec(message) ||
		/^\d{5}0([0-4])(10|[0-9])$/.exec(message);
	if (!fields) return false;
	const hunger = Number(fields[1]);
	const action = Number(fields[2]);
	if (action === 0 && hunger === 4) return 'I’m full now, thank you!';
	if (action === 4 && hunger <= 1) return 'I’m hungry. Do you have any food?';
	const lines = reactions[action];
	return lines[Math.floor(Math.random() * lines.length)];
}

export const petMessages = {
	591: 'Your pet needs %s.',
	598: 'Equipped',
	599: 'Choose a pet egg',
	600: 'Unequipped',
	601: 'Feed your pet?',
	2569: 'Pet Evolution',
	2570: 'Required Items',
	2571: 'Pet evolution failed.',
	2572: 'Summon a pet first.',
	2573: 'This pet cannot evolve into the selected form.',
	2574: 'The evolution requirements have not been met.',
	2575: 'You do not have the items required for evolution.',
	2576: 'Your pet must be Loyal to evolve.'
};
