"use client";

import { useEffect, useRef } from "react";

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  wind: number;
  opacity: number;
  velX: number;
  velY: number;
}

interface SnowfallProps {
  snowflakeCount?: number;
  speed?: { min: number; max: number };
  wind?: { min: number; max: number };
  size?: { min: number; max: number };
  opacity?: { min: number; max: number };
  fps?: number;
  followMouse?: boolean;
}

const random = (min: number, max: number) => Math.random() * (max - min) + min;

const createSnowflake = (
  canvasWidth: number,
  canvasHeight: number,
  config: {
    size: { min: number; max: number };
    speed: { min: number; max: number };
    wind: { min: number; max: number };
    opacity: { min: number; max: number };
  }
): Snowflake => ({
  x: random(0, canvasWidth),
  y: random(0, canvasHeight),
  size: random(config.size.min, config.size.max),
  speed: random(config.speed.min, config.speed.max),
  wind: random(config.wind.min, config.wind.max),
  opacity: random(config.opacity.min, config.opacity.max),
  velX: 0,
  velY: 0,
});

const applyMouseInteraction = (
  flake: Snowflake,
  mouse: { x: number; y: number }
) => {
  const dx = mouse.x - flake.x;
  const dy = mouse.y - flake.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 150) {
    const force = ((150 - dist) / 150) * 0.001;
    flake.velX += dx * force;
    flake.velY += dy * force;
  }

  flake.velX *= 0.98;
  flake.velY *= 0.98;
};

const updateSnowflakePosition = (
  flake: Snowflake,
  canvasWidth: number,
  canvasHeight: number
) => {
  flake.y += flake.speed + flake.velY;
  flake.x += flake.wind + flake.velX;

  if (flake.y > canvasHeight) {
    flake.y = -flake.size;
    flake.x = random(0, canvasWidth);
  }
  if (flake.x > canvasWidth) {
    flake.x = -flake.size;
  }
  if (flake.x < -flake.size) {
    flake.x = canvasWidth;
  }
};

const drawSnowflake = (ctx: CanvasRenderingContext2D, flake: Snowflake) => {
  ctx.save();
  ctx.globalAlpha = flake.opacity;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(flake.x, flake.y, flake.size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export function Snowfall({
  snowflakeCount = 50,
  speed = { min: 1, max: 3 },
  wind = { min: -0.5, max: 0.5 },
  size = { min: 1, max: 7 },
  opacity = { min: 0.1, max: 0.8 },
  followMouse = true,
  fps = 70,
}: SnowfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snowflakesRef = useRef<Snowflake[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { signal });

    snowflakesRef.current = Array.from({ length: snowflakeCount }, () =>
      createSnowflake(canvas.width, canvas.height, {
        size,
        speed,
        wind,
        opacity,
      })
    );

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    if (followMouse) {
      window.addEventListener("mousemove", handleMouseMove, { signal });
    }

    let lastTime = 0;
    const frameInterval = 1000 / fps;
    let animationId: number;

    const animate = (currentTime: number) => {
      if (currentTime - lastTime < frameInterval) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastTime = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const flake of snowflakesRef.current) {
        if (followMouse) {
          applyMouseInteraction(flake, mouseRef.current);
        }

        updateSnowflakePosition(flake, canvas.width, canvas.height);
        drawSnowflake(ctx, flake);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      abortController.abort();
      cancelAnimationFrame(animationId);
    };
  }, [snowflakeCount, speed, wind, size, opacity, fps, followMouse]);

  return (
    <canvas
      className="pointer-events-none fixed inset-0"
      ref={canvasRef}
      style={{ zIndex: 1000 }}
    />
  );
}
