import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- AUDIO ENGINE ---
class DirectorAudio {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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

// --- STATE ---
let players = [];
let turnIdx = 0;
let threeManIdx = -1;
let gameState = 'SPLASH'; // SPLASH, SETUP, READY, SHAKING, ROLLING, RESULTS, DECIDING
let audio;
let settleCounter = 0;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;

// --- 3D ENGINE ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.02);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = new CANNON.World();
world.gravity.set(0, -30, 0);
world.defaultContactMaterial.friction = 0.5;
world.defaultContactMaterial.restitution = 0.3;

const loader = new THREE.TextureLoader();
const feltTex = loader.load('felt_albedo.png');
const woodTex = loader.load('wood_albedo.png');

// --- TABLE ---
const tableMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.5, 64),
    new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.8 })
);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

const tableBody = new CANNON.Body({ mass: 0 });
tableBody.addShape(new CANNON.Box(new CANNON.Vec3(10, 0.5, 10)));
tableBody.position.set(0, -0.25, 0);
world.addBody(tableBody);

const railMesh = new THREE.Mesh(
    new THREE.TorusGeometry(6.1, 0.3, 32, 64),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4, metalness: 0.3 })
);
railMesh.rotation.x = Math.PI / 2;
scene.add(railMesh);

for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = new CANNON.Body({ mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 0.2)));
    b.position.set(Math.cos(a) * 6.3, 0.5, Math.sin(a) * 6.3);
    b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -a);
    world.addBody(b);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const spot = new THREE.SpotLight(0xffd700, 2);
spot.position.set(0, 15, 5);
spot.castShadow = true;
scene.add(spot);

// --- DYNAMIC DICE SYSTEM ---
function createDieTexture(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 20; ctx.strokeRect(0, 0, 256, 256);
    ctx.fillStyle = '#111111';
    const pips = {
        1: [[128, 128]], 2: [[64, 64], [192, 192]], 3: [[64, 64], [128, 128], [192, 192]],
        4: [[64, 64], [192, 64], [64, 192], [192, 192]], 5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
        6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
    };
    pips[number].forEach(p => {
        ctx.beginPath(); ctx.arc(p[0], p[1], 25, 0, Math.PI * 2); ctx.fill();
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

const dieMaterials = [
    new THREE.MeshStandardMaterial({ map: createDieTexture(2) }), new THREE.MeshStandardMaterial({ map: createDieTexture(5) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(1) }), new THREE.MeshStandardMaterial({ map: createDieTexture(6) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(3) }), new THREE.MeshStandardMaterial({ map: createDieTexture(4) })
];

function createDie(x) {
    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mesh = new THREE.Mesh(geo, dieMaterials);
    mesh.castShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)));
    body.position.set(x, 2, 0);
    body.linearDamping = 0.4;
    body.angularDamping = 0.4;
    body.addEventListener('collide', (e) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 0.3) audio?.playClack(v);
    });
    world.addBody(body);
    return { mesh, body };
}

const dice = [createDie(-0.6), createDie(0.6)];

// --- UI ---
const UI = {
    status: document.getElementById('action-text'),
    threeMan: document.getElementById('current-3man'),
    turn: document.getElementById('current-turn'),
    drinks: document.getElementById('drinks-overlay'),
    doublesTitle: document.getElementById('doubles-title'),
    btns: document.getElementById('recipient-buttons'),
    playerList: document.getElementById('player-list'),
    playerInput: document.getElementById('player-input')
};

// Consolidated UI functions
function renderPlayers() {
    UI.playerList.innerHTML = players.map((p, k) => `
        <div class='player-entry'>
            <span>${p}</span>
            <button onclick='window.removePlayer(${k})'>X</button>
        </div>
    `).join('');
}

window.removePlayer = (idx) => {
    players.splice(idx, 1);
    renderPlayers();
};

document.getElementById('init-btn').onclick = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
    audio = new DirectorAudio();
    if (audio.ctx.state === 'suspended') await audio.ctx.resume();
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    gameState = 'SETUP';
};

document.getElementById('add-player-btn').onclick = () => {
    const val = UI.playerInput.value.trim();
    if (val) {
        players.push(val);
        renderPlayers();
        UI.playerInput.value = '';
    }
};

document.getElementById('start-game-btn').onclick = () => {
    if (players.length < 2) return alert("Need 2+ players");
    document.getElementById('setup-screen').classList.add('hidden');
    turnIdx = players.length - 1; 
    nextTurn();
};

let accelMag = 0;
window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY' && gameState !== 'SHAKING') return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    accelMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    if (accelMag > 22) {
        if (gameState === 'READY') gameState = 'SHAKING';
    } else if (gameState === 'SHAKING' && accelMag < 15) {
        throwDice();
    }
});

window.onmousedown = (e) => { 
    if (gameState === 'READY' && e.target.tagName !== 'BUTTON') {
        gameState = 'SHAKING';
        setTimeout(throwDice, 800);
    }
};

function throwDice() {
    if (gameState !== 'SHAKING') return;
    gameState = 'ROLLING';
    settleCounter = 0;
    UI.status.innerText = "ROLL!";
    
    dice.forEach((d, i) => {
        d.body.type = CANNON.Body.DYNAMIC;
        d.body.mass = 0.05;
        d.body.updateMassProperties();
        d.body.wakeUp();
        const force = new CANNON.Vec3(Math.random()*0.4 - 0.2, 0.5, -0.8);
        d.body.applyImpulse(force, new CANNON.Vec3(Math.random()*0.01, 0.01, Math.random()*0.01));       
    });
    if (navigator.vibrate) navigator.vibrate(150);
}

function checkResults() {
    if (gameState !== 'ROLLING') return;
    const settled = dice.every(d => d.body.velocity.length() < 0.05 && d.body.angularVelocity.length() < 0.05);
    if (settled) {
        settleCounter++;
        if (settleCounter > 30) {
            gameState = 'RESULTS';
            audio.playThud();
            processRules(getFace(dice[0]), getFace(dice[1]));
        }
    } else {
        settleCounter = 0;
    }
    if (dice.some(d => d.body.position.y < -5)) triggerSloppy();
}

function getFace(die) {
    const up = new THREE.Vector3(0, 1, 0);
    let max = -1, face = 1;
    const normals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
    const vals = [2, 5, 1, 6, 3, 4];
    normals.forEach((n, i) => {
        const worldNormal = n.clone().applyQuaternion(die.mesh.quaternion);
        if (worldNormal.dot(up) > max) { max = worldNormal.dot(up); face = vals[i]; }
    });
    return face;
}

function processRules(v1, v2) {
    const total = v1 + v2;
    let events = [];
    
    // --- OFFICIAL RULEBOOK LOGIC ---
    
    // 1. The Three Man Penalty (Curse)
    // "Anytime a player rolls a three you must drink."
    // "Every three that appears on a single die, YOU DRINK!!"
    if (threeManIdx !== -1) {
        let p = 0;
        if (v1 === 3) p++;
        if (v2 === 3) p++;
        if (total === 3) p++; // Sum counts as "rolls a three"? The rule says "player rolls a three". 
        // Interpretation: Sum of 3 implies (1,2) or (2,1). Neither die is 3. 
        // But "A one and a two and you become the Three-man!" implies the sum 3 is special.
        // Rule 2 says "Anytime a player rolls a three". This usually means the digit 3 or sum 3.
        // We will count the sum for maximum drinking.
        
        if (p > 0) events.push(`${players[threeManIdx]} DRINKS ${p}`);
    }

    // 2. The Three Man Title (Hot Potato)
    // "A one and a two and you become the Three-man!"
    if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
        threeManIdx = turnIdx;
        events.push("NEW THREE MAN!");
    }

    // 3. Doubles
    if (v1 === v2) {
        if (v1 === 3) events.push("DOUBLE 3s! DRINK TWICE!"); // The penalty loop above handles the count, this is flavor.
        if (v1 === 5) events.push("DOUBLE 5s! THUMBS DOWN!");
        if (v1 === 1) events.push("SNAKE EYES! MAKE A RULE!");
    }

    // 4. Socials
    // "A four in any combination is a social."
    if (total === 4 || v1 === 4 || v2 === 4) { // "In any combination" implies dice values too? Usually implies sum.
        // Standard rule is usually sum=4 OR dice showing 4. The text says "A four in any combination".
        // Example: 1+3=4 (Sum). 2+2=4 (Sum). 4+1 (Die).
        // We'll count ALL of them.
        events.push("SOCIAL! EVERYONE DRINKS!");
    }

    // 5. Seven (Left Drinks)
    if (total === 7) {
        // (Current Index - 1) is Right? No, turn order goes 1->2->3.
        // If I am 2, Left is 1. Right is 3.
        // (i - 1) is Left.
        let leftIdx = (turnIdx - 1 + players.length) % players.length;
        events.push(`${players[leftIdx]} (LEFT) DRINKS`);
    }

    // 6. Eleven (Right Drinks)
    if (total === 11) {
        let rightIdx = (turnIdx + 1) % players.length;
        events.push(`${players[rightIdx]} (RIGHT) DRINKS`);
    }
    
    UI.status.innerText = `ROLLED ${v1} & ${v2}\n${events.join(' | ')}`;
    updateHUD();

    // 7. Doubles Challenge (Give Drinks Mode)
    // "When doubles are rolled, the roller may pass one or both out..."
    // We simplify to "Give Drinks" for the web version.
    if (v1 === v2) {
        gameState = 'DECIDING';
        UI.drinks.classList.remove('hidden');
        if (UI.doublesTitle) UI.doublesTitle.innerText = `DOUBLES! GIVE ${total} DRINKS`;
        UI.btns.innerHTML = players.map((p, i) => `<button onclick="confirmDrinks(${i})">${p}</button>`).join('');
    } else {
        // If not doubles, turn ends unless play continues logic (not fully implemented here for simplicity)
        setTimeout(() => { if (gameState === 'RESULTS') nextTurn(); }, 4000);
    }
}

window.confirmDrinks = (i) => {
    UI.drinks.classList.add('hidden');
    UI.status.innerText = `GAVE TO ${players[i]}`;
    setTimeout(() => { if (gameState === 'DECIDING') nextTurn(); }, 2000); // Roller rolls again on doubles usually? 
    // Rule says "Alpha may roll again to start the next round."
    // We will stick to nextTurn for now to keep flow moving.
};

function nextTurn() {
    turnIdx = (turnIdx + 1) % players.length;
    gameState = 'READY';
    updateHUD();
    UI.status.innerText = `${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`;
}

function updateHUD() {
    UI.threeMan.innerText = `3MAN: ${threeManIdx === -1 ? 'NONE' : players[threeManIdx].toUpperCase()}`;
    UI.turn.innerText = `TURN: ${players[turnIdx].toUpperCase()}`;
}

function triggerSloppy() {
    gameState = 'SLOPPY';
    UI.status.innerText = "SLOPPY! DRINK 2 & REROLL";
    setTimeout(() => { if (gameState === 'SLOPPY') { gameState = 'READY'; nextTurn(); turnIdx--; } }, 3000);
}

const camTarget = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    
    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        world.step(fixedTimeStep, dt, 3);
        
        // DICE POSITION LOGIC
        dice.forEach((d, i) => {
            if (gameState === 'READY') {
                // HOVER IN HAND POSITION (Close to camera)
                const targetPos = new THREE.Vector3(i === 0 ? -0.8 : 0.8, 6, 6);
                d.mesh.position.lerp(targetPos, 0.1);
                d.mesh.rotation.y += 0.01;
                d.body.position.copy(d.mesh.position);
            } else if (gameState === 'SHAKING') {
                // JITTER IN HAND
                const jitter = (Math.random() - 0.5) * (accelMag / 20);
                d.mesh.position.x += jitter;
                d.mesh.position.y += jitter;
                d.body.position.copy(d.mesh.position);
            } else {
                // SYNC WITH PHYSICS
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);
            }
        });

        // CAMERA TRACKING
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;
        
        if (gameState === 'READY' || gameState === 'SHAKING') {
            camTarget.set(0, 12, 15);
            camera.position.lerp(camTarget, 0.05);
            camera.lookAt(0, 4, 0);
        } else {
            camTarget.set(midX * 0.3, 10, 10);
            const lerpFactor = 1.0 - Math.pow(0.01, dt);
            camera.position.lerp(camTarget, lerpFactor); 
            camera.lookAt(midX * 0.1, 0, 0);
        }
        
        checkResults();
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth/window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
});
