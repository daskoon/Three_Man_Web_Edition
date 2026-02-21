export class DirectorAudio {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + velocity * 100, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(Math.min(velocity / 10, 0.3), t);
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
}
