// A reserved random-option record persists with the item through saves and transfers.
// Index, expected item ID, expected encoded bonus, stat index.
BUILDIN_FUNC(sroenchant)
{
	map_session_data* sd;
	if (!script_rid2sd(sd))
		return SCRIPT_CMD_FAILURE;

	const int64 index = script_getnum(st, 2);
	const int64 item_id = script_getnum(st, 3);
	const int64 current = script_getnum(st, 4);
	const int64 stat = script_getnum(st, 5);
	if (index < 0 || index >= MAX_INVENTORY || stat < -1 || stat >= 6 ||
		sd->state.trading || sd->state.storage_flag || sd->state.vending) {
		script_pushint(st, -1);
		return SCRIPT_CMD_SUCCESS;
	}

	auto& item = sd->inventory.u.items_inventory[index];
	const auto* data = sd->inventory_data[index];
	constexpr uint32 gear_slots = EQP_ARMOR | EQP_HAND_R | EQP_HAND_L | EQP_HEAD_TOP |
		EQP_HEAD_MID | EQP_HEAD_LOW | EQP_GARMENT | EQP_SHOES | EQP_ACC_RL;
	if (!data || (data->type != IT_ARMOR && data->type != IT_WEAPON) || !(data->equip & gear_slots) ||
		item.nameid != item_id || item.amount != 1 ||
		!item.identify || item.attribute || item.equip || item.equipSwitch ||
		item.expire_time) {
		script_pushint(st, -1);
		return SCRIPT_CMD_SUCCESS;
	}

	int slot = -1;
	int empty = -1;
	int old_stat = -1;
	int old_level = 0;
	int effect = 0;
	for (int i = 0; i < MAX_ITEM_RDM_OPT; ++i) {
		const auto& option = item.option[i];
		if (option.id == 32000) {
			slot = i;
			old_stat = option.param % 6;
			effect = option.param / 6;
			old_level = option.value;
			break;
		}
		if (option.id == 0 && empty < 0)
			empty = i;
	}
	const auto card = item.card[MAX_SLOTS - 1];
	const bool legacy = slot < 0 && data->type == IT_ARMOR && (data->equip & EQP_ARMOR) &&
		data->slots < MAX_SLOTS && !itemdb_isspecial(item.card[0]) &&
		card >= 4700 && card <= 4752 && card % 10 <= 2;
	if (legacy) {
		old_stat = (card - 4700) / 10;
		old_level = card % 10 + 1;
	}
	const int encoded = old_level ? 1 + old_stat * 10 + old_level - 1 : 0;
	const bool weapon = data->type == IT_WEAPON;
	if (stat == -1) {
		if (!weapon || slot < 0 || old_level != 10 || current != encoded + effect * 100) {
			script_pushint(st, -1);
			return SCRIPT_CMD_SUCCESS;
		}
		if (pc_payzeny(sd, 5000, LOG_TYPE_SCRIPT)) {
			script_pushint(st, -2);
			return SCRIPT_CMD_SUCCESS;
		}
		const int next = effect ? 1 + (effect - 1 + rnd() % 3 + 1) % 4 : 1 + rnd() % 4;
		item.option[slot].param = old_stat + 6 * next;
		clif_delitem(*sd, index, 1, 0);
		clif_additem(sd, index, 1, 0);
		chrif_save(sd, CSAVE_NORMAL);
		script_pushint(st, 11);
		return SCRIPT_CMD_SUCCESS;
	}
	if (encoded != current || old_level < 0 || old_level >= 10 ||
		(old_level && old_stat != stat) || (slot < 0 && empty < 0)) {
		script_pushint(st, -1);
		return SCRIPT_CMD_SUCCESS;
	}

	const int32 level = old_level + 1;
	const int32 price = level < 8 ? 1000 : 2000;
	if (pc_payzeny(sd, price, LOG_TYPE_SCRIPT)) {
		script_pushint(st, -2);
		return SCRIPT_CMD_SUCCESS;
	}

	const int32 chance = level < 5 ? 100 : 50 - level * 2;
	if (rnd() % 100 >= chance) {
		chrif_save(sd, CSAVE_NORMAL);
		script_pushint(st, -3);
		return SCRIPT_CMD_SUCCESS;
	}
	const int new_effect = weapon && level == 10 ? 1 + rnd() % 4 : 0;
	item.option[slot >= 0 ? slot : empty] = { 32000, static_cast<int16>(level), static_cast<char>(stat + 6 * new_effect) };
	if (legacy)
		item.card[MAX_SLOTS - 1] = 0;
	clif_delitem(*sd, index, 1, 0);
	clif_additem(sd, index, 1, 0);
	chrif_save(sd, CSAVE_NORMAL);
	script_pushint(st, level);
	return SCRIPT_CMD_SUCCESS;
}

