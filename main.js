/**
 * @file main.js
 * @description The "Director's Cut" Orchestrator.
 * 
 * WHAT: This is the entry point of the application. It synchronizes the Three.js renderer, 
 * the Cannon-es physics world, the synthetic audio engine, and the rule evaluator.
 * 
 * UPDATED: 
 * 1. Implemented Virtual Round Table (3D Player Heads).
 * 2. Orbiting POV Camera (Changes perspective based on current roller).
 * 3. Dynamic "LEFT/RIGHT" role indicators.
 * 4. Solid Bright Red Floor Plane (Debug).
 * 5. Persistent Verbose Session Logging.
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
    gameLogs.push(`[${t}] ${msg}`);
    console.log(msg);
};

UI.initLogButton(() => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `3man-session-log-${timeStr}.txt`;
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
let playerMeshes = []; // Array of { mesh, label, roleLabel }
let turnIdx = 0;
let threeManIdx = -1;
let isVirgin = true;
let audio;
let settleCounter = 0;
let accelMag = 0;
let gameTimer = null;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 120;

let challengeType = null; // SINGLE or SPLIT
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

// --- 3D ENGINE INITIALIZATION ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.FogExp2(0x050505, 0.02);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const world = setupPhysics();
const loader = new THREE.TextureLoader();
const feltTex = loader.load('felt_albedo.png');
const woodTex = loader.load('wood_albedo.png');

// Visual Table (Scaled to 7.0)
scene.add(new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 0.5, 64),
    new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.8 })
));

// Visual Rim (Scaled to 7.0)
const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.2, 4.0, 64, 1, true),
    new THREE.MeshStandardMaterial({ 
        map: woodTex, 
        roughness: 0.4, 
        metalness: 0.3, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.1 
    })
);
rim.position.y = 2.0;
scene.add(rim);

// WHAT: Visual Floor Plane (Debug).
// WHY: Hidden.
const debugFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20), 
    new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.4, side: THREE.DoubleSide, visible: false })
);
debugFloor.rotation.x = -Math.PI / 2;
debugFloor.position.y = 0.31; 
scene.add(debugFloor);

// Debug: Collision Cage Visualization (Hidden)
const debugRailMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.3, wireframe: true, visible: false });
const numRails = 32;
const railRadius = 6.8;
const RAIL_HEIGHT = 4.0;
for (let i = 0; i < numRails; i++) {
    const angle = (i / numRails) * Math.PI * 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, RAIL_HEIGHT, 1.0), debugRailMat);
    mesh.position.set(Math.cos(angle) * railRadius, RAIL_HEIGHT / 2, Math.sin(angle) * railRadius);
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
    scene.add(mesh);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const spot = new THREE.SpotLight(0xffd700, 3.0);
spot.position.set(0, 15, 0); spot.castShadow = true; scene.add(spot);

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

// --- VIRTUAL ROUND TABLE LOGIC ---
/**
 * WHAT: Player Presence Generator.
 * WHY: Creates the spheres and floating HTML labels around the table.
 */
function setupPlayerPresences() {
    playerMeshes.forEach(p => { 
        scene.remove(p.mesh); 
        if(p.labelEl) p.labelEl.remove(); 
    });
    playerMeshes = [];

    const radius = 10.0; // Scaled for 7.0 table
    const container = document.getElementById('ui-container');

    players.forEach((name, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.2 })
        );
        head.position.set(Math.sin(angle) * radius, 1.5, Math.cos(angle) * radius);
        scene.add(head);

        // 2D Floating Label
        const label = document.createElement('div');
        label.className = 'floating-label hidden';
        label.innerHTML = `<strong>${name.toUpperCase()}</strong><br><span class="role-text"></span>`;
        container.appendChild(label);

        playerMeshes.push({ mesh: head, angle: angle, name: name, labelEl: label });
    });
}

const updateHUD = () => {
    UI.updateHUD(players[turnIdx], threeManIdx === -1 ? null : players[threeManIdx]);
    
    playerMeshes.forEach((p, i) => {
        // Base state
        let isHighlighted = false;
        let roleStr = "";
        let hexColor = 0x222222; // Default Dark Grey
        
        // Contextual Logic
        if (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT') {
            // Highlight both challengers in Split Mode
            if (challengers.includes(i)) {
                isHighlighted = true;
                hexColor = 0xffd700; // Gold
                roleStr = "(CHALLENGER)";
            }
        } else {
            // Normal Turn Logic
            const isCurrent = (i === turnIdx);
            const isLeft = (i === (turnIdx - 1 + players.length) % players.length);
            const isRight = (i === (turnIdx + 1) % players.length);

            if (isCurrent) {
                isHighlighted = true;
                hexColor = 0xffd700;
                roleStr = "(YOU)";
            } else if (isLeft) {
                roleStr = "LEFT (Drinks on 7)";
            } else if (isRight) {
                roleStr = "RIGHT (Drinks on 11)";
            }
        }
        
        // Apply Material Updates
        p.mesh.material.emissive.setHex(hexColor);
        p.mesh.material.emissiveIntensity = isHighlighted ? 0.8 : 0.0;
        
        // Update Label Text
        if (p.labelEl) {
            p.labelEl.querySelector('.role-text').innerText = roleStr;
        }
    });
};

const nextTurn = () => {
    turnIdx = (turnIdx + 1) % players.length;
    isVirgin = true; originalRollerIdx = -1; challengers = []; diceRolledCount = 0;
    gameState = 'READY';
    updateHUD();
    UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
    UI.setShame(false);
};

// --- HANDLERS ---
document.getElementById('init-btn').onclick = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
    audio = new DirectorAudio(); await audio.resume();
    UI.splash.classList.add('hidden'); UI.setup.classList.remove('hidden');
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
    setupPlayerPresences();
    turnIdx = players.length - 1; 
    nextTurn();
};

document.getElementById('start-game-btn').onclick = () => { if (players.length < 2) return alert("Need 2+ players"); startGame(); };

document.getElementById('quick-play-btn').onclick = () => {
    players = ["SKOON", "FACE", "RICH", "BLAZE", "ROB"].sort(() => Math.random() - 0.5);
    startGame();
};

function throwDice() {
    if (gameState !== 'SHAKING') return;
    log(`>>> ${players[turnIdx].toUpperCase()} ROLLS FROM POV >>>`);
    gameState = 'ROLLING'; settleCounter = 0; UI.setStatus("THROW!");
    
    dice.forEach((d, i) => {
        if (challengeType === 'SPLIT' && i !== diceRolledCount) { d.body.type = CANNON.Body.STATIC; return; }
        
        // Randomize from current player's POV position
        const pMesh = playerMeshes[turnIdx].mesh;
        d.body.position.set(pMesh.position.x * 0.5, 4, pMesh.position.z * 0.5);
        d.body.quaternion.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
        d.body.type = CANNON.Body.DYNAMIC; d.body.mass = 1.0; d.body.updateMassProperties(); d.body.wakeUp();

        // Vector toward center from player seat
        const force = new CANNON.Vec3(-pMesh.position.x * 0.8, -8, -pMesh.position.z * 0.8);
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));
        d.body.angularVelocity.set(Math.random()*60-30, Math.random()*60-30, Math.random()*60-30);
    });
    vibrate(150);
}

// Listeners
window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING' && gameState !== 'CHALLENGE_READY') return;
    const a = e.accelerationIncludingGravity; if (!a) return;
    const currentMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    accelMag = accelMag * 0.7 + currentMag * 0.3;
    if (accelMag > 22) {
        if (gameState === 'READY' || gameState === 'CHALLENGE_READY') { gameState = 'SHAKING'; vibrate([20, 20, 20, 20, 20]); }
    } else if (gameState === 'SHAKING' && accelMag < 15) { throwDice(); }
});

window.onmousedown = (e) => { 
    if ((gameState === 'READY' || gameState === 'CHALLENGE_READY') && e.target.tagName !== 'BUTTON') {
        gameState = 'SHAKING'; setTimeout(throwDice, 800);
    }
};

/**
 * WHAT: Master Animation Loop with POV Camera.
 * WHY: Orbit the camera to the current player's seat.
 */
let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const lerpFactor = 1.0 - Math.pow(0.01, dt);
    
    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        world.step(fixedTimeStep, dt, 20);
        if (!dice[0] || !dice[1] || !playerMeshes[turnIdx]) return;
        
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;

        // Physics Logs (Restored)
        if (gameState === 'ROLLING') {
            dice.forEach((d, i) => {
                const vel = d.body.velocity.length();
                const pos = d.body.position;
                if (frameCount % 4 === 0) log(` [Physics] Die ${i}: ${vel.toFixed(2)} Vec3 {x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}}`);
            });
            frameCount++;
        }

        dice.forEach((d, i) => {
            if (gameState === 'READY' || (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT' && i > diceRolledCount)) {
                // Hovering dice relative to current POV (Offset i to prevent Z-fighting)
                const pMesh = playerMeshes[turnIdx].mesh;
                const angle = playerMeshes[turnIdx].angle;
                // Calculate an orthogonal offset so dice sit side-by-side relative to the camera
                const offsetX = Math.cos(angle + Math.PI/2) * (i === 0 ? -1 : 1);
                const offsetZ = Math.sin(angle + Math.PI/2) * (i === 0 ? -1 : 1);
                
                const hoverPos = new THREE.Vector3(pMesh.position.x * 0.6 + offsetX, 4, pMesh.position.z * 0.6 + offsetZ);
                d.mesh.position.lerp(hoverPos, lerpFactor);
                d.mesh.rotation.y += 0.01;
                d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
            } else {
                d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
            }
        });

        // --- POV CAMERA ORBIT ---
        const pMesh = playerMeshes[turnIdx].mesh;
        // Pushed back (2.2x) and higher (y=8) for mobile visibility
        const camPos = new THREE.Vector3(pMesh.position.x * 2.2, 8, pMesh.position.z * 2.2);
        
        if (gameState === 'READY' || gameState === 'SHAKING' || gameState === 'CHALLENGE_READY') {
            camera.position.lerp(camPos, lerpFactor * 0.5);
            camera.lookAt(0, 0, 0);
        } else if (gameState === 'ROLLING') {
            camera.position.lerp(new THREE.Vector3(midX * 0.5, 12, 12 + midZ * 0.5), lerpFactor);
            camera.lookAt(midX, 0, midZ);
            
            if (dice.every(d => d.body.velocity.length() < 0.05)) {
                settleCounter++; if (settleCounter > 40) { resolveRoll(); }
            } else { settleCounter = 0; }
            if (dice.some(d => Math.sqrt(d.body.position.x**2 + d.body.position.z**2) > 7.0)) triggerSloppy();
        } else {
            // Close-up on Results (Frame both dice)
            const distBetween = dice[0].mesh.position.distanceTo(dice[1].mesh.position);
            const camHeight = Math.max(4, distBetween * 0.8); // Pull back if dice are far apart
            camera.position.lerp(new THREE.Vector3(midX, camHeight, midZ + camHeight * 0.5), lerpFactor);
            camera.lookAt(midX, 0, midZ);
        }
    }
    renderer.render(scene, camera);
}

function resolveRoll() {
    gameState = 'RESULTS'; audio.playThud();
    const v1 = getFace(dice[0].mesh); const v2 = getFace(dice[1].mesh);

    if (originalRollerIdx !== -1) {
        if (challengeType === 'SINGLE') {
            const won = (v1 === v2);
            const res = won ? `${players[turnIdx]} WON! ${players[originalRollerIdx]} DRINKS` : `${players[turnIdx]} FAILED! ${players[turnIdx]} DRINKS`;
            UI.setStatus(res.replace('!', '!\n')); log(`!!! CHALLENGE: ${res}`);
            turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null;
            safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
        } else {
            if (diceRolledCount === 0) {
                diceRolledCount = 1; turnIdx = challengers[1]; gameState = 'CHALLENGE_READY';
                UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 2`);
                log(`>>> SPLIT CHALLENGE: Die 1 is ${v1}. Waiting for ${players[turnIdx]}...`);
            } else {
                const won = (v1 === v2);
                const res = won ? `MATCH! ${players[originalRollerIdx]} DRINKS TWICE!` : `NO MATCH! ${players[challengers[0]]} & ${players[challengers[1]]} DRINK`;
                UI.setStatus(res.replace('!', '!\n')); log(`!!! SPLIT CHALLENGE: ${res}`);
                turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null; diceRolledCount = 0;
                safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
            }
        }
    } else {
        const { events, newThreeManIdx, threeManPenalty, isDoubles } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
        if (threeManPenalty) UI.setShame(true);
        if (events.some(e => e.includes("SOCIAL"))) audio.playSocial();
        threeManIdx = newThreeManIdx;
        const statusStr = `ROLLED ${v1} & ${v2}\n${events.join(' | ')}`;
        UI.setStatus(statusStr); log(`!!! ROLL RESULT: ${statusStr.replace('\n', ' | ')}`);
        updateHUD(); isVirgin = false;

        if (isDoubles) {
            gameState = 'DECIDING';
            UI.showDoublesChoice((type) => {
                challengeType = type; originalRollerIdx = turnIdx;
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
        } else if (events.length > 0) { safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 3000);
        } else { safeSetTimeout(nextTurn, 5000); }
    }
}

function triggerSloppy() {
    if (gameState === 'SLOPPY') return;
    gameState = 'SLOPPY'; log(" [SYSTEM] SLOPPY TRIGGERED");
    UI.setStatus("SLOPPY! DRINK 2 & REROLL");
    vibrate([400, 200, 400, 200, 400]);
    safeSetTimeout(() => { 
        if (gameState === 'SLOPPY') { gameState = 'READY'; nextTurn(); turnIdx = (turnIdx - 1 + players.length) % players.length; } 
    }, 3000);
}

animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
