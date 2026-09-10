"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { ArrowRight, Sparkles, Undo2 } from "lucide-react";

const WORDS = ["sketch", "diagram", "brainstorm", "wireframe"];
const COLORS = ["#F3EFE6", "#3B5BFF", "#FFB020", "#FF5D5D"];

function MagneticButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className: string;
  href: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left - rect.width / 2) * 0.25);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.25);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.a>
  );
}

function LiveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState(COLORS[1]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext("2d");
      ctx?.scale(2, 2);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const point = "touches" in e ? (e.touches[0] ?? e.changedTouches?.[0]) : e;
    if (!point) return last.current;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.strokeStyle = color as string;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="h-64 w-full cursor-crosshair touch-none rounded-2xl bg-[#0F1114] sm:h-80"
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full transition-transform ${
              color === c ? "scale-110 ring-2 ring-white/60" : ""
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Use color ${c}`}
          />
        ))}
        <button
          onClick={clear}
          className="ml-1 flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/70 hover:text-white"
        >
          <Undo2 size={13} /> Clear
        </button>
      </div>
    </div>
  );
}

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-20 lg:px-16">
      {/* ambient mesh glow */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-[#3B5BFF]/20 blur-[120px] dark:bg-[#3B5BFF]/25" />
      <div className="pointer-events-none absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-[#FFB020]/10 blur-[120px] dark:bg-[#FFB020]/15" />

      {/* grid, swapped per theme */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(#14171B 1px, transparent 1px), linear-gradient(90deg, #14171B 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden opacity-[0.05] dark:block"
        style={{
          backgroundImage:
            "linear-gradient(#F3EFE6 1px, transparent 1px), linear-gradient(90deg, #F3EFE6 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative grid w-full max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
        {/* left: copy */}
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3.5 py-1.5 text-xs text-[#14171B]/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#F3EFE6]/80"
          >
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Sparkles size={13} className="text-[#FFB020]" />
            </motion.span>
            Every stroke syncs in real time
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl leading-[1.1] text-[#14171B] sm:text-5xl lg:text-6xl dark:text-[#F3EFE6]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            A room to{" "}
            <span className="relative inline-block bg-gradient-to-r from-[#3B5BFF] to-[#8AA0FF] bg-clip-text text-transparent">
              {WORDS[wordIndex]}
            </span>
            <br />
            with anyone, anywhere.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-md text-base text-[#14171B]/60 dark:text-[#F3EFE6]/60 lg:text-lg"
          >
            Open a room, share the link, and watch every line appear live for
            everyone in it. No installs, no setup — just draw.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <MagneticButton
              href="/signup"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[#14171B] px-6 py-3 font-medium text-[#F3EFE6] dark:bg-[#F3EFE6] dark:text-[#14171B]"
            >
              <span className="relative z-10">Create an account</span>
              <ArrowRight
                size={16}
                className="relative z-10 transition-transform group-hover:translate-x-1"
              />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </MagneticButton>

            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3 font-medium text-[#14171B] transition-colors hover:border-black/40 dark:border-white/15 dark:text-[#F3EFE6] dark:hover:border-white/40"
            >
              Sign in
            </Link>
          </motion.div>
        </div>

        {/* right: live interactive demo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-3xl border border-black/10 bg-black/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5D5D]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFB020]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#3B5BFF]/70" />
              </div>
              <span
                className="text-xs text-[#14171B]/40 dark:text-[#F3EFE6]/40"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                try it — draw below
              </span>
            </div>
            <LiveCanvas />
          </div>

          {/* floating presence chip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="absolute -right-4 -top-4 flex items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-[#14171B]/80 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#14171B]/90 dark:text-[#F3EFE6]/80"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ADE80]" />
            live sync
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}