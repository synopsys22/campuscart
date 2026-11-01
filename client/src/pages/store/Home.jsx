import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarX, Truck, Wallet } from 'lucide-react';
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { kitApi, productApi } from '../../api/index.js';
import { CategoryGrid } from '../../components/category.jsx';
import { KitRow } from '../../components/kits.jsx';
import { AnimatedNumber, EASE_OUT, Enter, Reveal } from '../../components/motion.jsx';
import { ProductBin } from '../../components/product.jsx';
import { SkeletonGrid } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';

// Each component on the board links to a part of the store. Its trace runs to the central chip.
const BOARD = [
  { ref: 'U1', label: 'Dev Hardware', slug: 'dev-hardware', x: 14, y: 17, path: 'M190 90H280L340 150V190' },
  { ref: 'U2', label: 'Laptops', slug: 'laptops', x: 14, y: 50, path: 'M190 260H320' },
  { ref: 'U3', label: 'Peripherals', slug: 'peripherals', x: 14, y: 83, path: 'M190 430H280L340 370V330' },
  { ref: 'U4', label: 'CS Textbooks', slug: 'cs-textbooks', x: 86, y: 17, path: 'M610 90H520L460 150V190' },
  { ref: 'U5', label: 'Software & Cloud', slug: 'software-licenses', x: 86, y: 50, path: 'M610 260H480' },
  { ref: 'U6', label: 'Project Kits', to: '/kits', x: 86, y: 83, path: 'M610 430H520L460 370V330' },
];

const PROMISES = [
  { icon: Truck, text: 'Free delivery from ₹999', hue: '#6d83ff' },
  { icon: Wallet, text: 'Cash on delivery available', hue: '#c77dff' },
  { icon: CalendarX, text: 'Cancel any time before it ships', hue: '#ff7f5e' },
  { icon: BadgeCheck, text: 'Reviews from verified buyers', hue: '#2fb8e6' },
];

const MotionLink = motion.create(Link);

/** Soft colour drifting slowly behind the hero. */
function Aurora() {
  const reduce = useReducedMotion();
  const drift = (x, y, duration) =>
    reduce
      ? {}
      : {
          animate: { x: [0, x, -x / 2, 0], y: [0, y, -y / 2, 0] },
          transition: { duration, repeat: Infinity, ease: 'easeInOut' },
        };
  return (
    <div className="aurora" aria-hidden="true">
      <motion.span className="aurora-a" {...drift(60, -40, 24)} />
      <motion.span className="aurora-b" {...drift(-50, 50, 30)} />
      <motion.span className="aurora-c" {...drift(40, 30, 36)} />
    </div>
  );
}

function HeroBoard({ counts, totalParts }) {
  const [hovered, setHovered] = useState(null);
  const reduce = useReducedMotion();
  const tiltX = useSpring(0, { stiffness: 110, damping: 18 });
  const tiltY = useSpring(0, { stiffness: 110, damping: 18 });

  // The board leans gently towards the pointer. Touch screens and reduced motion keep it flat.
  const lean = (event) => {
    if (reduce || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    tiltY.set(((event.clientX - box.left) / box.width - 0.5) * 5);
    tiltX.set(((event.clientY - box.top) / box.height - 0.5) * -5);
  };
  const settle = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <motion.div
      className="board"
      style={reduce ? undefined : { rotateX: tiltX, rotateY: tiltY, transformPerspective: 1200 }}
      onPointerMove={lean}
      onPointerLeave={settle}
    >
      <svg className="board-traces" viewBox="0 0 800 520" aria-hidden="true">
        <rect className="board-outline" x="6" y="6" width="788" height="508" rx="14" />
        {BOARD.map((part, index) => (
          <g key={part.ref} className={hovered === part.ref ? 'trace trace-lit' : 'trace'}>
            <path d={part.path} />
            {/* A pulse of light runs along each trace towards the chip. */}
            {!reduce && (
              <circle className="trace-pulse" r="4" opacity="0">
                <animateMotion path={part.path} dur="3.4s" begin={`${1.4 + index * 0.55}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur="3.4s" begin={`${1.4 + index * 0.55}s`} repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}
        <circle className="board-hole" cx="26" cy="26" r="7" />
        <circle className="board-hole" cx="774" cy="26" r="7" />
        <circle className="board-hole" cx="26" cy="494" r="7" />
        <circle className="board-hole" cx="774" cy="494" r="7" />
      </svg>

      <div className="board-core">
        <span className="board-core-count">{totalParts ? <AnimatedNumber value={totalParts} countUp /> : '...'}</span>
        <span className="small">parts on the shelf</span>
      </div>

      {BOARD.map((part, index) => (
        <MotionLink
          key={part.ref}
          to={part.to ?? `/products?category=${part.slug}`}
          className="board-part"
          style={{ '--x': `${part.x}%`, '--y': `${part.y}%` }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 + index * 0.06 }}
          onMouseEnter={() => setHovered(part.ref)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(part.ref)}
          onBlur={() => setHovered(null)}
        >
          <span className="board-ref mono" aria-hidden="true">{part.ref}</span>
          <span className="board-label">{part.label}</span>
          {part.slug && counts[part.slug] !== undefined && (
            <span className="board-count small">{counts[part.slug]} items</span>
          )}
        </MotionLink>
      ))}
    </motion.div>
  );
}

export default function Home() {
  usePageTitle();
  const filters = useQuery({ queryKey: ['product-filters'], queryFn: productApi.filters });
  const featured = useQuery({
    queryKey: ['products', { featured: true }],
    queryFn: () => productApi.list({ sort: 'featured', limit: 8 }),
  });
  const kits = useQuery({ queryKey: ['kits'], queryFn: () => kitApi.list() });

  const categories = filters.data?.categories ?? [];
  const counts = Object.fromEntries(categories.map((category) => [category.slug, category.count]));
  const totalParts = categories.reduce((sum, category) => sum + category.count, 0);

  return (
    <div>
      <section className="hero">
        <Aurora />
        <div className="container hero-inner">
          <div className="hero-copy">
            <Enter from={{ y: 22 }}>
              <h1>Everything your CS degree runs on.</h1>
            </Enter>
            <Enter from={{ y: 22 }} delay={0.08}>
              <p className="hero-lede">
                Dev boards, laptops, textbooks and hostel gear, chosen for Computer Science students and priced for student
                budgets.
              </p>
            </Enter>
            <Enter from={{ y: 22 }} delay={0.16} className="row">
              <Link to="/products" className="btn btn-primary btn-large">
                Browse the store
              </Link>
              <Link to="/kits" className="btn btn-large">
                See project kits
              </Link>
            </Enter>
          </div>
          <HeroBoard counts={counts} totalParts={totalParts} />
        </div>
      </section>

      <div className="promise-strip">
        <ul className="container promise-list" aria-label="What every order includes">
          {PROMISES.map(({ icon: Icon, text, hue }) => (
            <li key={text} style={{ '--hue': hue }}>
              <span className="tint-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <section className="container home-section" aria-labelledby="categories-heading">
        <Reveal>
          <h2 id="categories-heading" className="section-head">
            Shop by category
          </h2>
        </Reveal>
        <CategoryGrid categories={categories} />
      </section>

      <section className="container home-section" aria-labelledby="popular-heading">
        <Reveal className="row-between section-head">
          <h2 id="popular-heading">Popular with students</h2>
          <Link to="/products" className="section-link">
            All products
          </Link>
        </Reveal>
        {featured.isLoading ? <SkeletonGrid /> : <ProductBin products={featured.data?.items ?? []} />}
      </section>

      <section className="home-band" aria-labelledby="kits-heading">
        <div className="container">
          <Reveal className="row-between section-head">
            <div>
              <h2 id="kits-heading">Project Kits</h2>
              <p className="muted">One click adds every part a lab or semester needs.</p>
            </div>
            <Link to="/kits" className="section-link">
              All kits
            </Link>
          </Reveal>
          <KitRow kits={(kits.data ?? []).filter((kit) => kit.isFeatured).slice(0, 3)} isLoading={kits.isLoading} />
        </div>
      </section>

      <section className="container home-section" aria-labelledby="setup-heading">
        <Reveal>
          <div className="setup-band">
            <div>
              <h2 id="setup-heading">Plan your whole desk against a budget</h2>
              <p>
                Pick a laptop, keyboard, monitor and more. Build Your Setup keeps a running total, so you know what fits
                before you buy.
              </p>
            </div>
            <Link to="/setup-builder" className="btn btn-inverse btn-large">
              Build your setup
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
