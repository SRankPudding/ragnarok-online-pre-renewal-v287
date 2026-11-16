/**
 * Engine/MapEngine/CashShop.js
 *
 * Manage Trade packets and UI
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Session from 'Engine/SessionStorage.js';
import CashShop from 'UI/Components/CashShop/CashShop.js';

function onOpenCashShop(pkt) {
	CashShop.prepare();
	CashShop.readPoints(pkt.cashPoints, pkt.kafraPoints, pkt.tab);
	CashShop.append();

	if (PACKETVER.value >= 20130320 && Session.requestCashShop) {
		Session.requestCashShop = false;
		Network.sendPacket(new PACKET.CZ.PC_CASH_POINT_ITEMLIST());
	}
}

function onOpenReqCashShopItemList(pkt) {
	CashShop.readCashShopItems(pkt);
}

function onSuccessCashShopBuyList(pkt) {
	CashShop.setSuccessCashShopUpdate(pkt);
}

/**
 * Initialize
 */
export default function MainEngine() {
	Network.hookPacket(PACKET.ZC.SE_CASHSHOP_OPEN, onOpenCashShop);
	Network.hookPacket(PACKET.ZC.SE_CASHSHOP_OPEN2, onOpenCashShop);
	Network.hookPacket(PACKET.ZC.SE_CASHSHOP_OPEN3, onOpenCashShop); // old with no tab
	Network.hookPacket(PACKET.ZC.ACK_SCHEDULER_CASHITEM, onOpenReqCashShopItemList);
	Network.hookPacket(PACKET.ZC.SE_PC_BUY_CASHITEM_RESULT, onSuccessCashShopBuyList);
}
