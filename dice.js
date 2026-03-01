/**
 * @file dice.js
 * @description Procedural dice generation and result detection.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: This module handles the visual generation of die textures and the 
 * mathematical detection of which face is pointing "UP" after a roll.
 * WHY: Procedural textures save bandwidth and ensure die faces are perfectly 
 * aligned with the physics body without manual UV mapping.
 * HOW: Using HTML Canvas API for textures and Dot Product math for orientation detection.
 * WHEN: Textures generated on init; orientation checked when dice settle.
 * WHERE: Front-end rendering and logic integration.
 */

import * as THREE from 'three';

/**
 * WHAT: Procedural Texture Generator.
 * WHY: Creates crisp, high-resolution die faces on the fly without external assets.
 * HOW: Draws circles (pips) on a 2D canvas and converts it to a CanvasTexture.
 * @param {number} number - The face value (1-6).
 * @param {THREE.WebGLRenderer} renderer - Used to calculate max anisotropy.
 */
export function createDieTexture(number, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // WHAT: Background Fill.
    // WHY: Deep 'Casino Red' requested by Boss for premium feel.
    ctx.fillStyle = '#b22222';
    ctx.fillRect(0, 0, 256, 256);
    
    // WHAT: Pip Layout Mapping.
    // WHY: To ensure accurate standard-die pip distribution.
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
    // WHY: Anisotropy keeps textures crisp when viewed at sharp angles during Results zoom.
    if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

/**
 * WHAT: Result Detector (The "Oracle").
 * WHY: To mathematically identify which number is facing Up.
 * HOW: 1. Rotate 6 standard normals by the die's current rotation.
 *      2. Find the normal most aligned with the global UP vector (0,1,0).
 * @param {THREE.Mesh} mesh - The visual die mesh.
 */
export function getFace(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    let maxDot = -1, face = 1;
    const normals = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
        new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
    ];
    // WHAT: Texture Alignment Mapping.
    // WHY: Maps indices to faces based on the dieMaterials array in main.js.
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
