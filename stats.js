/**
 * @file stats.js
 * @description Drinking Tracker, Streaks, and Rivalry Engine.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: A persistent data store for game metrics (drinks given/received, streaks, and rivalries).
 * WHY: To enable the "Rivalry Concept" where the game tracks who is making whom drink all night.
 * HOW: Using a central object to map player names to stats and a string-key map for rivalries.
 * WHEN: Triggered after every resolved roll where a penalty is identified.
 * WHERE: Imported by main.js; updates data that is then consumed by the UI.
 */

export const GameStats = {
    players: {}, // Data Structure: { name: { given: 0, received: 0, currentStreak: 0, maxStreak: 0 } }
    rivalries: {}, // Data Structure: { "Skoon->Blaze": 15 }

    /**
     * WHAT: Initialization routine.
     * WHY: To ensure every player has a clean data object before the first roll.
     * HOW: Iterates through the validated player list and creates zeroed stat blocks.
     */
    init(playerNames) {
        playerNames.forEach(name => {
            this.players[name] = { given: 0, received: 0, currentStreak: 0, maxStreak: 0 };
        });
    },

    /**
     * WHAT: The "Record Keeper" function.
     * WHY: To accurately log the flow of drinks between players.
     * HOW: Updates 'received' for the drinker and 'given' for the roller. Updates rivalry keys.
     */
    record(from, to, count = 1) {
        if (!this.players[to]) return;
        
        // WHAT: Total Consumption Tracking.
        this.players[to].received += count;

        // WHAT: Aggressor Tracking & Rivalries.
        if (from && this.players[from]) {
            // WHAT: Total Chaos Tracking.
            // WHY: Roller still gets 'credit' for causing self-inflicted drinks.
            this.players[from].given += count;

            if (from !== to) {
                // WHAT: Rivalry Key Generation.
                const key = `${from}->${to}`;
                this.rivalries[key] = (this.rivalries[key] || 0) + count;

                // WHAT: Streak Tracking (Offensive).
                // WHY: To identify "Rampage" states.
                this.players[from].currentStreak++;
                if (this.players[from].currentStreak > this.players[from].maxStreak) {
                    this.players[from].maxStreak = this.players[from].currentStreak;
                }
            }

            // WHAT: Victim Streak Reset.
            // WHY: You can't be on a rampage if you're the one drinking.
            this.players[to].currentStreak = 0;
        }
    },

    /**
     * WHAT: Streak Maintenance.
     * WHY: To reset everyone's streak except the person who just hit a rule.
     */
    resetStreaks(exceptName) {
        Object.keys(this.players).forEach(name => {
            if (name !== exceptName) this.players[name].currentStreak = 0;
        });
    },

    /**
     * WHAT: Leaderboard Exporter.
     * WHY: To feed the UI the "Most Fucked Up" list.
     * HOW: Maps the internal objects to a sorted array based on drinks received.
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
     * HOW: Sorts the rivalry map and returns the highest value pair.
     */
    getRivalryReport() {
        return Object.entries(this.rivalries)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 1);
    }
};
