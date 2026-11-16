/memcpy(\&pd->loot->item\[pd->loot->count++\]/,+2c\
				if (pc_additem(sd, &fitem->item, fitem->item.amount, LOG_TYPE_PICKDROP_PLAYER) == ADDITEM_SUCCESS)\
					map_clearflooritem(target);\
				else\
					pd->ud.canact_tick = tick + 1000;

