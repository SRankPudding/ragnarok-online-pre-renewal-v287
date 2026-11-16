# Was sich gegenüber Pre-Renewal geändert hat

## Server

| Bereich | Stand v2.87 |
| --- | --- |
| Technische Basis | rAthena, Commit `1ca3e7700939ea40120cb51a777f8681ba5e84ae`, Pre-Renewal, Packet-Version 20211103, MariaDB 11.4 und Docker |
| Leveln | 2.500 % Base-, Job-, Quest- und MVP-EXP. Zusätzliche Level-Checkpoints begleiten die Story. Mehr Traglast, erweiterbare Inventarplätze und zusätzliche Zeny für Monster und Questabschlüsse |
| Beute | 30 % Karten-Drop laut Battle-Konfiguration. Separater Zusatzwurf für Waffen und Rüstungen mit je 20 %. Bonusmaterialien mit 18 %. Pet Treats in den Karten-Dropdaten mit 40 % |
| Haustiere | Ein Pet Treat startet den Fangversuch. Basis-Fangchance 60 %, nach Fehlschlägen steigt sie bis 100 %. Pets können Loot aufsammeln. Händler bieten Futter und Brutgeräte an |
| Reisen | Stadtkristalle verbinden 21 Ziele für 100 Zeny. Klassenziele sind im Menü gekennzeichnet. Händler, Kafra und Kristalle haben unterschiedliche Markierungen auf der Minimap |
| Crafting | 147 serverseitige Rezepte für Waffen, Metalle, Tränke, Kochen und Konverter. Die Kommandos für Herstellung, Sammelreparatur und Refine prüfen ihre Kosten am Server. Sammelreparatur kostet 5.000 Zeny pro beschädigtem Teil |
| Enchantment | Ausrüstung kann mit einem wählbaren Statuswert bis +10 verbessert werden. Die späteren Stufen haben eine Fehlschlagchance. Enchantment zerstört oder verschlechtert den Gegenstand dabei nicht. Waffen können auf +10 einen zusätzlichen Effekt erhalten, der gegen Zeny neu gewürfelt werden kann |
| Quests | Einführung für Haustier, Statuspunkte und Ausrüstung. Kapitel in Morroc, Payon, Geffen, Prontera, Izlude und Alberta. Auf das Mentor-Briefing folgt die Aufgabe für den echten Wechsel in eine reguläre zweite Klasse. Danach folgen sechs automatische Jagden für Base Level 50 bis 99. Eigene Quest-IDs stehen in `server/game-db/quest_db.yml` |
| Komfort | WASD und Shift-Sprint, zusätzliche Händlerwaren, eigener Cash-Shop-Katalog. Die administrative Testgutschrift der privaten Installation ist in dieser Vorlage deaktiviert |

## Client

- **Quests und Navigation:** Quest-Tracker links, Quest-Lexikon, Fortschritt für Kill- und Sammelziele, Abgabehinweise und Routen je Ziel. Die Fundortdaten enthalten Monster, Karten und bekannte Händler. Fernziele zeigen einen geeigneten Stadtkristall. Kartenklicks können Navigation und automatisches Laufen starten.
- **Klassen und Dungeons:** Class Guide mit dem Einstieg in alle 13 regulären zweiten Klassen, Stats Guide und Rebirth-Hinweisen. Dungeon Codex mit Levelbereichen, Monstern, Beute und Eingängen. Für ausgewählte Klassenquests gibt es detaillierte Prüfungsanleitungen.
- **Karte und HUD:** Minimap mit Ausgängen, Händler- und Questmarkierungen. Innenkarten ohne Bild erhalten einen Grundriss aus begehbaren Feldern. Das Standardlayout zeigt Charakterinfo rechts, Minimap unten rechts, Aktionsleiste oberhalb des Chats sowie getrennte Base- und Job-EXP-Balken.
- **Ausrüstung:** Inventarfilter, sichtbare Enchantment-Stufen, gemeinsames Ausrüstungs- und Statusfenster und eigener Enchantment-Dialog. Crafting zeigt Zutaten, Mengen, Fundorte und Rechtsklick-Beschreibungen. Repair All und Refine stehen separat zur Verfügung.
- **Bedienung und Darstellung:** Angewählte Kämpfe und Schnellleisten, Cooldown-Anzeige, Kamerabewegung per Rechtsziehen und rahmenloser Vollbildmodus. Überarbeitete Login- und Charakterauswahl mit Klassen- und Levelanzeige, animierten Titelmotiven und wechselnden Ladebildern.
- **Updates:** SHA-256-Abgleich pro Datei, Fortschrittsfenster und Zeitgrenzen. Der optionale Patcher kann ältere Clients direkt auf den vollständigen veröffentlichten Stand bringen.

## Stand und Grenzen

Das Paket spiegelt die abgeschlossene Hobbyfassung wider. Für geskriptete Questziele ohne strukturierte Daten kann der Client nur die vorhandene Questbeschreibung anzeigen. Die sechs Weltjagden sind enthalten. Gesonderte kampffreie Erkundungsquests und Klassen-Sets als Meilensteinbelohnungen waren noch offen. Eigene private Musik und zusätzliche Weltkartenmotive wurden bei der Quellcode-Aufbereitung entfernt.
