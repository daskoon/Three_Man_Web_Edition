/**
 * @file physics.js
 * @description Core physics engine configuration using Cannon-es.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: This module initializes the 3D physics world, handles collision detection, 
 * and defines the physical bodies for the dice and the table environment.
 * WHY: Separation of physics from rendering ensures stable simulation and 
 * allows for high-precision sub-stepping independent of frame rate.
 * HOW: Using Cannon-es rigid body dynamics with specific Material properties.
 * WHEN: Initialized on application start; stepped in every frame of the animate loop.
 * WHERE: Logic core for physical interactions within the WebGL scene.
 */

import * as CANNON from 'cannon-es';

/**
 * WHAT: World Setup Function.
 * WHY: To create the physical 'reality' where the dice exist.
 * HOW: Configures gravity, contact materials, and the infinite table plane.
 */
export function setupPhysics() {
    const world = new CANNON.World();

    // WHAT: Global Gravity Vector.
    // WHY: Increased to -40 for 'Heavy' cellulose acetate feel requested by Boss.
    world.gravity.set(0, -40, 0); 
    
    // WHAT: Physics Sleeping Optimization.
    // WHY: To save CPU/Battery by not simulating stationary objects.
    world.allowSleep = true;

    // WHAT: Default Contact Material.
    // WHY: Defines how objects bounce/slide by default.
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.55;

    // WHAT: Table "Floor" (Infinite Collision Plane).
    // WHY: Catches the dice at table height (y=4.0) to prevent them falling infinitely.
    // HOW: Rotates a static Plane 90 degrees to face 'Up'.
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); 
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    groundBody.position.set(0, 4.0, 0);
    world.addBody(groundBody);

    // WHAT: Circular Collision Rails (The "Cage").
    // WHY: Prevents dice from leaving the play area under normal velocity.
    // HOW: Uses 32 segmented boxes arranged in a circle.
    const numRails = 32;
    const railRadius = 6.8;
    const RAIL_HEIGHT = 0.5; 
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

    // WHAT: Dice Material System.
    // WHY: To define specific "Dice-on-Dice" interaction properties (clipping fix).
    // HOW: Assigns a unique ID to die bodies and a specific ContactMaterial rule.
    const diceMaterial = new CANNON.Material('dice');
    const diceContactMaterial = new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
        friction: 0.3,
        restitution: 0.5,
        contactEquationStiffness: 1e6,
        contactEquationRelaxation: 3
    });
    world.addContactMaterial(diceContactMaterial);

    return { world, diceMaterial };
}

/**
 * WHAT: Die Body Factory.
 * WHY: To create standardized cube colliders for every die in the pool.
 * @param {number} x - The starting X coordinate.
 * @param {CANNON.World} world - The physics world to add the body to.
 * @param {CANNON.Material} diceMaterial - The material definition.
 */
export function createDieBody(x, world, diceMaterial) {
    const body = new CANNON.Body({ 
        mass: 0, 
        type: CANNON.Body.STATIC,
        linearDamping: 0.1,
        angularDamping: 0.2,
        material: diceMaterial
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.095, 0.095, 0.095)));
    body.position.set(x, 8, 6);
    world.addBody(body);
    return body;
}
