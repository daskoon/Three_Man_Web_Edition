/**
 * @file main.js
 * @description Modularized "Director's Cut" Orchestrator.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DirectorAudio } from './audio.js';
import { createDieTexture, getFace } from './dice.js';
import { setupPhysics, createDieBody } from './physics.js';
import { evaluateRules } from './rules.js';
import { UI } from './ui.js';
import { log, initLogButton } from './logger.js';
import { setupEnvironment, tableHeight } from './environment.js';
import { updateCamera, handleResize, isFreeCam, setFreeCam } from './camera.js';

// --- GAME STATE ---
let players = [];
let playerMeshes = [];
let turnIdx = 0;
let threeManIdx = -1;
let isVirgin = true;
let audio;
let settleCounter = 0;
let accelMag = 0;
let gameTimer = null;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 120;

let challengeType = null;
let originalRollerIdx = -1;
let challengers = [];
let diceRolledCount = 0;
let gameState = 'SPLASH';

// Input State
const keys = {};
let isLeftDown = false;
let isRightDown = false;
let movement = { x: 0, y: 0 };

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
let scene, camera, renderer, world;

try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.02);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    
    const canvas = document.getElementById('game-canvas');
    if (!canvas) throw new Error("Canvas element 'game-canvas' not found!");
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    log("[System] Three.js Renderer initialized.");
} catch (e) {
    log(`[CRITICAL] Renderer initialization failed: ${e.message}`);
    alert("WebGL initialization failed! Please check your browser support.");
}

try {
    world = setupPhysics();
    setupEnvironment(scene);
    initLogButton('download-logs-btn');
    log("[System] Physics and Environment setup complete.");
} catch (e) {
    log(`[CRITICAL] Setup failed: ${e.message}`);
}

window.onerror = (msg, url, line) => {
    log(`[Unhandled Error] ${msg} at ${url}:${line}`);
    return false;
};

// --- HANDLERS ---
let dieMaterials = [];
let dice = [];

function initializeGameObjects() {
    try {
        if (!renderer || !world) return;
        
        dieMaterials = [
            new THREE.MeshStandardMaterial({ map: createDieTexture(2, renderer), transparent: true, opacity: 0.9 }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(5, renderer), transparent: true, opacity: 0.9 }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(1, renderer), transparent: true, opacity: 0.9 }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(6, renderer), transparent: true, opacity: 0.9 }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(3, renderer), transparent: true, opacity: 0.9 }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(4, renderer), transparent: true, opacity: 0.9 })
        ];

        dice = [
            { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.19), dieMaterials), body: createDieBody(-0.6, world) },
            { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.19), dieMaterials), body: createDieBody(0.6, world) }
        ];
        dice.forEach(d => { d.mesh.castShadow = true; scene.add(d.mesh); });
        log("[System] Dice and Materials initialized.");
    } catch (e) {
        log(`[CRITICAL] GameObject initialization failed: ${e.message}`);
    }
}

// Initial call removed - moving into init-btn for safety

function setupPlayerPresences() {
    playerMeshes.forEach(p => {
        scene.remove(p.mesh);
        if(p.labelEl) p.labelEl.remove();
    });
    playerMeshes = [];
    const radius = 10.0;
    const container = document.getElementById('ui-container');

    players.forEach((name, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.3, roughness: 0.5 })
        );
        head.position.set(Math.sin(angle) * radius, tableHeight + 1.5, Math.cos(angle) * radius);
        scene.add(head);

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
        let isHighlighted = false;
        let roleStr = "";
        let hexColor = 0x666666;

        if (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT') {
            if (challengers.includes(i)) {
                isHighlighted = true;
                hexColor = 0xffd700;
                roleStr = "(CHALLENGER)";
            }
        } else {
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
        p.mesh.material.emissive.setHex(hexColor);
        p.mesh.material.emissiveIntensity = isHighlighted ? 0.8 : 0.2;
        if (p.labelEl) p.labelEl.querySelector('.role-text').innerText = roleStr;
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

document.getElementById('init-btn').onclick = async (e) => {
    const btn = e.target;
    const originalText = btn.innerText;
    btn.innerText = "LOADING...";
    btn.disabled = true;
    log("[System] PLAY button clicked. Initializing...");
    
    try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            log("[System] Requesting motion permissions...");
            await DeviceMotionEvent.requestPermission();
        }
    } catch (err) {
        log(`[Warning] Motion permission error: ${err.message}`);
    }

    try {
        log("[System] Initializing audio...");
        audio = new DirectorAudio();
        await audio.resume();
    } catch (err) {
        log(`[Warning] Audio initialization failed: ${err.message}`);
    }

    // Ensure objects are initialized before moving to SETUP
    initializeGameObjects();
    
    if (dice.length < 2) {
        log("[CRITICAL] Game objects failed to initialize.");
        btn.innerText = "ERROR - RETRY?";
        btn.disabled = false;
        return;
    }
    
    UI.splash.classList.add('hidden');
    UI.setup.classList.remove('hidden');
    gameState = 'SETUP';
    log("[System] Transitioned to SETUP state.");
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
    if (dice.length < 2) {
        log("[Error] Cannot throw dice: Dice not initialized!");
        gameState = 'READY';
        return;
    }
    log(`>>> ${players[turnIdx].toUpperCase()} ROLLS FROM POV >>>`);
    gameState = 'ROLLING'; settleCounter = 0; UI.setStatus("THROW!");

    dice.forEach((d, i) => {
        if (challengeType === 'SPLIT' && i !== diceRolledCount) { d.body.type = CANNON.Body.STATIC; return; }
        const pMesh = playerMeshes[turnIdx].mesh;
        d.body.position.set(pMesh.position.x * 0.5, tableHeight + 4, pMesh.position.z * 0.5);
        d.body.quaternion.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
        d.body.type = CANNON.Body.DYNAMIC; d.body.mass = 1.0; d.body.updateMassProperties(); d.body.wakeUp();
        const force = new CANNON.Vec3(-pMesh.position.x * 0.8, -8, -pMesh.position.z * 0.8);
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));
        d.body.angularVelocity.set(Math.random()*60-30, Math.random()*60-30, Math.random()*60-30);
    });
    vibrate(150);
}

// Input Listeners
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
    if (e.button === 0) isLeftDown = true;
    if (e.button === 2) isRightDown = true;
};

window.onmouseup = (e) => {
    if (e.button === 0) isLeftDown = false;
    if (e.button === 2) isRightDown = false;
};

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('mousemove', (e) => { movement.x = e.movementX; movement.y = e.movementY; });
window.addEventListener('contextmenu', (e) => { if (isFreeCam) e.preventDefault(); });
window.addEventListener('wheel', (e) => {
    if (!isFreeCam) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(forward, -e.deltaY * 0.01);
});

document.getElementById('freecam-btn').onclick = (e) => {
    setFreeCam(!isFreeCam);
    e.target.innerText = `FREE CAM: ${isFreeCam ? 'ON' : 'OFF'}`;
    e.target.style.background = isFreeCam ? 'var(--gold)' : 'rgba(0,0,0,0.5)';
    e.target.style.color = isFreeCam ? 'black' : 'white';
};

let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const lerpFactor = 1.0 - Math.pow(0.01, dt);

    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        if (!isFreeCam) {
            world.step(fixedTimeStep, dt, 20);
        }

        updateCamera(camera, gameState, playerMeshes, turnIdx, dice, tableHeight, lerpFactor, isLeftDown, isRightDown, movement, keys, dt);

        if (!dice[0] || !dice[1] || !playerMeshes[turnIdx]) return;

        // Physics Logs
        if (gameState === 'ROLLING' && !isFreeCam) {
            dice.forEach((d, i) => {
                const vel = d.body.velocity.length();
                if (frameCount % 4 === 0) log(` [Physics] Die ${i}: ${vel.toFixed(2)} Vec3`);
            });
            frameCount++;
        }

        dice.forEach((d, i) => {
            if (gameState === 'READY' || (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT' && i > diceRolledCount)) {
                const pMesh = playerMeshes[turnIdx].mesh;
                const angle = playerMeshes[turnIdx].angle;
                const offsetX = Math.cos(angle + Math.PI/2) * (i === 0 ? -1.5 : 1.5);
                const offsetZ = Math.sin(angle + Math.PI/2) * (i === 0 ? -1.5 : 1.5);
                const hoverPos = new THREE.Vector3(pMesh.position.x * 0.5 + offsetX, tableHeight + 4, pMesh.position.z * 0.5 + offsetZ);

                if (!isFreeCam) {
                    d.mesh.position.lerp(hoverPos, lerpFactor);
                    d.mesh.scale.lerp(new THREE.Vector3(4, 4, 4), lerpFactor);
                    d.mesh.rotation.y += 0.01;
                    d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
                }
            } else {
                if (!isFreeCam) {
                    d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
                    if (gameState === 'RESULTS') d.mesh.scale.lerp(new THREE.Vector3(4, 4, 4), lerpFactor);
                    else d.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFactor);
                    const visualOffset = 0.095 * (d.mesh.scale.x - 1);
                    d.mesh.position.y += visualOffset;
                }
            }
        });

        if (gameState === 'ROLLING' && !isFreeCam) {
            if (dice.every(d => d.body.velocity.length() < 0.05)) {
                settleCounter++; if (settleCounter > 40) { resolveRoll(); }
            } else { settleCounter = 0; }

            if (originalRollerIdx === -1) {
                if (dice.some(d => d.body.type === CANNON.Body.DYNAMIC && Math.sqrt(d.body.position.x**2 + d.body.position.z**2) > 7.0)) triggerSloppy();
            }
        }

        playerMeshes.forEach(p => {
            const vector = p.mesh.position.clone().project(camera);
            p.labelEl.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
            p.labelEl.style.top = `${(vector.y * -0.5 + 0.5) * window.innerHeight - 40}px`;
            p.labelEl.classList.remove('hidden');
        });
    }
    renderer.render(scene, camera);
}

function resolveRoll() {
    if (dice.length < 2) return;
    gameState = 'RESULTS'; if (audio) audio.playThud();
    const v1 = getFace(dice[0].mesh); const v2 = getFace(dice[1].mesh);

    if (originalRollerIdx !== -1) {
        const won = (v1 === v2);
        if (challengeType === 'SINGLE') {
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
                const res = won ? `MATCH! ${players[originalRollerIdx]} DRINKS TWICE!` : `NO MATCH! ${players[challengers[0]]} & ${players[challengers[1]]} DRINK`;
                UI.setStatus(res.replace('!', '!\n')); log(`!!! SPLIT CHALLENGE: ${res}`);
                turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null; diceRolledCount = 0;
                safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
            }
        }
    } else {
        const { events, newThreeManIdx, threeManPenalty, isDoubles } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
        if (threeManPenalty) UI.setShame(true);
        if (audio && events.some(e => e.includes("SOCIAL"))) audio.playSocial();
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
        if (gameState === 'SLOPPY') {
            if (originalRollerIdx !== -1) { gameState = 'CHALLENGE_READY'; }
            else { gameState = 'READY'; }
            UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL AGAIN (SLOPPY)`);
        }
    }, 3000);
}

animate();
window.addEventListener('resize', () => handleResize(camera, renderer));
