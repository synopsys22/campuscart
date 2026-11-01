import { useAutoAnimate } from '@formkit/auto-animate/react';
import { animate, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

// One rhythm for the whole site: things arrive quickly and settle gently.
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const SPRING = { type: 'spring', stiffness: 420, damping: 32 };

/**
 * Fades content up as it scrolls into view, once. With reduced motion it is simply there,
 * so nothing can ever be left waiting to appear.
 */
export function Reveal({ as = 'div', delay = 0, className = '', children, ...props }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={`reveal ${className}`}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** A short delay per position in a row, so a grid arrives as a wave and never drags. */
export const staggerDelay = (index, perRow = 4) => (index % perRow) * 0.05;

/** Fades in the content of a new page or checkout step. */
export function Enter({ from = { y: 10 }, delay = 0, className, children, ...props }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, ...from }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Rolls a figure to its new value. The final value is always exact. */
export function AnimatedNumber({ value, format = String, countUp = false }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(countUp && !reduce ? 0 : value);
  const current = useRef(shown);

  useEffect(() => {
    if (reduce || current.current === value) {
      current.current = value;
      setShown(value);
      return undefined;
    }
    const controls = animate(current.current, value, {
      duration: 0.6,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        current.current = Math.round(latest);
        setShown(current.current);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return format(shown);
}

/** A bar that grows from its left edge when it comes into view. */
export function GrowBar({ percent, color }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      style={{ width: `${percent}%`, background: color, originX: 0 }}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
    />
  );
}

/** The confirmation tick on the order success page, drawn in one stroke. */
export function SuccessMark() {
  const reduce = useReducedMotion();
  const draw = (delay) => ({
    initial: reduce ? false : { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.55, ease: EASE_OUT, delay },
  });
  return (
    <svg className="success-icon" viewBox="0 0 52 52" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.circle cx="26" cy="26" r="23" {...draw(0)} />
      <motion.path d="M15 27l8 8 14-16" {...draw(0.3)} />
    </svg>
  );
}

/** A thin line under the header showing progress down the page. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, mass: 0.3 });
  if (reduce) return null;
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}

/** Slides list items into place when they are added, removed or reordered. */
export function useSmoothList() {
  const [ref] = useAutoAnimate({ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  return ref;
}
