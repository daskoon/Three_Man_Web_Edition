/**
 * @file ui.js
 * @description DOM Abstraction Layer for the Three Man HUD and Overlays.
 * 
 * WHAT: Maps HTML elements to a structured object and provides methods for UI updates.
 * WHY: Prevents the main game loop from becoming cluttered with document.getElementById calls.
 * HOW: Centralizes state-based UI changes (like showing challenge prompts or shame glows).
 */

export const UI = {
    // --- DOM REFERENCES ---
    splash: document.getElementById('splash-screen'),
    setup: document.getElementById('setup-screen'),
    status: document.getElementById('action-text'),
    threeMan: document.getElementById('current-3man'),
    threeManBadge: document.getElementById('three-man-badge'),
    turn: document.getElementById('current-turn'),
    drinks: document.getElementById('drinks-overlay'),
    doublesTitle: document.getElementById('doubles-title'),
    btns: document.getElementById('recipient-buttons'),
    playerList: document.getElementById('player-list'),
    playerInput: document.getElementById('player-input'),
    logBtn: document.getElementById('download-logs-btn'),

    /**
     * WHAT: Player List Renderer.
     * WHY: Dynamically updates the setup screen as names are added or removed.
     * HOW: Maps the player array to HTML strings and injects them into the DOM.
     */
    renderPlayers(players, removeCallback) {
        this.playerList.innerHTML = players.map((p, k) => `
            <div class='player-entry'>
                <span>${p}</span>
                <button class="remove-btn" data-idx="${k}">X</button>
            </div>
        `).join('');
        
        this.playerList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => removeCallback(parseInt(btn.dataset.idx));
        });
    },

    /**
     * WHAT: HUD Synchronizer.
     * WHY: Keeps the top-screen badges in sync with the current game state.
     * HOW: Updates innerText based on the current turn and 3-Man index.
     */
    updateHUD(player, threeMan) {
        this.threeMan.innerText = `3MAN: ${threeMan ? threeMan.toUpperCase() : 'NONE'}`;
        this.turn.innerText = `TURN: ${player ? player.toUpperCase() : '...'}`;
    },

    /**
     * WHAT: Log Button Initializer.
     * WHY: Bridges the gap between UI and the logger in main.js.
     */
    initLogButton(callback) {
        if (this.logBtn) this.logBtn.onclick = callback;
    },

    /**
     * WHAT: Status Text Updater.
     * WHY: Primary feedback mechanism for the user (e.g., "SHAKE TO ROLL").
     */
    setStatus(text) {
        this.status.innerText = text;
    },

    /**
     * WHAT: Challenge/Doubles Selection UI.
     * WHY: Allows the roller to "pass" drinks or pick a "Challenger" (PDF Rule).
     * HOW: Generates a grid of buttons for every active player.
     */
    showChallenge(players, confirmCallback) {
        this.drinks.classList.remove('hidden');
        this.doublesTitle.innerText = "PICK A CHALLENGER";
        this.btns.innerHTML = players.map((p, i) => `
            <button class="give-btn" data-idx="${i}">${p}</button>
        `).join('');
        
        this.btns.querySelectorAll('.give-btn').forEach(btn => {
            btn.onclick = () => {
                this.drinks.classList.add('hidden');
                confirmCallback(parseInt(btn.dataset.idx));
            };
        });
    },

    /**
     * WHAT: Shame Glow Activator.
     * WHY: Visual penalty for the 3-Man when they drink.
     * HOW: Adds/removes a CSS class that triggers a gold-pulsing shadow.
     */
    setShame(active) {
        if (active) this.threeManBadge.classList.add('shame-glow');
        else this.threeManBadge.classList.remove('shame-glow');
    }
};
