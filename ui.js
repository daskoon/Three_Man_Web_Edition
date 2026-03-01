/**
 * @file ui.js
 * @description DOM Abstraction Layer for the Three Man HUD and Overlays.
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
    guide: document.getElementById('guide-screen'),
    guideBody: document.getElementById('guide-body'),

    showGuide(show) {
        if (show) {
            this.populateGuide();
            this.guide.classList.remove('hidden');
        } else {
            this.guide.classList.add('hidden');
        }
    },

    populateGuide() {
        if (this.guideBody.innerHTML !== "") return; // Already populated

        const combinations = [
            { v1: 1, v2: 1, desc: "SNAKE EYES! Make a rule & Challenge." },
            { v1: 1, v2: 2, desc: "NEW THREE MAN! No one drinks." },
            { v1: 1, v2: 3, desc: "3-Man drinks 1 | SOCIAL (Everyone drinks)." },
            { v1: 1, v2: 4, desc: "SOCIAL! Everyone drinks." },
            { v1: 1, v2: 5, desc: "Dead Roll. Turn Ends." },
            { v1: 1, v2: 6, desc: "Left neighbor drinks." },
            { v1: 2, v2: 2, desc: "SOCIAL | Challenge." },
            { v1: 2, v2: 3, desc: "3-Man drinks 1." },
            { v1: 2, v2: 4, desc: "SOCIAL! Everyone drinks." },
            { v1: 2, v2: 5, desc: "Left neighbor drinks." },
            { v1: 2, v2: 6, desc: "Dead Roll. Turn Ends." },
            { v1: 3, v2: 3, desc: "3-Man drinks 2 | Challenge." },
            { v1: 3, v2: 4, desc: "3-Man drinks 1 | SOCIAL | Left neighbor drinks." },
            { v1: 3, v2: 5, desc: "3-Man drinks 1." },
            { v1: 3, v2: 6, desc: "3-Man drinks 1." },
            { v1: 4, v2: 4, desc: "SOCIAL | Challenge." },
            { v1: 4, v2: 5, desc: "SOCIAL." },
            { v1: 4, v2: 6, desc: "SOCIAL." },
            { v1: 5, v2: 5, desc: "THUMBS! Last one down drinks | Challenge." },
            { v1: 5, v2: 6, desc: "Right neighbor drinks." },
            { v1: 6, v2: 6, desc: "Challenge." }
        ];

        this.guideBody.innerHTML = combinations.map(c => `
            <tr>
                <td>
                    <div class="dice-pair-ui">
                        ${this.renderDieUI(c.v1)}
                        ${this.renderDieUI(c.v2)}
                    </div>
                </td>
                <td>${c.desc}</td>
            </tr>
        `).join('');
    },

    renderDieUI(val) {
        let pips = "";
        for(let i=0; i<val; i++) pips += '<div class="pip"></div>';
        return `<div class="die-ui" data-val="${val}">${pips}</div>`;
    },

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
        this.turn.innerText = `TURN: ${player ? player.toUpperCase() : '...'}`;
    },

    initLogButton(callback) {
        if (this.logBtn) this.logBtn.onclick = callback;
    },

    setStatus(text) {
        this.status.innerText = text;
    },

    /**
     * WHAT: Challenge Mode Picker.
     * WHY: Let's the player choose between a single challenge or a split challenge.
     */
    showDoublesChoice(callback) {
        this.drinks.classList.remove('hidden');
        this.doublesTitle.innerText = "CHOOSE YOUR ATTACK";
        this.btns.innerHTML = `
            <button class="give-btn" id="choice-single">SINGLE CHALLENGE (1 PLAYER)</button>
            <button class="give-btn" id="choice-split">SPLIT CHALLENGE (2 PLAYERS)</button>
        `;
        document.getElementById('choice-single').onclick = () => {
            callback('SINGLE');
        };
        document.getElementById('choice-split').onclick = () => {
            callback('SPLIT');
        };
    },

    /**
     * WHAT: Challenger Selection.
     * WHY: Picks 1 or 2 players for the challenge.
     */
    showPicker(title, players, maxNeeded, callback) {
        const selected = [];
        this.doublesTitle.innerText = title;
        this.btns.innerHTML = players.map((p, i) => `
            <button class="give-btn pick-btn" data-idx="${i}">${p}</button>
        `).join('');
        
        this.btns.querySelectorAll('.pick-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                if (!selected.includes(idx)) {
                    selected.push(idx);
                    btn.style.background = 'var(--gold)';
                    btn.style.color = 'black';
                }
                if (selected.length >= maxNeeded) {
                    this.drinks.classList.add('hidden');
                    callback(selected);
                }
            };
        });
    },

    hideDrinks() {
        this.drinks.classList.add('hidden');
    },

    setShame(active) {
        if (active) this.threeManBadge.classList.add('shame-glow');
        else this.threeManBadge.classList.remove('shame-glow');
    }
};
