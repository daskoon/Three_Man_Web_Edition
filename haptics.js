/**
 * @file haptics.js
 * @description Haptic Feedback Bridge for Three Man.
 * 
 * WHAT: Provides a clean abstraction for Android-style haptic primitives.
 * WHY: This architecture allows the web app to act as a logic reference 
 * for the final native Android VibratorManager implementation.
 */

export const HapticManager = {
    // --- ANDROID PRIMITIVES (EMULATED) ---
    
    /**
     * WHAT: Subtle "tick" for minor tumbles or die-on-die collisions.
     * NATIVE: VibrationEffect.PRIMITIVE_TICK
     */
    tick() {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
        }
    },

    /**
     * WHAT: Sharp "click" for major impacts.
     * NATIVE: VibrationEffect.PRIMITIVE_CLICK
     */
    click() {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(20);
        }
    },

    /**
     * WHAT: Heavy "thud" for the final settle.
     * NATIVE: VibrationEffect.PRIMITIVE_LOW_TICK
     */
    thud() {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([30, 10, 15]);
        }
    },

    /**
     * WHAT: Rhythmic pattern for errors/sloppy rolls.
     */
    error() {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([400, 200, 400, 200, 400]);
        }
    },

    /**
     * WHAT: Continuous jitter for the shaking phase.
     */
    vibrate(pattern) {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(pattern);
        }
    }
};
