export const UI = {
    splash: document.getElementById('splash-screen'),
    setup: document.getElementById('setup-screen'),
    status: document.getElementById('action-text'),
    threeMan: document.getElementById('current-3man'),
    turn: document.getElementById('current-turn'),
    drinks: document.getElementById('drinks-overlay'),
    doublesTitle: document.getElementById('doubles-title'),
    btns: document.getElementById('recipient-buttons'),
    playerList: document.getElementById('player-list'),
    playerInput: document.getElementById('player-input'),

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

    updateHUD(player, threeMan) {
        this.threeMan.innerText = `3MAN: ${threeMan ? threeMan.toUpperCase() : 'NONE'}`;
        this.turn.innerText = `TURN: ${player.toUpperCase()}`;
    },

    setStatus(text) {
        this.status.innerText = text;
    },

    showDrinks(total, players, confirmCallback) {
        this.drinks.classList.remove('hidden');
        this.doublesTitle.innerText = `GIVE ${total} DRINKS`;
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

    hideDrinks() {
        this.drinks.classList.add('hidden');
    }
};
