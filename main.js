/**
 * @file main.js
 * @description The "Director's Cut" Orchestrator.
 * 
 * WHAT: This is the entry point of the application. It synchronizes the Three.js renderer, 
 * the Cannon-es physics world, the synthetic audio engine, and the rule evaluator.
 * 
 * WHY: To create a "VIP Lounge" drinking experience with "Hand of God" physics interaction.
 * 
 * HOW: 1. Setup 3D Scene -> 2. Initialize Physics -> 3. Run Animation Loop -> 4. Evaluate Rules.
 * 
 * UPDATED: 
 * 1. Restored Jules' high-fidelity physics metrics logging.
 * 2. Fixed Split Challenge infinite loop bug (Resetting originalRollerIdx).
 * 3. Implemented true dice randomness (Randomized starting rotation and position).
 * 4. Fixed challenge resolution for Single player mode.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DirectorAudio } from './audio.js';
import { createDieTexture, getFace } from './dice.js';
import { setupPhysics, createDieBody } from './physics.js';
import { evaluateRules } from './rules.js';
import { UI } from './ui.js';

// --- LOGGING SYSTEM ---
const gameLogs = [];
const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    // Save to buffer for download
    gameLogs.push(`[${t}] ${msg}`);
    // Output to real console for F12 workflow
    console.log(msg);
};

/**
 * WHAT: Log Exporter.
 * WHY: Saves current session metrics to a file and resets the buffer.
 * HOW: Generate timestamped filename and clear gameLogs array.
 */
UI.initLogButton(() => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `3man-physics-log-${timeStr}.txt`;
    
    const blob = new Blob([gameLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    
    gameLogs.length = 0;
    log("LOGS DOWNLOADED - BUFFER TRUNCATED");
});

// --- GAME STATE ---
let players = [];
let turnIdx = 0;
let threeManIdx = -1;
let isVirgin = true;
let audio;
let settleCounter = 0;
let accelMag = 0;
let gameTimer = null;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 120;

// CHALLENGE STATE (PDF Rule Page 4)
let challengeType = null; 
let originalRollerIdx = -1;
let challengers = [];
let diceRolledCount = 0; 

let gameState = 'SPLASH'; // States: SPLASH, SETUP, READY, SHAKING, ROLLING, RESULTS, DECIDING, CHALLENGE_READY

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

scene.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 64), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.8 })));
const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 4.0, 64, 1, true), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.2 }));
rim.position.y = 2.0; scene.add(rim);

const debugRailMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, wireframe: true });
const numRails = 32;
const railRadius = 6.3;
const RAIL_HEIGHT = 4.0;
for (let i = 0; i < numRails; i++) {
    const angle = (i / numRails) * Math.PI * 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, RAIL_HEIGHT, 1.0), debugRailMat);
    mesh.position.set(Math.cos(angle) * railRadius, RAIL_HEIGHT / 2, Math.sin(angle) * railRadius);
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
    scene.add(mesh);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const spot = new THREE.SpotLight(0xffd700, 2.5);
spot.position.set(0, 15, 5); spot.castShadow = true; scene.add(spot);

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

// --- FLOW ---
const updateHUD = () => { UI.updateHUD(players[turnIdx], threeManIdx === -1 ? null : players[threeManIdx]); };

const nextTurn = () => {
    turnIdx = (turnIdx + 1) % players.length;
    isVirgin = true;
    originalRollerIdx = -1;
    challengers = [];
    diceRolledCount = 0;
    gameState = 'READY';
    updateHUD();
    UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
    UI.setShame(false);
};

document.getElementById('init-btn').onclick = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
    audio = new DirectorAudio();
    await audio.resume();
    UI.splash.classList.add('hidden');
    UI.setup.classList.remove('hidden');
    gameState = 'SETUP';
};
    
document.getElementById('add-player-btn').onclick = () => {
    if (players.length >= 8) return alert("Max 8 players!");
    const val = UI.playerInput.value.trim();
    if (val) { players.push(val); UI.renderPlayers(players, window.removePlayer); UI.playerInput.value = ''; }
};

window.removePlayer = (idx) => { players.splice(idx, 1); UI.renderPlayers(players, window.removePlayer); };

const startGame = () => {
    UI.setup.classList.add('hidden');
    turnIdx = players.length - 1; 
    nextTurn();
};

document.getElementById('start-game-btn').onclick = () => { if (players.length < 2) return alert("Need 2+ players"); startGame(); };

document.getElementById('quick-play-btn').onclick = () => {
    const legends = ["SKOON", "FACE", "RICH", "BLAZE", "ROB", "CRUSTY", "BM", "SHADOW"];
    const shuffled = [...legends].sort(() => Math.random() - 0.5);
    players = shuffled.slice(0, 5);
    startGame();
};

/**
 * WHAT: True Random Dice Throw.
 * WHY: To ensure getting doubles is difficult and every throw is unique.
 * HOW: Randomizes initial position, rotation, impulse force, and angular velocity.
 */
function throwDice() {
    if (gameState !== 'SHAKING') return;
    
    gameState = 'ROLLING';
    settleCounter = 0;
    UI.setStatus("THROW!");
    
    dice.forEach((d, i) => {
        // Handle Split Challenge
        const isSplit = challengeType === 'SPLIT';
        if (isSplit && i !== diceRolledCount) {
            d.body.type = CANNON.Body.STATIC;
            return;
        }

        // --- TRUE RANDOMIZATION ---
        // 1. Random Start Position
        d.body.position.set(
            (i === 0 ? -2 : 2) + (Math.random() - 0.5) * 2, 
            4 + Math.random() * 2, 
            (Math.random() - 0.5) * 2
        ); 
        // 2. Random Start Rotation (Quaternions for non-gimbal lock chaos)
        d.body.quaternion.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();

        d.body.type = CANNON.Body.DYNAMIC;
        d.body.mass = 1.0; 
        d.body.updateMassProperties();
        d.body.wakeUp();

        // 3. Random Impulse
        const force = new CANNON.Vec3(
            (Math.random() - 0.5) * 10, 
            -5 - Math.random() * 10, // Slam
            -10 - Math.random() * 10 // Drive
        );
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));

        // 4. Random Angular Velocity (Chaos Spin)
        d.body.angularVelocity.set(Math.random() * 60 - 30, Math.random() * 60 - 30, Math.random() * 60 - 30);
    });
    vibrate(150);
}

// Interaction
window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING' && gameState !== 'CHALLENGE_READY') return;
    const a = e.accelerationIncludingGravity; if (!a) return;
    const currentMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    accelMag = accelMag * 0.7 + currentMag * 0.3;
    if (accelMag > 22) {
        if (gameState === 'READY' || gameState === 'CHALLENGE_READY') {
            gameState = 'SHAKING'; vibrate([20, 20, 20, 20, 20]);
        }
    } else if (gameState === 'SHAKING' && accelMag < 15) { throwDice(); }
});

window.onmousedown = (e) => { 
    if ((gameState === 'READY' || gameState === 'CHALLENGE_READY') && e.target.tagName !== 'BUTTON') {
        gameState = 'SHAKING'; setTimeout(throwDice, 800);
    }
};

/**
 * WHAT: Master Animation Loop.
 * WHY: Restoration of Jules' high-fidelity physics metrics.
 */
let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const lerpFactor = 1.0 - Math.pow(0.01, dt);
    
    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        world.step(fixedTimeStep, dt, 20);
        if (!dice[0] || !dice[1]) return;
        
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;

        // --- JULES' PHYSICS LOGS (RESTORED) ---
        if (gameState === 'ROLLING') {
            dice.forEach((d, i) => {
                const vel = d.body.velocity.length();
                const pos = d.body.position;
                // Only log every 2nd frame to keep file size reasonable but data high
                if (frameCount % 2 === 0) {
                    log(` [Physics] Die ${i}: ${vel.toFixed(2)} Vec3 {x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}}`);
                    if (Math.sqrt(pos.x**2 + pos.z**2) > 6.4) {
                        log(` [Physics] Die ${i} breached boundary! Pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) Vel: ${vel.toFixed(2)}`);
                    }
                }
            });
            frameCount++;
        }

        dice.forEach((d, i) => {
            if (gameState === 'READY' || (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT' && i > diceRolledCount)) {
                const targetPos = new THREE.Vector3(i === 0 ? -0.8 : 0.8, 6, 6);
                d.mesh.position.lerp(targetPos, lerpFactor);
                d.mesh.rotation.y += 0.01;
                d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
            } else {
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);
            }
        });

        if (gameState === 'READY' || gameState === 'SHAKING' || gameState === 'CHALLENGE_READY') {
            camera.position.lerp(new THREE.Vector3(0, 12, 15), lerpFactor);
            camera.lookAt(0, 4, 0);
        } else if (gameState === 'ROLLING') {
            camera.position.lerp(new THREE.Vector3(midX * 0.3, 10, 10 + midZ * 0.3), lerpFactor);
            camera.lookAt(midX * 0.1, 0, 0);
            
            if (dice.every(d => d.body.velocity.length() < 0.05)) {
                settleCounter++;
                if (settleCounter > 40) { resolveRoll(); }
            } else { settleCounter = 0; }
            if (dice.some(d => Math.sqrt(d.body.position.x**2 + d.body.position.z**2) > 6.5)) triggerSloppy();
        } else {
            camera.position.lerp(new THREE.Vector3(midX, 4, midZ + 2), lerpFactor);
            camera.lookAt(midX, 0, midZ);
        }
    }
    renderer.render(scene, camera);
}

/**
 * WHAT: Result Resolver.
 * WHY: Processes challenges or standard rules. Fixes infinite loop bugs.
 */
function resolveRoll() {
    gameState = 'RESULTS';
    audio.playThud();
    const v1 = getFace(dice[0].mesh);
    const v2 = getFace(dice[1].mesh);

    if (originalRollerIdx !== -1) {
        // --- CHALLENGE LOGIC ---
        if (challengeType === 'SINGLE') {
            const won = (v1 === v2);
            if (won) UI.setStatus(`${players[turnIdx]} WON!\n${players[originalRollerIdx]} DRINKS`);
            else UI.setStatus(`${players[turnIdx]} FAILED!\n${players[turnIdx]} DRINKS`);
            
            // RESET CHALLENGE STATE
            turnIdx = originalRollerIdx;
            originalRollerIdx = -1;
            challengeType = null;
            challengers = [];
            safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
        } else {
            // Split Challenge Flow
            if (diceRolledCount === 0) {
                diceRolledCount = 1;
                turnIdx = challengers[1];
                gameState = 'CHALLENGE_READY';
                UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 2`);
            } else {
                const won = (v1 === v2);
                if (won) UI.setStatus(`MATCH!\n${players[originalRollerIdx]} DRINKS TWICE!`);
                else UI.setStatus(`NO MATCH!\n${players[challengers[0]]} & ${players[challengers[1]]} DRINK`);
                
                // RESET CHALLENGE STATE
                turnIdx = originalRollerIdx;
                originalRollerIdx = -1;
                challengeType = null;
                diceRolledCount = 0;
                challengers = [];
                safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
            }
        }
    } else {
        // --- STANDARD RULE EVALUATION ---
        const { events, newThreeManIdx, threeManPenalty, isDoubles } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
        if (threeManPenalty) UI.setShame(true);
        if (events.some(e => e.includes("SOCIAL"))) audio.playSocial();
        threeManIdx = newThreeManIdx;
        UI.setStatus(`ROLLED ${v1} & ${v2}\n${events.join(' | ')}`);
        updateHUD();
        isVirgin = false;

        if (isDoubles) {
            gameState = 'DECIDING';
            UI.showDoublesChoice((type) => {
                challengeType = type;
                originalRollerIdx = turnIdx;
                if (type === 'SINGLE') {
                    UI.showPicker("PICK ONE CHALLENGER", players, 1, (picked) => {
                        challengers = picked; turnIdx = picked[0];
                        gameState = 'CHALLENGE_READY'; UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO CHALLENGE`);
                    });
                } else {
                    UI.showPicker("PICK TWO CHALLENGERS", players, 2, (picked) => {
                        challengers = picked; turnIdx = picked[0]; diceRolledCount = 0;
                        gameState = 'CHALLENGE_READY'; UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 1`);
                    });
                }
            });
        } else if (events.length > 0) {
            safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 3000);
        } else {
            safeSetTimeout(nextTurn, 5000);
        }
    }
}

function triggerSloppy() {
    if (gameState === 'SLOPPY') return;
    gameState = 'SLOPPY';
    log(" [SYSTEM] SLOPPY TRIGGERED");
    UI.setStatus("SLOPPY! DRINK 2 & REROLL");
    vibrate([400, 200, 400, 200, 400]);
    safeSetTimeout(() => { 
        if (gameState === 'SLOPPY') { 
            gameState = 'READY'; 
            nextTurn(); turnIdx = (turnIdx - 1 + players.length) % players.length;
        } 
    }, 3000);
}

animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
