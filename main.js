/**
 * @file main.js
 * @description Modularized "Director's Cut" Orchestrator.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: The brain of the application. Manages the state machine, physics loop, and systems integration.
 * WHY: To provide a high-fidelity, polished WebGL experience for Three Man.
 * HOW: Implements a discrete state machine (SPLASH -> SETUP -> READY -> SHAKING -> ROLLING -> RESULTS) using a top-level string variable. Orchestrates the Cannon-es physics world (`world.step`) and Three.js rendering loop (`requestAnimationFrame`). Synchronizes physical bodies to visual meshes by copying `body.position` and `body.quaternion` every frame.
 * WHEN: Continuous execution via requestAnimationFrame.
 * WHERE: Root orchestrator for the web application.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { DirectorAudio } from './modules/audio.js';
import { HapticManager } from './modules/haptics.js';
import { GameStats } from './modules/stats.js';
import { createDieTexture, getFace } from './modules/dice.js';
import { setupPhysics, createDieBody } from './modules/physics.js';
import { setupEnvironment, tableHeight } from './modules/environment.js';
import { updateCamera, setFreeCam, isFreeCam, handleResize } from './modules/camera.js';
import { evaluateRules } from './modules/rules.js';
import { Laws } from './modules/laws.js';
import { UI } from './ui.js';
import { log, initLogButton } from './logger.js';

// --- CONFIGURATION ---
/**
 * WHAT: Founding Player Roster.
 * WHY: Canonical list of original members for Quick Play randomized selection.
 */
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

let isLeftDown = false;
let isRightDown = false;
let movement = { x: 0, y: 0 };
const keys = {};

const lerpFactor = 0.1;
let audio;

// --- UTILS ---
/**
 * WHAT: Vibration Bridge.
 * WHY: Simple wrapper for the HapticManager.
 * HOW: Proxies calls to `navigator.vibrate` through the `HapticManager` abstraction to ensure cross-platform safety.
 */
const vibrate = (pattern) => {
    HapticManager.vibrate(pattern);
};

/**
 * WHAT: Timed Action Wrapper.
 * WHY: To ensure only one game timer is active at a time and prevent memory leaks.
 * HOW: Uses `clearTimeout` on the global `gameTimer` reference before initializing a new `setTimeout` call.
 */
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

/**
 * WHAT: Game Object Construction.
 * WHY: Creates the physical and visual dice.
 * HOW: Maps procedural textures (Canvas-generated) to `THREE.BoxGeometry` faces. Simultaneously creates `CANNON.Body` boxes with matching dimensions (0.19 units) and attaches a `collide` event listener to each body to trigger material-specific SFX.
 */
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

            /**
             * WHAT: Collision Logic Handler.
             * WHY: To trigger material-specific audio/haptics based on physics data.
             */
            const onCollide = (e) => {
                if (gameState !== 'ROLLING' && gameState !== 'SHAKING') return;
                if (d.body.sleepState === CANNON.Body.SLEEPING) return;

                const velocity = e.contact.getImpactVelocityAlongNormal();
                if (velocity < 0.8) return; 

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

            // WHAT: Listener Lifecycle Management.
            // WHY: To prevent 'Ghost Clacks' by ensuring only one listener exists per body.
            // HOW: Stores the function reference on the body object for reliable removal.
            if (d.body._collideListener) d.body.removeEventListener('collide', d.body._collideListener);
            d.body._collideListener = onCollide;
            d.body.addEventListener('collide', onCollide);
        });
        
        log("[System] Dice and Materials initialized.");
    } catch (e) {
        log(`[CRITICAL] GameObject initialization failed: ${e.message}`);
    }
}

/**
 * WHAT: Player Avatar Setup.
 * WHY: Replaces generic spheres with high-fidelity animated Meshy 3D models.
 * HOW: 1. Uses `GLTFLoader` to pre-fetch the base biped model. 2. For each player, clones the model and sets up an `AnimationMixer`. 3. Positions models in a radial circle around the table. 4. Updates player labels to float above the new character heads.
 */
async function setupPlayerPresences() {
    playerMeshes.forEach(p => {
        scene.remove(p.mesh);
        if(p.labelEl) p.labelEl.remove();
    });
    playerMeshes = [];
    
    const loader = new GLTFLoader();
    const radius = 10.0;
    const container = document.getElementById('ui-container');

    // WHAT: Base Model Loading.
    // WHY: To ensure we have the asset once before cloning.
    const gltf = await loader.loadAsync('assets/models/Meshy_AI_biped/Meshy_AI_Animation_Alert_withSkin.glb');

    players.forEach((name, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        
        // WHAT: Object Cloning.
        // WHY: Efficient memory use for 18+ identical models.
        const model = SkeletonUtils.clone(gltf.scene);
        model.scale.set(3, 3, 3);
        model.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        model.lookAt(0, 0, 0); // Face the table
        scene.add(model);

        // WHAT: Animation System.
        // WHY: To bring the characters to life.
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

/**
 * WHAT: HUD Synchronization.
 * WHY: Highlights the current roller and neighbors in the 3D scene.
 * HOW: Updates the `emissive` color and `emissiveIntensity` of player meshes. Uses modulo arithmetic `(turnIdx +/- 1 + length) % length` to identify the 'Left' and 'Right' neighbors relative to the current roller.
 */
const updateHUD = () => {
    UI.updateHUD(players[turnIdx], threeManIdx === -1 ? null : players[threeManIdx]);
    playerMeshes.forEach((p, i) => {
        let isHighlighted = false;
        let roleStr = "";
        
        const isCurrent = (i === turnIdx);
        const isLeft = (i === (turnIdx - 1 + players.length) % players.length);
        const isRight = (i === (turnIdx + 1) % players.length);

        if (isCurrent) {
            isHighlighted = true; roleStr = "(YOU)";
        } else if (isLeft) {
            roleStr = "LEFT";
        } else if (isRight) {
            roleStr = "RIGHT";
        }
        
        // WHAT: Visual Feedback.
        // WHY: Since complex models don't use simple emissive on the group, we highlight the label.
        if (p.labelEl) {
            p.labelEl.querySelector('.role-text').innerText = roleStr;
            p.labelEl.style.borderColor = isHighlighted ? 'var(--gold)' : '#444';
            p.labelEl.style.boxShadow = isHighlighted ? '0 0 10px var(--gold-glow)' : 'none';
        }
    });
};

/**
 * WHAT: Turn Progression (Right-Hand Rotation).
 * WHY: Dead rolls or lost challenges pass the dice to the right.
 * HOW: Increments `turnIdx` with modulo wrap-around. Switches state to `PASSING` and invokes the `UI.showPassPhone` overlay, which requires a manual user acknowledgment before returning to the `READY` state.
 */
const nextTurn = () => {
    turnIdx = (turnIdx + 1) % players.length;
    isVirgin = true; originalRollerIdx = -1; challengers = []; diceRolledCount = 0;
    
    gameState = 'PASSING';
    UI.showPassPhone(players[turnIdx], () => {
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

/**
 * WHAT: Quick Launch Handler.
 * WHY: To bypass the manual setup phase for rapid testing or 'Jump In' play.
 * HOW: Manually populates the `players` array by shuffling the `FOUNDING_PLAYERS` constant and selecting the first five names.
 */
document.getElementById('quick-play-btn').onclick = () => {
    // Shuffle and pick 5 from the canonical constant
    players = [...FOUNDING_PLAYERS].sort(() => 0.5 - Math.random()).slice(0, 5);
    
    log(`[System] Quick Launch initiated with 5 random founding players: ${players.join(', ')}`);
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

/**
 * WHAT: The "Toss" Mechanic.
 * WHY: Applies physics impulses to simulate a manual dice throw.
 * HOW: Sets dice body types to `DYNAMIC`. Calculates a target vector from the player's 3D position toward the center (0,0,0). Applies a primary downward impulse (-15) and a horizontal inward impulse, adding a randomized `spread` to ensure non-deterministic roll outcomes.
 */
function throwDice() {
    if (gameState !== 'SHAKING') return;
    if (dice.length < 2) return;
    
    log(`>>> ${players[turnIdx].toUpperCase()} ROLLS FROM POV >>>`);
    gameState = 'ROLLING'; settleTimer = 0; rollStartTime = performance.now();
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

/**
 * WHAT: Roll Resolver.
 * WHY: Evaluates the outcome, updates stats, and manages turn progression.
 * HOW: Freezes all physics bodies to `STATIC`. Invokes `getFace()` to determine results via Normal-vector dot-product math. Passes results to `evaluateRules()` and iterates through returned `penalties` to update the `GameStats` engine. Triggers either a state reset (`READY`) or a turn end (`nextTurn`) based on rule hits.
 */
function resolveRoll() {
    if (dice.length < 2) return;
    
    dice.forEach(d => {
        d.body.velocity.set(0, 0, 0); d.body.angularVelocity.set(0, 0, 0);
        d.body.type = CANNON.Body.STATIC; d.body.updateMassProperties();
    });

    gameState = 'RESULTS'; if (audio) audio.playFelt(15); HapticManager.thud();
    const v1 = getFace(dice[0].mesh); const v2 = getFace(dice[1].mesh);

    if (originalRollerIdx !== -1) {
        const won = (v1 === v2);
        if (challengeType === 'SINGLE') {
            const res = won ? `${players[turnIdx]} WON! ${players[originalRollerIdx]} DRINKS` : `${players[turnIdx]} FAILED! ${players[turnIdx]} DRINKS`;
            UI.setStatus(`${res}\n${UI.getTrashTalk(won ? 'win' : 'fail')}`);
            
            // WHAT: Challenge Audio Feedback.
            if (audio) { if (won) audio.playWin(); else audio.playSucks(); }

            if (won) GameStats.record(players[turnIdx], players[originalRollerIdx], 1);
            else GameStats.record(players[originalRollerIdx], players[turnIdx], 1);

            turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null;
            if (won) safeSetTimeout(nextTurn, 5000);
            else safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
        } else {
            if (diceRolledCount === 0) {
                diceRolledCount = 1; turnIdx = challengers[1]; gameState = 'CHALLENGE_READY';
                UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL DIE 2`);
            } else {
                const res = won ? `MATCH! ${players[originalRollerIdx]} DRINKS TWICE!` : `NO MATCH! ${players[challengers[0]]} & ${players[challengers[1]]} DRINK`;
                UI.setStatus(`${res}\n${UI.getTrashTalk(won ? 'win' : 'fail')}`);
                
                // WHAT: Split Challenge Audio Feedback.
                if (audio) { if (won) audio.playWin(); else audio.playKeepDrinking(); }

                if (won) GameStats.record(players[turnIdx], players[originalRollerIdx], 2);
                else { GameStats.record(players[originalRollerIdx], players[challengers[0]], 1); GameStats.record(players[originalRollerIdx], players[challengers[1]], 1); }

                turnIdx = originalRollerIdx; originalRollerIdx = -1; challengeType = null; diceRolledCount = 0;
                if (won) safeSetTimeout(nextTurn, 5000);
                else safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 5000);
            }
        }
    } else {
        const { events, newThreeManIdx, threeManPenalty, isDoubles, penalties, triggeredLaws } = evaluateRules(v1, v2, players, turnIdx, threeManIdx, isVirgin);
        if (threeManPenalty) UI.setShame(true);
        
        // WHAT: Voice-over Logic.
        if (audio) {
            if (newThreeManIdx !== threeManIdx) audio.playThreeMan();
            else if (events.some(e => e.includes("SOCIAL"))) audio.playSocial(); // Restore synthesis for core socials
            else if (threeManPenalty) audio.playSocial(); 
        }
        
        penalties.forEach(p => GameStats.record(players[turnIdx], p.name, p.count));
        
        threeManIdx = newThreeManIdx;
        
        // WHAT: HUD Callout Construction.
        // WHY: To clearly differentiate core rules from custom 'Snake Eyes' laws.
        let statusStr = `ROLLED ${v1} & ${v2}\n${events.join(' | ')}`;
        if (triggeredLaws && triggeredLaws.length > 0) {
            // Append explicit penalties so players know who needs to drink for the laws
            const lawPenalties = penalties.filter(p => p.reason === "CUSTOM LAW");
            const lawActionStrings = lawPenalties.map(p => `${p.name} DRINKS ${p.count}`);
            if (lawActionStrings.length > 0) {
                statusStr += `\nLAW ENFORCED: ${lawActionStrings.join(', ')}`;
            } else {
                statusStr += `\nLAW ENFORCED:\n${triggeredLaws.join('\n')}`;
            }
        }
        
        UI.setStatus(statusStr); 
        updateHUD(); isVirgin = false;

        // WHAT: News Ticker Headline Generation.
        // WHY: To provide the 'CNN-style' barker requested by Boss.
        // HOW: Transforms the multi-line HUD status into a single-line marquee string.
        let tickerMsg = statusStr.replace(/\n/g, ' | ');
        if (penalties.length > 0) {
            const totalDrinks = penalties.reduce((sum, p) => sum + (p.count || 0), 0);
            tickerMsg += ` | LATEST CHAOS: ${totalDrinks} DRINKS DISTRIBUTED`;
        }
        const rivalry = GameStats.getRivalryReport();
        if (rivalry.length > 0) {
            const [key, count] = rivalry[0];
            const [from, to] = key.split('->');
            tickerMsg += ` | TOP BEEF: ${from.toUpperCase()} VS ${to.toUpperCase()} (${count} DRINKS)`;
        }
        UI.updateTicker(tickerMsg);

        // WHAT: Snake Eyes Lawmaking Trigger.
        // WHY: Per Boss request - allows creation of Mad-Libs style custom rules.
        if (v1 === 1 && v2 === 1) {
            gameState = 'LAWMAKING';
            UI.showLawmaker((trigger, target, action) => {
                Laws.enact(trigger, target, action);
                log(`[LAW] New rule enacted: ${trigger} -> ${target} -> ${action}`);
                gameState = 'DECIDING';
                triggerDoublesFlow(); // Continue to challenge after lawmaking
            });
            return;
        }

        if (isDoubles) {
            triggerDoublesFlow();
        } else if (events.length > 0) { 
            safeSetTimeout(() => { gameState = 'READY'; UI.setStatus("ROLL AGAIN"); }, 3000);
        } else { 
            UI.setStatus(`ROLLED ${v1} & ${v2}\n${UI.getTrashTalk('dead')}`);
            safeSetTimeout(nextTurn, 5000); 
        }
    }
}

/**
 * WHAT: Doubles Challenge Initiation.
 * WHY: Modularized to be called after Rulemaking or immediately after a double.
 */
function triggerDoublesFlow() {
    gameState = 'DECIDING';
    UI.showDoublesChoice((type) => {
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

/**
 * WHAT: Sloppy Dice Handler.
 * WHY: Penalizes players for rolling off the table surface.
 * HOW: Interrupts the current state, records a self-penalty in `GameStats`, and triggers a long haptic error pattern. Resets dice to the player's 'Hand' position after a 3-second delay.
 */
function triggerSloppy() {
    if (gameState === 'SLOPPY') return;
    gameState = 'SLOPPY'; log(" [SYSTEM] SLOPPY TRIGGERED");
    UI.setStatus(`SLOPPY! DRINK 2 & REROLL\n${UI.getTrashTalk('sloppy')}`);
    
    // WHAT: Sloppy Audio Feedback.
    if (audio) audio.playRigged();

    // STATS: Record as chaos caused by the roller (even if to themselves)
    GameStats.record(players[turnIdx], players[turnIdx], 2); 
    HapticManager.error();
    safeSetTimeout(() => {
        if (gameState === 'SLOPPY') {
            if (originalRollerIdx !== -1) { gameState = 'CHALLENGE_READY'; }
            else { gameState = 'READY'; }
            UI.setStatus(`${players[turnIdx].toUpperCase()}\nROLL AGAIN (SLOPPY)`);
        }
    }, 3000);
}

// --- ENGINE LOOP ---
/**
 * WHAT: Core Loop.
 * WHY: Main integration point for all subsystems.
 * HOW: 1. Advances Cannon world by `1/60s`. 2. Updates cinematic camera position. 3. Physically confines dice within an invisible 'Cup' during SHAKING. 4. Lerps visual meshes to their physical body positions. 5. Monitors velocity to detect "Settle" state via a time-based threshold (>0.8s below 0.1 velocity). 6. Projects player 3D coordinates to 2D screen space for floating labels.
 */
function animate() {
    requestAnimationFrame(animate);
    const dt = 1/60; world.step(dt);

    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        updateCamera(camera, gameState, playerMeshes, turnIdx, dice, tableHeight, lerpFactor, isLeftDown, isRightDown, movement, keys, dt);
        const cup = scene.getObjectByName("diceCup");
        if (cup) {
            if (gameState === 'SHAKING') {
                const pMesh = playerMeshes[turnIdx].mesh;
                cup.visible = false;
                cup.position.set(pMesh.position.x * 0.5, tableHeight + 4, pMesh.position.z * 0.5);
            } else { cup.visible = false; }
        }

        dice.forEach((d, i) => {
            if (gameState === 'READY' || (gameState === 'CHALLENGE_READY' && challengeType === 'SPLIT' && i >= diceRolledCount)) {
                const pMesh = playerMeshes[turnIdx].mesh;
                const angle = playerMeshes[turnIdx].angle;
                const offsetX = Math.cos(angle) * (i === 0 ? -0.8 : 0.8);
                const offsetZ = -Math.sin(angle) * (i === 0 ? -0.8 : 0.8);
                const hoverPos = new THREE.Vector3(pMesh.position.x * 0.5 + offsetX, tableHeight + 4, pMesh.position.z * 0.5 + offsetZ);

                if (!isFreeCam) {
                    d.mesh.position.lerp(hoverPos, lerpFactor);
                    d.mesh.scale.lerp(new THREE.Vector3(4, 4, 4), lerpFactor);
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
                    d.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFactor);
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
            const isStopped = dice.every(d => d.body.velocity.length() < 0.1 && d.body.angularVelocity.length() < 0.2);
            if (isStopped) {
                settleTimer += dt; if (settleTimer > 0.8) { log("[System] Dice settled."); resolveRoll(); }
            } else { settleTimer = 0; }
            if (performance.now() - rollStartTime > 8000) { resolveRoll(); }
        }

        playerMeshes.forEach(p => {
            if (p.mixer) p.mixer.update(dt);
            const vector = p.mesh.position.clone().project(camera);
            p.labelEl.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
            p.labelEl.style.top = `${(vector.y * -0.5 + 0.5) * window.innerHeight - 40}px`;
            p.labelEl.classList.remove('hidden');
        });
    }
    renderer.render(scene, camera);
}

animate();
window.addEventListener('resize', () => handleResize(camera, renderer));

document.getElementById('guide-btn').onclick = () => UI.showGuide(true, Laws.getLaws());
document.getElementById('close-guide-btn').onclick = () => UI.showGuide(false);

document.getElementById('stats-btn').onclick = () => UI.showStats(true, GameStats);
document.getElementById('close-stats-btn').onclick = () => UI.showStats(false);

window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING' && gameState !== 'CHALLENGE_READY') return;
    const { x, y, z } = e.accelerationIncludingGravity;
    accelMag = Math.sqrt(x*x + y*y + z*z);
    if (accelMag > 22) {
        if (gameState === 'READY' || gameState === 'CHALLENGE_READY') {
            gameState = 'SHAKING'; setTimeout(throwDice, 800);
        }
    }
});

window.addEventListener('mousemove', (e) => {
    movement.x = e.movementX;
    movement.y = e.movementY;
});

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
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
