export function evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin) {
    const total = v1 + v2;
    const events = [];
    let newThreeManIdx = threeManIdx;
    let threeManPenalty = false;
    let isDoubles = v1 === v2;

    // 1. Three Man Penalty (Curse)
    if (threeManIdx !== -1) {
        let p = 0;
        if (v1 === 3) p++;
        if (v2 === 3) p++;
        // This satisfies the "Any roll of 3" penalty rule.
        if (total === 3) p++; 
        
        if (p > 0) {
            events.push(`${players[threeManIdx]} DRINKS ${p}`);
            threeManPenalty = true;
        }
    }

    // 2. Three Man Title (Hot Potato)
    if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
        newThreeManIdx = turnIdx;
        events.push("NEW THREE MAN!");
    }

    // 3. Specials
    if (isDoubles) {
        if (v1 === 3) events.push("DOUBLE 3s!");
        if (v1 === 5) events.push("DOUBLE 5s! THUMBS!");
        if (v1 === 1) events.push("SNAKE EYES! RULE!");
        events.push("DOUBLES! CHALLENGE!");
    }

    // 4. Socials & Neighbors
    if (total === 4 || v1 === 4 || v2 === 4) events.push("SOCIAL!");
    if (total === 7) {
        const left = (turnIdx - 1 + players.length) % players.length;
        events.push(`${players[left]} (LEFT) DRINKS`);
    }
    if (total === 11) {
        const right = (turnIdx + 1) % players.length;
        events.push(`${players[right]} (RIGHT) DRINKS`);
    }

    // 5. Virgin Roll (APK Scavenged Rule)
    if (events.length === 0 && isVirgin) {
        events.push("VIRGIN ROLL! DRINK 1 & GO AGAIN");
    }

    return { events, newThreeManIdx, total, threeManPenalty, isDoubles };
}
