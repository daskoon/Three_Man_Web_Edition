/**
 * @file audio.js
 * @description Premium Audio Engine for Three Man (Director's Cut).
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Manages high-fidelity sample playback, debouncing, and material-specific SFX.
 * WHY: To provide an immersive, tactile soundscape that reacts to physics velocities.
 * HOW: Using Web Audio API with a custom AudioPoolManager for low-latency playback.
 * WHEN: Triggered by collision events in main.js.
 * WHERE: Audio subsystem of the game engine.
 */

/**
 * WHAT: Sample Resource Manager.
 * WHY: To handle loading, decoding, and randomized playback of audio buffers.
 * HOW: Stores decoded AudioBuffers in a Map; handles per-ID debouncing.
 */
class AudioPoolManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.samples = new Map();
        this.lastPlayTime = new Map();
        this.debounceMs = 20; // WHY: To prevent "Machine Gun" audio artifacts during fast rattles.
    }

    /**
     * WHAT: Asset Loader.
     * WHY: To asynchronously fetch and decode OGG/MP3 files into memory.
     */
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

    /**
     * WHAT: Trigger Function.
     * WHY: To play a specific sample with dynamic randomization.
     * HOW: Creates a BufferSource, applies detune/gain, and connects to destination.
     */
    play(name, options = {}) {
        if (!this.ctx || !this.samples.has(name)) return;

        const now = this.ctx.currentTime * 1000;
        const debounceId = `${name}_${options.id || 'default'}`;
        const lastTime = this.lastPlayTime.get(debounceId) || 0;

        // WHAT: Per-Object Debouncing.
        // WHY: Allows multiple dice to sound simultaneously without one muting the other.
        if (now - lastTime < this.debounceMs) return;
        this.lastPlayTime.set(debounceId, now);

        const buffer = this.samples.get(name);
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        source.buffer = buffer;

        // WHAT: Dynamic Pitch Jitter.
        // WHY: Prevents repetitive "robotic" sounds.
        const baseDetune = options.detune || 0;
        const jitter = (Math.random() - 0.5) * 200; 
        source.detune.value = baseDetune + jitter;

        // WHAT: Volume Scaling.
        const volume = options.volume !== undefined ? options.volume : 0.5;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);
    }
}

/**
 * WHAT: High-Level Audio Controller.
 * WHY: Provides a clean API for the main game loop to trigger material-based sounds.
 */
export class DirectorAudio {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.pool = new AudioPoolManager(this.ctx);
            
            // WHAT: Local Asset Mapping.
            // WHY: To avoid CORS issues and ensure fast loading from the same domain.
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
     * WHAT: Audio Context Unlock.
     * WHY: Browsers block audio until an explicit user interaction (The PLAY button).
     */
    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
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
     * WHAT: Table "Felt" Impact.
     * WHY: To provide a muffled, heavy thud sound.
     */
    playFelt(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 25, 0.5);
        this.pool.play('THUD', { volume: vol, detune: -200, id });
    }

    /**
     * WHAT: Rail "Wood" Impact.
     * WHY: To provide a sharp, bright clack sound.
     */
    playWood(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 15, 0.7);
        this.pool.play('CLACK', { volume: vol, detune: 200, id });
    }

    /**
     * WHAT: Dice-on-Dice Collision.
     */
    playClack(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 15, 0.6);
        this.pool.play('CLACK', { volume: vol, id });
    }

    /**
     * WHAT: SOCIAL! UI Tone.
     * WHY: Unique synthesized sound for the "Everyone Drinks" rule.
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
