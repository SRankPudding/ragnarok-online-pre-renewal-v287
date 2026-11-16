/**
 * Audio/BGM.js
 *
 * BGM Manager
 *
 * Class to Manage BGM (RO background music)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Client from 'Core/Client.js';
import Preferences from 'Preferences/Audio.js';

let _playToken = 0;
let musicContext;
let musicSource;
let centeredElement;

function canCenter(url) {
	try {
		const audioURL = new URL(url, location.href);
		return ['blob:', 'data:'].includes(audioURL.protocol) ||
			(location.origin !== 'null' && audioURL.origin === location.origin);
	} catch {
		return false;
	}
}

function centerMusic(audio) {
	if (!canCenter(audio.src) || centeredElement === audio) return;
	const Context = window.AudioContext || window.webkitAudioContext;
	if (!Context) return;
	try {
		musicContext ||= new Context();
		if (musicContext.state !== 'running') {
			musicContext.resume().then(() => {
				if (musicContext.state === 'running' && audio === BGM.audio) centerMusic(audio);
			}).catch(() => {});
			return;
		}
		const mono = musicContext.createGain();
		mono.channelCountMode = 'explicit';
		mono.channelCount = 1;
		mono.channelInterpretation = 'speakers';
		mono.connect(musicContext.destination);
		musicSource = musicContext.createMediaElementSource(audio);
		musicSource.connect(mono);
		centeredElement = audio;
	} catch (error) {
		console.warn('Could not center background music:', error.message);
	}
}

/**
 * BGM NameSpace
 */
class BGM {
	static filename = null;
	static volume = Preferences.BGM.volume;
	static extension = 'mp3';
	static isInit = false;
	static audio = document.createElement('audio');

	// Cache to persist playback position when switching BGMs
	static cache = {
		filename: null,
		currentTime: 0
	};

	/**
	 * Initialize player
	 * Fixed a known bug
	 */
	static init() {
		if (BGM.isInit) {
			return;
		}

		BGM.isInit = true;

		// Buggy looping for HTM5 Audio...
		if (typeof BGM.audio.loop === 'boolean') {
			BGM.audio.loop = true;
			return;
		}

		// Work around
		BGM.audio.addEventListener(
			'ended',
			() => {
				BGM.audio.currentTime = 0;
				if (BGM.cache.filename === BGM.filename) {
					BGM.cache.currentTime = 0;
				}
				BGM.audio.play();
			},
			false
		);
	}

	/**
	 * Test audio extension from a list to see what format the browser can read
	 *
	 * @param {Array} extensions list
	 */
	static setAvailableExtensions(extensions) {
		let i, count;
		const audio = BGM.audio;

		if (!extensions || !extensions.length) {
			extensions = ['mp3'];
		}

		// Find supported audio file from list
		for (i = 0, count = extensions.length; i < count; ++i) {
			if (audio.canPlayType(`audio/${extensions[i]}`).replace(/no/i, '')) {
				BGM.extension = extensions[i];
				BGM.init();
				return;
			}
		}
	}

	/**
	 * Play the audio file specify
	 *
	 * @param {string} filename
	 */
	static play(filename) {
		if (!filename) return;
		if (filename.match(/bgm/i)) {
			filename = filename.match(/\w+\.mp3/i)?.toString();
			if (!filename) return;
		}
		if (BGM.filename === filename && BGM.audio && !BGM.audio.paused) {
			return;
		}

		// Save current progress before switching BGMs
		if (BGM.filename && BGM.audio) {
			BGM.cache.filename = BGM.filename;
			BGM.cache.currentTime = BGM.audio.currentTime;
		}

		BGM.filename = filename;
		const myToken = ++_playToken;
		// Login and character selection play our own title theme (Audio/title_theme.mp3) when the file is there
		if (filename === '01.mp3' && Preferences.BGM.play && !BGM.noTitleTheme) {
			// Loaded as a blob like every other track: the audio element cannot stream from app:// directly
			const original = () => {
				BGM.noTitleTheme = true;
				if (myToken === _playToken) {
					Client.loadFile(`BGM/${filename}`, url => BGM.load(url));
				}
			};
			if (BGM.titleTheme) {
				BGM.load(BGM.titleTheme);
				return;
			}
			fetch(new URL('./title_theme.mp3', import.meta.url).href)
				.then(response => {
					if (!response.ok) {
						throw new Error('no title theme');
					}
					return response.blob();
				})
				.then(blob => {
					BGM.titleTheme = URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' }));
					if (myToken === _playToken) {
						BGM.load(BGM.titleTheme);
					}
				})
				.catch(original);
			return;
		}
		if (Preferences.BGM.play) {
			Client.loadFile(`BGM/${filename}`, url => {
				if (myToken !== _playToken) {
					return;
				}
				BGM.load(url);
			});
		}
	}

	/**
	 * Play the music centred. Some town tracks jump between the left and the right channel,
	 * which is unpleasant on headphones: both channels are mixed into one.
	 */
	static centre() {
		if (BGM.context) {
			if (BGM.context.state === 'suspended') {
				BGM.context.resume().catch(() => {});
			}
			return;
		}
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (BGM.context === null || !AudioContextClass) {
			return;
		}
		try {
			const context = new AudioContextClass();
			const mono = context.createGain();
			mono.channelCount = 1;
			mono.channelCountMode = 'explicit';
			mono.channelInterpretation = 'speakers';
			context.createMediaElementSource(BGM.audio).connect(mono);
			mono.connect(context.destination);
			BGM.context = context;
			// A context can start paused until the first input: wake it up then
			const wake = () => BGM.centre();
			document.addEventListener('pointerdown', wake, true);
			document.addEventListener('keydown', wake, true);
		} catch (error) {
			// Leave the music as it was
			BGM.context = null;
		}
	}

	/**
	 * Load the audio file
	 *
	 * @param {string} url (HTTP / DATA URI or BLOB)
	 */
	static load(url) {
		if (!Preferences.BGM.play) {
			return;
		}

		// Add support for other extensions, only supported with
		// remote audio files.
		if (!url.match(/^(blob|data):/)) {
			url = url.replace(/mp3$/i, BGM.extension);
		}

		// Check if the new BGM matches the one in the cache
		const isSameBGM = BGM.cache.filename === BGM.filename;
		const targetTime = isSameBGM ? BGM.cache.currentTime : 0;

		BGM.centre();
		if (centeredElement === BGM.audio && !canCenter(url)) {
			BGM.audio.pause();
			musicSource.disconnect();
			centeredElement = null;
			BGM.audio = document.createElement('audio');
			BGM.isInit = false;
			BGM.init();
		}
		BGM.audio.src = url;
		BGM.audio.volume = BGM.volume;

		// Restore playback position if the BGM is the same
		BGM.audio.currentTime = targetTime;

		const playPromise = BGM.audio.play();
		centerMusic(BGM.audio);
		if (playPromise) {
			playPromise.catch(err => {
				if (err.name !== 'AbortError') {
					console.warn('Failed to play:', err);
				}
			});
		}
	}

	/**
	 * Stop the BGM
	 */
	static stop() {
		_playToken++;
		if (BGM.audio) {
			// Save current progress before pausing the global playback
			BGM.cache.filename = BGM.filename;
			BGM.cache.currentTime = BGM.audio.currentTime;
			BGM.audio.pause();
		}
	}

	/**
	 * Change the volume of the BGM
	 *
	 * @param {number} volume
	 */
	static setVolume(volume) {
		BGM.volume = volume;
		Preferences.BGM.volume = volume;
		Preferences.save();

		BGM.audio.volume = volume;
	}
}

/**
 * Export
 */
export default BGM;
