/**
 * @file rules.js
 * @description The "Commandments" - Drinking Game Logic Engine.
 * 
 * WHAT: Evaluates the dice roll (Face 1 + Face 2) against the official rules.
 * WHY: Encapsulates all drinking penalties, title changes, and turn logic in one place.
 * HOW: Returns a structured object containing events, penalties, and flags for the game loop.
 */

export function evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin) {
    const total = v1 + v2;
    const events = [];
    let newThreeManIdx = threeManIdx;
    let threeManPenalty = false;
    let isDoubles = v1 === v2;

    // --- COMMANDMENT 1: THE THREE MAN (CURSE) ---
    // WHAT: Every 3 that appears (Face OR Sum), the 3-Man drinks.
    // WHY: This is the core "Hot Potato" mechanic of the game.
    if (threeManIdx !== -1) {
        let p = 0;
        if (v1 === 3) p++;
        if (v2 === 3) p++;
        // WHY: 1+2 = 3. This satisfies the "Any roll of 3" penalty rule for the current 3-Man.
        if (total === 3) p++; 
        
        if (p > 0) {
            events.push(`${players[threeManIdx]} DRINKS ${p}`);
            threeManPenalty = true;
        }
    }

    // --- COMMANDMENT 2: THE TITLE CHANGE (HOT POTATO) ---
    // WHAT: Rolling a 1 and a 2 makes YOU the new Three-Man.
    if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
        newThreeManIdx = turnIdx;
        events.push("NEW THREE MAN!");
    }

    // --- COMMANDMENT 3: SPECIALS (DOUBLES) ---
    if (isDoubles) {
        if (v1 === 3) events.push("DOUBLE 3s!");
        if (v1 === 5) events.push("DOUBLE 5s! THUMBS!");
        if (v1 === 1) events.push("SNAKE EYES! RULE!");
        // WHY: Doubles trigger the "Doubles & Troubles" Challenge (PDF Page 4).
        events.push("DOUBLES! CHALLENGE!");
    }

    // --- COMMANDMENT 4: SOCIALS & NEIGHBORS ---
    // WHAT: Any combination of 4 is a Social.
    if (total === 4 || v1 === 4 || v2 === 4) events.push("SOCIAL!");
    
    // WHAT: 7 = Left neighbor drinks.
    if (total === 7) {
        const left = (turnIdx - 1 + players.length) % players.length;
        events.push(`${players[left]} (LEFT) DRINKS`);
    }
    
    // WHAT: 11 = Right neighbor drinks.
    if (total === 11) {
        const right = (turnIdx + 1) % players.length;
        events.push(`${players[right]} (RIGHT) DRINKS`);
    }

    // --- COMMANDMENT 5: THE VIRGIN ROLL (SCAVENGED) ---
    // WHAT: If your very first roll of the turn hits NOTHING, you drink 1.
    // WHY: Incentivizes hitting penalties and keeps the game moving.
    if (events.length === 0 && isVirgin) {
        events.push("VIRGIN ROLL! DRINK 1 & GO AGAIN");
    }

    return { events, newThreeManIdx, total, threeManPenalty, isDoubles };
}
