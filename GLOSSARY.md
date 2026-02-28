# GLOSSARY: Three Man (Director's Cut)

This document defines the specific terminology and spatial references used in the development of the Three Man 3D engine to ensure consistent communication between the Boss and the Agent.

## 1. Spatial References (Coordinates)
*   **The Baseline (y=4.0):** This is the height of the table surface. All primary action happens at this level.
*   **The Floor (y=4.0):** When referring to "The Floor" or "Table Floor," we mean the **Infinite Collision Plane** at y=4.0. This catches the dice and acts as the felt surface.
*   **The Room Floor (y=-0.25):** The visual hardwood floor at the bottom of the 3D room. (Currently visually removed/hidden).
*   **The Ceiling (y=12.0):** The top of the room box.
*   **The Hand (y=8.0):** The hovering position where dice wait side-by-side during the `READY` state.

## 2. Objects & Geometry
*   **The Rails:** The circular/octagonal gold collision "cage" surrounding the table. These keep the dice from flying off the table.
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
