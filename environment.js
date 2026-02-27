import * as THREE from 'three';

export const tableHeight = 4.0;

export function setupEnvironment(scene) {
    const loader = new THREE.TextureLoader();
    const feltTex = loader.load('felt_albedo.png');
    const woodTex = loader.load('wood_albedo.png');
    const wallTex = loader.load('wall_wood.png');
    const brickTex = loader.load('wall_brick.png');
    const ceilingTex = loader.load('ceiling_tiles.png');
    const floorTex = loader.load('floor_hardwood.png');

    // --- BASEMENT ENVIRONMENT ---
    // Floor
    const roomFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 })
    );
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.y = -0.25;
    scene.add(roomFloor);

    // Ceiling
    const roomCeiling = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: ceilingTex, roughness: 0.9 })
    );
    roomCeiling.rotation.x = Math.PI / 2;
    roomCeiling.position.y = 12;
    scene.add(roomCeiling);

    // Walls
    const createWall = (x, z, rotY, tex) => {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12.25), new THREE.MeshStandardMaterial({ map: tex }));
        wall.position.set(x, 5.875, z);
        wall.rotation.y = rotY;
        scene.add(wall);
    };
    createWall(0, -20, 0, wallTex); // Back
    createWall(0, 20, Math.PI, wallTex); // Front
    createWall(-20, 0, Math.PI / 2, brickTex); // Left
    createWall(20, 0, -Math.PI / 2, wallTex); // Right

    // Visual Table
    const tableTop = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 7, 0.5, 64),
        new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.8 })
    );
    tableTop.position.y = tableHeight - 0.25;
    scene.add(tableTop);

    // Table Legs
    const createLeg = (x, z) => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, tableHeight, 16),
            new THREE.MeshStandardMaterial({ map: woodTex })
        );
        leg.position.set(x, tableHeight / 2 - 0.25, z);
        scene.add(leg);
    };
    createLeg(4, 4); createLeg(-4, 4); createLeg(4, -4); createLeg(-4, -4);

    // Visual Rim
    const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.2, 4.0, 64, 1, true),
        new THREE.MeshStandardMaterial({
            map: woodTex,
            roughness: 0.4,
            metalness: 0.3,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.1
        })
    );
    rim.position.y = tableHeight + 2.0;
    scene.add(rim);

    // Debug: Collision Cage Visualization
    const debugRailMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.3, wireframe: true });
    const numRails = 32;
    const railRadius = 6.8;
    const RAIL_HEIGHT = 4.0;
    for (let i = 0; i < numRails; i++) {
        const angle = (i / numRails) * Math.PI * 2;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, RAIL_HEIGHT, 1.0), debugRailMat);
        mesh.position.set(Math.cos(angle) * railRadius, tableHeight + RAIL_HEIGHT / 2, Math.sin(angle) * railRadius);
        mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
        scene.add(mesh);
    }

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const spot = new THREE.SpotLight(0xffd700, 3.0);
    spot.position.set(0, tableHeight + 15, 0); spot.castShadow = true; scene.add(spot);

    const bulb = new THREE.PointLight(0xffaa44, 1.0, 30);
    bulb.position.set(0, tableHeight + 10, 0);
    scene.add(bulb);
}
