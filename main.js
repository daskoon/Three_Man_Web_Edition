import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DirectorAudio } from './audio.js';
import { createDieTexture, getFace } from './dice.js';
import { setupPhysics, createDieBody } from './physics.js';
import { evaluateRules } from './rules.js';
import { UI } from './ui.js';

// --- STATE ---
let players = [];
let turnIdx = 0;
let threeManIdx = -1;
let gameState = 'SPLASH'; // SPLASH, SETUP, READY, SHAKING, ROLLING, RESULTS, DECIDING
let audio;
let settleCounter = 0;
let accelMag = 0;
let gameTimer = null;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;

// Task 2.3: Weighty feel constants
const SHAKE_THRESHOLD = 22;
const RELEASE_THRESHOLD = 15;
const SENSOR_ALPHA = 0.7; // Snappier response (was 0.85)

const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
    }
};

const safeSetTimeout = (fn, delay) => {
    clearTimeout(gameTimer);
    gameTimer = setTimeout(fn, delay);
};

// --- 3D ENGINE ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.02);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = setupPhysics();
const loader = new THREE.TextureLoader();
const feltTex = loader.load('felt_albedo.png');
const woodTex = loader.load('wood_albedo.png');

// Visual Table
scene.add(new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.5, 64),
    new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.8 })
));
const rim = new THREE.Mesh(
    new THREE.TorusGeometry(6.1, 0.3, 32, 64),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4, metalness: 0.3 })
);
rim.rotation.x = Math.PI / 2;
scene.add(rim);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const spot = new THREE.SpotLight(0xffd700, 2.5);
spot.position.set(0, 15, 5);
spot.castShadow = true;
scene.add(spot);

// Dice Initialization
const dieMaterials = [
    new THREE.MeshStandardMaterial({ map: createDieTexture(2, renderer) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(5, renderer) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(1, renderer) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(6, renderer) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(3, renderer) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(4, renderer) })
];

const dice = [
    { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), dieMaterials), body: createDieBody(-0.6, world) },
    { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), dieMaterials), body: createDieBody(0.6, world) }
];
dice.forEach(d => { d.mesh.castShadow = true; scene.add(d.mesh); });

// --- UI LOGIC ---
const updateHUD = () => {
    UI.updateHUD(players[turnIdx], threeManIdx === -1 ? null : players[threeManIdx]);
};

const nextTurn = () => {
    turnIdx = (turnIdx + 1) % players.length;
    gameState = 'READY';
    updateHUD();
    UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
    UI.setShame(false);
};

document.getElementById('init-btn').onclick = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
    audio = new DirectorAudio();
    await audio.resume();
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    gameState = 'SETUP';
};

document.getElementById('add-player-btn').onclick = () => {
    // Task 3.3: Player Cap Enforcement
    if (players.length >= 8) return alert("Max 8 players!");
    const val = UI.playerInput.value.trim();
    if (val) {
        players.push(val);
        UI.renderPlayers(players, (idx) => { players.splice(idx, 1); UI.renderPlayers(players, window.removePlayer); });
        UI.playerInput.value = '';
    }
};

window.removePlayer = (idx) => {
    players.splice(idx, 1);
    UI.renderPlayers(players, window.removePlayer);
};

const startGame = () => {
    UI.setup.classList.add('hidden');
    turnIdx = players.length - 1; 
    nextTurn();
    if (audio) audio.startSliding();
};

document.getElementById('start-game-btn').onclick = () => {
    if (players.length < 2) return alert("Need 2+ players");
    startGame();
};

document.getElementById('quick-play-btn').onclick = () => {
    const legends = ["SKOON", "FACE", "RICH", "BLAZE", "ROB", "CRUSTY", "BM", "SHADOW"];
    const shuffled = [...legends];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    players = shuffled.slice(0, 5);
    startGame();
};

// --- CORE LOGIC ---
function throwDice() {
    if (gameState !== 'SHAKING') return;
    gameState = 'ROLLING';
    settleCounter = 0;
    UI.setStatus("THROW!");
    UI.setShame(false);
    
    dice.forEach((d, i) => {
        d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
        d.body.type = CANNON.Body.DYNAMIC;
        d.body.mass = 0.05;
        d.body.updateMassProperties();
        d.body.wakeUp();

        // Control throw force: Moderate forward/downward throw
        // Y: Moderate upward throw
        // Z: Strong forward force to roll across table
        // X: Slight randomness
        const force = new CANNON.Vec3(
            (Math.random() - 0.5) * 0.1, 
            0.3, 
            -1.8
        );
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));

        // Add random spin for better tumbling
        d.body.angularVelocity.set(
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            Math.random() * 10 - 5
        );
    });
    // Task 2.1: Snap pulse
    vibrate(150);
}

window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING') return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    // Task 2.3: Tune magnitude calculation
    const currentMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    accelMag = accelMag * SENSOR_ALPHA + currentMag * (1 - SENSOR_ALPHA);

    if (accelMag > SHAKE_THRESHOLD) {
        if (gameState === 'READY') {
            gameState = 'SHAKING';
            // Task 2.1: Micro-pulse jitter
            vibrate([20, 20, 20, 20, 20]);
        }
    } else if (gameState === 'SHAKING' && accelMag < RELEASE_THRESHOLD) {
        throwDice();
    }
});

window.onmousedown = (e) => { 
    if (gameState === 'READY' && e.target.tagName !== 'BUTTON') {
        gameState = 'SHAKING';
        setTimeout(throwDice, 800);
    }
};

// --- ANIMATION LOOP ---
const camTarget = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const lerpFactor = 1.0 - Math.pow(0.01, dt);
    
    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        world.step(fixedTimeStep, dt, 10);
        if (!dice[0] || !dice[1]) return;
        
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;
        
        const totalVel = dice[0].body.velocity.length() + dice[1].body.velocity.length();
        if (audio) audio.updateSliding(totalVel);

        dice.forEach((d, i) => {
            if (gameState === 'READY') {
                const targetPos = new THREE.Vector3(i === 0 ? -0.8 : 0.8, 6, 6);
                d.mesh.position.lerp(targetPos, lerpFactor);
                d.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFactor);
                d.mesh.rotation.y += 0.01;
                d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
            } else if (gameState === 'SHAKING') {
                // Task 2.1: Jitter scaled by normalized mag
                const jitterAmount = (accelMag / SHAKE_THRESHOLD) * 0.1;
                const jitter = (Math.random() - 0.5) * jitterAmount * (dt * 60);
                d.mesh.position.x += jitter; d.mesh.position.y += jitter;
                d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
            } else if (gameState === 'ROLLING') {
                d.mesh.scale.lerp(new THREE.Vector3(0.5, 0.5, 0.5), lerpFactor * 0.5);
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);
            } else {
                d.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFactor);
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);
            }
        });

        if (gameState === 'READY' || gameState === 'SHAKING') {
            camTarget.set(0, 12, 15);
            camera.position.lerp(camTarget, lerpFactor);
            camera.lookAt(0, 4, 0);
        } else if (gameState === 'ROLLING') {
            camTarget.set(midX * 0.3, 10, 10 + midZ * 0.3);
            camera.position.lerp(camTarget, lerpFactor); 
            camera.lookAt(midX * 0.1, 0, 0);
            
            if (dice.every(d => d.body.velocity.length() < 0.05 && d.body.angularVelocity.length() < 0.05)) {
                settleCounter++;
                if (settleCounter > 40) {
                    gameState = 'RESULTS';
                    audio.playThud();
                    const v1 = getFace(dice[0].mesh);
                    const v2 = getFace(dice[1].mesh);
                    const { events, newThreeManIdx, threeManPenalty } = evaluateRules(v1, v2, players, turnIdx, threeManIdx);
                    
                    // Task 1.3: Shame Glow
                    if (threeManPenalty) UI.setShame(true);
                    
                    // Task 2.2: Social Callout
                    if (events.some(e => e.includes("SOCIAL"))) audio.playSocial();

                    threeManIdx = newThreeManIdx;
                    UI.setStatus(`ROLLED ${v1} & ${v2}\n${events.join(' | ')}`);
                    updateHUD();
                    
                    if (v1 === v2) {
                        gameState = 'DECIDING';
                        UI.showDrinks(v1 * 2, players, (idx) => {
                            UI.setStatus(`GAVE TO ${players[idx]}`);
                            safeSetTimeout(nextTurn, 2000);
                        });
                    } else {
                        safeSetTimeout(nextTurn, 5000);
                    }
                }
            } else { settleCounter = 0; }
            
            const dist = Math.sqrt(midX**2 + midZ**2);
            if (dist > 6.5 || dice.some(d => d.body.position.y < -5)) triggerSloppy();
        } else {
            camTarget.set(midX, 4, midZ + 2);
            camera.position.lerp(camTarget, lerpFactor);
            camera.lookAt(midX, 0, midZ);
        }
    }
    renderer.render(scene, camera);
}

function triggerSloppy() {
    if (gameState === 'SLOPPY') return;
    gameState = 'SLOPPY';
    UI.setStatus("SLOPPY! DRINK 2 & REROLL");
    
    // Task 2.1: Womp Womp pattern
    vibrate([400, 200, 400, 200, 400]);

    safeSetTimeout(() => { 
        if (gameState === 'SLOPPY') { 
            gameState = 'READY'; 
            nextTurn(); turnIdx = (turnIdx - 1 + players.length) % players.length;
        } 
    }, 3000);
}

animate();
window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); 
});
