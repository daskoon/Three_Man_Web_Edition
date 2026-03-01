# FUTURE STATE: Three Man (Director's Cut)
**Project Vision & Roadmap**

We have successfully built a mathematically perfect, highly stable, and professionally documented "physics and rules" prototype. However, a game is not just rules—it is an experience. 

To transition from a "Tech Demo" to a "Monetizable Product," we must execute the following roadmap focusing on Visual Fidelity, Game Feel ("Juice"), and Player Retention.

---

## 🚀 PHASE 1: The Visual Overhaul (Killing the Grey Spheres)
*Target: 1-2 Weeks*

The current `THREE.SphereGeometry` avatars are sterile. We need personality.
*   **Avatar System:** Replace spheres with 2D "Player Cards" or stylized 3D tokens (e.g., poker chips with custom decals or colored solo cups).
*   **Dynamic Lighting Events:** When a rule hits, the lighting should react. 
    *   *Social:* The main spotlight flashes like a strobe for 1 second.
    *   *Sloppy:* The lights dim to a moody red, focusing a spotlight on the offending player.
*   **Particle Effects:** When dice hit the table hard, tiny "dust" or "spark" particles should emit from the impact point. When the 3-Man is crowned, a subtle gold aura should envelop their avatar.
*   **Camera Polish:** Add a slight "Camera Shake" effect when dice hit the rails with high velocity.

## 🎧 PHASE 2: The "Skoon Edition" Audio Integration
*Target: 1 Week*

We have downloaded high-fidelity placeholders from Evil Karaoke. It's time to wire them up.
*   **The Soundbite Engine:** Integrate `rigged.mp3`, `win.mp3`, `keep_drinking.mp3`, etc., into the `DirectorAudio` class.
*   **Contextual Triggering:** 
    *   Hitting the "Sloppy" rail triggers `rigged.mp3`.
    *   Winning a Doubles challenge triggers `win.mp3`.
*   **Dynamic Background Ambience:** Add a low-volume, looping "crowd murmur" or "bar noise" that slightly swells in volume during a "Social" or a "Doubles Challenge," making the table feel alive.

## 🏆 PHASE 3: The Meta-Game & Retention
*Target: 2 Weeks*

Players need a reason to keep the app installed beyond a single Friday night.
*   **Persistent Local Storage:** Save the `GameStats` to `localStorage`. 
*   **The "Hall of Fame":** A dedicated screen showing the "All-Time" stats across all sessions:
    *   *The Iron Liver* (Most drinks taken all-time).
    *   *The Instigator* (Most drinks given all-time).
    *   *Legendary Beef* (The highest rivalry score across all time).
*   **Unlockable Progression:** Hitting milestones (e.g., "Give 100 drinks") unlocks cosmetic rewards.

## 💰 PHASE 4: Monetization & DLC (The Business End)
*Target: 2 Weeks*

How this framework actually generates revenue.
*   **The Freemium Model:** The base game (standard red dice, green felt table) is free.
*   **Cosmetic DLC Packs (Microtransactions):**
    *   *The High Roller Pack ($1.99):* Gold-plated dice, velvet black table felt.
    *   *The Dive Bar Pack ($0.99):* Scratched bone dice, stained wood table, broken glass obstacles on the edges.
    *   *Custom Trash Talk Voice Packs ($1.99):* Swap the UI text for recorded voice-over insults.
*   **Ad Integration (Non-Intrusive):** 
    *   Instead of pop-ups, sell the *Table Felt* or *Wall Posters* in the 3D room as ad space. "Brought to you by [Beer Brand]."

---

## 🛠️ The Immediate Next Steps (The Backlog)
Before we jump into Phase 1, we must clear the technical backlog:
1.  **Squash the Final Ghost Clack:** Investigate the Web Audio API buffer timing to ensure total silence during the `RESULTS` camera zoom.
2.  **Soundbite Wiring:** Connect the downloaded `.mp3` placeholders to the `rules.js` event triggers.

*Signed, Principal Architect.*