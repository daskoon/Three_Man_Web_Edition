import * as CANNON from 'cannon-es';

export function setupPhysics() {
    const world = new CANNON.World();
    world.gravity.set(0, -35, 0);
    world.allowSleep = true;
    world.defaultContactMaterial.friction = 0.6;
    world.defaultContactMaterial.restitution = 0.2;

    // Tank-Grade Floor Box
    const tableBody = new CANNON.Body({ mass: 0 });
    tableBody.addShape(new CANNON.Box(new CANNON.Vec3(10, 0.5, 10)));
    tableBody.position.set(0, -0.25, 0);
    world.addBody(tableBody);

    // High-Fidelity Collision Rails
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const b = new CANNON.Body({ mass: 0 });
        b.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 0.2)));
        b.position.set(Math.cos(a) * 6.3, 0.5, Math.sin(a) * 6.3);
        b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -a);
        world.addBody(b);
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
