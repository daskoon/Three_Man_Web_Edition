# BUG TRACKER: Three Man (Director's Cut)

This document tracks known bugs and regressions that require investigation and resolution.

## 1. Persistent Ghost Clacking
*   **Status:** OPEN
*   **Description:** After the dice have settled and the camera begins its zoom-in transition to the `RESULTS` state, a final "clack click clack" is heard.
*   **Observed Behavior:** The sounds trigger even though the physics bodies are supposedly locked (`STATIC`) and velocities are zeroed. 
*   **Potential Causes:** 
    *   Delayed audio buffer execution in the Web Audio API.
    *   Residual collision events in the Cannon-es pipeline that are processed after the state change.
    *   Race condition between `resolveRoll()` execution and the final physics step.

---
*Note: This file serves as a 'Circle Back' list for the Boss and the Agent.*
