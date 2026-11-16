/int16 opt_id = sd->inventory.u.items_inventory\[index\].option\[j\].id;/a\
			if (opt_id == 32000) {\
				const auto\& enchant = sd->inventory.u.items_inventory[index].option[j];\
				const int32 stat_bonus[] = { SP_STR, SP_INT, SP_DEX, SP_AGI, SP_VIT, SP_LUK };\
				const auto* gear = sd->inventory_data[index];\
				const auto code = static_cast<unsigned char>(enchant.param);\
				if (code < 30 \&\&\
					enchant.value >= 1 \&\& enchant.value <= 10 \&\& gear \&\&\
					(pc_has_permission(sd, PC_PERM_USE_ALL_EQUIPMENT) || !itemdb_isNoEquip(gear, sd->m))) {\
					pc_bonus(sd, stat_bonus[code % 6], enchant.value + (enchant.value == 10 ? 2 : 0));\
					if (enchant.value == 10 \&\& gear->type == IT_WEAPON) {\
						switch (code / 6) {\
							case 1: pc_bonus(sd, SP_CRIT_ATK_RATE, 10); break;\
							case 2: pc_bonus(sd, SP_CRITICAL, 8); break;\
							case 3: pc_bonus(sd, SP_HIT, 15); break;\
							case 4: pc_bonus2(sd, SP_HP_DRAIN_RATE, 50, 8); break;\
						}\
					}\
				}\
				continue;\
			}

