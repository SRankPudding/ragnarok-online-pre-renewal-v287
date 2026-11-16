s/static std::map<t_itemid, uint16> items = {/static const std::vector<std::pair<t_itemid, uint16>> items = {/
/{ ITEMID_INVENTORY_EX_EVT, 10 },/d
/{ ITEMID_INVENTORY_EX, 10 },/a\
\t\t{ ITEMID_INVENTORY_EX_EVT, 1 },
s/{ ITEMID_INVENTORY_EX_DIS, 10 }/{ ITEMID_INVENTORY_EX_DIS, INVENTORY_EXPANSION_SIZE }/
s/if( sd->status.inventory_slots + entry.second > MAX_INVENTORY )/const uint16 amount = entry.first == ITEMID_INVENTORY_EX_DIS ? MAX_INVENTORY - sd->status.inventory_slots : entry.second;\n\t\t\tif( sd->status.inventory_slots + amount > MAX_INVENTORY )/
s/sd->state.inventory_expansion_amount = entry.second;/sd->state.inventory_expansion_amount = amount;/
