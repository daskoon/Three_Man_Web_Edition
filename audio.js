/**
 * @file audio.js
 * @description Synthetic Sound Engine for Three Man.
 * 
 * WHAT: This module uses the Web Audio API to synthesize SFX in real-time.
 * WHY: To avoid high-latency asset loading and provide dynamic, pitch-shifted 
 * feedback based on physics velocities.
 */

export class DirectorAudio {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("AudioContext not supported:", e.message);
            this.ctx = null;
        }
    }

    /**
     * WHY: Browsers block audio until a user interaction (like clicking "PLAY").
     */
    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * WHAT: Collision "Clack".
     * WHY: Audio feedback for dice hitting rails or each other.
     * HOW: Triangle wave oscillator with a fast frequency and gain ramp.
     */
    playClack(velocity) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        const freq = 400 + Math.min(velocity * 100, 2000);
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        
        const vol = Math.min(velocity / 15, 0.4);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(t + 0.1);
    }

    /**
     * WHAT: Table "Thud".
     * WHY: Heavy feedback for when dice settle on the table surface.
     */
    playThud() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(t + 0.2);
    }

    /**
     * WHAT: SOCIAL! Callout.
     * WHY: Unique synthesized tone for the 'Social' rule (Sum of 4 or Face of 4).
     * HOW: Sawtooth wave with a downward 'womp' ramp.
     */
    playSocial() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.5);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(t + 0.6);
    }
}
