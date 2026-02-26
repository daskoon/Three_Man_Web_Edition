import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DirectorAudio } from './audio.js';
import { createDieTexture, getFace } from './dice.js';
import { setupPhysics, createDieBody } from './physics.js';
import { evaluateRules } from './rules.js';
import { UI } from './ui.js';

// --- LOGGING ---
const gameLogs = [];
const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    gameLogs.push(`[${t}] ${msg}`);
    console.log(msg);
};

// --- STATE ---
let players = [];
let turnIdx = 0;
let threeManIdx = -1;
let isVirgin = true;
let originalRollerIdx = -1;
let gameState = 'SPLASH'; // SPLASH, SETUP, READY, SHAKING, ROLLING, RESULTS, DECIDING, CHALLENGE_READY
let audio;
let settleCounter = 0;
let accelMag = 0;
let gameTimer = null;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 120;

UI.initLogButton(() => {
    const blob = new Blob([gameLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `3man-logs-${Date.now()}.txt`;
    a.click();
});

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
// Visual Rim (Now matches physical walls)
const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 6.5, 4.0, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
);
rim.position.y = 2.0;
scene.add(rim);

// Debug: Visualize Collision Rails
const debugRailMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, wireframe: true });
const numRails = 32;
const railRadius = 6.3;
const RAIL_HEIGHT = 4.0;
for (let i = 0; i < numRails; i++) {
    const angle = (i / numRails) * Math.PI * 2;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, RAIL_HEIGHT, 1.0), // Full extent (2x half-extent)
        debugRailMat
    );
    mesh.position.set(
        Math.cos(angle) * railRadius,
        RAIL_HEIGHT / 2,
        Math.sin(angle) * railRadius
    );
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
    scene.add(mesh);
}

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
    isVirgin = true;
    originalRollerIdx = -1;
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
    // Task 3.3: Player Cap Enforcement
    if (players.length >= 8) return alert("Max 8 players!");
    const val = UI.playerInput.value.trim();
    if (val) {
        players.push(val);
        UI.renderPlayers(players, window.removePlayer);
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
    
    // Truncate logs for new throw
    gameLogs.length = 0;
    log(`New Throw by ${players[turnIdx]}`);

    gameState = 'ROLLING';
    settleCounter = 0;
    UI.setStatus("THROW!");
    UI.setShame(false);
    
    dice.forEach((d, i) => {
        // Start throw from a stable position
        d.body.position.set(i === 0 ? -1 : 1, 4, 0); 
        d.body.type = CANNON.Body.DYNAMIC;
        d.body.mass = 1.0; 
        d.body.updateMassProperties();
        d.body.wakeUp();

        // Control throw force: Forward drive toward center
        const force = new CANNON.Vec3(
            (Math.random() - 0.5) * 2, 
            -5, // Downward slam for impact
            -8  // Forward roll
        );
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));

        // Add random spin for better tumbling
        d.body.angularVelocity.set(
            Math.random() * 20 - 10,
            Math.random() * 20 - 10,
            Math.random() * 20 - 10
        );
    });
    // Task 2.1: Snap pulse
    vibrate(150);
}

window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING' && gameState !== 'CHALLENGE_READY') return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    // Task 2.3: Tune magnitude calculation
    const currentMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    accelMag = accelMag * SENSOR_ALPHA + currentMag * (1 - SENSOR_ALPHA);

    if (accelMag > SHAKE_THRESHOLD) {
        if (gameState === 'READY' || gameState === 'CHALLENGE_READY') {
            gameState = 'SHAKING';
            // Task 2.1: Micro-pulse jitter
            vibrate([20, 20, 20, 20, 20]);
        }
    } else if (gameState === 'SHAKING' && accelMag < RELEASE_THRESHOLD) {
        throwDice();
    }
});

window.onmousedown = (e) => { 
    if ((gameState === 'READY' || gameState === 'CHALLENGE_READY') && e.target.tagName !== 'BUTTON') {
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
        world.step(fixedTimeStep, dt, 20);
        if (!dice[0] || !dice[1]) return;
        
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;
        
        const totalVel = dice[0].body.velocity.length() + dice[1].body.velocity.length();
        if (audio) audio.updateSliding(totalVel);

            // Debug: Log excessive velocities or escapes
            dice.forEach((d, i) => {
                const vel = d.body.velocity.length();
                const pos = d.body.position;
                if (vel > 40) log(`[WARN] Extreme Velocity Die ${i}: ${vel.toFixed(2)}`);
                if (Math.sqrt(pos.x**2 + pos.z**2) > 6.5) {
                    log(`[ALERT] Die ${i} Breach! Pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) Vel: ${vel.toFixed(2)}`);
                }
                if (pos.y < -1) log(`[CRITICAL] Die ${i} fell through floor! y: ${pos.y.toFixed(2)}`);
            });

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
                    
                    if (originalRollerIdx !== -1) {
                        // Challenge Result
                        const challengerWon = (v1 === v2);
                        if (challengerWon) {
                            UI.setStatus(`${players[turnIdx]} WON!\n${players[originalRollerIdx]} DRINKS EVERYTHING`);
                        } else {
                            UI.setStatus(`${players[turnIdx]} FAILED!\n${players[turnIdx]} DRINKS`);
                        }
                        turnIdx = originalRollerIdx;
                        originalRollerIdx = -1;
                        isVirgin = false;
                        safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
                    } else {
                        // Regular Result
                        const { events, newThreeManIdx, threeManPenalty, isDoubles } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
                        
                        if (threeManPenalty) UI.setShame(true);
                        if (events.some(e => e.includes("SOCIAL"))) audio.playSocial();

                        threeManIdx = newThreeManIdx;
                        UI.setStatus(`ROLLED ${v1} & ${v2}\n${events.join(' | ')}`);
                        updateHUD();
                        
                        isVirgin = false;

                        if (isDoubles) {
                            gameState = 'DECIDING';
                            UI.showChallenge(players, (idx) => {
                                originalRollerIdx = turnIdx;
                                turnIdx = idx;
                                gameState = 'CHALLENGE_READY';
                                UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO CHALLENGE`);
                                updateHUD();
                            });
                        } else if (events.length > 0) {
                             // Roll again on a hit
                             safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 3000);
                        } else {
                            safeSetTimeout(nextTurn, 5000);
                        }
                    }
                }
            } else { settleCounter = 0; }
            
            if (dice.some(d => Math.sqrt(d.body.position.x**2 + d.body.position.z**2) > 6.5 || d.body.position.y < -5)) triggerSloppy();
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
