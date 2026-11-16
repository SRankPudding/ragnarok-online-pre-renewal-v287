/if *(rnd_chance(pet_catch_rate, 10000)) *{/i\
	char attempt_key[32];\
	snprintf(attempt_key, sizeof(attempt_key), "sro_tame_%u", static_cast<unsigned>(md->mob_id));\
	const int64 failed_attempts = cap_value(pc_readreg2(\&sd, attempt_key), 0, 4);\
	pet_catch_rate = 6000 + 1000 * failed_attempts;
/if *(rnd_chance(pet_catch_rate, 10000)) *{/a\
		pc_setreg2(\&sd, attempt_key, 0);
/if *(rnd_chance(pet_catch_rate, 10000)) *{/,/^}/{
/clif_pet_roulette( sd, false );/i\
		pc_setreg2(\&sd, attempt_key, failed_attempts + 1);
}

