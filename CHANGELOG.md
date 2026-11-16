# Changes from standard Pre-Renewal

## Server

| Area | v2.87 |
| --- | --- |
| Platform | rAthena commit `1ca3e7700939ea40120cb51a777f8681ba5e84ae`, Pre-Renewal, packet version 20211103, MariaDB 11.4, and Docker |
| Leveling | 2,500% Base, Job, quest, and MVP EXP. Story checkpoints, higher carrying capacity, expandable inventory, and additional Zeny from monsters and quests |
| Loot | Card drops are set to 30%. Extra weapon and armor drops each roll at 20%, bonus materials at 18%, and Pet Treats are listed at 40% in map drops |
| Pets | A Pet Treat starts taming. Base success is 60%, increasing to 100% after failures. Pets can collect loot. Merchants sell food and incubators |
| Travel | City Crystals connect 21 destinations for 100 Zeny per trip. First-job destinations are labeled, and services have distinct minimap markers |
| Crafting | 147 server-side recipes for weapons, metals, potions, food, and converters. The server validates crafting, repair, and refinement costs. Repair All costs 5,000 Zeny per damaged item |
| Enchantment | Pick a stat and upgrade gear to +10. Later ranks can fail without damage or downgrades. +10 weapons can gain an additional effect that can be rerolled for Zeny |
| Quests | Tutorials for pets, stats, and gear. Chapters in Morroc, Payon, Geffen, Prontera, Izlude, and Alberta. The mentor's quest leads to an actual second-job change and six automated hunting quests for Base Levels 50–99. See `server/game-db/quest_db.yml` |
| Quality of life | WASD, Shift sprint, additional shop goods, and a custom Cash Shop catalog. The private installation's test credit command is disabled in this template |

## Client

- **Quests and navigation.** Left-side tracker, Quest Lexicon, progress for kill and collection objectives, turn-in prompts, and routes per objective. Sources include monsters, maps, and known merchants. Distant destinations show a suitable City Crystal. Map clicks can start routing and automatic walking.
- **Classes and dungeons.** Class Guide for all 13 regular second jobs, a Stats Guide, and Rebirth guidance. Dungeon Codex with level ranges, monsters, loot, and entrances. Selected job quests also have step-by-step test guides.
- **Map and HUD.** Minimap exits, services, and quest markers. Indoor maps without an image use walkable tiles to draw a floor plan. The default layout includes character info on the right, a bottom-right minimap, a shortcut bar above chat, and separate Base and Job EXP bars.
- **Equipment and crafting.** Inventory filters, visible enchantment levels, combined equipment and stats, and a dedicated enchantment window. Crafting shows ingredients, quantities, sources, and right-click item details. Repair All and Refine have separate buttons.
- **Controls and presentation.** Combat shortcuts, cooldown indicators, right-drag camera control, and borderless fullscreen. The login and character selection show updated artwork and clearer class and level details. Title backgrounds animate and loading illustrations rotate.
- **Updates.** The optional patcher uses per-file SHA-256 checks, a progress window, and time limits. Older clients can update directly to the full published version.

## Known limits

Scripted quest objectives without structured data rely on the existing quest description. The six world hunts are included. Separate non-combat exploration quests and milestone class sets were unfinished. Private music and additional world map illustrations are excluded from the source package.
