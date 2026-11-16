const notice = document.querySelector('#registration-notice');
const online = document.querySelector('#online-count');
const list = document.querySelector('#players');

async function update() {
	try {
		const response = await fetch('/?status=1', { cache: 'no-store' });
		if (response.status === 403) {
			online.textContent = 'Your session expired. Please sign in again.';
			list.replaceChildren();
			return;
		}
		if (!response.ok) throw new Error('Status unavailable');
		const { registration, roster } = await response.json();
		if (notice.dataset.status === 'pending' && registration.message) {
			notice.textContent = registration.message;
			notice.dataset.status = registration.status;
		}
		const count = roster.players.filter(player => player.online).length;
		online.textContent = roster.available ? `${count} online · ${roster.players.length} registered` : 'Player status is currently unavailable.';
		list.replaceChildren(...roster.players.map(player => {
			const row = document.createElement('li');
			const state = document.createElement('span');
			state.textContent = roster.available ? (player.online ? 'Online' : 'Offline') : '';
			state.className = roster.available && player.online ? 'online' : '';
			row.append(player.username, state);
			return row;
		}));
	} catch {
		online.textContent = 'Player status is currently unavailable.';
		list.replaceChildren();
	}
	setTimeout(update, notice.dataset.status === 'pending' ? 4000 : 20000);
}

update();
