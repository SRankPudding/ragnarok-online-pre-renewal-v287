export const statBasics = [
	['STR', 'Raises melee physical damage and carrying capacity. Useful for melee builds and certain skill formulas.'],
	['AGI', 'Raises attack speed and Flee. Flee is less dependable when several monsters surround you.'],
	['VIT', 'Raises max HP, improves recovery from healing items and helps resist several status effects. Good for taking hits.'],
	['INT', 'Raises magic attack and max SP. It also helps SP recovery and matters for skills such as Heal.'],
	['DEX', 'Raises HIT and bow damage, and shortens many Pre-Renewal casts. Add it early if your attacks miss.'],
	['LUK', 'Raises Critical and Perfect Dodge. Some skills, traps and crafting builds use it too.']
];

// Advanced jobs are listed alongside their parent job when they share the same priorities.
export const builds = [
	['Novice / High Novice', 'STR or DEX · AGI or VIT', 'Use the stats your first weapon needs. Spend nine points on Basic Skill and reach Job Lv 10 to change jobs.'],
	['Swordman / High Swordman', 'STR · DEX · VIT', 'DEX keeps Bash reliable. Take VIT for a shield build or AGI for faster normal attacks.'],
	['Knight / Lord Knight', 'STR · VIT · DEX', 'Spear and mobbing builds favor VIT. Two-Hand Quicken builds favor AGI and still need enough HIT.'],
	['Crusader / Paladin', 'VIT · STR · DEX', 'Shield and protection builds favor durability. Grand Cross benefits from INT as well as STR.'],
	['Acolyte / High Acolyte', 'INT · DEX · VIT', 'INT supports healing and SP. A melee Acolyte can favor STR and AGI instead.'],
	['Priest / High Priest', 'INT · DEX · VIT', 'Use INT for sustained healing, DEX for casts and VIT to survive while supporting others.'],
	['Monk / Champion', 'STR · DEX · INT', 'Combo builds can use AGI. Asura Strike benefits from attack and a large SP pool.'],
	['Archer / High Archer', 'DEX · AGI', 'DEX gives bow damage and HIT. Add INT if repeated Double Strafe drains your SP.'],
	['Hunter / Sniper', 'DEX · AGI', 'Add LUK for automatic Falcon strikes, or INT for trap and SP-heavy builds.'],
	['Bard / Clown', 'DEX · INT · VIT', 'DEX helps bow damage. Support builds can use INT for SP and VIT to keep performing under pressure.'],
	['Dancer / Gypsy', 'DEX · INT · VIT', 'DEX is a good leveling start. Check the specific dance formula before committing to a support build.'],
	['Mage / High Mage', 'INT · DEX', 'INT improves spell damage and SP. DEX helps you finish casting before enemies reach you.'],
	['Wizard / High Wizard', 'INT · DEX · VIT', 'Build INT for damage and DEX for cast time. A little VIT is useful when enemies break through your frontline.'],
	['Sage / Professor', 'INT · DEX · VIT', 'Support and spell builds value DEX. Auto-spell builds can invest in AGI for attack speed.'],
	['Merchant / High Merchant', 'STR · DEX · VIT', 'STR and HIT help physical leveling. Plan a separate DEX/LUK setup if you want to specialize in crafting.'],
	['Blacksmith / Whitesmith', 'STR · DEX · VIT or AGI', 'VIT suits skill-heavy fighting. AGI suits normal attacks. Dedicated forging favors DEX and LUK.'],
	['Alchemist / Creator', 'INT · DEX or STR', 'Acid Demonstration favors INT. Physical leveling favors STR and HIT, while brewing uses DEX and LUK.'],
	['Thief / High Thief', 'STR · AGI · DEX', 'Raise DEX if Double Attack misses. AGI and Improve Dodge help against single enemies.'],
	['Assassin / Assassin Cross', 'STR · AGI · DEX or LUK', 'Use LUK for crit builds. Skill and dual-dagger builds generally want enough DEX to hit reliably.'],
	['Rogue / Stalker', 'STR or DEX · AGI · VIT', 'Use STR for melee and DEX for bows. DEX also helps strip builds. Choose your copied skill before specializing.'],
	['Ninja', 'INT · DEX or STR · DEX', 'Magic favors INT and casting speed. Physical skills need a separate build. Read the skill formula before mixing both.'],
	['Gunslinger', 'DEX · AGI or INT', 'DEX helps gun damage. AGI suits normal attacks and INT helps keep skill-heavy builds supplied with SP.'],
	['Taekwon', 'STR · DEX · AGI or VIT', 'Balance kick damage and HIT first. Choose speed for solo play or VIT to take more hits.'],
	['Star Gladiator', 'STR · DEX · AGI or VIT', 'Plan which maps and monsters you want to specialize in before setting your targets.'],
	['Soul Linker', 'INT · DEX · VIT', 'INT supports magic and SP, DEX helps casts and VIT is useful for surviving while buffing.'],
	['Super Novice', 'STR or INT · DEX', 'Pick melee or magic first. Commit your limited early points to the skills you actually use.']
];

export const endgame = [
	['Build around a role', 'Pick damage, tanking or support. Check HIT or cast time first, then fix your biggest gear weakness.'],
	['Gear for the dungeon', 'Match weapon element and defensive cards to the monsters. Use Enchantment to add a stat to your gear.'],
	['Explore with a party', 'Use the Dungeon Codex tab to pick a destination. Learn its route and monsters before taking on bosses.']
];
