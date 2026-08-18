"use client";

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";

type Props = { children: ReactNode; className?: string; padLeft?: number };

export function ScrollCarousel({ children, className = "", padLeft = 24 }: Props) {
  const swiperRef = useRef<SwiperType | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  // Use ref for gradient to avoid re-renders during drag
  const rafRef = useRef<number>(0);

  const checkGradient = useCallback(() => {
    const s = swiperRef.current;
    if (!s) return;
    setCanLeft(!s.isBeginning);
    setCanRight(!s.isEnd);
  }, []);

  // Debounced gradient check — only updates state when scroll stops
  const scheduleCheck = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(checkGradient);
    });
  }, [checkGradient]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const onSwiper = useCallback((s: SwiperType) => {
    swiperRef.current = s;
    checkGradient();
  }, [checkGradient]);

  const items = React.Children.toArray(children);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 72, zIndex: 3,
        pointerEvents: "none",
        background: "linear-gradient(90deg, #0d1219 20%, transparent 100%)",
        opacity: canLeft ? 1 : 0, transition: "opacity .25s ease",
      }} />
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, right: 0, width: 72, zIndex: 3,
        pointerEvents: "none",
        background: "linear-gradient(270deg, #0d1219 20%, transparent 100%)",
        opacity: canRight ? 1 : 0, transition: "opacity .25s ease",
      }} />
      <Swiper
        modules={[FreeMode, Mousewheel]}
        slidesPerView="auto"
        spaceBetween={12}
        freeMode={{
          enabled: true,
          momentum: true,
          momentumRatio: 0.4,
          momentumVelocityRatio: 0.5,
          momentumBounce: false,
        }}
        mousewheel={{ forceToAxis: true }}
        grabCursor={true}
        onSwiper={onSwiper}
        onSlideChange={scheduleCheck}
        onTransitionEnd={checkGradient}
        resistanceRatio={0.95}
        touchMoveStopPropagation={true}
        preventClicks={false}
        preventClicksPropagation={false}
        shortSwipes={true}
        longSwipes={false}
        speed={300}
        style={{ overflow: "hidden", paddingLeft: padLeft }}
      >
        {items.map((child, i) => (
          <SwiperSlide key={i} style={{ width: "auto" }}>
            {child}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}