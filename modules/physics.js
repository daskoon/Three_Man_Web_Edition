/**
 * @file physics.js
 * @description Core physics engine configuration using Cannon-es.
 * 
 * WHO: Principal Architect (Agent) & The Boss (Skoon).
 * WHAT: This module initializes the 3D physics world, handles collision detection, 
 * and defines the physical bodies for the dice and the table environment.
 * WHY: Separation of physics from rendering ensures stable simulation and 
 * allows for high-precision sub-stepping independent of frame rate.
 * HOW: Initializes a `CANNON.World` with high-velocity resolution. Maps rigid bodies to meshes using a 1:1 coordinate system. Implements `ContactMaterial` overrides to define precise friction/bounciness ratios for specific object pairs (e.g. Dice-on-Dice vs Dice-on-Table).
 * WHEN: Initialized on application start; stepped in every frame of the animate loop.
 * WHERE: Logic core for physical interactions within the WebGL scene.
 */

import * as CANNON from 'cannon-es';

/**
 * WHAT: World Setup Function.
 * WHY: To create the physical 'reality' where the dice exist.
 * HOW: 1. Configures global gravity vector. 2. Sets `allowSleep` to true for CPU efficiency. 3. Configures default contact material properties. 4. Generates a static `CANNON.Plane` for the table surface and 32 `CANNON.Box` segments for the circular rails.
 */
export function setupPhysics() {
    const world = new CANNON.World();

    // WHAT: Global Gravity Vector.
    // WHY: Increased to -40 for 'Heavy' cellulose acetate feel requested by Boss.
    world.gravity.set(0, -40, 0); 
    
    // WHAT: Physics Sleeping Optimization.
    world.allowSleep = true;

    // WHAT: Default Contact Material.
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.55;

    // WHAT: Table "Floor" (Infinite Collision Plane).
    // WHY: Catches the dice at table height (y=4.0).
    // HOW: Transforms a local `CANNON.Plane` by a -90 degree X-axis rotation using a `CANNON.Quaternion` to align it with the horizontal grid.
    const groundBody = new CANNON.Body({ mass: 0 });
    const groundShape = new CANNON.Plane();
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); 
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), quat);
    groundBody.position.set(0, 4.0, 0);
    world.addBody(groundBody);

    // WHAT: Circular Collision Rails (The "Cage").
    // WHY: Prevents dice from leaving the table.
    // HOW: Distributes 32 static box colliders in a circle of radius 6.8. Each box is rotated around the Y-axis to face the center using `setFromAxisAngle`.
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
    // HOW: Creates a custom `CANNON.Material`. Defines a `ContactMaterial` with a high `contactEquationStiffness` (1e6) to ensure dice bounce off each other physically rather than overlapping.
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
 * HOW: Instantiates a `CANNON.Body` with `mass = 0` (Static) by default. Assigns a `CANNON.Box` shape with half-extents matching the 19mm visual scale.
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
