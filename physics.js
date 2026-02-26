import * as CANNON from 'cannon-es';

export function setupPhysics() {
    const world = new CANNON.World();
    // Weighted Gravity (Stable)
    world.gravity.set(0, -25, 0); 
    world.allowSleep = true;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.1;

    // Infinite Floor Plane (Impossible to tunnel through)
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    world.addBody(groundBody);

    // Table Rim (Visual boundary check still uses 6.5)
    const numRails = 32;
    const railRadius = 6.3;
    const RAIL_HEIGHT = 4.0;
    for (let i = 0; i < numRails; i++) {
        const angle = (i / numRails) * Math.PI * 2;
        const rail = new CANNON.Body({ mass: 0 });
        // Standard Rim: Tall enough to catch rolls, low enough for 'Sloppy' mistakes
        // Jules stability fix: Boxes are 0.5m thick and rotated to form a continuous circle
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
