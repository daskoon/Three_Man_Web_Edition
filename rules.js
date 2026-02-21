export function evaluateRules(v1, v2, players, turnIdx, threeManIdx) {
    const total = v1 + v2;
    const events = [];
    let newThreeManIdx = threeManIdx;

    // 1. Three Man Penalty (Curse)
    // Only counts die face 3s. Standard Three Man rules often separate die face from sum.
    if (threeManIdx !== -1) {
        let p = 0;
        if (v1 === 3) p++;
        if (v2 === 3) p++;
        // If the sum is 3 (1+2), it's a title change, but we'll add one drink if no die is 3.
        if (total === 3) p++; 
        
        if (p > 0) events.push(`${players[threeManIdx]} DRINKS ${p}`);
    }

    // 2. Three Man Title (Hot Potato)
    if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
        newThreeManIdx = turnIdx;
        events.push("NEW THREE MAN!");
    }

    // 3. Specials
    if (v1 === v2) {
        if (v1 === 3) events.push("DOUBLE 3s!");
        if (v1 === 5) events.push("DOUBLE 5s! THUMBS!");
        if (v1 === 1) events.push("SNAKE EYES! RULE!");
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

    return { events, newThreeManIdx, total };
}
