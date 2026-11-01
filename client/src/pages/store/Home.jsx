import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { kitApi, productApi } from '../../api/index.js';
import { KitRow } from '../../components/kits.jsx';
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

function HeroBoard({ counts, totalParts }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="board">
      <svg className="board-traces" viewBox="0 0 800 520" aria-hidden="true">
        {BOARD.map((part) => (
          <g key={part.ref} className={hovered === part.ref ? 'trace trace-lit' : 'trace'}>
            <path d={part.path} />
          </g>
        ))}
        <rect className="board-outline" x="6" y="6" width="788" height="508" rx="14" />
        <circle className="board-hole" cx="26" cy="26" r="7" />
        <circle className="board-hole" cx="774" cy="26" r="7" />
        <circle className="board-hole" cx="26" cy="494" r="7" />
        <circle className="board-hole" cx="774" cy="494" r="7" />
      </svg>

      <div className="board-core">
        <span className="board-core-count mono">{totalParts || '...'}</span>
        <span className="small">parts on the shelf</span>
      </div>

      {BOARD.map((part) => (
        <Link
          key={part.ref}
          to={part.to ?? `/products?category=${part.slug}`}
          className="board-part"
          style={{ '--x': `${part.x}%`, '--y': `${part.y}%` }}
          onMouseEnter={() => setHovered(part.ref)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(part.ref)}
          onBlur={() => setHovered(null)}
        >
          <span className="board-ref mono" aria-hidden="true">{part.ref}</span>
          <span className="board-label">{part.label}</span>
          {part.slug && counts[part.slug] !== undefined && (
            <span className="board-count small mono">{counts[part.slug]} items</span>
          )}
        </Link>
      ))}
    </div>
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
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1>Everything your CS degree runs on.</h1>
            <p className="hero-lede">
              Dev boards, laptops, textbooks and hostel gear, chosen for Computer Science students and priced for student
              budgets.
            </p>
            <div className="row">
              <Link to="/products" className="btn btn-primary btn-large">
                Browse the store
              </Link>
              <Link to="/kits" className="btn btn-large">
                See project kits
              </Link>
            </div>
          </div>
          <HeroBoard counts={counts} totalParts={totalParts} />
        </div>
      </section>

      <section className="container home-section" aria-labelledby="kits-heading">
        <div className="row-between section-head">
          <div>
            <h2 id="kits-heading">Project Kits</h2>
            <p className="muted">One click adds every part a lab or semester needs.</p>
          </div>
          <Link to="/kits" className="text-link">
            All kits
          </Link>
        </div>
        <KitRow kits={(kits.data ?? []).filter((kit) => kit.isFeatured).slice(0, 3)} isLoading={kits.isLoading} />
      </section>

      <section className="container home-section" aria-labelledby="popular-heading">
        <div className="row-between section-head">
          <h2 id="popular-heading">Popular with students</h2>
          <Link to="/products" className="text-link">
            All products
          </Link>
        </div>
        {featured.isLoading ? <SkeletonGrid /> : <ProductBin products={featured.data?.items ?? []} />}
      </section>

      <section className="container home-section" aria-labelledby="setup-heading">
        <div className="setup-band">
          <div>
            <h2 id="setup-heading">Plan your whole desk against a budget</h2>
            <p className="muted">
              Pick a laptop, keyboard, monitor and more. Build Your Setup keeps a running total, so you know what fits
              before you buy.
            </p>
          </div>
          <Link to="/setup-builder" className="btn btn-primary">
            Build your setup
          </Link>
        </div>
      </section>

      <section className="container home-section" aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="section-head">
          Shop by category
        </h2>
        <ul className="drawer-list">
          {categories.map((category) => (
            <li key={category._id}>
              <Link to={`/products?category=${category.slug}`}>
                <span>{category.name}</span>
                <span className="mono small muted">{category.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
