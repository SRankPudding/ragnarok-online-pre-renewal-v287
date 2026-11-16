/**
 * UI/Components/MiniMap/ExitLabels.js
 *
 * Writes the destination map next to every exit of a map,
 * for the minimap and the navigation window. Exit data: DB/Map/MapExits.js.
 */
import { mapExits } from 'DB/Map/MapExits.js';

/** Doors into houses and shops of the same town: too many and not useful for orientation */
const INDOOR = /_in\d*$|^(?:in_(?!sphinx)|prt_church$|prt_castle$)/;
const DUNGEON = /dun|cave|cavern|_pryd|in_sphinx|^(?:anthell|pay_d|gef_d|mjo_d|treasure|thor_v|abbey|ice_d|ra_san|lhz_d|ama_d|ayo_d|gl_|tur_d)/;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} mapName current map, without extension
 * @param {function(number, number): {x: number, y: number}} project map cell -> canvas pixel
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @param {number} fontSize in pixels
 */
export function drawExitLabels(ctx, mapName, project, width, height, fontSize) {
	const exits = mapExits[mapName];
	if (!ctx || !exits) {
		return;
	}
	ctx.save();
	ctx.font = `bold ${fontSize}px Arial, sans-serif`;
	ctx.textBaseline = 'middle';
	ctx.lineWidth = fontSize / 3.5;
	ctx.strokeStyle = 'rgba(0,0,0,0.9)';
	ctx.fillStyle = '#ffd9d9';

	const drawn = [];
	const boxes = [];
	const overlaps = box => boxes.some(b => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h);
	const edge = Math.max(width, height) * 0.14;

	for (const [x, y, destination] of exits) {
		if (INDOOR.test(destination)) continue;
		const point = project(x, y);
		if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
			continue;
		}
		const radius = fontSize * 0.8;
		const markerX = Math.max(radius, Math.min(width - radius, point.x));
		const markerY = Math.max(radius, Math.min(height - radius, point.y));
		ctx.save();
		ctx.translate(markerX, markerY);
		ctx.strokeStyle = '#21152b';
		ctx.beginPath();
		if (DUNGEON.test(destination)) {
			ctx.fillStyle = '#ff535a';
			ctx.arc(0, 0, radius * 0.55, 0, 2 * Math.PI);
		} else {
			const angle = Math.atan2(point.y - height / 2, point.x - width / 2);
			ctx.rotate(Math.round(angle / (Math.PI / 2)) * Math.PI / 2);
			ctx.fillStyle = '#ffe58b';
			ctx.moveTo(radius, 0);
			ctx.lineTo(0, -radius);
			ctx.lineTo(0, -radius / 2);
			ctx.lineTo(-radius, -radius / 2);
			ctx.lineTo(-radius, radius / 2);
			ctx.lineTo(0, radius / 2);
			ctx.lineTo(0, radius);
		}
		ctx.closePath();
		ctx.stroke();
		ctx.fill();
		ctx.restore();

		// Several portals side by side to the same map get one label
		if (drawn.some(d => d.destination === destination && Math.hypot(d.x - point.x, d.y - point.y) < fontSize * 3)) {
			continue;
		}
		drawn.push({ destination, x: point.x, y: point.y });

		const length = ctx.measureText(destination).width;
		// Exits on the left or right edge: text runs upright along that edge.
		// Everything else: text lies flat, above or below the exit.
		const upright = point.x < edge || point.x > width - edge;
		let box;
		if (upright) {
			const left = point.x < edge;
			const cx = left ? fontSize / 2 + 1 : width - fontSize / 2 - 1;
			const cy = Math.min(height - length / 2 - 1, Math.max(length / 2 + 1, point.y));
			box = { x: cx - fontSize / 2, y: cy - length / 2, w: fontSize, h: length, cx, cy, angle: left ? -Math.PI / 2 : Math.PI / 2 };
		} else {
			const below = point.y < height / 2;
			const cx = Math.min(width - length / 2 - 1, Math.max(length / 2 + 1, point.x));
			const cy = below ? point.y + fontSize : point.y - fontSize;
			box = { x: cx - length / 2, y: cy - fontSize / 2, w: length, h: fontSize, cx, cy, angle: 0 };
		}

		// Never draw over another label: slide along the label's own direction, else leave it out
		let placed = !overlaps(box);
		for (let step = 1; !placed && step <= 6; step++) {
			for (const sign of [1, -1]) {
				const shift = sign * step * (fontSize + 1);
				const moved = upright
					? { ...box, y: box.y + shift, cy: box.cy + shift }
					: { ...box, y: box.y + shift, cy: box.cy + shift };
				if (moved.y >= 0 && moved.y + moved.h <= height && !overlaps(moved)) {
					box = moved;
					placed = true;
					break;
				}
			}
		}
		if (!placed) {
			continue;
		}
		boxes.push(box);

		ctx.save();
		ctx.translate(box.cx, box.cy);
		ctx.rotate(box.angle);
		ctx.textAlign = 'center';
		ctx.strokeText(destination, 0, 0);
		ctx.fillText(destination, 0, 0);
		ctx.restore();
	}
	ctx.restore();
}
