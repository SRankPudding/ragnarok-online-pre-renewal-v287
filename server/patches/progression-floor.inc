// Grant the missing regular level-up EXP, with normal stat and skill point awards.
BUILDIN_FUNC(sroprogressfloor)
{
	map_session_data* sd;
	if (!script_rid2sd(sd))
		return SCRIPT_CMD_FAILURE;

	const int32 base = cap_value(script_getnum(st, 2), 0, 99);
	const int32 job = cap_value(script_getnum(st, 3), 0, 50);
	while (sd->status.base_level < base && !pc_is_maxbaselv(sd)) {
		const auto before = sd->status.base_level;
		const t_exp next = pc_nextbaseexp(sd);
		if (next <= sd->status.base_exp) break;
		pc_gainexp(sd, nullptr, next - sd->status.base_exp, 0, 2);
		if (sd->status.base_level == before) break;
	}
	while (sd->status.job_level < job && !pc_is_maxjoblv(sd)) {
		const auto before = sd->status.job_level;
		const t_exp next = pc_nextjobexp(sd);
		if (next <= sd->status.job_exp) break;
		pc_gainexp(sd, nullptr, 0, next - sd->status.job_exp, 2);
		if (sd->status.job_level == before) break;
	}
	chrif_save(sd, CSAVE_NORMAL);
	return SCRIPT_CMD_SUCCESS;
}

