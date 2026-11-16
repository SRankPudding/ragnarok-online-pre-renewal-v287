/^int32 quest_update_status(/,/^}/{
/clif_quest_delete(sd, quest_id);/a\
	pc_getzeny(sd, 10000, LOG_TYPE_SCRIPT);
}

