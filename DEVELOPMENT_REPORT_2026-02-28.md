# DEVELOPMENT REPORT: Three Man (Director's Cut) - 2026-02-28

This document summarizes the massive architectural, visual, and logical overhaul performed today to elevate the "Skoon Edition" to professional standards.

## 1. Major Feature Implementations
*   **Modular Architecture**: Refactored the entire engine into a `modules/` directory structure for granular maintenance.
*   **Snake Eyes Rule Maker**: A 'Mad-Libs' style engine allowing players to enact custom digital laws (Triggers, Targets, Actions) with safety constraints.
*   **Live Scoreboard & Stats**: Persistent tracking of drinks received, chaos caused, streaks (Rampages), and top session rivalries.
*   **CNN-Style News Ticker**: A red "Casino Red" scrolling barker at the top of the HUD providing live broadcast headlines of game events.
*   **Multiplayer Hotseat**: A dedicated "PASS THE PHONE" screen to prevent accidental rolls during player transitions.
*   **Material Intelligence Audio**: A premium sample pool that distinguishes between hitting **Felt** (Table), **Wood** (Rails), and **Dice** (Dice-on-Dice).
*   **Dice Cup Mechanic**: An invisible physical container that shoves dice together during the SHAKING state to ensure realistic clacking.
*   **Visual Reference Tools**: Persistent HUD buttons for the **Official Rule Book (PDF)** and a **Visual Roll Guide** featuring flat CSS-rendered dice faces.
*   **Quick Play Roster**: Overhauled the quick launch to include 17 original founding members from the Delco PA era.

## 2. Bugs Fixed Today

| Bug | Root Cause ("Why it was fucking up") | Resolution ("How we fixed it") |
| :--- | :--- | :--- |
| **Non-responsive PLAY button** | A `SyntaxError` in `logger.js` (literal newline inside a single-quoted string) crashed the script loader. | Replaced literal newline with `
` escape sequence. |
| **8-Second Roll Hang** | "Micro-jitters" in the physics engine kept resetting the frame-based settle counter. | Switched to time-based stability (0.8s) and increased velocity thresholds. |
| **Persistent Ghost Clacking** | Collision event listeners were being stacked/duplicated every time the game was initialized. | Implemented robust listener lifecycle management (storing and removing function references on bodies). |
| **Dice Clipping / Overlapping** | Dice shared a generic physics material with no specific inter-collision rules. | Implemented a dedicated `DiceMaterial` and `ContactMaterial` with high stiffness. |
| **Invisible Dice Pips** | A solid red color override in `main.js` was washing out the procedural textures from `dice.js`. | Removed mesh color overrides; used solid 'Casino Red' background in the texture generator. |
| **Lobby UI Destruction** | The "Pass the Phone" logic was overwriting the `#setup-screen` HTML, losing player data. | Created a dedicated `#passing-screen` overlay to preserve the lobby state. |
| **Self-Challenging Loop** | The player picker didn't filter out the current roller during Doubles. | Implemented an `excludedIdx` filter in the UI picker logic. |
| **Jitter ReferenceError** | A variable `jitter` was used in the animate loop but never defined. | Defined `jitterAmount` constant in the SHAKING state logic. |
| **1&2 Rule Inaccuracy** | Existing 3-man was drinking on a 1&2 roll because the sum hit 3. | Added a specific bypass flag (`isTitleChange`) to the rule evaluator. |

## 3. Remaining Bugs (Circle Back List)
*   **The Final Ghost Clack**: A single residual "click-clack" is still audible occasionally at the exact moment the camera begins its macro zoom. 
    *   *Suspected Cause*: A race condition where Cannon-es processes one last collision step after `resolveRoll()` but before the state strictly blocks audio.

## 4. Technical Standards
*   **6-Point Technical Manifesto**: All core files now feature exhaustive **WHO, WHAT, WHY, HOW, WHEN, WHERE** documentation.
*   **Security**: Implemented XSS sanitization for player names and enforced "Sanity Caps" on custom rules (Max 3 drinks).
*   **Optimization**: Implemented per-object debouncing and lazy-loading for the Roll Guide.

---
**Status:** PRODUCTION READY / GOLD MASTER STAGE
**Signed:** Principal Architect (Agent) & Approved by The Boss (Skoon).
