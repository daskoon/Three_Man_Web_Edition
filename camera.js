import * as THREE from 'three';

export let isFreeCam = false;
let cameraPitch = -0.3;
let cameraYaw = 0;

export function setFreeCam(value) {
    isFreeCam = value;
}

export function updateCamera(camera, gameState, playerMeshes, turnIdx, dice, tableHeight, lerpFactor, isLeftDown, isRightDown, movement, keys, dt) {
    if (isFreeCam) {
        // Free Cam Movement (WASD)
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

export function handleResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
