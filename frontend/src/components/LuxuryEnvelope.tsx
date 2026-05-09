import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const VB_W = 280;
const VB_H = 175;

/** Fold line: flap pivots here (center-bottom of triangle) */
const FOLD_X = 140;
const FOLD_Y = 86;

/** Simple V flap: tip up, base along fold */
const FLAP_PATH = `M 24 ${FOLD_Y} L ${FOLD_X} 14 L 256 ${FOLD_Y} Z`;

/** Wax seal centered on flap when closed */
const SEAL_SIZE = 72;
const SEAL_CX = FOLD_X;
const SEAL_CY = Math.round((FOLD_Y + 14) / 2); // ~50 — mid flap

/** Open: flap swings up (negative = CCW in SVG) */
const FLAP_OPEN_DEG = -158;

const cream = "#F5EFE8";
const strokeCol = "#d8cfc4";

export type LuxuryEnvelopeHandle = {
  playCloseAndStamp: () => Promise<void>;
  resetToOpen: () => void;
};

type LuxuryEnvelopeProps = {
  variant: "interactive" | "sealed";
};

function sealImageAttrs() {
  const x = SEAL_CX - SEAL_SIZE / 2;
  const y = SEAL_CY - SEAL_SIZE / 2;
  return { x, y, width: SEAL_SIZE, height: SEAL_SIZE };
}

export const LuxuryEnvelope = forwardRef<LuxuryEnvelopeHandle, LuxuryEnvelopeProps>(
  function LuxuryEnvelope({ variant }, ref) {
    const flapRef = useRef<SVGGElement>(null);
    const sealRef = useRef<SVGGElement>(null);
    const sealAttrs = sealImageAttrs();

    useLayoutEffect(() => {
      if (variant !== "interactive") return;
      const flap = flapRef.current;
      const seal = sealRef.current;
      if (!flap || !seal) return;

      gsap.killTweensOf([flap, seal]);
      gsap.set(seal, { opacity: 0, scale: 1, svgOrigin: `${SEAL_CX} ${SEAL_CY}` });
      gsap.set(flap, { svgOrigin: `${FOLD_X} ${FOLD_Y}`, rotation: 0 });
      gsap.to(flap, {
        rotation: FLAP_OPEN_DEG,
        duration: 0.75,
        ease: "power2.out",
        delay: 0.1,
      });
    }, [variant]);

    useImperativeHandle(
      ref,
      () => ({
        playCloseAndStamp: () =>
          new Promise<void>((resolve) => {
            if (variant !== "interactive") {
              resolve();
              return;
            }
            const flap = flapRef.current;
            const seal = sealRef.current;
            if (!flap || !seal) {
              resolve();
              return;
            }
            gsap.killTweensOf([flap, seal]);
            gsap.set(flap, { svgOrigin: `${FOLD_X} ${FOLD_Y}` });
            gsap.set(seal, { svgOrigin: `${SEAL_CX} ${SEAL_CY}` });

            const tl = gsap.timeline({ onComplete: () => resolve() });
            tl.to(flap, { rotation: 0, duration: 0.6, ease: "power2.inOut" })
              .set(seal, { opacity: 1, scale: 1.35 })
              .to(seal, { scale: 1, duration: 0.4, ease: "power3.out" });
          }),
        resetToOpen: () => {
          if (variant !== "interactive") return;
          const flap = flapRef.current;
          const seal = sealRef.current;
          if (!flap || !seal) return;
          gsap.killTweensOf([flap, seal]);
          gsap.set(flap, { svgOrigin: `${FOLD_X} ${FOLD_Y}`, rotation: FLAP_OPEN_DEG });
          gsap.set(seal, { opacity: 0, scale: 1, svgOrigin: `${SEAL_CX} ${SEAL_CY}` });
        },
      }),
      [variant]
    );

    const isSealed = variant === "sealed";

    return (
      <svg
        className="luxury-envelope__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={VB_W}
        height={VB_H}
        role="img"
        aria-label={isSealed ? "Sealed envelope" : "Envelope preview"}
      >
        {/* Body */}
        <rect
          x="24"
          y={FOLD_Y}
          width="232"
          height="78"
          rx="3"
          fill={cream}
          stroke={strokeCol}
          strokeWidth="1.25"
        />

        {/* Letter (visible when flap is open) */}
        <rect
          x="38"
          y="96"
          width="204"
          height="52"
          rx="2"
          fill="#fffdf9"
          stroke={strokeCol}
          strokeWidth="0.75"
          opacity={0.95}
        />

        {/* V flap */}
        <g ref={variant === "interactive" ? flapRef : undefined}>
          <path d={FLAP_PATH} fill={cream} stroke={strokeCol} strokeWidth="1.25" strokeLinejoin="round" />
        </g>

        {/* Seal on top of flap */}
        {isSealed ? (
          <image
            href="/seal.png"
            {...sealAttrs}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <g ref={sealRef}>
            <image
              href="/seal.png"
              {...sealAttrs}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}
      </svg>
    );
  }
);
