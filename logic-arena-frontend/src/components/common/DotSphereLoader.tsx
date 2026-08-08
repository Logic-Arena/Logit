import { useEffect, useRef } from "react";

interface DotSphereLoaderProps {
  /** 캔버스 한 변의 픽셀 크기 (정사각형). 기본 320 */
  size?: number;
  /** 회전 속도 (라디안/프레임). 클수록 빠름. 기본 0.01 */
  speed?: number;
  /** 일렁임 속도. 클수록 빠르게 출렁임. 기본 0.035 */
  wobbleSpeed?: number;
  /** 일렁임 강도(반지름 변동 비율). 기본 0.10 */
  wobbleAmount?: number;
  /** 점 최대 크기 배수. 기본 1.5 */
  dotScale?: number;
  /** 점/선 색상의 HSL hue. 보라색 계열 기본 243 (#6c63ff) */
  hue?: number;
  className?: string;
}

interface Pt {
  x: number;
  y: number;
  z: number;
  sz: number; // 점 기본 크기 (랜덤)
  ph: number; // 일렁임 위상 (랜덤)
}

/**
 * 로딩 중 자동으로 회전하는 "일렁이는 점 구체" 비주얼.
 * - 크기가 무작위인 작은 점들로 구체 표면을 표현.
 * - 표면 반지름이 노이즈+시간에 따라 출렁이며 일렁이는 느낌.
 * - 인터랙션 없음(클릭/호버/드래그 X). 자동 회전 + 일렁임만 수행.
 * - 다크모드 자동 대응, 레티나 대응, 안티에일리어싱 처리.
 */
export default function DotSphereLoader({
  size = 320,
  speed = 0.01,
  wobbleSpeed = 0.035,
  wobbleAmount = 0.1,
  dotScale = 1.5,
  hue = 243,
  className,
}: DotSphereLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const W = size;
    const H = size;
    const cx = W / 2;
    const cy = H / 2;
    const baseRadius = size * 0.3; // 320 기준 96px

    const isDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    // 구체 표면 점 격자 생성 (점마다 랜덤 크기/위상 부여)
    const latSteps = 46;
    const lonSteps = 72;
    const points: Pt[] = [];
    for (let i = 0; i <= latSteps; i++) {
      const theta = (Math.PI * i) / latSteps;
      const ringRadius = Math.sin(theta);
      const y = Math.cos(theta);
      const lonCount = Math.max(6, Math.round(lonSteps * ringRadius));
      for (let j = 0; j < lonCount; j++) {
        const phi =
          (2 * Math.PI * j) / lonCount + (i % 2) * (Math.PI / lonCount);
        points.push({
          x: ringRadius * Math.cos(phi),
          y,
          z: ringRadius * Math.sin(phi),
          // 아주 작은 점이 많고 큰 점은 드물게 (곱셈으로 작은 쪽 치우침)
          sz: 0.25 + Math.random() * Math.random() * dotScale,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }

    const noise3 = (x: number, y: number, z: number) =>
      (Math.sin(x * 3.1 + y * 1.7) +
        Math.sin(y * 2.3 + z * 2.9) +
        Math.sin(z * 3.7 + x * 1.3)) /
      3;

    const rotate = (p: Pt, ax: number, ay: number) => {
      const cosA = Math.cos(ax);
      const sinA = Math.sin(ax);
      const y1 = p.y * cosA - p.z * sinA;
      const z1 = p.y * sinA + p.z * cosA;
      const cosB = Math.cos(ay);
      const sinB = Math.sin(ay);
      const x1 = p.x * cosB + z1 * sinB;
      const z2 = -p.x * sinB + z1 * cosB;
      return { x: x1, y: y1, z: z2 };
    };

    let rotY = 0;
    const rotX = 0.18;
    let t = 0;
    let raf = 0;

    const persp = 440;
    const camDist = 360;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      rotY += speed;
      t += wobbleSpeed;

      const list: {
        sx: number;
        sy: number;
        depth: number;
        sz: number;
        z: number;
      }[] = [];

      for (let k = 0; k < points.length; k++) {
        const p = points[k];
        // 표면 일렁임: 노이즈 + 개별 점 위상에 따른 미세 진동
        const n = noise3(
          p.x * 2.2 + Math.cos(t) * 0.6,
          p.y * 2.2 + t * 0.3,
          p.z * 2.2 + Math.sin(t) * 0.6
        );
        const wobble =
          1 + n * wobbleAmount + Math.sin(t * 1.6 + p.ph) * 0.025;
        const rad = baseRadius * wobble;

        const r = rotate(p, rotX, rotY);
        const px = r.x * rad;
        const py = r.y * rad;
        const pz = r.z * rad;
        const scale = persp / (camDist + pz);
        const sx = cx + px * scale;
        const sy = cy + py * scale;

        const depth = (pz / baseRadius + 1) / 2; // 0(뒤) ~ 1(앞)
        list.push({ sx, sy, depth, sz: p.sz * scale, z: pz });
      }

      // 뒤쪽 먼저 그려서 깊이감 부여
      list.sort((a, b) => a.z - b.z);

      for (let m = 0; m < list.length; m++) {
        const d = list[m];
        const alpha = 0.15 + d.depth * 0.8;
        const light = isDark ? 40 + d.depth * 50 : 28 + d.depth * 42;
        ctx.fillStyle = `hsla(${hue}, 60%, ${light}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, Math.max(0.2, d.sz), 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(raf);
  }, [size, speed, wobbleSpeed, wobbleAmount, dotScale, hue]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="로딩 중"
      className={className}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
