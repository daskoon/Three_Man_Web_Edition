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
    // WHY: Lowered to -25 (from -50) to achieve a 'Human Scale' feel.
    world.gravity.set(0, -25, 0); 
    
    // WHAT: Physics Sleeping.
    // WHY: Optimization for mobile devices.
    world.allowSleep = true;

    // WHAT: Default Contact Material.
    // WHY: Defines how dice interact with surfaces (Low bounciness).
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.1;

    // WHAT: Infinite Floor Plane.
    // WHY: Swapped from Cylinder to Plane to prevent tunneling. 
    // UPDATED: Raised to y=0.3 so half-height (0.3) of dice (0.6) sits on top of visual floor (y=0).
    // HOW: Create a Plane shape and rotate it -90 degrees around the X-axis.
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    // Raise position so dice surfaces align with visual floor at y=0
    groundBody.position.set(0, 0.31, 0);
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
 */
export function createDieBody(x, world) {
    const body = new CANNON.Body({ 
        mass: 0, 
        type: CANNON.Body.STATIC,
        linearDamping: 0.4,
        angularDamping: 0.4
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)));
    // Dice start hovering at y=6 while ready
    body.position.set(x, 6, 6);
    world.addBody(body);
    return body;
}
