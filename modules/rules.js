/**
 * @file rules.js
 * @description The "Commandments" - Drinking Game Logic Engine.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Evaluates 3D dice faces against the official "Skoon Edition" rulebook.
 * WHY: To provide a central authority for all drinking penalties and state changes.
 * HOW: Implements a deterministic evaluation function. It receives raw face values (1-6) and compares them against predefined logic blocks (sums, matches, and face-checks). Returns a structured 'Action' object containing events for the HUD and penalty metadata for the Stats engine.
 * WHEN: Triggered every time the dice settle (resolveRoll).
 * WHERE: Logic core used by main.js.
 */

import { Laws } from './laws.js';

/**
 * WHAT: The "Grand Evaluation" of the roll.
 * WHY: To determine who drinks, who moves, and what the HUD says.
 * HOW: 1. Calculates `total`. 2. Checks for 'Title Change' (1&2). 3. Checks for '3-Man Curse' face matches. 4. Evaluates 'Specials' (Doubles). 5. Evaluates 'Socials' (Any 4). 6. Delegates custom law checks to the `Laws` module. 7. Enforces the 'Virgin Roll' fallback if no other rules hit.
 */
export function evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin) {
    const total = v1 + v2;
    const events = [];
    const penalties = []; // Format: [{ name: "Rich", count: 1, reason: "LEFT" }]
    const triggeredLaws = [];
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

    // --- CUSTOM LAWS (MODULAR DELEGATION) ---
    const hits = Laws.evaluate(v1, v2, total, isDoubles);
    
    /**
     * WHAT: Target Name Resolver.
     * WHY: To map role-based strings (Everyone, Left, etc.) to actual player names.
     */
    const getTargets = (targetKey) => {
        const t = [];
        if (targetKey === 'everyone') players.forEach(p => t.push(p));
        else if (targetKey === 'roller') t.push(players[turnIdx]);
        else if (targetKey === 'threeman' && threeManIdx !== -1) t.push(players[threeManIdx]);
        else if (targetKey === 'left') t.push(players[(turnIdx - 1 + players.length) % players.length]);
        else if (targetKey === 'right') t.push(players[(turnIdx + 1) % players.length]);
        return t;
    };

    hits.forEach(law => {
        triggeredLaws.push(law.label);
        events.push("CUSTOM LAW!");
        
        const targetNames = getTargets(law.target);
        const drinkCount = Laws.resolvePenalty(law);
        targetNames.forEach(name => penalties.push({ name, count: drinkCount, reason: "CUSTOM LAW" }));
    });

    // --- COMMANDMENT 5: THE VIRGIN ROLL ---
    if (events.length === 0 && isVirgin) {
        events.push("VIRGIN ROLL! DRINK 1 & GO AGAIN");
        penalties.push({ name: players[turnIdx], count: 1, reason: "VIRGIN" });
    }

    return { events, newThreeManIdx, total, threeManPenalty, isDoubles, penalties, triggeredLaws };
}
