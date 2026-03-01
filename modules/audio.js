/**
 * @file audio.js
 * @description Premium Audio Engine for Three Man (Director's Cut).
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Manages high-fidelity sample playback, debouncing, and material-specific SFX.
 * WHY: To provide an immersive, tactile soundscape that reacts to physics velocities.
 * HOW: Implements a custom buffer-based playback engine using the Web Audio API. Uses `fetch` and `decodeAudioData` to load local OGG assets into memory. Maps `collision.velocity` from Cannon-es directly to `gain.value` and `detune.value` for physical realism.
 * WHEN: Triggered by collision events in main.js.
 * WHERE: Audio subsystem of the game engine.
 */

/**
 * WHAT: Sample Resource Manager.
 * WHY: To handle loading, decoding, and randomized playback of audio buffers.
 * HOW: Maintains a `Map` of decoded `AudioBuffers`. Uses a per-ID `lastPlayTime` registry to enforce a `debounceMs` cooldown, preventing overlapping audio peaks that cause digital clipping.
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
     * HOW: Uses the Fetch API to retrieve binary data, converts to `arrayBuffer`, and invokes the hardware-accelerated `decodeAudioData` on the AudioContext.
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
     * HOW: Creates an ephemeral `AudioBufferSourceNode` and `GainNode`. Randomizes the `detune` property (pitch) by +/- 100 cents to ensure every "clack" sounds distinct. Connects the source through the gain stage to the master `destination`.
     */
    play(name, options = {}) {
        if (!this.ctx || !this.samples.has(name)) return;

        const now = this.ctx.currentTime * 1000;
        const debounceId = `${name}_${options.id || 'default'}`;
        const lastTime = this.lastPlayTime.get(debounceId) || 0;

        // WHAT: Per-Object Debouncing.
        if (now - lastTime < this.debounceMs) return;
        this.lastPlayTime.set(debounceId, now);

        const buffer = this.samples.get(name);
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        source.buffer = buffer;

        // WHAT: Dynamic Pitch Jitter.
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
 * HOW: Encapsulates the `AudioPoolManager`. Exposes semantic methods (`playFelt`, `playWood`) that preset the appropriate `detune` and `volume` parameters for specific collision types.
 */
export class DirectorAudio {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.pool = new AudioPoolManager(this.ctx);
            
            // WHAT: Local Asset Mapping.
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
     * HOW: Executes `this.ctx.resume()` and then triggers the asynchronous pre-fetching of all OGG samples via `this.pool.loadSample`.
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
     */
    playFelt(velocity, id = 0) {
        if (!this.pool) return;
        const vol = Math.min(velocity / 25, 0.5);
        this.pool.play('THUD', { volume: vol, detune: -200, id });
    }

    /**
     * WHAT: Rail "Wood" Impact.
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
     * HOW: Creates an ephemeral `OscillatorNode` with a `sawtooth` waveform. Automates the `frequency` ramp over 0.5 seconds to create a distinct UI 'buzz' effect.
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
