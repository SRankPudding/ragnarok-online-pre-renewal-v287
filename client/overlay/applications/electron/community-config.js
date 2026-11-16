Object.assign(window.ROConfig, {
	development: false,
	remoteClient: 'app://localhost/local-only/',
	servers: [
		{
			display: 'Ragnarok Online – Pre-Renewal',
			desc: 'Private Pre-Renewal server',
			address: window.electronAPI.serverHost,
			port: 6900,
			version: 55,
			langtype: 1,
			packetver: 20211103,
			renewal: false,
			packetKeys: false,
			forceUseAddress: true,
			adminList: []
		}
	],
	skipIntro: true,
	skipServerList: true,
	grfList: ['data.grf'],
	saveFiles: false,
	customItemInfo: ['SystemEN/LuaFiles514/itemInfo.lua'],
	enableAchievements: false,
	enableCashShop: true,
	wasdMovement: true,
	holdToSprint: true,
	enableCheckAttendance: false,
	enableRoulette: false
});
