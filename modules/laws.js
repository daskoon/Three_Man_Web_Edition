/**
 * @file modules/laws.js
 * @description Snake Eyes: Rule Maker Engine.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Manages the lifecycle of player-created custom rules (Laws).
 * WHY: To isolate dynamic rule-making logic from the static core game commandments.
 * HOW: Maintains a private `activeLaws` array. Provides methods to enact, evaluate, and list current laws.
 * WHEN: Triggered by Snake Eyes rolls (enactment) and every subsequent roll (evaluation).
 * WHERE: Specialized module imported by main.js and rules.js.
 */

class LawEngine {
    constructor() {
        this.activeLaws = [];
    }

    /**
     * WHAT: Law Enactor.
     * WHY: To transform 'Mad Libs' dropdown selections into a logic object.
     * HOW: Maps raw strings to a structured object. Generates a readable HUD label.
     */
    enact(trigger, target, action) {
        const triggerText = trigger.replace('_', ' ');
        const targetText = target === 'threeman' ? 'The 3-Man' : target;
        const actionText = action.replace('_', ' ');
        const label = `Whenever ${triggerText}, ${targetText} must ${actionText}`;
        
        const newLaw = { trigger, target, action, label };
        this.activeLaws.push(newLaw);
        return newLaw;
    }

    /**
     * WHAT: Law Evaluator.
     * WHY: To check if any current roll triggers a custom law.
     * HOW: Iterates through `activeLaws` and performs logical checks against v1, v2, and sum.
     * @param {number} v1 - Die 1.
     * @param {number} v2 - Die 2.
     * @param {number} total - Sum of dice.
     * @param {boolean} isDoubles - True if dice match.
     * @returns {Array} - List of triggered law objects.
     */
    evaluate(v1, v2, total, isDoubles) {
        return this.activeLaws.filter(law => {
            if (law.trigger === 'sum_5' && total === 5) return true;
            if (law.trigger === 'sum_8' && total === 8) return true;
            if (law.trigger === 'sum_9' && total === 9) return true;
            if (law.trigger === 'sum_10' && total === 10) return true;
            if (law.trigger === 'any_5' && (v1 === 5 || v2 === 5)) return true;
            if (law.trigger === 'any_6' && (v1 === 6 || v2 === 6)) return true;
            if (law.trigger === 'doubles' && isDoubles) return true;
            return false;
        });
    }

    /**
     * WHAT: Action Resolver.
     * WHY: Maps law actions to specific penalty counts or state effects.
     */
    resolvePenalty(law) {
        if (law.action === 'drink_3') return 3;
        if (law.action === 'drink_2') return 2;
        return 1;
    }

    getLaws() {
        return this.activeLaws;
    }
}

export const Laws = new LawEngine();
