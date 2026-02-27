/**
 * @file dice.js
 * @description Procedural dice generation and result detection.
 * 
 * WHAT: This module handles the visual generation of die textures and the 
 * mathematical detection of which face is pointing "UP" after a roll.
 * 
 * WHY: Procedural textures save bandwidth and ensure die faces are perfectly 
 * aligned with the physics body without manual UV mapping.
 */

import * as THREE from 'three';

/**
 * WHAT: Procedural Texture Generator.
 * WHY: Creates crisp, high-resolution die faces on the fly.
 * HOW: Uses a 2D Canvas to draw circles (pips) based on the die number and 
 * converts the result into a Three.js CanvasTexture.
 */
export function createDieTexture(number, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Background: Translucent Casino Red
    ctx.fillStyle = 'rgba(220, 20, 60, 0.8)';
    ctx.fillRect(0, 0, 256, 256);
    
    // Pip Filling: Flush White Pips (Equal density paint simulation)
    ctx.fillStyle = '#ffffff';
    const pips = {
        1: [[128, 128]], 2: [[64, 64], [192, 192]], 3: [[64, 64], [128, 128], [192, 192]],
        4: [[64, 64], [192, 64], [64, 192], [192, 192]], 5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
        6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
    };
    
    pips[number].forEach(p => {
        ctx.beginPath(); ctx.arc(p[0], p[1], 28, 0, Math.PI * 2); ctx.fill();
    });
    
    const tex = new THREE.CanvasTexture(canvas);
    // WHY: Anisotropy keeps textures crisp when viewed at sharp angles (Macro mode).
    if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

/**
 * WHAT: Result Detector.
 * WHY: Finds which number is facing the sky.
 * HOW: 1. Clone the 6 standard unit normals (UP, DOWN, LEFT, RIGHT, FRONT, BACK).
 *      2. Rotate them by the mesh's current quaternion.
 *      3. The normal with the highest Dot Product against the global UP vector (0,1,0) is the winner.
 */
export function getFace(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    let maxDot = -1, face = 1;
    const normals = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
        new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
    ];
    // Values corresponding to the normals based on the dieMaterials array in main.js
    const vals = [2, 5, 1, 6, 3, 4];
    
    normals.forEach((n, i) => {
        const worldNormal = n.clone().applyQuaternion(mesh.quaternion);
        const dot = worldNormal.dot(up);
        if (dot > maxDot) { 
            maxDot = dot; 
            face = vals[i]; 
        }
    });
    return face;
}
