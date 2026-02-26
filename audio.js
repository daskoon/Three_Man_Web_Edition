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
        // WHAT: Audio Context Initialization.
        // WHY: Core of the Web Audio API. 
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    /**
     * WHY: Browsers block audio until a user interaction (like clicking "PLAY").
     */
    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * WHAT: Collision "Clack".
     * WHY: Audio feedback for dice hitting rails or each other.
     * HOW: Triangle wave oscillator with a fast frequency and gain ramp.
     */
    playClack(velocity) {
        if (this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        // Pitch is determined by velocity magnitude
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
     * WHY: Heavy feedback for when dice settle on the infinite floor plane.
     */
    playThud() {
        if (this.ctx.state === 'suspended') return;
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
     * WHAT: Sliding Noise.
     * WHY: Ambient noise that scales with dice velocity to sell the 'sliding' feeling.
     * HOW: White noise buffer passed through a low-pass filter.
     */
    startSliding() {
        if (this.slidingSource) {
            try { this.slidingSource.stop(); } catch(e) {}
            this.slidingSource.disconnect();
        }
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        this.slidingSource = this.ctx.createBufferSource();
        this.slidingSource.buffer = buffer;
        this.slidingSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;

        this.slidingGain = this.ctx.createGain();
        this.slidingGain.gain.value = 0;

        this.slidingSource.connect(filter);
        filter.connect(this.slidingGain);
        this.slidingGain.connect(this.ctx.destination);
        this.slidingSource.start();
    }

    updateSliding(velocity) {
        if (!this.slidingGain) return;
        const vol = Math.min(velocity / 20, 0.1);
        this.slidingGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }

    /**
     * WHAT: SOCIAL! Callout.
     * WHY: Unique synthesized tone for the 'Social' rule (Sum of 4 or Face of 4).
     * HOW: Sawtooth wave with a downward 'womp' ramp.
     */
    playSocial() {
        if (this.ctx.state === 'suspended') return;
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
