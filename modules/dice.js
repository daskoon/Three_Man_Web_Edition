/**
 * @file dice.js
 * @description Procedural dice generation and result detection.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: This module handles the visual generation of die textures and the 
 * mathematical detection of which face is pointing "UP" after a roll.
 * WHY: Procedural textures save bandwidth and ensure die faces are perfectly 
 * aligned with the physics body without manual UV mapping.
 * HOW: Generates dynamic textures using the HTML5 Canvas API (`2D context`). Detects results by transforming local normal vectors into world-space and calculating their dot-product against the global 'Up' axis (0,1,0).
 * WHEN: Textures generated on init; orientation checked when dice settle.
 * WHERE: Front-end rendering and logic integration.
 */

import * as THREE from 'three';

/**
 * WHAT: Procedural Texture Generator.
 * WHY: Creates crisp, high-resolution die faces on the fly without external assets.
 * HOW: Uses `canvas.getContext('2d')` to paint a solid background (`#b22222`) and draw circle paths (`arc`) for pips. Creates a `THREE.CanvasTexture` from the final element and sets `anisotropy` to the hardware maximum to prevent blur during macro camera zooms.
 */
export function createDieTexture(number, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // WHAT: Background Fill.
    ctx.fillStyle = '#b22222';
    ctx.fillRect(0, 0, 256, 256);
    
    // WHAT: Pip Layout Mapping.
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
    if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

/**
 * WHAT: Result Detector (The "Oracle").
 * WHY: To mathematically identify which number is facing Up.
 * HOW: Maintains an array of 6 unit vectors (Normals) representing each cube face. Multiplies each normal by the mesh's `worldQuaternion` to get its orientation in the scene. Performs a `.dot(globalUp)` calculation; the normal with the highest positive result (closest to 1.0) is facing straight up.
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
