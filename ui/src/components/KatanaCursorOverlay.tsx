import React, { useEffect, useRef } from "react";
import * as monacoPkg from "monaco-editor";

interface KatanaSlashStrike {
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  startTime: number;
  duration: number;
  glints: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
  }>;
}

interface KatanaCursorOverlayProps {
  editor: monacoPkg.editor.IStandaloneCodeEditor | null;
  enabled?: boolean;
}

export const KatanaCursorOverlay: React.FC<KatanaCursorOverlayProps> = ({
  editor,
  enabled = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!editor || !enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number | null = null;
    let isRunning = false;
    let lastTime = performance.now();

    // Target caret coordinates (true cursor position)
    let targetX = 0;
    let targetY = 0;
    let targetH = 20;
    let hasTarget = false;

    // Follower coordinates (smooth trailing katana blade)
    let trailX = 0;
    let trailY = 0;
    let trailH = 20;

    // Previous position for strike detection
    let prevX = 0;
    let prevY = 0;
    let prevH = 20;

    // Active slash strikes (from jumps / fast cursor moves)
    let strikes: KatanaSlashStrike[] = [];

    // Resize canvas to match editor viewport with device pixel ratio
    const resizeCanvas = () => {
      const domNode = editor.getDomNode();
      if (!domNode || !canvas) return;
      const rect = domNode.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    // Main render loop
    const render = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Frame-rate independent exponential follower physics
      // lambda = 18 s^-1 provides a crisp ~90ms responsive trailing delay
      const decay = 1 - Math.exp(-18 * dt);
      trailX += (targetX - trailX) * decay;
      trailY += (targetY - trailY) * decay;
      trailH += (targetH - trailH) * decay;

      const dx = targetX - trailX;
      const dy = targetY - trailY;
      const distTrail = Math.sqrt(dx * dx + dy * dy);

      // 1. Draw dynamic Katana Blade Trail connecting trail to target
      if (hasTarget && distTrail > 0.4) {
        ctx.save();
        ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
        ctx.shadowBlur = 6;

        // Gradient from needle-sharp trailing point to radiant leading cutting edge
        const grad = ctx.createLinearGradient(trailX, trailY, targetX, targetY);
        grad.addColorStop(0, "rgba(255, 255, 255, 0)");
        grad.addColorStop(0.25, "rgba(224, 242, 254, 0.35)");
        grad.addColorStop(0.8, "rgba(255, 255, 255, 0.85)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0.95)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Leading edge top corner
        ctx.moveTo(targetX, targetY);
        // Tapered curve to trailing point
        ctx.quadraticCurveTo(
          (targetX + trailX) * 0.5,
          targetY + targetH * 0.15,
          trailX,
          trailY + trailH * 0.5
        );
        // Tapered curve back to leading edge bottom corner
        ctx.quadraticCurveTo(
          (targetX + trailX) * 0.5,
          targetY + targetH * 0.85,
          targetX,
          targetY + targetH
        );
        ctx.closePath();
        ctx.fill();

        // White-hot cutting edge line along central blade spine
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(trailX, trailY + trailH * 0.5);
        ctx.lineTo(targetX, targetY + targetH * 0.5);
        ctx.stroke();

        // Radiant leading edge (the cursor caret itself)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(targetX, targetY + targetH);
        ctx.stroke();

        ctx.restore();
      }

      // 2. Render active Katana Slash Strikes (curved sori cuts with microscopic glints)
      if (strikes.length > 0) {
        strikes = strikes.filter((strike) => {
          const age = now - strike.startTime;
          const progress = age / strike.duration;
          if (progress >= 1) return false;

          const alpha = Math.pow(1 - progress, 2); // Quadratic fade

          ctx.save();
          ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
          ctx.shadowBlur = 8 * alpha;

          // Central razor-sharp blade slash line
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
          ctx.lineWidth = Math.max(0.6, 2.4 * (1 - progress * 0.5));
          ctx.lineCap = "round";

          ctx.beginPath();
          ctx.moveTo(strike.startX, strike.startY);
          ctx.quadraticCurveTo(strike.ctrlX, strike.ctrlY, strike.endX, strike.endY);
          ctx.stroke();

          // Subtle silver-cyan luminous halo
          ctx.strokeStyle = `rgba(200, 240, 255, ${0.35 * alpha})`;
          ctx.lineWidth = Math.max(1.2, 5.0 * (1 - progress * 0.4));
          ctx.stroke();

          // Microscopic light glints (2-3 tiny specks)
          for (const glint of strike.glints) {
            const gAlpha = alpha * Math.max(0, 1 - progress / glint.life);
            if (gAlpha > 0.05) {
              const gx = glint.x + glint.vx * age * 0.035;
              const gy = glint.y + glint.vy * age * 0.035;
              ctx.fillStyle = `rgba(255, 255, 255, ${gAlpha})`;
              ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
            }
          }

          ctx.restore();
          return true;
        });
      }

      ctx.restore();

      // Check if motion and strikes have settled to sleep loop
      if (distTrail < 0.25 && strikes.length === 0) {
        trailX = targetX;
        trailY = targetY;
        trailH = targetH;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isRunning = false;
        animFrameId = null;
        return;
      }

      animFrameId = requestAnimationFrame(render);
    };

    // Awaken animation loop if stopped
    const wakeLoop = () => {
      if (!isRunning) {
        isRunning = true;
        lastTime = performance.now();
        animFrameId = requestAnimationFrame(render);
      }
    };

    // Update cursor position and trigger slash physics
    const updateCursorPosition = (isScroll = false) => {
      const pos = editor.getPosition();
      if (!pos) return;

      const visiblePos = editor.getScrolledVisiblePosition(pos);
      if (!visiblePos) return;

      const newTargetX = visiblePos.left;
      const newTargetY = visiblePos.top;
      const newTargetH = visiblePos.height || 20;

      if (!hasTarget) {
        targetX = newTargetX;
        targetY = newTargetY;
        targetH = newTargetH;
        trailX = newTargetX;
        trailY = newTargetY;
        trailH = newTargetH;
        prevX = newTargetX;
        prevY = newTargetY;
        prevH = newTargetH;
        hasTarget = true;
        return;
      }

      // If scrolling significantly, snap follower to avoid cross-viewport sweeps
      if (isScroll) {
        const scrollDist = Math.abs(newTargetY - targetY);
        if (scrollDist > 30) {
          trailX = newTargetX;
          trailY = newTargetY;
          trailH = newTargetH;
          strikes = [];
        }
        targetX = newTargetX;
        targetY = newTargetY;
        targetH = newTargetH;
        prevX = newTargetX;
        prevY = newTargetY;
        prevH = newTargetH;
        wakeLoop();
        return;
      }

      const moveDx = newTargetX - prevX;
      const moveDy = newTargetY - prevY;
      const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

      // Trigger Katana Slash Strike when jumping or moving fast (distance > 12px)
      if (moveDist > 12) {
        const startX = prevX;
        const startY = prevY + prevH * 0.5;
        const endX = newTargetX;
        const endY = newTargetY + newTargetH * 0.5;

        // Katana sori curvature (subtle natural blade arc perpendicular to stroke)
        const perpX = -moveDy / moveDist;
        const perpY = moveDx / moveDist;
        const curveOffset = Math.min(6, Math.max(2, moveDist * 0.06));

        const ctrlX = (startX + endX) * 0.5 + perpX * curveOffset;
        const ctrlY = (startY + endY) * 0.5 + perpY * curveOffset;

        // Generate 2-3 microscopic cutting glints
        const glints = [];
        const numGlints = Math.min(3, Math.max(1, Math.floor(moveDist / 25)));
        for (let i = 0; i < numGlints; i++) {
          const ratio = (i + 1) / (numGlints + 1);
          glints.push({
            x: startX + moveDx * ratio,
            y: startY + moveDy * ratio,
            vx: (Math.random() - 0.5) * 1.5 + perpX * 0.5,
            vy: (Math.random() - 0.5) * 1.5 + perpY * 0.5,
            life: 0.7 + Math.random() * 0.3
          });
        }

        strikes.push({
          startX,
          startY,
          ctrlX,
          ctrlY,
          endX,
          endY,
          startTime: performance.now(),
          duration: 180, // 180ms crisp katana strike duration
          glints
        });
      }

      prevX = targetX;
      prevY = targetY;
      prevH = targetH;

      targetX = newTargetX;
      targetY = newTargetY;
      targetH = newTargetH;

      wakeLoop();
    };

    // Initialize dimensions and initial cursor position
    resizeCanvas();
    updateCursorPosition();

    // Event subscriptions
    const cursorSub = editor.onDidChangeCursorPosition(() => {
      updateCursorPosition(false);
    });

    const scrollSub = editor.onDidScrollChange(() => {
      updateCursorPosition(true);
    });

    const layoutSub = editor.onDidLayoutChange(() => {
      resizeCanvas();
      updateCursorPosition(true);
    });

    return () => {
      cursorSub.dispose();
      scrollSub.dispose();
      layoutSub.dispose();
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      if (canvas) {
        const c = canvas.getContext("2d");
        c?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [editor, enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="katana-cursor-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 10,
        imageRendering: "pixelated"
      }}
    />
  );
};
