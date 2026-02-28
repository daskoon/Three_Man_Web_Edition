// --- LOGGING SYSTEM ---
const gameLogs = [];
export const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    gameLogs.push(`[${t}] ${msg}`);
    console.log(msg);
};

export const initLogButton = (buttonId) => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.onclick = () => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `3man-session-log-${timeStr}.txt`;
        const blob = new Blob([gameLogs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        a.click();
        gameLogs.length = 0;
        log("LOGS DOWNLOADED - BUFFER TRUNCATED");
    };
};
