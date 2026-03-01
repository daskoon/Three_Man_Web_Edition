/**
 * @file rules.js
 * @description The "Commandments" - Drinking Game Logic Engine.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Evaluates 3D dice faces against the official "Skoon Edition" rulebook and Custom Laws.
 * WHY: To provide a central authority for all drinking penalties and state changes.
 * HOW: Maps dice combinations to event strings. Maintains a `CustomRules` array for player-created 'Mad Libs' laws.
 * WHEN: Triggered every time the dice settle (resolveRoll).
 * WHERE: Logic core used by main.js.
 */

// WHAT: Custom Law Storage.
// WHY: To persist 'Snake Eyes' rules throughout the session.
export let CustomRules = [];

/**
 * WHAT: Law Enactor.
 * WHY: To add a new Mad-Libs style rule to the engine.
 * HOW: Pushes a logic object into the CustomRules array.
 */
export function addCustomRule(trigger, target, action) {
    CustomRules.push({ trigger, target, action });
}

/**
 * WHAT: The "Grand Evaluation" of the roll.
 * WHY: To determine who drinks, who moves, and what the HUD says.
 */
export function evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin) {
    const total = v1 + v2;
    const events = [];
    const penalties = []; // Format: [{ name: "Rich", count: 1, reason: "LEFT" }]
    let newThreeManIdx = threeManIdx;
    let threeManPenalty = false;
    let isDoubles = v1 === v2;
    const isTitleChange = (v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1);

    // --- COMMANDMENT 1: THE THREE MAN (CURSE) ---
    if (threeManIdx !== -1 && !isTitleChange) {
        let p = 0;
        if (v1 === 3) p++;
        if (v2 === 3) p++;
        if (total === 3) p++; 
        
        if (p > 0) {
            events.push(`${players[threeManIdx]} DRINKS ${p}`);
            penalties.push({ name: players[threeManIdx], count: p, reason: "3-MAN CURSE" });
            threeManPenalty = true;
        }
    }

    // --- COMMANDMENT 2: THE TITLE CHANGE (HOT POTATO) ---
    if (isTitleChange) {
        newThreeManIdx = turnIdx;
        events.push("NEW THREE MAN!");
    }

    // --- COMMANDMENT 3: SPECIALS (DOUBLES) ---
    if (isDoubles) {
        if (v1 === 3) events.push("DOUBLE 3s!");
        if (v1 === 5) events.push("DOUBLE 5s! THUMBS!");
        if (v1 === 1) events.push("SNAKE EYES! RULE!");
        events.push("DOUBLES! CHALLENGE!");
    }

    // --- COMMANDMENT 4: SOCIALS & NEIGHBORS ---
    if (total === 4 || v1 === 4 || v2 === 4) {
        events.push("4, SOCIAL, EVERYONE DRINK!");
        players.forEach(p => penalties.push({ name: p, count: 1, reason: "SOCIAL" }));
    }
    
    if (total === 7) {
        const left = (turnIdx - 1 + players.length) % players.length;
        events.push("7 TO THE LEFT");
        penalties.push({ name: players[left], count: 1, reason: "LEFT" });
    }
    
    if (total === 11) {
        const right = (turnIdx + 1) % players.length;
        events.push("11 TO THE RIGHT");
        penalties.push({ name: players[right], count: 1, reason: "RIGHT" });
    }

    // --- CUSTOM LAWS (MAD LIBS) ---
    // WHAT: Dynamic Rule Iteration.
    // WHY: To enforce player-created laws from Snake Eyes rolls.
    CustomRules.forEach(rule => {
        let triggered = false;
        if (rule.trigger === 'sum_5' && total === 5) triggered = true;
        if (rule.trigger === 'sum_8' && total === 8) triggered = true;
        if (rule.trigger === 'sum_9' && total === 9) triggered = true;
        if (rule.trigger === 'sum_10' && total === 10) triggered = true;
        if (rule.trigger === 'any_5' && (v1 === 5 || v2 === 5)) triggered = true;
        if (rule.trigger === 'any_6' && (v1 === 6 || v2 === 6)) triggered = true;
        if (rule.trigger === 'doubles' && isDoubles) triggered = true;

        if (triggered) {
            const label = rule.action.toUpperCase().replace('_', ' ');
            events.push(`LAW: ${label}!`);
            
            // Map target to names
            const targetNames = [];
            if (rule.target === 'everyone') players.forEach(p => targetNames.push(p));
            else if (rule.target === 'roller') targetNames.push(players[turnIdx]);
            else if (rule.target === 'threeman' && threeManIdx !== -1) targetNames.push(players[threeManIdx]);
            else if (rule.target === 'left') targetNames.push(players[(turnIdx - 1 + players.length) % players.length]);
            else if (rule.target === 'right') targetNames.push(players[(turnIdx + 1) % players.length]);

            const drinkCount = rule.action === 'drink_2' ? 2 : 1;
            targetNames.forEach(name => penalties.push({ name, count: drinkCount, reason: "CUSTOM LAW" }));
        }
    });

    // --- COMMANDMENT 5: THE VIRGIN ROLL ---
    if (events.length === 0 && isVirgin) {
        events.push("VIRGIN ROLL! DRINK 1 & GO AGAIN");
        penalties.push({ name: players[turnIdx], count: 1, reason: "VIRGIN" });
    }

    return { events, newThreeManIdx, total, threeManPenalty, isDoubles, penalties };
}
