import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const VB_W = 280;
const VB_H = 188;
/** Degrees: 0 = closed, negative = flap opened toward viewer */
const FLAP_OPEN_ROTATION = -168;
const FOLD_X = 140;
const FOLD_Y = 88;
const SEAL_CENTER_X = 140;
const SEAL_CENTER_Y = 56;

export type LuxuryEnvelopeHandle = {
  playCloseAndStamp: () => Promise<void>;
  resetToOpen: () => void;
};

const cream = "#F5EFE8";
const creamShadow = "#e8dfd4";
const letterFill = "#fffbf7";
const letterLine = "#e5ddd4";

type LuxuryEnvelopeProps = {
  variant: "interactive" | "sealed";
};

export const LuxuryEnvelope = forwardRef<LuxuryEnvelopeHandle, LuxuryEnvelopeProps>(
  function LuxuryEnvelope({ variant }, ref) {
    const uid = useId().replace(/:/g, "");
    const filterId = `luxury-env-sh-${uid}`;
    const gradId = `luxury-env-flap-${uid}`;
    const flapRef = useRef<SVGGElement>(null);
    const sealRef = useRef<SVGGElement>(null);

    useLayoutEffect(() => {
      if (variant !== "interactive") return;
      const flap = flapRef.current;
      const seal = sealRef.current;
      if (!flap || !seal) return;

      gsap.killTweensOf([flap, seal]);
      gsap.set(seal, { autoAlpha: 0, scale: 1, svgOrigin: `${SEAL_CENTER_X} ${SEAL_CENTER_Y}` });
      gsap.set(flap, { svgOrigin: `${FOLD_X} ${FOLD_Y}`, rotation: 0 });
      gsap.to(flap, {
        rotation: FLAP_OPEN_ROTATION,
        duration: 0.85,
        ease: "power2.out",
        delay: 0.12,
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
            gsap.set(seal, { svgOrigin: `${SEAL_CENTER_X} ${SEAL_CENTER_Y}` });

            const tl = gsap.timeline({
              onComplete: () => resolve(),
            });
            tl.to(flap, { rotation: 0, duration: 0.6, ease: "power2.inOut" })
              .set(seal, { autoAlpha: 1, scale: 1.3 }, "+=0")
              .to(seal, { scale: 1, duration: 0.45, ease: "power3.out" });
          }),
        resetToOpen: () => {
          if (variant !== "interactive") return;
          const flap = flapRef.current;
          const seal = sealRef.current;
          if (!flap || !seal) return;
          gsap.killTweensOf([flap, seal]);
          gsap.set(flap, { svgOrigin: `${FOLD_X} ${FOLD_Y}`, rotation: FLAP_OPEN_ROTATION });
          gsap.set(seal, { autoAlpha: 0, scale: 1, svgOrigin: `${SEAL_CENTER_X} ${SEAL_CENTER_Y}` });
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
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#3e342a" floodOpacity="0.12" />
          </filter>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#faf6f0" />
            <stop offset="100%" stopColor={cream} />
          </linearGradient>
        </defs>

        {/* Body */}
        <rect
          x="14"
          y={FOLD_Y}
          width="252"
          height="92"
          rx="4"
          fill={cream}
          stroke={creamShadow}
          strokeWidth="1.2"
        />

        {/* Letter */}
        <g filter={`url(#${filterId})`}>
          <rect
            x="28"
            y="102"
            width="224"
            height="68"
            rx="3"
            fill={letterFill}
            stroke={creamShadow}
            strokeWidth="0.9"
          />
          <line x1="48" y1="122" x2="232" y2="122" stroke={letterLine} strokeWidth="1.2" />
          <line x1="48" y1="138" x2="208" y2="138" stroke={letterLine} strokeWidth="1.2" />
          <line x1="48" y1="154" x2="188" y2="154" stroke={letterLine} strokeWidth="1.2" />
        </g>

        {/* Front pocket */}
        <path
          d="M 14 178 L 14 128 L 140 168 L 266 128 L 266 178 Z"
          fill="#ebe4db"
          stroke={creamShadow}
          strokeWidth="1"
          opacity={0.92}
        />

        {/* Top flap — decorative V / scalloped edge (rotation: interactive = GSAP only; sealed = closed) */}
        <g ref={variant === "interactive" ? flapRef : undefined}>
          <path
            d="
              M 14 88
              C 38 34 72 14 108 9
              C 118 7.5 128 7 140 7
              C 152 7 162 7.5 172 9
              C 208 14 242 34 266 88
              L 140 124
              Z
            "
            fill={`url(#${gradId})`}
            stroke={creamShadow}
            strokeWidth="1.1"
          />
          <path
            d="
              M 72 40 Q 104 22 140 20 Q 176 22 208 40
            "
            fill="none"
            stroke={creamShadow}
            strokeWidth="0.85"
            opacity={0.55}
          />
          <path
            d="
              M 96 52 Q 118 44 140 42 Q 162 44 184 52
            "
            fill="none"
            stroke={creamShadow}
            strokeWidth="0.65"
            opacity={0.4}
          />
        </g>

        {/* Wax seal — on top of closed flap; hidden until stamp in interactive mode */}
        <g ref={variant === "interactive" ? sealRef : undefined} transform={`translate(${SEAL_CENTER_X} ${SEAL_CENTER_Y})`}>
          <image href="/seal.png" x="-36" y="-36" width="72" height="72" />
        </g>
      </svg>
    );
  }
);
