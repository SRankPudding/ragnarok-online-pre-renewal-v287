/^bool pc_statusup(/,/^}/{
/achievement_update_objective(sd, AG_GOAL_STATUS, 1, final_value);/a\
\
	// Reward only after a real purchase using unspent status points.\
	if (quest_check(sd, 65016, HAVEQUEST) == 1 \&\& quest_update_status(sd, 65016, Q_COMPLETE) == 0) {\
		const t_exp next = pc_nextbaseexp(sd);\
		if (!pc_is_maxbaselv(sd) \&\& next > sd->status.base_exp)\
			pc_gainexp(sd, nullptr, next - sd->status.base_exp, 0, 2);\
		clif_displaymessage(sd->fd, "First Stat Point complete! You earned the Base EXP needed for the next level (if available) and 10,000 Zeny.");\
		chrif_save(sd, CSAVE_NORMAL);\
	}
}

