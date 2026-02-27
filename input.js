export function setupInputHandlers(gameState, throwDice) {
    const keys = {};
    let isLeftDown = false;
    let isRightDown = false;
    let movement = { x: 0, y: 0 };

    window.addEventListener('devicemotion', (e) => {
        if (gameState() !== 'READY' && gameState() !== 'SHAKING' && gameState() !== 'CHALLENGE_READY') return;
        const a = e.accelerationIncludingGravity; if (!a) return;
        const currentMag = Math.sqrt(a.x**2 + a.y**2 + a.z**2);
        // We'll need to pass accelMag back or handle it here
    });

    window.onmousedown = (e) => {
        if ((gameState() === 'READY' || gameState() === 'CHALLENGE_READY') && e.target.tagName !== 'BUTTON') {
            throwDice();
        }
    };

    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) isLeftDown = true;
        if (e.button === 2) isRightDown = true;
    });
    
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) isLeftDown = false;
        if (e.button === 2) isRightDown = false;
    });

    window.addEventListener('mousemove', (e) => {
        movement.x = e.movementX;
        movement.y = e.movementY;
    });

    window.addEventListener('wheel', (e) => {
        // Handle zoom logic if needed, or pass delta
    });

    return { keys, isLeftDown, isRightDown, movement };
}
