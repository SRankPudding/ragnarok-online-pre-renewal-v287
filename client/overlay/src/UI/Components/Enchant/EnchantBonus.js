export const stats = ['STR', 'INT', 'DEX', 'AGI', 'VIT', 'LUK'];
export const effects = ['', 'Critical damage +10%', 'Critical +8', 'HIT +15',
	'5% chance to recover HP equal to 8% of damage dealt'];

export function readEnchant(item) {
	const option = Object.values(item?.Options || {}).find(value => value?.index === 32000);
	if (!option || option.value < 1 || option.value > 10 || option.param < 0 || option.param >= 30) return null;
	return { stat: option.param % 6, effect: Math.floor(option.param / 6), level: option.value };
}

export function enchantBadge(item) {
	const level = readEnchant(item)?.level;
	if (!level || !Number.isInteger(level) || !item.IsIdentified) return '';
	const color = level === 10 ? '#ffd1ca' : '#fff1b8';
	return '<b aria-label="Enchantment +' + level + '" style="position:absolute;top:1px;left:2px;' +
		'z-index:12;pointer-events:none;background:none;color:' + color +
		';display:block;width:max-content;white-space:nowrap;font:900 12px/13px system-ui,sans-serif;' +
		'paint-order:stroke fill;-webkit-text-stroke:2px #191112">+' + level + '</b>';
}
