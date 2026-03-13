/**
 * @file ui.js
 * @description DOM Abstraction Layer for the Three Man HUD and Overlays.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Manages all HTML overlays, buttons, leaderboard displays, and roll guide visuals.
 * WHY: To isolate DOM manipulation from the 3D physics engine for cleaner code.
 * HOW: Maintains a static registry of DOM elements via `document.getElementById`. Exposes higher-order methods that manipulate CSS class lists (`.classList.add/remove('hidden')`) and inject dynamic HTML via template strings. Coordinates the 'Snake Eyes' lawmaking interface and the 'Leaderboard' data visualization.
 * WHEN: Triggered by state changes in main.js or user input.
 * WHERE: Injected into the index.html via module scripts.
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
    passingScreen: document.getElementById('passing-screen'),
    passingInfo: document.getElementById('passing-player-info'),
    passConfirmBtn: document.getElementById('pass-confirm-btn'),
    lawmakerScreen: document.getElementById('lawmaker-screen'),
    lawTrigger: document.getElementById('law-trigger'),
    lawTarget: document.getElementById('law-target'),
    lawAction: document.getElementById('law-action'),
    confirmLawBtn: document.getElementById('confirm-law-btn'),
    statsScreen: document.getElementById('stats-screen'),
    statsBody: document.getElementById('stats-body'),
    rivalryReport: document.getElementById('rivalry-report'),
    ticker: document.getElementById('ticker-content'),

    /**
     * WHAT: News Ticker Updater.
     * WHY: To provide dynamic, scrolling 'CNN-style' feedback.
     * HOW: Injects a formatted headline string into the `ticker-content` element. Uses CSS `@keyframes` logic to translate the element horizontally across the viewport.
     * @param {string} text - The headline to display.
     */
    updateTicker(text) {
        if (this.ticker) {
            this.ticker.innerText = text.toUpperCase();
        }
    },

    /**
     * WHAT: Stats Screen Controller.
     * WHY: To display the leaderboard and session highlights.
     * HOW: Invokes `populateStats` to refresh data and then toggles the `hidden` class on the `statsScreen` overlay.
     * @param {boolean} show - Toggle state.
     * @param {object} statsEngine - Reference to GameStats.
     */
    showStats(show, statsEngine) {
        if (show) {
            this.populateStats(statsEngine);
            this.statsScreen.classList.remove('hidden');
        } else {
            this.statsScreen.classList.add('hidden');
        }
    },

    /**
     * WHAT: Leaderboard Generator.
     * WHY: To map raw GameStats data into a readable HTML table.
     * HOW: Performs an array transformation using `.map()` on the sorted leaderboard data. Dynamically constructs `<tr>` and `<td>` elements with inline styling for the 'Top Rivalry' report based on directed drinking keys.
     */
    populateStats(statsEngine) {
        const board = statsEngine.getLeaderboard();
        this.statsBody.innerHTML = board.map(p => `
            <tr>
                <td style="color:var(--gold); font-weight:bold;">${p.name.toUpperCase()}</td>
                <td>${p.received}</td>
                <td>${p.given}</td>
                <td>${p.maxStreak}</td>
            </tr>
        `).join('');

        const rivalry = statsEngine.getRivalryReport();
        if (rivalry.length > 0) {
            const [key, count] = rivalry[0];
            const [p1, p2] = key.split('<->');
            this.rivalryReport.innerHTML = `<strong>TOP RIVALRY:</strong><br>${p1.toUpperCase()} and ${p2.toUpperCase()} are going at it (${count} drinks)!`;
        } else {
            this.rivalryReport.innerHTML = "<strong>TOP RIVALRY:</strong><br>No beef identified yet. Keep rolling.";
        }
    },

    /**
     * WHAT: Lawmaker UI Controller.
     * WHY: To capture player-created rules during Snake Eyes rolls.
     * HOW: Displays the `lawmaker-screen`. Attaches a one-time `onclick` handler to the confirmation button that extracts values from three `<select>` dropdowns and executes the provided callback.
     * @param {function} callback - Called when law is enacted.
     */
    showLawmaker(callback) {
        this.confirmLawBtn.onclick = null; // Clear any old junk
        this.lawmakerScreen.classList.remove('hidden');
        this.confirmLawBtn.onclick = () => {
            const trigger = this.lawTrigger.value;
            const target = this.lawTarget.value;
            const action = this.lawAction.value;
            this.lawmakerScreen.classList.add('hidden');
            callback(trigger, target, action);
        };
    },

    /**
     * WHAT: Player List Renderer.
     * WHY: To show current players during the lobby/setup phase.
     * HOW: Iterates through the `players` array. Implements basic XSS mitigation by replacing `<` and `>` characters with HTML entities before injecting into the DOM.
     */
    renderPlayers(players, removeCallback) {
        this.playerList.innerHTML = players.map((p, k) => {
            const safeName = p.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `
                <div class='player-entry'>
                    <span>${safeName}</span>
                    <button class="remove-btn" data-idx="${k}">X</button>
                </div>
            `;
        }).join('');
        
        this.playerList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => removeCallback(parseInt(btn.dataset.idx));
        });
    },

    /**
     * WHAT: HUD Updater.
     * WHY: Keeps the top bars consistent with current game state.
     * HOW: Directly updates the `innerText` of the badge spans.
     */
    updateHUD(player, threeMan, statsEngine) {
        const title = statsEngine ? statsEngine.getPlayerTitle(player) : "DICE ROLLER";
        this.threeMan.innerText = `3MAN: ${threeMan ? threeMan.toUpperCase() : 'NONE'}`;
        this.turn.innerText = `${player ? player.toUpperCase() : '...'} (${title})`;
    },

    /**
     * WHAT: Roll Guide Controller.
     * WHY: Persistent reference for all 21 dice combinations.
     * HOW: Toggles overlay visibility. Refreshes the guide content with current session laws.
     * @param {boolean} show - Toggle state.
     * @param {Array} customLaws - Current session laws.
     */
    showGuide(show, customLaws = []) {
        if (show) {
            this.populateGuide(customLaws);
            this.guide.classList.remove('hidden');
        } else {
            this.guide.classList.add('hidden');
        }
    },

    /**
     * WHAT: Visual Dice Matrix.
     * WHY: To generate the flat-dice table requested by the Boss.
     * HOW: Uses a static array of rule-objects. Iterates and calls `renderDieUI` for each face value. Appends the 'SNAKE EYES RULE LIMITS' footer and any active 'Custom Laws' from the Laws module.
     * @param {Array} customLaws - Optional array of active Laws objects.
     */
    populateGuide(customLaws = []) {
        this.guideBody.innerHTML = ""; // Clear to ensure fresh state

        const coreCombinations = [
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

        let html = coreCombinations.map(c => `
            <tr>
                <td><div class="dice-pair-ui">${this.renderDieUI(c.v1)}${this.renderDieUI(c.v2)}</div></td>
                <td>${c.desc}</td>
            </tr>
        `).join('');

        // WHAT: Custom Law Visibility.
        // WHY: To show player-created rules in the guide in real-time.
        if (customLaws && customLaws.length > 0) {
            html += `<tr><td colspan="2" style="background:rgba(255,215,0,0.1); color:var(--gold); text-align:center; font-weight:900;">SESSION LAWS</td></tr>`;
            html += customLaws.map(law => `
                <tr>
                    <td colspan="2" style="color:#fff;">• ${law.label}</td>
                </tr>
            `).join('');
        }

        html += `
            <tr>
                <td colspan="2" style="background: rgba(255,215,0,0.1); padding: 15px; border-top: 2px solid var(--gold);">
                    <h3 style="color:var(--gold); margin-top:0;">SNAKE EYES RULE LIMITS</h3>
                    <p style="font-size:0.7rem; color:#ccc; margin:0;">
                        1. No Rule Interference: Laws cannot overwrite core rules.<br>
                        2. No Direct Targeting: Laws must target roles, not names.<br>
                        3. Sanity Cap: Max penalty is 3 drinks. Don't die.
                    </p>
                </td>
            </tr>
        `;
        
        this.guideBody.innerHTML = html;
    },

    /**
     * WHAT: CSS Die Renderer.
     * WHY: To create high-contrast dice faces without image assets.
     * HOW: Constructs a grid-based `<div>` with `pip` child elements. The `data-val` attribute on the parent triggers specific grid-area mappings in style.css.
     */
    renderDieUI(val) {
        let pips = "";
        for(let i=0; i<val; i++) pips += '<div class="pip"></div>';
        return `<div class="die-ui" data-val="${val}">${pips}</div>`;
    },

    initLogButton(callback) {
        if (this.logBtn) this.logBtn.onclick = callback;
    },

    setStatus(text) {
        this.status.innerText = text;
    },

    /**
     * WHAT: Challenge Picker.
     * WHY: Allows selection of 1 or 2 targets for Doubles & Troubles.
     * HOW: Toggles the `drinks-overlay` and populates selection buttons.
     */
    showDoublesChoice(callback) {
        this.drinks.classList.remove('hidden');
        this.doublesTitle.innerText = "CHOOSE YOUR ATTACK";
        this.btns.innerHTML = `
            <button class="give-btn" id="choice-single">SINGLE CHALLENGE (1 PLAYER)</button>
            <button class="give-btn" id="choice-split">SPLIT CHALLENGE (2 PLAYERS)</button>
        `;
        document.getElementById('choice-single').onclick = () => callback('SINGLE');
        document.getElementById('choice-split').onclick = () => callback('SPLIT');
    },

    /**
     * WHAT: Challenger Selection UI.
     * WHY: Picks 1 or 2 players for the challenge.
     * HOW: Filters out the current roller index. Uses `data-idx` attributes to identify selections.
     */
    showPicker(title, players, maxNeeded, excludedIdx, callback) {
        const selected = [];
        this.doublesTitle.innerText = title;
        this.btns.innerHTML = players.map((p, i) => {
            if (i === excludedIdx) return ""; 
            return `<button class="give-btn pick-btn" data-idx="${i}">${p}</button>`;
        }).join('');
        
        this.btns.querySelectorAll('.pick-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                if (!selected.includes(idx)) {
                    selected.push(idx);
                    btn.style.background = 'var(--gold)'; btn.style.color = 'black';
                }
                if (selected.length >= maxNeeded) { this.drinks.classList.add('hidden'); callback(selected); }
            };
        });
    },

    hideDrinks() { this.drinks.classList.add('hidden'); },

    flashRed() {
        const div = document.createElement('div');
        div.className = 'flash-red';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 600);
    },

    setShame(active) {
        if (active) this.threeManBadge.classList.add('shame-glow');
        else this.threeManBadge.classList.remove('shame-glow');
    },

    /**
     * WHAT: Trash Talk Engine.
     * WHY: To provide variety in callouts as requested by Boss.
     * HOW: Uses `Math.random()` to index into hardcoded phrase arrays.
     */
    getTrashTalk(type) {
        const phrases = {
            dead: ["Pass the fuckin dice dude, that ain't shit", "You're done. Move it.", "Weak roll. Hand 'em over.", "Pitiful. Next player."],
            win: ["Absolute legend!", "Skoon would be proud.", "You're on fire!", "Dominating the table."],
            fail: ["Pathetic. Drink up.", "You're a disgrace.", "Embarrassing.", "Filtered."],
            sloppy: ["Sloppy dice drinks twice!", "Keep it on the table, amateur.", "Clumsy as hell."]
        };
        const list = phrases[type] || phrases.dead;
        return list[Math.floor(Math.random() * list.length)];
    },

    /**
     * WHAT: Pass the Phone Overlay.
     * WHY: To prevent accidental rolls during Hotseat transitions.
     * HOW: Activates the `passing-screen` overlay. Blocks all 3D input until the `pass-confirm-btn` is clicked.
     */
    showPassPhone(playerName, callback) {
        this.passingScreen.classList.remove('hidden');
        this.passingInfo.innerHTML = `<h2 style="color:var(--gold); font-size: 2rem; margin-top: 20px;">${playerName.toUpperCase()}</h2><p style="margin-bottom: 20px;">IT IS YOUR TURN</p>`;
        this.passConfirmBtn.onclick = () => {
            this.passingScreen.classList.add('hidden');
            callback();
        };
    }
};
