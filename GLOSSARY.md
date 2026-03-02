# GLOSSARY: Three Man (Director's Cut)

This document defines the specific terminology and spatial references used in the development of the Three Man 3D engine to ensure consistent communication between the Boss and the Agent.

## 1. Spatial References (Coordinates)
*   **The Baseline (y=4.0):** This is the height of the table surface. All primary action happens at this level.
*   **The Floor (y=4.0):** When referring to "The Floor" or "Table Floor," we mean the **Infinite Collision Plane** at y=4.0. This catches the dice and acts as the felt surface. It is visually represented by a Red Semi-Translucent Plane at y=3.99, which is currently set to **Invisible**.
*   **The Room Floor (y=-0.25):** The Red Semi-Translucent Plane at the bottom of the room, acting as a secondary catch-all visual. Currently set to **Invisible**.

## 7. Engine Lifecycle Terms
*   **Invisible:** An object that still exists in the physics world and code memory, but is not rendered by the GPU. It can still collide with and influence other objects (e.g., The invisible Rails still catch the dice).
*   **Gone / Deleted:** An object that has been completely removed from the Scene and the Physics World. It has no physical or visual presence.
*   **The Ceiling (y=12.0):** The top of the room box.
*   **The Hand (y=8.0):** The hovering position where dice wait side-by-side during the `READY` state.

## 2. Objects & Geometry
*   **The Rails:** The circular/octagonal gold collision "cage" surrounding the table. Reduced to 0.5m height (1/8 of original) to allow for "Sloppy" hops. These keep the dice from flying off the table under normal conditions.
*   **The Felt:** The visual top of the table (`tableTop`). It must always align perfectly with the **Floor** (y=4.0) to prevent dice from sinking or floating.
*   **The Rim:** The thin wooden visual cylinder surrounding the table.
*   **The Die (19mm):** A standard casino-grade cube. Visually scaled up by 4x during the `READY` and `RESULTS` states for readability.

## 3. Game States & Physics
*   **Forward Momentum:** The horizontal impulse applied toward the center (0,0,0) when a throw is triggered.
*   **Shake Jitter:** The visual/haptic vibration applied when the accelerometer magnitude exceeds 22.
*   **Sloppy Zone:** Any area outside the 7.0m radius rail. Landing here or hitting the rails too hard triggers the "Sloppy" penalty.
*   **Settle Counter:** The 40-frame stability check. Once dice velocity drops below 0.05 for 40 consecutive frames, the roll is considered "Resolved."

## 4. Interaction Model
*   **"Hand of God":** The interaction model where the user's phone motion directly influences the dice (Shake to Roll).
*   **Virgin Roll:** The first roll of a player's turn. If it results in no penalties, they drink 1 and roll again.
*   **Social:** Any roll involving a 4 (Face 4 or Sum 4). Triggers the synthesized audio callout.

## 5. Advanced Audio & Logic Terms
*   **Material Intelligence:** The system's ability to distinguish between **Felt** (table), **Wood** (rails), and **Dice** (dice-on-dice) impacts to trigger unique, physics-accurate sounds.
*   **Per-Object Debouncing:** An audio optimization that allows both dice to clack simultaneously while preventing a single die from "machine-gunning" (triggering too many sounds in a split second).
*   **The Dead Roll:** A roll that results in no drinking penalties or rule triggers. This ends the player's turn and passes the dice to the right.
*   **Double Matching:** A condition in the Doubles Challenge where the challenger(s) roll a double, forcing the original roller to drink and lose their turn.

## 6. Snake Eyes: Rule Maker Engine
*   **Rule Maker Limits:** The mandatory safety constraints for custom rules.
    1. **No Rule Interference.** Custom rules cannot overwrite or delete core rules (e.g., 3-Man, 7-Left).
    2. **No Direct Targeting.** Laws must target roles (Roller, Neighbors, Everyone), never specific individuals by name.
    3. **Sanity Cap.** Penalties are limited to 3 drinks. No "Hospital-level" rules allowed. We are here to have fun and get drunk, not die.
