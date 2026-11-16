/**
 * WinLoginCommon.js
 *
 * Create a common login window for the game.
 *
 * @author AoShinHo
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import PerfProbe from 'Core/PerfProbe.js';
import 'UI/Elements/Elements.js';

export function createWinLogin({ name, htmlText, cssText }) {
	const Component = new GUIComponent(name, cssText);
	Component.render = () => htmlText;
	Component.needFocus = false;

	const _preferences = Preferences.get('WinLogin', { saveID: true, ID: '' }, 1.0);

	let _inputUsername;
	let _inputPassword;
	let _buttonSave;
	let _rememberPassword;
	let _pendingLogin;
	let _savedUsername;
	let _loginView = 0;
	const gameLogin = window.electronAPI?.gameLogin;

	Component.init = function init() {
		this.draggable();

		const root = this.getRoot();
		// Save element references
		_inputUsername = root.querySelector('.user');
		_inputPassword = root.querySelector('.pass');
		_buttonSave = root.querySelector('.save');
		_rememberPassword = root.querySelector('.save-password input');
		if (_rememberPassword && gameLogin) {
			_rememberPassword.parentElement.hidden = false;
			_rememberPassword.addEventListener('change', () => {
				if (!_rememberPassword.checked) forgetPassword();
			});
			_inputUsername.addEventListener('input', () => {
				if (_savedUsername && _inputUsername.value !== _savedUsername) {
					_inputPassword.value = '';
					_savedUsername = null;
				}
			});
		}

		// Keep clicks inside the fields from dragging the window.
		_inputUsername.addEventListener('mousedown', function (event) {
			this.focus();
			event.stopImmediatePropagation();
		});
		_inputPassword.addEventListener('mousedown', function (event) {
			this.focus();
			event.stopImmediatePropagation();
		});

		// Save button toggle
		_buttonSave.addEventListener('mousedown', event => {
			toggleSaveButton();
			event.stopImmediatePropagation();
		});

		// Connect / Signup / Exit
		root.querySelector('.signup').addEventListener('click', signup);
		root.querySelector('.connect').addEventListener('click', connect);
		root.querySelector('.exit').addEventListener('click', exit);

		// Replay Upload, only present on the UI versions supporting replays
		const replayUpload = root.querySelector('.replay-upload');
		const replayButton = root.querySelector('.replay');

		if (!replayUpload || !replayButton) {
			return;
		}

		replayButton.addEventListener('click', () => {
			replayUpload.click();
		});
		replayUpload.addEventListener('change', function () {
			if (!this.files || !this.files.length) {
				return;
			}

			const file = this.files[0];
			this.value = ''; // reset so we can select same file again

			if (!file.name || !file.name.toLowerCase().endsWith('.rrf')) {
				UIManager.showMessageBox('Please select a Ragnarok replay file (.rrf).', 'ok');
				return;
			}

			loadReplay(file);
		});
	};

	Component.onAppend = function onAppend() {
		_pendingLogin = null;
		_savedUsername = null;
		const view = ++_loginView;
		_inputUsername.value = _preferences.saveID ? _preferences.ID : '';
		_inputPassword.value = '';
		if (_rememberPassword && gameLogin) {
			_rememberPassword.checked = false;
			const username = _inputUsername.value;
			if (username) {
				gameLogin('read', username).then(password => {
					if (password && view === _loginView && _inputUsername.value === username &&
						!_inputPassword.value && Component._host?.isConnected) {
						_inputPassword.value = password;
						_rememberPassword.checked = true;
						_savedUsername = username;
					}
				}).catch(() => {});
			}
		}
		_buttonSave.setAttribute('aria-pressed', String(_preferences.saveID));

		Client.loadFile(
			`${DB.INTERFACE_PATH}login_interface/chk_save${_preferences.saveID ? 'on' : 'off'}.bmp`,
			url => {
				_buttonSave.style.backgroundImage = 'url(' + url + ')';
			}
		);

		if (_preferences.ID.length) {
			_inputPassword.focus();
		} else {
			_inputUsername.focus();
		}

		Component.placeOnTop();

		if (PerfProbe.enabled) {
			PerfProbe.loginShown();
		}
	};

	Component.onKeyDown = function onKeyDown(event) {
		if (this._host.style.display === 'none') return true;

		switch (event.which) {
			case KEYS.ENTER:
				connect();
				event.stopImmediatePropagation();
				return false;
			case KEYS.ESCAPE:
				exit();
				event.stopImmediatePropagation();
				return false;
			case KEYS.TAB: {
				if (_rememberPassword && gameLogin) return true;
				const activeEl = this._shadow.activeElement;
				const target = activeEl === _inputUsername ? _inputPassword : _inputUsername;
				target.focus();
				target.select();
				event.stopImmediatePropagation();
				return false;
			}
		}
		return true;
	};

	function toggleSaveButton() {
		_preferences.saveID = !_preferences.saveID;
		if (!_preferences.saveID && _rememberPassword && gameLogin) {
			_rememberPassword.checked = false;
			forgetPassword();
		}
		_buttonSave.setAttribute('aria-pressed', String(_preferences.saveID));
		Client.loadFile(
			`${DB.INTERFACE_PATH}login_interface/chk_save${_preferences.saveID ? 'on' : 'off'}.bmp`,
			url => {
				_buttonSave.style.backgroundImage = 'url(' + url + ')';
			}
		);
	}

	function exit() {
		Component.onExitRequest();
		return false;
	}

	function connect() {
		const user = _inputUsername.value;
		const pass = _inputPassword.value;
		++_loginView;
		_pendingLogin = _rememberPassword?.checked && gameLogin && user && pass ? { user, pass } : null;
		if (_pendingLogin) _preferences.saveID = true;
		if (_preferences.saveID) {
			_preferences.saveID = true;
			_preferences.ID = user;
		} else {
			_preferences.saveID = false;
			_preferences.ID = '';
		}
		_preferences.save();
		Component.onConnectionRequest(user, pass);
		return false;
	}

	function forgetPassword() {
		++_loginView;
		_savedUsername = null;
		gameLogin('forget').catch(() => UIManager.showMessageBox('Could not remove the saved password.', 'ok'));
	}

	Component.onLoginAccepted = function onLoginAccepted() {
		const login = _pendingLogin;
		_pendingLogin = null;
		if (login) {
			gameLogin('save', login.user, login.pass).then(saved => {
				if (!saved) UIManager.showMessageBox('Could not save the password on this PC.', 'ok');
			}).catch(() => UIManager.showMessageBox('Could not save the password on this PC.', 'ok'));
		}
	};

	async function loadReplay(file) {
		try {
			// Loaded on demand, the replay stack pulls in the whole map engine
			const { default: ReplayPlayer } = await import('Engine/Replay/ReplayPlayer.js');
			const replay = new ReplayPlayer();

			await replay.load(file);
			Component.remove();
			replay.start();
		} catch (err) {
			console.error('[Replay] Error loading replay', err);
			UIManager.showMessageBox(`Could not load the replay file.\n${err.message || err}`, 'ok');
		}
	}

	function signup() {
		const url = Configs.get('registrationweb');
		if (url) {
			UIManager.showPromptBox(
				DB.getMessage(662),
				'ok',
				'cancel',
				() => {
					window.open(url);
				},
				null
			);
		} else {
			UIManager.showPromptBox(
				'No registration URL was provided.\nIf this server uses simplified registration, then input your new:\n - Username followed by _M for Male and _F for Female account (Eg: MyUser_M)\n - Password.',
				'ok',
				'cancel',
				null,
				null
			);
		}
	}

	Component.onConnectionRequest = function onConnectionRequest() {};
	Component.onExitRequest = function onExitRequest() {};

	return UIManager.addComponent(Component);
}
