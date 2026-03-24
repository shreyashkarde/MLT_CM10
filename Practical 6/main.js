/**
 * CREATIVE POSE & GESTURE ENGINE
 * Features: Confidence filtering, Pose Smoothing, and Canvas HUD
 */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const poseText = document.getElementById("poseText");
const gestureText = document.getElementById("gestureText");

let detector;
let lastPose = "Detecting...";
let poseBuffer = []; // For smoothing out jitter

// --- CONFIGURATION ---
const THEMES = {
    "🙌 Hands Up": { color: "#00ff88", label: "ZEN MODE" },
    "🧍 T-Pose": { color: "#ff0055", label: "COMMAND" },
    "🏋️ Squat": { color: "#00d4ff", label: "POWER" },
    "🪑 Sitting": { color: "#ffcc00", label: "IDLE" },
    "🧍 Standing": { color: "#ffffff", label: "READY" }
};

// --- CAMERA SETUP ---
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
    });
    video.srcObject = stream;
    return new Promise(r => video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        r();
    });
}

// --- CREATIVE DRAWING ---
function drawVisuals(keypoints, poseName) {
    const theme = THEMES[poseName] || { color: "#ffffff" };
    
    // 1. Draw Skeleton with Neon Glow
    const pairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = theme.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.color;

    pairs.forEach(([i, j]) => {
        const a = keypoints[i], b = keypoints[j];
        if (a.score > 0.4 && b.score > 0.4) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    });

    // 2. Draw Keypoints (Data Nodes)
    keypoints.forEach(k => {
        if (k.score > 0.4) {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(k.x, k.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    // 3. Digital HUD Overlay
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(20, 20, 200, 60);
    ctx.strokeStyle = theme.color;
    ctx.strokeRect(20, 20, 200, 60);
    
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = theme.color;
    ctx.fillText(poseName.toUpperCase(), 35, 45);
    ctx.font = "10px monospace";
    ctx.fillText("SYSTEM ACTIVE // 60FPS", 35, 65);
}

// --- MATH & LOGIC ---
function getAngle(A, B, C) {
    const AB = Math.hypot(A.x - B.x, A.y - B.y);
    const BC = Math.hypot(C.x - B.x, C.y - B.y);
    const AC = Math.hypot(A.x - C.x, A.y - C.y);
    // Law of Cosines
    return Math.acos((AB**2 + BC**2 - AC**2) / (2 * AB * BC)) * (180 / Math.PI);
}

function detectPoseType(keypoints) {
    const kp = {};
    keypoints.forEach(k => kp[k.name] = k);

    // Basic Validation
    if (!kp.left_shoulder || !kp.left_hip || !kp.left_knee) return "Detecting...";

    // 1. Hands Up (Check wrist relative to eyes for more "fun" accuracy)
    if (kp.left_wrist?.y < kp.left_eye?.y && kp.right_wrist?.y < kp.right_eye?.y) 
        return "🙌 Hands Up";

    // 2. T-Pose (Check horizontal alignment)
    const armSpan = Math.abs(kp.left_wrist?.y - kp.left_shoulder?.y);
    if (armSpan < 40 && Math.abs(kp.right_wrist?.y - kp.right_shoulder?.y) < 40)
        return "🧍 T-Pose";

    // 3. Legs Logic
    const kneeAngle = getAngle(kp.left_hip, kp.left_knee, kp.left_ankle);
    if (kneeAngle < 110) return "🏋️ Squat";
    if (kp.left_hip.y > kp.right_shoulder.y + 150 && kneeAngle < 150) return "🪑 Sitting";

    return "🧍 Standing";
}

// --- CORE ENGINE ---
async function detect() {
    ctx.save();
    // Mirror the video for more intuitive movement
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    try {
        const poses = await detector.estimatePoses(video);
        if (poses.length > 0) {
            const rawPose = detectPoseType(poses[0].keypoints);
            
            // Simple smoothing: Only update if pose persists for 3 frames
            poseBuffer.push(rawPose);
            if (poseBuffer.length > 3) poseBuffer.shift();
            const smoothedPose = poseBuffer.every(v => v === poseBuffer[0]) ? poseBuffer[0] : lastPose;
            
            lastPose = smoothedPose;
            drawVisuals(poses[0].keypoints, smoothedPose);

            // Update UI
            poseText.innerText = `Status: ${smoothedPose}`;
            gestureText.innerText = `Action: ${getGestureAction(smoothedPose)}`;
        }
    } catch (err) {
        console.warn("Detection pause...");
    }

    requestAnimationFrame(detect);
}

function getGestureAction(pose) {
    const actions = {
        "🙌 Hands Up": "▶️ MEDIA: PLAY",
        "🧍 T-Pose": "🖥️ SYSTEM: OPEN TERMINAL",
        "🏋️ Squat": "🔉 VOL: DOWN",
        "🪑 Sitting": "💤 MODE: SLEEP"
    };
    return actions[pose] || "Waiting...";
}

async function start() {
    await setupCamera();
    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    detect();
}

start();