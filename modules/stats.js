/**
 * @file stats.js
 * @description Drinking Tracker, Streaks, and Rivalry Engine.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: A persistent data store for game metrics (drinks given/received, streaks, and rivalries).
 * WHY: To enable the "Rivalry Concept" where the game tracks who is making whom drink all night.
 * HOW: Implements an in-memory database using a JavaScript object. Keys are player names; values are nested objects containing counters for drinks and streaks. Uses string-template keys (e.g., `From->To`) to track directed drinking relationships for the rivalry engine.
 * WHEN: Triggered after every resolved roll where a penalty is identified.
 * WHERE: Imported by main.js; updates data that is then consumed by the UI.
 */

export const GameStats = {
    players: {}, // Data Structure: { name: { given: 0, received: 0, currentStreak: 0, maxStreak: 0 } }
    rivalries: {}, // Data Structure: { "Skoon->Blaze": 15 }

    /**
     * WHAT: Initialization routine.
     * WHY: To ensure every player has a clean data object before the first roll.
     * HOW: Iterates through the validated player list provided during setup and creates zeroed stat blocks using the name as the primary lookup key.
     */
    init(playerNames) {
        playerNames.forEach(name => {
            this.players[name] = { given: 0, received: 0, currentStreak: 0, maxStreak: 0 };
        });
    },

    /**
     * WHAT: The "Record Keeper" function.
     * WHY: To accurately log the flow of drinks between players.
     * HOW: Increments `received` for the target. If an 'aggressor' (from) is identified, it increments their `given` count. If the two are distinct, it generates a unique rivalry key and increments the value. It also manages offensive streaks by incrementing the aggressor's counter and resetting the victim's.
     */
    record(from, to, count = 1) {
        if (!this.players[to]) return;
        
        // WHAT: Total Consumption Tracking.
        this.players[to].received += count;

        // WHAT: Aggressor Tracking & Rivalries.
        if (from && this.players[from]) {
            // WHAT: Total Chaos Tracking.
            this.players[from].given += count;

            if (from !== to) {
                // WHAT: Rivalry Key Generation.
                const key = `${from}->${to}`;
                this.rivalries[key] = (this.rivalries[key] || 0) + count;

                // WHAT: Streak Tracking (Offensive).
                this.players[from].currentStreak++;
                if (this.players[from].currentStreak > this.players[from].maxStreak) {
                    this.players[from].maxStreak = this.players[from].currentStreak;
                }
            }

            // WHAT: Victim Streak Reset.
            this.players[to].currentStreak = 0;
        }
    },

    /**
     * WHAT: Streak Maintenance.
     * WHY: To reset everyone's streak except the person who just hit a rule.
     * HOW: Iterates the `players` object and zeroes out `currentStreak` for all keys excluding the provided `exceptName`.
     */
    resetStreaks(exceptName) {
        Object.keys(this.players).forEach(name => {
            if (name !== exceptName) this.players[name].currentStreak = 0;
        });
    },

    /**
     * WHAT: Leaderboard Exporter.
     * WHY: To feed the UI the "Most Fucked Up" list.
     * HOW: Uses `Object.entries` to convert the data store into a flat array. Sorts the array in descending order using the `received` property.
     */
    getLeaderboard() {
        return Object.entries(this.players).map(([name, data]) => ({
            name,
            ...data
        })).sort((a, b) => b.received - a.received);
    },

    /**
     * WHAT: Rivalry Reporter.
     * WHY: To highlight the "Beef" of the night.
     * HOW: Sorts the `rivalries` key-value pairs by magnitude and returns the top entry as a single-element array.
     */
    getRivalryReport() {
        return Object.entries(this.rivalries)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 1);
    }
};
