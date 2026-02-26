export class DirectorAudio {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.slidingSource = null;
        this.slidingGain = null;
    }

    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    playClack(velocity) {
        if (this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Task 2.2: Refine pitch/volume curve
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

    // Task 2.2: Low-pass filtered "sliding" noise
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

    stopSliding() {
        if (this.slidingGain) {
            this.slidingGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
    }

    // Task 2.2: Social Callout
    playSocial() {
        if (this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Simple "Womp Womp" style synthesized voice-ish tone
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.5);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(t + 0.6);
    }
}
