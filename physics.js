import * as CANNON from 'cannon-es';

export function setupPhysics() {
    const world = new CANNON.World();
    // Heavy Gravity for Weighty Feel
    world.gravity.set(0, -50, 0); 
    world.allowSleep = true;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.1; // Low bounciness

    // Felt Table Surface (Increased radius for safety)
    const tableBody = new CANNON.Body({ mass: 0 });
    const tableShape = new CANNON.Cylinder(6.5, 6.5, 0.5, 32);
    tableBody.addShape(tableShape);
    tableBody.position.set(0, 0, 0);
    world.addBody(tableBody);

    // High-Fidelity Collision Rails (Circular containment)
    // We use a ring of boxes to simulate the table rim
    const numRails = 32;
    const railRadius = 6.3;
    const RAIL_HEIGHT = 4.0;
    for (let i = 0; i < numRails; i++) {
        const angle = (i / numRails) * Math.PI * 2;
        const rail = new CANNON.Body({ mass: 0 });
        // Craps-style Pit: Rails are very tall and thick
        // Rotated 90 degrees to form a continuous wall (1.0m thick)
        const railShape = new CANNON.Box(new CANNON.Vec3(1.0, RAIL_HEIGHT / 2, 0.5));
        rail.addShape(railShape);
        rail.position.set(
            Math.cos(angle) * railRadius, 
            RAIL_HEIGHT / 2, 
            Math.sin(angle) * railRadius
        );
        rail.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle + Math.PI / 2);
        world.addBody(rail);
    }

    return world;
}

export function createDieBody(x, world) {
    const body = new CANNON.Body({ 
        mass: 0, 
        type: CANNON.Body.STATIC,
        linearDamping: 0.4,
        angularDamping: 0.4
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)));
    body.position.set(x, 2, 0);
    world.addBody(body);
    return body;
}
