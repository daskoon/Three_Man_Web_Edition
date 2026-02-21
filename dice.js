import * as THREE from 'three';

export function createDieTexture(number, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, 256, 256);
    
    ctx.fillStyle = '#111111';
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

export function getFace(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    let maxDot = -1, face = 1;
    const normals = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
        new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
    ];
    const vals = [2, 5, 1, 6, 3, 4];
    normals.forEach((n, i) => {
        const worldNormal = n.clone().applyQuaternion(mesh.quaternion);
        if (worldNormal.dot(up) > maxDot) { maxDot = worldNormal.dot(up); face = vals[i]; }
    });
    return face;
}
