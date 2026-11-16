/**
 * Controls/MapControl.js
 *
 * Control for keys and input
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Cursor from 'UI/CursorManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Mobile from 'Core/Mobile.js';
import Configs from 'Core/Configs.js';
import Renderer from 'Renderer/Renderer.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import Camera from 'Renderer/Camera.js';
import EntityManager from 'Renderer/EntityManager.js';
import Session from 'Engine/SessionStorage.js';
import Preferences from 'Preferences/Controls.js';
import KEYS from 'Controls/KeyEventHandler.js';
import AIDriver from 'Core/AIDriver.js';
import Altitude from 'Renderer/Map/Altitude.js';
import PathFinding from 'Utils/PathFinding.js';
import PACKETVER from 'Network/PacketVerManager.js';
import PACKET from 'Network/PacketStructure.js';
import Network from 'Network/NetworkManager.js';
import Events from 'Core/Events.js';
import CaptchaSelector from 'UI/Components/Captcha/CaptchaSelector.js';
import 'Controls/ScreenShot.js';

/**
 * @var {int16[2]} screen position
 */
const _rightClickPosition = new Int16Array(2);
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const heldMovementKeys = new Set();
let keyboardWalkTimer;
let keyboardWalkMap;
let lastKeyboardStep = -Infinity;
let keyboardDestination;
const sprintKeys = new Set();
let sprintTimer;
let sprintPlayer;
let waypointTimer;

function stopWaypoint() {
	window.clearInterval(waypointTimer);
	waypointTimer = undefined;
}

/**
 * @namespace MapControl
 */
class MapControl {
	static stopWaypoint = stopWaypoint;

	static walkToWaypoint(x, y, readPath) {
		stopWaypoint();
		stopKeyboardWalk();
		this.onRequestStopWalk();
		Session.moveAction = null;
		Session.autoFollow = false;
		EntityManager.getFocusEntity()?.onFocusEnd();
		EntityManager.setFocusEntity(null);
		const player = Session.Entity;
		const map = MapRenderer.currentMap;
		let queued;
		let retries = 0;
		let sentAt = 0;
		let waitingSince = performance.now();
		const tick = () => {
			const now = performance.now();
			if (!player || player !== Session.Entity || map !== MapRenderer.currentMap ||
				player.action === player.ACTION.DIE || player.action === player.ACTION.SIT || MapRenderer.loading) {
				stopWaypoint();
				return;
			}
			const px = Math.round(player.position[0]);
			const py = Math.round(player.position[1]);
			if (px === x && py === y) {
				stopWaypoint();
				return;
			}
			if (Session.FreezeUI || player.action === player.ACTION.WALK || now - sentAt < 100) return;
			const path = readPath();
			if (!path?.length) {
				if (now - waitingSince > 4000) stopWaypoint();
				return;
			}
			waitingSince = now;
			let nearest = -1;
			let best = Infinity;
			for (let i = 0; i < path.length; i++) {
				const distance = Math.hypot(px - path[i].x, py - path[i].y);
				if (distance < best) { nearest = i; best = distance; }
			}
			let next;
			for (let i = Math.min(path.length - 1, nearest + 8); i >= nearest; i--) {
				const point = path[i];
				if (point.x === px && point.y === py) continue;
				if (Math.max(Math.abs(point.x - px), Math.abs(point.y - py)) > 10) continue;
				if (PathFinding.search(px, py, point.x, point.y, 0, []) > 1) {
					next = point;
					break;
				}
			}
			if (!next) {
				stopWaypoint();
				return;
			}
			if (queued?.x === next.x && queued?.y === next.y && queued?.px === px && queued?.py === py) {
				if (now - sentAt < 480) return;
				if (++retries > 2) {
					stopWaypoint();
					return;
				}
			} else retries = 0;
			const packet = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
			packet.dest[0] = next.x;
			packet.dest[1] = next.y;
			Network.sendPacket(packet);
			queued = { ...next, px, py };
			sentAt = now;
		};
		waypointTimer = window.setInterval(tick, 60);
		tick();
	}

	/**
	 * Callback used when requesting to move somewhere
	 */
	static onRequestWalk() {}

	/**
	 * Callback used when request to stop move
	 */
	static onRequestStopWalk() {}

	/**
	 * Callback used when dropping an item to the map
	 */
	static onRequestDropItem() {}

	/**
	 * Initializing the controller
	 */
	static init() {
		Mobile.init();
		Mobile.onTouchStart = onMouseDown.bind(this);
		Mobile.onTouchEnd = onMouseUp.bind(this);

		// Attach events
		Renderer.canvas.addEventListener('wheel', onMouseWheel);
		Renderer.canvas.addEventListener('dragover', onDragOver);
		Renderer.canvas.addEventListener('drop', onDrop.bind(this));

		window.addEventListener('mousedown', onMouseDown.bind(this));
		window.addEventListener('mouseup', onMouseUp.bind(this));

		// A mouseup released over a UI element can be swallowed by the element's
		// own handler (e.g. scrollbars call stopPropagation), so the bubbling
		// 'mouseup' above never fires and the camera would keep rotating.
		// Listen in the capture phase to always catch the release.
		window.addEventListener('mouseup', onMouseUpCapture, true);
		window.addEventListener('keydown', onMovementKeyDown, true);
		window.addEventListener('keyup', onMovementKeyUp, true);
		window.addEventListener('blur', releaseMovementKeys);
		document.addEventListener('visibilitychange', releaseMovementKeys);
		window.addEventListener('pagehide', releaseMovementKeys);
	}
}

function canUseMovementControls() {
	if (Session.FreezeUI) GUIComponent.recoverDetachedInput();
	let focused = document.activeElement;
	while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
	const player = Session.Entity;
	return player?.position && Altitude.width && !MapRenderer.loading &&
		!document.hidden && !Session.FreezeUI && !KEYS.CTRL && !KEYS.ALT &&
		!focused?.isContentEditable && !focused?.matches('input, textarea, select, [role="textbox"]') &&
		!document.querySelector('#NpcBox, #NpcMenu') &&
		player.action !== player.ACTION.SIT && player.action !== player.ACTION.DIE;
}

function canWalkWithKeyboard() {
	return Configs.get('wasdMovement') && canUseMovementControls() &&
		(!KEYS.SHIFT || Configs.get('holdToSprint'));
}

function isSprintKey(event) {
	return event.code === 'ShiftLeft' || event.code === 'ShiftRight';
}

function sendSprint(player, active) {
	if (player !== Session.Entity || !player?.display?.name || MapRenderer.loading) return;
	const packet = new PACKET.CZ.REQUEST_CHAT();
	packet.msg = player.display.name + ' : @rosprint ' + (active ? 'on' : 'off');
	Network.sendPacket(packet);
}

function stopSprint() {
	sprintKeys.clear();
	window.clearInterval(sprintTimer);
	sprintTimer = undefined;
	if (sprintPlayer) sendSprint(sprintPlayer, false);
	sprintPlayer = undefined;
}

function refreshSprint() {
	if (!sprintKeys.size || sprintPlayer !== Session.Entity || !canUseMovementControls()) {
		stopSprint();
		return;
	}
	sendSprint(sprintPlayer, true);
}

function releaseMovementKeys() {
	stopSprint();
	stopKeyboardWalk();
}

function onMovementKeyDown(event) {
	if (isSprintKey(event) && Configs.get('holdToSprint') && !event.isComposing &&
		!event.ctrlKey && !event.altKey && !event.metaKey && canUseMovementControls()) {
		if (event.repeat) return;
		sprintKeys.add(event.code);
		if (sprintTimer === undefined) {
			sprintPlayer = Session.Entity;
			refreshSprint();
			sprintTimer = window.setInterval(refreshSprint, 650);
		}
		return;
	}
	if (!movementKeys.has(event.code) || event.ctrlKey || event.altKey || event.metaKey || (event.shiftKey && !Configs.get('holdToSprint')) ||
		event.isComposing || !canWalkWithKeyboard()) return;

	event.preventDefault();
	event.stopImmediatePropagation();
	if (event.repeat) return;
	heldMovementKeys.add(event.code);
	stopWaypoint();
	if (keyboardWalkTimer === undefined) {
		keyboardWalkMap = MapRenderer.currentMap;
		lastKeyboardStep = -Infinity;
		keyboardDestination = null;
		MapControl.onRequestStopWalk();
		keyboardWalkTimer = window.setInterval(walkWithKeyboard, 40);
		walkWithKeyboard();
	}
}

function onMovementKeyUp(event) {
	if (isSprintKey(event)) {
		sprintKeys.delete(event.code);
		if (!sprintKeys.size) stopSprint();
		return;
	}
	heldMovementKeys.delete(event.code);
	if (!heldMovementKeys.size) stopKeyboardWalk();
}

function stopKeyboardWalk() {
	heldMovementKeys.clear();
	window.clearInterval(keyboardWalkTimer);
	keyboardWalkTimer = undefined;
	keyboardDestination = null;
}

function walkWithKeyboard() {
	if (!canWalkWithKeyboard() || keyboardWalkMap !== MapRenderer.currentMap) {
		stopKeyboardWalk();
		return;
	}

	const player = Session.Entity;
	const now = performance.now();
	const walking = player.action === player.ACTION.WALK;
	if (now - lastKeyboardStep < 100) return;
	if (walking && (!keyboardDestination ||
		Math.hypot(player.position[0] - keyboardDestination[0], player.position[1] - keyboardDestination[1]) > 1.5)) return;

	const x = Number(heldMovementKeys.has('KeyD')) - Number(heldMovementKeys.has('KeyA'));
	const y = Number(heldMovementKeys.has('KeyW')) - Number(heldMovementKeys.has('KeyS'));
	if (!x && !y) return;

	// Rotate the keys by the real camera yaw (matches the modelView rotateY), so W is always screen-up
	const angle = Camera.angle[1] * Math.PI / 180;
	const magnitude = Math.hypot(x, y);
	const dx = Math.round((x * Math.cos(angle) - y * Math.sin(angle)) / magnitude);
	const dy = Math.round((x * Math.sin(angle) + y * Math.cos(angle)) / magnitude);
	let toX = Math.round(player.position[0]);
	let toY = Math.round(player.position[1]);
	let steps = 0;
	const maxSteps = walking ? 2 : 1;
	for (; steps < maxSteps; steps++) {
		if (!isFreeCell(toX + dx, toY + dy)) break;
		if (dx && dy && (!(Altitude.getCellType(toX + dx, toY) & Altitude.TYPE.WALKABLE) ||
			!(Altitude.getCellType(toX, toY + dy) & Altitude.TYPE.WALKABLE))) break;
		toX += dx;
		toY += dy;
	}
	if (!steps || (toX === keyboardDestination?.[0] && toY === keyboardDestination?.[1] &&
		(walking || now - lastKeyboardStep < 350))) return;

	Session.moveAction = null;
	Session.autoFollow = false;
	const packet = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
	packet.dest[0] = toX;
	packet.dest[1] = toY;
	Network.sendPacket(packet);
	keyboardDestination = [toX, toY];
	lastKeyboardStep = now;
}

/**
 * Stop the camera rotation when the right button is released, even if the
 * release happens over a UI element that swallows the bubbling mouseup event.
 */
function onMouseUpCapture(event) {
	if (event.which !== 3 || !Camera.action.active) {
		return;
	}

	Cursor.setType(Cursor.ACTION.DEFAULT);
	Camera.rotate(false);
}

/**
 * What to do when clicking on the map ?
 */
function onMouseDown(event) {
	if (Session.FreezeUI) GUIComponent.recoverDetachedInput();
	const action = (event && event.which) || 1;

	// Skill target selection handles the click itself (right click just cancels it)
	if (Mouse.state === Mouse.MOUSE_STATE.USESKILL && SkillTargetSelection.onMapMouseDown(event)) {
		return;
	}

	if (!Mouse.intersect) {
		return;
	}

	const entityFocus = EntityManager.getFocusEntity();
	const picked = EntityManager.getOverEntity();
	const entityOver = picked?.objecttype === Entity.TYPE_MOB && picked.action === picked.ACTION?.DIE ? null : picked;

	switch (action) {
		// Left click
		case 1:
			stopWaypoint();
			stopKeyboardWalk();
			if (!KEYS.SHIFT && KEYS.ALT && !KEYS.CTRL) {
				if (
					entityOver &&
					entityOver != Session.Entity &&
					entityOver.objecttype != Entity.TYPE_EFFECT &&
					entityOver.objecttype != Entity.TYPE_TRAP
				) {
					AIDriver.setmsg(Session.mercId, '3,' + entityOver.GID);
				} else {
					AIDriver.setmsg(Session.mercId, '1,' + Mouse.world.x + ',' + Mouse.world.y);
				}
			} else {
				Session.moveAction = null;
				Session.autoFollow = false;

				let stop = false;
				if (entityOver != Session.Entity) {
					if (entityFocus && entityFocus != entityOver) {
						if (!(Session.TouchTargeting && !entityOver)) {
							entityFocus.onFocusEnd();
							EntityManager.setFocusEntity(null);
						}
					}

					// Entity picking ?
					if (entityOver) {
						stop = stop || entityOver.onMouseDown();
						stop = stop || entityOver.onFocus();
						EntityManager.setFocusEntity(entityOver);

						// Know if propagate to map mousedown
						if (stop) {
							return;
						}
					}
				}

				// Start walking
				if (this.onRequestWalk) {
					this.onRequestWalk();
				}
			}
			break;

		// Right Click
		case 3:
			_rightClickPosition[0] = Mouse.screen.x;
			_rightClickPosition[1] = Mouse.screen.y;

			if (Session.captchaGetIdOnFloorClick) {
				CaptchaSelector.requestPlayersIds(Mouse.world.x, Mouse.world.y);
			}

			if (!KEYS.SHIFT && KEYS.ALT && !KEYS.CTRL) {
				Camera.rotate(false);

				if (
					entityOver &&
					entityOver != Session.Entity &&
					entityOver.objecttype != Entity.TYPE_EFFECT &&
					entityOver.objecttype != Entity.TYPE_TRAP
				) {
					AIDriver.setmsg(Session.homunId, '3,' + entityOver.GID);
				} else {
					AIDriver.setmsg(Session.homunId, '1,' + Mouse.world.x + ',' + Mouse.world.y);
				}
			} else {
				if (
					entityOver &&
					entityOver != Session.Entity &&
					entityOver.objecttype != Entity.TYPE_EFFECT &&
					entityOver.objecttype != Entity.TYPE_TRAP
				) {
					if (KEYS.SHIFT) {
						// Shift + Right click on an entity
						Session.autoFollowTarget = entityOver;
						Session.autoFollow = true;
						onAutoFollow();
					}
				}

				// Right click only rotates the camera here.
				Cursor.setType(Cursor.ACTION.ROTATE);
				Camera.rotate(true);
			}
			break;
	}
}

/**
 * What to do when stop clicking on the map ?
 */
function onMouseUp(event) {
	let entity, ET;
	const action = (event && event.which) || 1;

	// Not rendering yet
	if (!Mouse.intersect) {
		return;
	}

	switch (action) {
		// Left click
		case 1:
			// Remove entity picking ?
			entity = EntityManager.getFocusEntity();

			if (entity) {
				ET = entity.constructor;
				entity.onMouseUp();

				// Touch Targeting retains any selected entity independently of /nc.
				if (
					!Session.TouchTargeting &&
					(Preferences.noctrl === false ||
						![ET.TYPE_MOB, ET.TYPE_NPC_ABR, ET.TYPE_NPC_BIONIC].includes(entity.objecttype))
				) {
					EntityManager.setFocusEntity(null);
					entity.onFocusEnd();
				}
			}

			// stop walking
			if (this.onRequestStopWalk) {
				this.onRequestStopWalk();
			}
			break;

		// Right Click
		case 3:
			Cursor.setType(Cursor.ACTION.DEFAULT);
			Camera.rotate(false);

			// Seems like it's how the official client handle the contextmenu
			// Just check for the same position on mousedown and mouseup
			if (_rightClickPosition[0] === Mouse.screen.x && _rightClickPosition[1] === Mouse.screen.y && !KEYS.SHIFT) {
				entity = EntityManager.getOverEntity();

				if (entity && entity !== Session.Entity) {
					entity.onContextMenu();
				}
			}
			break;
	}
}

/**
 * Zoom feature
 */
function onMouseWheel(event) {
	if (Mouse.state === Mouse.MOUSE_STATE.USESKILL) {
		if (event.deltaY < 0) {
			SkillTargetSelection.setSkillLevelDelta(1);
		} else {
			SkillTargetSelection.setSkillLevelDelta(-1);
		}
		return;
	}
	// Zooming on the scene
	const delta = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0;

	Camera.setZoom(delta);
}

/**
 * Allow dropping data
 */
function onDragOver(event) {
	event.stopImmediatePropagation();
	event.preventDefault();
}

/**
 * Drop items to the map
 */
function onDrop(event) {
	let data;

	try {
		data = JSON.parse(event.dataTransfer.getData('Text'));
	} catch (e) {
		console.error(e);
	}

	// Stop default behavior
	event.preventDefault();
	event.stopImmediatePropagation();
	if (!data) {
		return;
	}

	// Hacky way to trigger mouseleave (mouseleave isn't
	// triggered when dragging an object).
	// ondragleave event is not relyable to do it (not working as intended)
	if (data.from) {
		const comp = UIManager.getComponent(data.from);
		if (comp && comp.ui) {
			const el = comp.ui[0] || comp.ui;
			el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
		}
	}

	// Just support items ?
	if (data.type !== 'item' || data.from !== 'Inventory') {
		return;
	}

	// Can't drop an item on map if Equipment window is open
	if (Equipment.ui.is(':visible')) {
		ChatBox.addText(DB.getMessage(189), ChatBox.TYPE.ERROR, ChatBox.FILTER.ITEM);
		return;
	}

	// Item Drop Lock
	const InventoryVersion = UIManager.getComponent('Inventory').name;
	if (InventoryVersion !== 'InventoryV0' && Inventory.itemlock === true) {
		return;
	}

	const item = data.data;

	// Have to specify how much
	if (item.count > 1) {
		InputBox.append();
		InputBox.setType('item', false, item.count, item.ITID);
		InputBox.onSubmitRequest = function onSubmitRequest(count) {
			InputBox.remove();
			MapControl.onRequestDropItem(item.index, parseInt(count, 10));
		};
	}

	// Only one, don't have to specify
	else {
		MapControl.onRequestDropItem(item.index, 1);
	}
}

/**
 * Auto follow logic
 */
function onAutoFollow() {
	if (Session.autoFollow) {
		const player = Session.Entity;
		const target = Session.autoFollowTarget;

		const dx = Math.abs(player.position[0] - target.position[0]);
		const dy = Math.abs(player.position[1] - target.position[1]);

		// Use square based range check instead of Pythagorean because of diagonals
		if (dx > 1 || dy > 1) {
			const dest = [0, 0];

			// If there is valid cell send move packet
			if (checkFreeCell(Math.round(target.position[0]), Math.round(target.position[1]), 1, dest)) {
				let pkt;
				if (PACKETVER.value >= 20180307) {
					pkt = new PACKET.CZ.REQUEST_MOVE2();
				} else {
					pkt = new PACKET.CZ.REQUEST_MOVE();
				}
				pkt.dest = dest;
				Network.sendPacket(pkt);
			}
		}

		Events.setTimeout(onAutoFollow, 500);
	}
}

/**
 * Search free cells around a position
 *
 * @param {number} x
 * @param {number} y
 * @param {number} range
 * @param {array} out
 */
function checkFreeCell(x, y, range, out) {
	let _x, _y, r;
	const d_x = Session.Entity.position[0] < x ? -1 : 1;
	const d_y = Session.Entity.position[1] < y ? -1 : 1;

	// Search possible positions
	for (r = 0; r <= range; ++r) {
		for (_x = -r; _x <= r; ++_x) {
			for (_y = -r; _y <= r; ++_y) {
				if (isFreeCell(x + _x * d_x, y + _y * d_y)) {
					out[0] = x + _x * d_x;
					out[1] = y + _y * d_y;
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Does a cell is free (walkable, and no entity on)
 *
 * @param {number} x
 * @param {number} y
 * @param {returns} is free
 */
function isFreeCell(x, y) {
	if (!(Altitude.getCellType(x, y) & Altitude.TYPE.WALKABLE)) {
		return false;
	}

	let free = true;

	EntityManager.forEach(function (entity) {
		if (
			entity !== Session.Entity &&
			entity.objecttype !== entity.constructor.TYPE_EFFECT &&
			entity.objecttype !== entity.constructor.TYPE_UNIT &&
			entity.objecttype !== entity.constructor.TYPE_TRAP &&
			entity.objecttype !== entity.constructor.TYPE_CART &&
			entity.objecttype !== entity.constructor.TYPE_FALCON &&
			entity.objecttype !== entity.constructor.TYPE_WUG &&
			Math.round(entity.position[0]) === x &&
			Math.round(entity.position[1]) === y
		) {
			free = false;
			return false;
		}

		return true;
	});

	return free;
}

/**
 * Export
 */
export default MapControl;
