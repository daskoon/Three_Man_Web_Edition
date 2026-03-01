/**
 * @file camera.js
 * @description Cinematic and Interactive View Controller.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: Manages the position and orientation of the Three.js camera.
 * WHY: To provide high-impact cinematic transitions during rolls and a diagnostic "Free Cam" mode.
 * HOW: Using Vector lerping (linear interpolation) between state-based target positions.
 * WHEN: Updated every frame via the animate loop in main.js.
 * WHERE: Front-end visualization layer.
 */

import * as THREE from 'three';

export let isFreeCam = false;
let cameraPitch = -0.3;
let cameraYaw = 0;

/**
 * WHAT: Toggle for Free Exploration.
 * WHY: Allows the Boss to inspect the scene geometry and physics from any angle.
 */
export function setFreeCam(value) {
    isFreeCam = value;
}

/**
 * WHAT: The "Director" Update Loop.
 * WHY: To smoothly follow the dice and the current player.
 * HOW: Calculates target vectors based on game state (READY vs ROLLING vs RESULTS).
 */
export function updateCamera(camera, gameState, playerMeshes, turnIdx, dice, tableHeight, lerpFactor, isLeftDown, isRightDown, movement, keys, dt) {
    if (isFreeCam) {
        // WHAT: Diagnostic Movement (WASD).
        const speed = 10 * dt;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        
        if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
        if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
        if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
        if (keys['KeyD']) camera.position.addScaledVector(right, speed);
        if (keys['Space']) camera.position.y += speed;
        if (keys['ShiftLeft']) camera.position.y -= speed;

        if (isLeftDown || isRightDown) {
            cameraYaw -= movement.x * 0.005;
            cameraPitch -= movement.y * 0.005;
            cameraPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraPitch));
        }
        camera.quaternion.setFromEuler(new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ'));
    } else {
        // WHAT: Cinematic View Mapping.
        // WHY: To ensure the player is always at the center of the action.
        const pMesh = playerMeshes[turnIdx].mesh;
        const camPos = new THREE.Vector3(pMesh.position.x * 2.2, tableHeight + 8, pMesh.position.z * 2.2);
        const midX = (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2;
        const midZ = (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2;

        if (gameState === 'READY' || gameState === 'SHAKING' || gameState === 'CHALLENGE_READY') {
            camera.position.lerp(camPos, lerpFactor * 0.5);
            camera.lookAt(0, tableHeight, 0);
        } else if (gameState === 'ROLLING') {
            const distBetween = dice[0].mesh.position.distanceTo(dice[1].mesh.position);
            const dynamicHeight = Math.max(tableHeight + 12, distBetween * 1.5);
            camera.position.lerp(new THREE.Vector3(midX * 0.5, dynamicHeight, 15 + midZ * 0.5), lerpFactor);
            camera.lookAt(midX, tableHeight, midZ);
        } else {
            const distBetween = dice[0].mesh.position.distanceTo(dice[1].mesh.position);
            const camHeight = Math.max(tableHeight + 6, distBetween * 1.2);
            camera.position.lerp(new THREE.Vector3(midX, camHeight, midZ + camHeight * 0.8), lerpFactor);
            camera.lookAt(midX, tableHeight, midZ);
        }
    }
}

/**
 * WHAT: Responsive Display Utility.
 * WHY: Ensures the view doesn't stretch on mobile orientation changes.
 */
export function handleResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
