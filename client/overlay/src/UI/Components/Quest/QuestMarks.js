/**
 * UI/Components/Quest/QuestMarks.js
 *
 * Shared state for quest marks on the minimap: the quest log fills the list,
 * the minimap draws it. Kept in its own module so neither imports the other.
 */
const QuestMarks = {
	/** @type {string} current map name without extension */
	currentMap: '',
	/** @type {Array<{x:number, y:number, color:string, label:string}>} marks on the current map */
	list: [],
	/** Set by the quest log: rebuilds `list` for `currentMap` */
	refresh: null
};

export default QuestMarks;
