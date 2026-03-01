// WHAT: Custom Law Storage & Flagging System.
// WHY: To persist 'Snake Eyes' rules and provide clear HUD callouts.
// HOW: Each law is an object with logic triggers and a pre-formatted 'label' for the UI.
export let CustomRules = [];

/**
 * WHAT: Law Enactor.
 * WHY: To add a new Mad-Libs style rule to the engine.
 * HOW: Pushes a logic object into the CustomRules array. Generates a readable string for the HUD 'Callout'.
 */
export function addCustomRule(trigger, target, action) {
    // Generate a human-readable label for the flagging system
    const triggerText = trigger.replace('_', ' ');
    const targetText = target === 'threeman' ? 'The 3-Man' : target;
    const actionText = action.replace('_', ' ');
    const label = `Whenever ${triggerText}, ${targetText} must ${actionText}`;
    
    CustomRules.push({ trigger, target, action, label });
}

/**
 * WHAT: The "Grand Evaluation" of the roll.
 * WHY: To determine who drinks, who moves, and what the HUD says.
 * HOW: Checks core commandments first, then iterates through CustomRules 'Flags'.
 */
export function evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin) {
    const total = v1 + v2;
    const events = [];
    const penalties = []; 
    const triggeredLaws = []; // Flags for custom rules triggered this roll
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

    // --- CUSTOM LAWS (FLAGGING ENGINE) ---
    // WHAT: Dynamic Flag Check.
    // WHY: To call out player-created laws specifically in the HUD.
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
            triggeredLaws.push(rule.label);
            events.push("CUSTOM LAW!");
            
            const targetNames = [];
            if (rule.target === 'everyone') players.forEach(p => targetNames.push(p));
            else if (rule.target === 'roller') targetNames.push(players[turnIdx]);
            else if (rule.target === 'threeman' && threeManIdx !== -1) targetNames.push(players[threeManIdx]);
            else if (rule.target === 'left') targetNames.push(players[(turnIdx - 1 + players.length) % players.length]);
            else if (rule.target === 'right') targetNames.push(players[(turnIdx + 1) % players.length]);

            const drinkCount = rule.action === 'drink_2' ? 2 : (rule.action === 'drink_3' ? 3 : 1);
            targetNames.forEach(name => penalties.push({ name, count: drinkCount, reason: "CUSTOM LAW" }));
        }
    });

    // --- COMMANDMENT 5: THE VIRGIN ROLL ---
    if (events.length === 0 && isVirgin) {
        events.push("VIRGIN ROLL! DRINK 1 & GO AGAIN");
        penalties.push({ name: players[turnIdx], count: 1, reason: "VIRGIN" });
    }

    return { events, newThreeManIdx, total, threeManPenalty, isDoubles, penalties, triggeredLaws };
}
