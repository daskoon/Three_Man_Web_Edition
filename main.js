/**
 * @file main.js
 * @description Modularized "Director's Cut" Orchestrator.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: The brain of the application. Manages the state machine, physics loop, and UI coordination.
 * WHY: To ensure a high-fidelity, synchronous drinking experience.
 * HOW: Integrates Three.js (Visuals), Cannon-es (Physics), and Web Audio API (Sound).
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DirectorAudio } from './modules/audio.js';
import { HapticManager } from './modules/haptics.js';
import { GameStats } from './modules/stats.js';
import { createDieTexture, getFace } from './modules/dice.js';
import { setupPhysics, createDieBody } from './modules/physics.js';
import { setupEnvironment, tableHeight } from './modules/environment.js';
import { updateCamera, setFreeCam, isFreeCam, handleResize, triggerShake } from './modules/camera.js';
import { evaluateRules } from './modules/rules.js';
import { Laws } from './modules/laws.js';
import { UI } from './ui.js';
import { log, initLogButton } from './logger.js';

// --- CONFIGURATION ---
const FOUNDING_PLAYERS = [
    "The Skoon", "Kate", "Rich Morehead", "Blaze", 
    "Jesskanka", "Crusty", "Spacepants", "Kim Sexy", "Ashley", 
    "Lucifer", "Jess", "Lauren", "Joey Bars", "Egz", "BM", 
    "Black Larry", "Shadow"
];

// --- STATE MACHINE ---
let players = [];
let turnIdx = 0;
let threeManIdx = -1;
let isVirgin = true;
let gameState = 'SPLASH'; 
let settleTimer = 0;
let rollStartTime = 0;
let accelMag = 0;
let gameTimer = null;
let challengeType = null; 
let originalRollerIdx = -1;
let challengers = [];
let diceRolledCount = 0;
let playerMeshes = [];
let audioMuted = false;

let isLeftDown = false;
let isRightDown = false;
let movement = { x: 0, y: 0 };
const keys = {};

const lerpFactor = 0.1;
let audio;

// --- UTILS ---
const vibrate = (pattern) => {
    HapticManager.vibrate(pattern);
};

const safeSetTimeout = (fn, delay, reason = "unknown") => {
    log(`[Timer] Setting timer for ${delay}ms. Reason: ${reason}`);
    clearTimeout(gameTimer);
    gameTimer = setTimeout(() => {
        log(`[Timer] Firing timer for: ${reason}`);
        fn();
    }, delay);
};

// --- 3D ENGINE INITIALIZATION ---
let scene, camera, renderer, world, composer;

try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.02);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    
    const canvas = document.getElementById('game-canvas');
    if (!canvas) throw new Error("Canvas element 'game-canvas' not found!");
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.4, 0.85);
    composer.addPass(bloomPass);

    const filmPass = new FilmPass(0.15, 0.025, 648, false);
    composer.addPass(filmPass);

    log("[System] Director's Post-Processing initialized.");
} catch (e) {
    log(`[CRITICAL] Renderer initialization failed: ${e.message}`);
}

try {
    const phys = setupPhysics();
    world = phys.world;
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

function initializeGameObjects(diceMaterial) {
    try {
        if (!renderer || !world) return;

        dieMaterials = [
            new THREE.MeshStandardMaterial({ map: createDieTexture(2, renderer) }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(5, renderer) }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(1, renderer) }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(6, renderer) }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(3, renderer) }),
            new THREE.MeshStandardMaterial({ map: createDieTexture(4, renderer) })
        ];

        dice = [
            { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.19), dieMaterials), body: createDieBody(-0.6, world, diceMaterial) },     
            { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.19), dieMaterials), body: createDieBody(0.6, world, diceMaterial) }       
        ];
        
        dice.forEach((d, i) => {
            d.mesh.castShadow = true;
            scene.add(d.mesh);

            const onCollide = (e) => {
                if (audioMuted) return;
                if (gameState !== 'ROLLING' && gameState !== 'SHAKING') return;
                if (d.body.sleepState === CANNON.Body.SLEEPING) return;

                const velocity = e.contact.getImpactVelocityAlongNormal();
                if (velocity < 0.8) return;

                if (velocity > 5) triggerShake(velocity * 0.02);
                if (velocity > 10) createImpactParticles(d.mesh.position, 0xffd700);

                const otherBody = e.body;
                const isDieOnDie = dice.some(other => other.body === otherBody);
                const isFloor = otherBody.position.y === 4.0;
                const isRail = !isDieOnDie && !isFloor;

                if (isDieOnDie) {
                    if (audio) audio.playClack(velocity, i);
                    HapticManager.tick();
                } else if (isRail) {
                    if (audio) audio.playWood(velocity, i);
                    HapticManager.click();
                } else {
                    if (audio) audio.playFelt(velocity, i);
                    HapticManager.click();
                }
            };

            if (d.body._collideListener) d.body.removeEventListener('collide', d.body._collideListener);
            d.body._collideListener = onCollide;
            d.body.addEventListener('collide', onCollide);
        });
        
        log("[System] Dice initialized.");
    } catch (e) {
        log(`[CRITICAL] GameObject initialization failed: ${e.message}`);
    }
}

async function setupPlayerPresences() {
    playerMeshes.forEach(p => {
        scene.remove(p.mesh);
        if(p.labelEl) p.labelEl.remove();
    });
    playerMeshes = [];
    
    const loader = new GLTFLoader();
    const radius = 10.0;
    const container = document.getElementById('ui-container');

    const gltf = await loader.loadAsync('assets/models/Meshy_AI_biped/Meshy_AI_Animation_Alert_withSkin.glb');

    players.forEach((name, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        const model = SkeletonUtils.clone(gltf.scene);
        model.scale.set(3, 3, 3);
        model.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        model.lookAt(0, 0, 0);
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();

        const label = document.createElement('div');
        label.className = 'floating-label hidden';
        label.innerHTML = `<strong>${name.toUpperCase()}</strong><br><span class="role-text"></span>`;
        container.appendChild(label);
        playerMeshes.push({ mesh: model, mixer: mixer, angle: angle, name: name, labelEl: label });
    });
}

const updateHUD = () => {
    UI.updateHUD(players[turnIdx], threeManIdx === -1 ? null : players[threeManIdx], GameStats);
    playerMeshes.forEach((p, i) => {
        let roleStr = "";
        const isCurrent = (i === turnIdx);
        const isLeft = (i === (turnIdx - 1 + players.length) % players.length);
        const isRight = (i === (turnIdx + 1) % players.length);

        if (isCurrent) roleStr = "(YOU)";
        else if (isLeft) roleStr = "LEFT";
        else if (isRight) roleStr = "RIGHT";
        
        if (p.labelEl) {
            p.labelEl.querySelector('.role-text').innerText = roleStr;
            p.labelEl.style.borderColor = isCurrent ? 'var(--gold)' : '#444';
            p.labelEl.style.boxShadow = isCurrent ? '0 0 10px var(--gold-glow)' : 'none';
        }
    });
};

const nextTurn = () => {
    log(`[Logic] nextTurn() entered. Current turnIdx: ${turnIdx}`);
    turnIdx = (turnIdx + 1) % players.length;
    isVirgin = true; originalRollerIdx = -1; challengers = []; diceRolledCount = 0;
    
    gameState = 'PASSING';
    log(`[Logic] State: PASSING. Waiting for confirmation for ${players[turnIdx]}`);
    UI.showPassPhone(players[turnIdx], () => {
        log(`[Logic] Pass confirmed. ${players[turnIdx]} is READY.`);
        gameState = 'READY';
        updateHUD();
        UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
        UI.setShame(false);
    });
};

// --- BUTTONS ---
document.getElementById('init-btn').onclick = async (e) => {
    const btn = e.target; btn.innerText = "LOADING..."; btn.disabled = true;
    try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            await DeviceMotionEvent.requestPermission();
        }
    } catch (err) { log(`[Warning] Motion permission error: ${err.message}`); }

    try {
        audio = new DirectorAudio(); await audio.resume();
    } catch (err) { log(`[Warning] Audio failed: ${err.message}`); }

    const phys = setupPhysics();
    initializeGameObjects(phys.diceMaterial);
    
    UI.splash.classList.add('hidden');
    UI.setup.classList.remove('hidden');
    gameState = 'SETUP';
};

document.getElementById('start-game-btn').onclick = () => {
    if (players.length < 2) { alert("Need at least 2 players!"); return; }
    GameStats.init(players);
    setupPlayerPresences();
    UI.setup.classList.add('hidden');
    gameState = 'READY';
    updateHUD();
    UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
};

document.getElementById('quick-play-btn').onclick = () => {
    players = [...FOUNDING_PLAYERS].sort(() => 0.5 - Math.random()).slice(0, 5);
    log(`[System] Quick Launch with: ${players.join(', ')}`);
    GameStats.init(players);
    setupPlayerPresences();
    UI.setup.classList.add('hidden');
    gameState = 'READY';
    updateHUD();
    UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`);
};

document.getElementById('add-player-btn').onclick = () => {
    const name = UI.playerInput.value.trim();
    if (name && !players.includes(name)) {
        players.push(name);
        UI.playerInput.value = "";
        UI.renderPlayers(players, (idx) => { players.splice(idx, 1); UI.renderPlayers(players, (idx)=>{}); });
    }
};

function throwDice() {
    if (gameState !== 'SHAKING') return;
    if (dice.length < 2) return;
    
    log(`>>> ${players[turnIdx].toUpperCase()} THROW >>>`);
    gameState = 'ROLLING'; settleTimer = 0; rollStartTime = performance.now();
    audioMuted = false;
    UI.setStatus("THROW!");

    dice.forEach((d, i) => {
        if (challengeType === 'SPLIT' && i !== diceRolledCount) { d.body.type = CANNON.Body.STATIC; return; }
        const pMesh = playerMeshes[turnIdx].mesh;
        d.body.position.set(pMesh.position.x * 0.5, tableHeight + 4, pMesh.position.z * 0.5);
        d.body.quaternion.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
        d.body.type = CANNON.Body.DYNAMIC; d.body.mass = 1.0; d.body.updateMassProperties(); d.body.wakeUp();
        
        const spread = (Math.random() - 0.5) * 2;
        const force = new CANNON.Vec3(-pMesh.position.x * 1.5 + spread, -15, -pMesh.position.z * 1.5 + spread);
        d.body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));
        d.body.angularVelocity.set(Math.random()*60-30, Math.random()*60-30, Math.random()*60-30);
    });
    vibrate(150);
}

// --- PARTICLE SYSTEM ---
const particles = [];
function createImpactParticles(pos, color = 0xffd700) {
    for (let i = 0; i < 12; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 4, 4),
            new THREE.MeshBasicMaterial({ color: color, transparent: true })
        );
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.2, (Math.random()-0.5)*0.2);
        particles.push({ mesh: p, vel: vel, life: 1.0 });
        scene.add(p);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.vel);
        p.life -= dt * 2;
        p.mesh.material.opacity = p.life;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}

/**
 * WHAT: Roll Resolver.
 * CRITICAL FIX: Added state guard to prevent double-resolving which freezes the game.
 */
function resolveRoll() {
    if (gameState !== 'ROLLING') {
        log(`[System] resolveRoll blocked. Current state is ${gameState}, not ROLLING.`);
        return;
    }
    log(`[Logic] resolveRoll entering. State: ${gameState}, turnIdx: ${turnIdx}`);
    if (dice.length < 2) return;
    
    gameState = 'RESULTS'; // Lock state immediately
    audioMuted = true;
    dice.forEach(d => {
        d.body.velocity.set(0, 0, 0); d.body.angularVelocity.set(0, 0, 0);
        d.body.type = CANNON.Body.STATIC; d.body.updateMassProperties();
        if (d.body._collideListener) d.body.removeEventListener('collide', d.body._collideListener);
        d.mesh.material.forEach(m => { m.emissive.set(0x000000); m.emissiveIntensity = 0; });
    });

    if (audio) audio.playFelt(15); HapticManager.thud();
    triggerShake(0.5);

    const v1 = getFace(dice[0].mesh); const v2 = getFace(dice[1].mesh);
    log(`[Logic] Rolled: ${v1}, ${v2}`);

    if (originalRollerIdx !== -1) {
        const won = (v1 === v2);
        if (challengeType === 'SINGLE') {
            const res = won ? `${players[turnIdx]} WON! ${players[originalRollerIdx]} DRINKS` : `${players[turnIdx]} FAILED! ${players[turnIdx]} DRINKS`;
            UI.setStatus(`${res}\n${UI.getTrashTalk(won ? 'win' : 'fail')}`);
            if (audio) { if (won) audio.playWin(); else audio.playSucks(); }
            if (won) GameStats.record(players[turnIdx], players[originalRollerIdx], 1);
            else GameStats.record(players[originalRollerIdx], players[turnIdx], 1);

            turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null;
            if (won) { log("[Logic] Challenge won -> nextTurn"); safeSetTimeout(nextTurn, 5000, "ChallengePass"); }
            else { log("[Logic] Challenge failed -> READY"); safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000, "ChallengeStay"); }
        } else {
            if (diceRolledCount === 0) {
                log("[Logic] Split part 1 done.");
                diceRolledCount = 1; turnIdx = challengers[1]; gameState = 'CHALLENGE_READY';
                UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 2`);
            } else {
                log("[Logic] Split part 2 done.");
                const res = won ? `MATCH! ${players[originalRollerIdx]} DRINKS TWICE!` : `NO MATCH! ${players[challengers[0]]} & ${players[challengers[1]]} DRINK`;
                UI.setStatus(`${res}\n${UI.getTrashTalk(won ? 'win' : 'fail')}`);
                if (audio) { if (won) audio.playWin(); else audio.playKeepDrinking(); }
                if (won) GameStats.record(players[turnIdx], players[originalRollerIdx], 2);
                else { GameStats.record(players[originalRollerIdx], players[challengers[0]], 1); GameStats.record(players[originalRollerIdx], players[challengers[1]], 1); }

                turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null; diceRolledCount = 0;
                if (won) { log("[Logic] Split won -> nextTurn"); safeSetTimeout(nextTurn, 5000, "SplitPass"); }
                else { log("[Logic] Split failed -> READY"); safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000, "SplitStay"); }
            }
        }
    } else {
        const { events, newThreeManIdx, threeManPenalty, isDoubles, penalties, triggeredLaws } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
        if (threeManPenalty) UI.setShame(true);
        if (audio) {
            if (newThreeManIdx !== threeManIdx) audio.playThreeMan();
            else if (events.some(e => e.includes("SOCIAL"))) audio.playSocial();
            else if (threeManPenalty) audio.playSocial(); 
        }
        
        penalties.forEach(p => GameStats.record(players[turnIdx], p.name, p.count));
        threeManIdx = newThreeManIdx;
        
        let statusStr = `ROLLED ${v1} & ${v2}\n${events.join(' | ')}`;
        UI.setStatus(statusStr); 
        updateHUD(); isVirgin = false;

        if (newThreeManIdx !== threeManIdx || threeManPenalty) {
            dice.forEach(d => { d.mesh.material.forEach(m => { m.emissive.set(0xffd700); m.emissiveIntensity = 1.5; }); });
            createImpactParticles(dice[0].mesh.position, 0xffd700);
            createImpactParticles(dice[1].mesh.position, 0xffd700);
            celebrate(1.5);
        } else if (events.some(e => e.includes("SOCIAL"))) {
            celebrate(1.0);
        }

        let tickerMsg = statusStr.replace(/\n/g, ' | ');
        const rivalry = GameStats.getRivalryReport();
        if (rivalry.length > 0) {
            const [key, count] = rivalry[0];
            const [from, to] = key.split('->');
            tickerMsg += ` | TOP BEEF: ${from.toUpperCase()} VS ${to.toUpperCase()} (${count} DRINKS)`;
        }
        UI.updateTicker(tickerMsg);

        if (v1 === 1 && v2 === 1) {
            log("[Logic] Snake Eyes Lawmaking.");
            gameState = 'LAWMAKING';
            UI.showLawmaker((trigger, target, action) => {
                Laws.enact(trigger, target, action);
                gameState = 'DECIDING';
                triggerDoublesFlow();
            });
            return;
        }

        if (isDoubles) {
            log("[Logic] Doubles Challenge.");
            triggerDoublesFlow();
        } else if (events.length > 0) { 
            log("[Logic] Rule hits -> staying READY");
            safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 3000, "RuleHitsKeepTurn");
        } else { 
            log("[Logic] No hits -> nextTurn");
            UI.setStatus(`ROLLED ${v1} & ${v2}\n${UI.getTrashTalk('dead')}`);
            safeSetTimeout(nextTurn, 5000, "DeadRollPass"); 
        }
    }
}

function triggerDoublesFlow() {
    log(`[Logic] triggerDoublesFlow. State: ${gameState}`);
    gameState = 'DECIDING';
    UI.showDoublesChoice((type) => {
        log(`[Logic] Double choice: ${type}`);
        challengeType = type; originalRollerIdx = turnIdx;
        if (type === 'SINGLE') {
            UI.showPicker("PICK ONE CHALLENGER", players, 1, turnIdx, (picked) => {
                challengers = picked; turnIdx = picked[0];
                gameState = 'CHALLENGE_READY'; UI.setStatus(`${players[turnIdx].toUpperCase()}\nSHAKE TO CHALLENGE`);
            });
        } else {
            UI.showPicker("PICK TWO CHALLENGERS", players, 2, turnIdx, (picked) => {
                challengers = picked; turnIdx = picked[0]; diceRolledCount = 0;
                gameState = 'CHALLENGE_READY'; UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 1`);
            });
        }
    });
}

function celebrate(intensity = 1.0) {
    playerMeshes.forEach(p => {
        if (p.mixer) p.mixer.timeScale = 3.0 * intensity;
        const originalY = p.mesh.position.y;
        p.mesh.position.y += 0.5 * intensity;
        setTimeout(() => { 
            if (p.mesh) p.mesh.position.y = originalY;
            if (p.mixer) p.mixer.timeScale = 1.0; 
        }, 1000);
    });
}

function triggerSloppy() {
    if (gameState === 'SLOPPY') return;
    gameState = 'SLOPPY';
    UI.setStatus(`SLOPPY! DRINK 2 & REROLL\n${UI.getTrashTalk('sloppy')}`);
    triggerShake(1.5);
    UI.flashRed();
    celebrate(0.5);
    if (audio) audio.playRigged();
    GameStats.record(players[turnIdx], players[turnIdx], 2); 
    HapticManager.error();
    safeSetTimeout(() => {
        if (gameState === 'SLOPPY') {
            if (originalRollerIdx !== -1) gameState = 'CHALLENGE_READY';
            else gameState = 'READY';
            UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL AGAIN`);
        }
    }, 3000, "SloppyReset");
}

function animate() {
    requestAnimationFrame(animate);
    const dt = 1/60; world.step(dt);
    updateParticles(dt);

    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        updateCamera(camera, gameState, playerMeshes, turnIdx, dice, tableHeight, lerpFactor, isLeftDown, isRightDown, movement, keys, dt);
        dice.forEach((d, i) => {
            const targetScale = isGiantDice ? 8 : (gameState === 'RESULTS' ? 4 : 1);
            if (gameState === 'READY' || (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT' && i >= diceRolledCount)) {
                const pMesh = playerMeshes[turnIdx].mesh;
                const angle = playerMeshes[turnIdx].angle;
                const offsetX = Math.cos(angle) * (i === 0 ? -0.8 : 0.8);
                const offsetZ = -Math.sin(angle) * (i === 0 ? -0.8 : 0.8);
                const hoverPos = new THREE.Vector3(pMesh.position.x * 0.5 + offsetX, tableHeight + 4, pMesh.position.z * 0.5 + offsetZ);
                if (!isFreeCam) {
                    d.mesh.position.lerp(hoverPos, lerpFactor);
                    d.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
                    d.mesh.rotation.y += 0.01;
                    d.body.position.set(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z);
                    d.body.type = CANNON.Body.STATIC;
                }
            } else if (gameState === 'SHAKING') {
                const pMesh = playerMeshes[turnIdx].mesh;
                if (!isFreeCam) {
                    if (d.body.type !== CANNON.Body.DYNAMIC) {
                        d.body.type = CANNON.Body.DYNAMIC; d.body.mass = 1.0; d.body.updateMassProperties();
                    }
                    const jitterAmount = 0.5;
                    d.body.position.x = pMesh.position.x * 0.5 + (Math.random()-0.5) * jitterAmount;
                    d.body.position.z = pMesh.position.z * 0.5 + (Math.random()-0.5) * jitterAmount;
                    d.body.position.y = tableHeight + 4 + (Math.random()-0.5) * jitterAmount;
                    d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
                    d.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
                }
            } else {
                if (!isFreeCam) {
                    d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
                    d.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
                    const visualOffset = 0.095 * (d.mesh.scale.x - 1);
                    d.mesh.position.y += visualOffset;
                }
            }
        });

        if (gameState === 'ROLLING' && !isFreeCam) {
            const isStopped = dice.every(d => d.body.velocity.length() < 0.1 && d.body.angularVelocity.length() < 0.2);
            if (isStopped) {
                settleTimer += dt; if (settleTimer > 0.8) { log("[System] Dice settled."); resolveRoll(); }
            } else { settleTimer = 0; }
            if (performance.now() - rollStartTime > 8000) { log("[System] Roll Timeout."); resolveRoll(); }
        }

        playerMeshes.forEach(p => {
            if (p.mixer) p.mixer.update(dt);
            const vector = p.mesh.position.clone().project(camera);
            p.labelEl.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
            p.labelEl.style.top = `${(vector.y * -0.5 + 0.5) * window.innerHeight - 40}px`;
            p.labelEl.classList.remove('hidden');
        });
    }
    if (composer) composer.render();
    else renderer.render(scene, camera);
}

animate();
window.addEventListener('resize', () => handleResize(camera, renderer));
document.getElementById('guide-btn').onclick = () => UI.showGuide(true, Laws.getLaws());
document.getElementById('close-guide-btn').onclick = () => UI.showGuide(false);
document.getElementById('stats-btn').onclick = () => UI.showStats(true, GameStats);
document.getElementById('close-stats-btn').onclick = () => UI.showStats(false);

window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING' && gameState !== 'CHALLENGE_READY') return;
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    accelMag = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
    if (accelMag > 22) {
        if (gameState === 'READY' || gameState === 'CHALLENGE_READY') {
            gameState = 'SHAKING'; setTimeout(throwDice, 800);
        }
    }
});

window.addEventListener('mousemove', (e) => { movement.x = e.movementX; movement.y = e.movementY; });

let secretSequence = "";
let isGiantDice = false;
window.addEventListener('keydown', (e) => { 
    keys[e.code] = true; 
    secretSequence += e.key.toUpperCase();
    if (secretSequence.includes("SKOON")) {
        isGiantDice = !isGiantDice; secretSequence = "";
        triggerShake(1.0); vibrate([100, 50, 100]);
    }
    if (secretSequence.length > 10) secretSequence = secretSequence.substring(1);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.onmousedown = (e) => {
    if (e.button === 0) isLeftDown = true;
    if (e.button === 2) isRightDown = true;
    if ((gameState === 'READY' || gameState === 'CHALLENGE_READY') && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
        gameState = 'SHAKING'; setTimeout(throwDice, 800);
    }
};

window.onmouseup = (e) => {
    if (e.button === 0) isLeftDown = false;
    if (e.button === 2) isRightDown = false;
};
