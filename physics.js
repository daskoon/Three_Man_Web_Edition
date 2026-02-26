/**
 * @file physics.js
 * @description Core physics engine configuration using Cannon-es.
 * 
 * WHAT: This module initializes the 3D physics world, handles collision detection, 
 * and defines the physical bodies for the dice and the table environment.
 * 
 * WHY: Separation of physics from rendering ensures stable simulation and 
 * allows for high-precision sub-stepping (Jules' fix) independent of frame rate.
 */

import * as CANNON from 'cannon-es';

export function setupPhysics() {
    const world = new CANNON.World();

    // WHAT: Global Gravity Vector.
    // WHY: Lowered to -25 (from -50) to achieve a 'Human Scale' feel where dice tumble 
    // rather than hitting like rail-gun slugs.
    // HOW: Set the Y-axis gravity to a constant downward force.
    world.gravity.set(0, -25, 0); 
    
    // WHAT: Physics Sleeping.
    // WHY: Optimization. Allows the physics engine to stop calculating bodies that have 
    // come to a rest, saving CPU for mobile devices.
    world.allowSleep = true;

    // WHAT: Default Contact Material.
    // WHY: Defines how ALL objects interact by default. Low restitution (0.1) 
    // ensures dice hit the felt and settle quickly instead of bouncing like super-balls.
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.1;

    // WHAT: Infinite Floor Plane.
    // WHY: To prevent "Physics Tunneling" where dice moving at high speed pass through 
    // thin surfaces (like Cylinders). A Plane is mathematically infinite in thickness.
    // HOW: Create a Plane shape and rotate it -90 degrees around the X-axis to face UP.
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    world.addBody(groundBody);

    // WHAT: Circular Collision Rails (The "Cage").
    // WHY: To contain the dice within the visual table area (6.5 radius). 
    // Jules stability fix uses a tight ring of rotated boxes to form a seamless barrier.
    // HOW: Calculate 32 positions around a circle and orient boxes toward the center.
    const numRails = 32;
    const railRadius = 6.3;
    const RAIL_HEIGHT = 4.0; // Jules' "Vegas Vault" height for absolute containment.
    for (let i = 0; i < numRails; i++) {
        const angle = (i / numRails) * Math.PI * 2;
        const rail = new CANNON.Body({ mass: 0 });
        
        // WHAT: Box Collider.
        // HOW: 1.0m thick boxes, rotated to form a continuous collision ring.
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

/**
 * WHAT: Die Body Factory.
 * WHY: Creates a standard cube collider for the dice.
 * HOW: Uses a STATIC body initially (while shaking) and switches to DYNAMIC on throw.
 */
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
