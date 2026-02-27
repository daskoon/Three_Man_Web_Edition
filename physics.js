/**
 * @file physics.js
 * @description Core physics engine configuration using Cannon-es.
 * 
 * WHAT: This module initializes the 3D physics world, handles collision detection, 
 * and defines the physical bodies for the dice and the table environment.
 * 
 * WHY: Separation of physics from rendering ensures stable simulation and 
 * allows for high-precision sub-stepping (Jules' fix) independent of frame rate.
 * 
 * UPDATED: Raised Infinite Plane to y=0.3 to prevent dice sinking into visual floor.
 */

import * as CANNON from 'cannon-es';

export function setupPhysics() {
    const world = new CANNON.World();

    // WHAT: Global Gravity Vector.
    // WHY: Increased to -40 for 'Heavy' cellulose acetate feel.
    world.gravity.set(0, -40, 0); 
    
    // WHAT: Physics Sleeping.
    // WHY: Optimization for mobile devices.
    world.allowSleep = true;

    // WHAT: Default Contact Material.
    // WHY: High bounciness (0.55) to simulate reactive casino dice.
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.55;

    // WHAT: Infinite Floor Plane.
    // WHY: Raised to bar-table height (4.0m) + offset for 19mm dice.
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    // Baseline Surface at y=4.0
    groundBody.position.set(0, 4.0, 0);
    world.addBody(groundBody);

    // WHAT: Circular Collision Rails (The "Cage").
    // WHY: Scaled to 7.0 radius for better mobile perspective.
    const numRails = 32;
    const railRadius = 6.8;
    const RAIL_HEIGHT = 4.0; 
    for (let i = 0; i < numRails; i++) {
        const angle = (i / numRails) * Math.PI * 2;
        const rail = new CANNON.Body({ mass: 0 });
        
        const railShape = new CANNON.Box(new CANNON.Vec3(1.0, RAIL_HEIGHT / 2, 0.5));
        rail.addShape(railShape);
        rail.position.set(
            Math.cos(angle) * railRadius, 
            4.0 + RAIL_HEIGHT / 2, 
            Math.sin(angle) * railRadius
        );
        rail.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle + Math.PI / 2);
        world.addBody(rail);
    }

    return world;
}

/**
 * WHAT: Die Body Factory.
 * WHY: Creates a 19mm (0.19 unit) cube collider.
 */
export function createDieBody(x, world) {
    const body = new CANNON.Body({ 
        mass: 0, 
        type: CANNON.Body.STATIC,
        linearDamping: 0.1,
        angularDamping: 0.2
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.095, 0.095, 0.095)));
    // Dice start hovering at y=8 while ready (above table at y=4)
    body.position.set(x, 8, 6);
    world.addBody(body);
    return body;
}
