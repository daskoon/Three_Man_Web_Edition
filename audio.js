/**
 * @file audio.js
 * @description Premium Audio Engine for Three Man (Director's Cut).
 * 
 * WHAT: This module manages a pool of high-fidelity audio samples and 
 * provides a "Web-as-Reference" architecture for future native porting.
 */

class AudioPoolManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.samples = new Map();
        this.lastPlayTime = new Map();
        this.debounceMs = 20; // Lowered for more responsive rattling
    }

    async loadSample(name, url) {
        if (!this.ctx) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.samples.set(name, audioBuffer);
            console.log(`[AudioPool] Loaded: ${name} from ${url}`);
        } catch (e) {
            console.error(`[AudioPool] Failed to load ${name}:`, e.message);
        }
    }

    play(name, options = {}) {
        if (!this.ctx || !this.samples.has(name)) return;

        const now = this.ctx.currentTime * 1000;
        const debounceId = `${name}_${options.id || 'default'}`;
        const lastTime = this.lastPlayTime.get(debounceId) || 0;

        // Collision Debouncing per ID (to allow simultaneous dice sounds)
        if (now - lastTime < this.debounceMs) return;
        this.lastPlayTime.set(debounceId, now);

        const buffer = this.samples.get(name);
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        source.buffer = buffer;

        // Dynamic Pitch Randomization (+/- 10%)
        // detune: base shift provided by material (felt vs wood)
        const baseDetune = options.detune || 0;
        const jitter = (Math.random() - 0.5) * 200; // cents
        source.detune.value = baseDetune + jitter;

        // Volume Scaling
        const volume = options.volume !== undefined ? options.volume : 0.5;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);

        source.connect(gain);
        gain.connect(this.ctx.destination);

        source.start(0);
    }
}

export class DirectorAudio {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.pool = new AudioPoolManager(this.ctx);
            
            // Local Assets (Served from the same domain to avoid CORS)
            this.urls = {
                CLACK: "assets/audio/wood_clack.ogg",
                THUD: "assets/audio/roll_impact.ogg"
            };
        } catch (e) {
            console.warn("AudioContext not supported:", e.message);
            this.ctx = null;
        }
    }

    /**
     * WHY: Browsers block audio until a user interaction.
     */
    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        // Prefetch samples on resume
        if (this.ctx) {
            try {
                await Promise.all([
                    this.pool.loadSample('CLACK', this.urls.CLACK),
                    this.pool.loadSample('THUD', this.urls.THUD)
                ]);
            } catch (e) {
                console.error("[AudioPool] Initial pre-fetch failed:", e.message);
            }
        }
    }

    /**
     * WHAT: Table "Felt" Thud.
     * WHY: Muffled low-frequency hit.
     */
    playFelt(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 25, 0.5);
        // Randomize pitch slightly lower for felt
        this.pool.play('THUD', { volume: vol, detune: -200, id });
    }

    /**
     * WHAT: Rail "Wood" Clack.
     * WHY: Sharp, high-frequency impact.
     */
    playWood(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 15, 0.7);
        // Randomize pitch slightly higher for wood
        this.pool.play('CLACK', { volume: vol, detune: 200, id });
    }

    /**
     * WHAT: Dice-on-Dice "Clack".
     */
    playClack(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 15, 0.6);
        this.pool.play('CLACK', { volume: vol, id });
    }

    /**
     * WHAT: SOCIAL! Callout.
     * WHY: Keep original synthesis for unique UI tones.
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
