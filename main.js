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
let gameState = 'SPLASH';
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
// FIX: Cap pixel ratio to prevent GPU thermal throttling
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 20;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.fillStyle = '#111111';
    const pips = {
        1: [[128, 128]],
        2: [[64, 64], [192, 192]],
        3: [[64, 64], [128, 128], [192, 192]],
        4: [[64, 64], [192, 64], [64, 192], [192, 192]],
        5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
        6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
    };
    pips[number].forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 25, 0, Math.PI * 2);
        ctx.fill();
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

const dieMaterials = [
    new THREE.MeshStandardMaterial({ map: createDieTexture(2) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(5) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(1) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(6) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(3) }),
    new THREE.MeshStandardMaterial({ map: createDieTexture(4) })
];

function createDie(x) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), dieMaterials);
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
    splash: document.getElementById('splash-screen'),
    setup: document.getElementById('setup-screen'),
    status: document.getElementById('action-text'),
    threeMan: document.getElementById('current-3man'),
    turn: document.getElementById('current-turn'),
    drinks: document.getElementById('drinks-overlay'),
    doublesTitle: document.getElementById('doubles-title'),
    btns: document.getElementById('recipient-buttons'),
    playerList: document.getElementById('player-list')
};

document.getElementById('init-btn').onclick = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try { await DeviceMotionEvent.requestPermission(); } catch(e) {}
    }
    audio = new DirectorAudio();
    if (audio.ctx.state === 'suspended') await audio.ctx.resume();
    UI.splash.classList.add('hidden');
    UI.setup.classList.remove('hidden');
    gameState = 'SETUP';
};

document.getElementById('add-player-btn').onclick = () => {
    const i = document.getElementById('player-input');
    if (i.value.trim()) {
        players.push(i.value.trim());
        renderSetup();
        i.value = '';
    }
};

function renderSetup() {
    UI.playerList.innerHTML = players.map((p, k) => `<div class='player-entry'><span>${p}</span><button onclick='players.splice(${k},1); window.dispatchEvent(new Event("renderPlayers"))'>X</button></div>`).join('');
}
window.addEventListener('renderPlayers', renderSetup);

document.getElementById('start-game-btn').onclick = () => {
    if (players.length < 2) return alert("Need 2+ players");
    UI.setup.classList.add('hidden');
    turnIdx = players.length - 1; 
    nextTurn();
};

window.addEventListener('devicemotion', (e) => {
    if (gameState !== 'READY') return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
    // FIX: Lowered threshold for better accessibility
    if (mag > 22) roll();
});

window.onmousedown = (e) => { 
    if (gameState === 'READY' && e.target.tagName !== 'BUTTON') roll(); 
};

function roll() {
    if (gameState !== 'READY' && gameState !== 'SLOPPY') return;
    gameState = 'ROLLING';
    settleCounter = 0;
    UI.status.innerText = "ROLLING...";
    dice.forEach((d, i) => {
        d.body.wakeUp();
        d.body.type = CANNON.Body.DYNAMIC;
        d.body.mass = 0.05;
        d.body.updateMassProperties();
        d.body.position.set(i===0?-0.6:0.6, 4, 0); 
        d.body.velocity.set(0,0,0);
        d.body.angularVelocity.set(0,0,0);
        const force = new CANNON.Vec3(Math.random()*6-3, 15, -8);
        d.body.applyImpulse(force, new CANNON.Vec3(Math.random()*0.2, 0.2, Math.random()*0.2));
    });
}

function checkResults() {
    if (gameState !== 'ROLLING') return;
    const isStill = dice.every(d => d.body.velocity.length() < 0.05 && d.body.angularVelocity.length() < 0.05);
    if (isStill) {
        settleCounter++;
    } else {
        settleCounter = 0;
    }
    if (settleCounter > 30) {
        gameState = 'RESULTS';
        audio.playThud();
        processRules(getFace(dice[0]), getFace(dice[1]));
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
    if (threeManIdx !== -1) {
        let p = (v1===3?1:0) + (v2===3?1:0) + (total===3?1:0);
        if (p) events.push(`${players[threeManIdx]} DRINKS ${p}`);
    }
    if (v1===3 || v2===3 || total===3) { threeManIdx = turnIdx; events.push("THREE MAN!"); }
    if (total===7) events.push("PREV DRINKS");
    if (total===11) events.push("CURRENT DRINKS");
    UI.status.innerText = `ROLLED ${v1} & ${v2}\n${events.join(' | ')}`;
    updateHUD();
    if (v1===v2 && v1!==3) {
        gameState = 'DECIDING';
        UI.drinks.classList.remove('hidden');
        if (UI.doublesTitle) UI.doublesTitle.innerText = `GIVE ${total} DRINKS`;
        UI.btns.innerHTML = players.map((p, i) => `<button onclick="confirmDrinks(${i})">${p}</button>`).join('');
    } else {
        setTimeout(() => { if (gameState === 'RESULTS') nextTurn(); }, 4000);
    }
}

window.confirmDrinks = (i) => {
    UI.drinks.classList.add('hidden');
    UI.status.innerText = `GAVE TO ${players[i]}`;
    setTimeout(() => { if (gameState === 'DECIDING') nextTurn(); }, 2000);
};

function nextTurn() {
    turnIdx = (turnIdx + 1) % players.length;
    gameState = 'READY';
    updateHUD();
    UI.status.innerText = `${players[turnIdx].toUpperCase()}\nSHAKE TO ROLL`;
    dice.forEach((d, i) => {
        d.body.type = CANNON.Body.STATIC;
        d.body.position.set(i===0?-0.6:0.6, 2, 0); 
        d.body.velocity.set(0,0,0); d.body.angularVelocity.set(0,0,0);
        d.body.quaternion.set(0,0,0,1);
    });
}

function updateHUD() {
    UI.threeMan.innerText = `3MAN: ${threeManIdx === -1 ? 'NONE' : players[threeManIdx].toUpperCase()}`;
    UI.turn.innerText = `TURN: ${players[turnIdx].toUpperCase()}`;
}

function triggerSloppy() {
    gameState = 'SLOPPY';
    UI.status.innerText = "SLOPPY! DRINK 2 & REROLL";
    setTimeout(() => { if (gameState === 'SLOPPY') { gameState = 'READY'; roll(); } }, 3000);
}

const camTarget = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (gameState !== 'SPLASH' && gameState !== 'SETUP') {
        // FIX: Frame-rate independent physics
        world.step(fixedTimeStep, dt, 3);
        dice.forEach(d => {
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);
        });
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        camTarget.set(midX * 0.3, 10, 10);
        // FIX: Frame-rate independent camera LERP
        const lerpFactor = 1.0 - Math.pow(0.01, dt);
        camera.position.lerp(camTarget, lerpFactor); 
        camera.lookAt(midX * 0.1, 0, 0);
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
