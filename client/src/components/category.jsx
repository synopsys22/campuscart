import {
  Backpack,
  BookOpen,
  Coffee,
  Cpu,
  HardDrive,
  Keyboard,
  KeyRound,
  Laptop,
  LayoutGrid,
  Package,
  PenLine,
  Plug,
  Shirt,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal, staggerDelay } from './motion.jsx';

// Each category keeps its own colour, matching its product artwork.
const HUES = {
  'dev-hardware': '#6d83ff',
  laptops: '#9b7bff',
  peripherals: '#c77dff',
  'laptop-accessories': '#4ea4ff',
  'storage-cables': '#2fb8e6',
  'cs-textbooks': '#f0a040',
  'software-licenses': '#ee6fc6',
  stationery: '#ff7f5e',
  backpacks: '#c9a26b',
  'college-merch': '#f0657f',
  'daily-essentials': '#eab308',
};

const ICONS = {
  cpu: Cpu,
  laptop: Laptop,
  keyboard: Keyboard,
  plug: Plug,
  'hard-drive': HardDrive,
  'book-open': BookOpen,
  'key-round': KeyRound,
  'pen-line': PenLine,
  backpack: Backpack,
  shirt: Shirt,
  coffee: Coffee,
};

function CategoryTile({ to, icon: Icon, name, count, hue = '#818cf8', index }) {
  return (
    <Reveal as="li" delay={staggerDelay(index, 6)} style={{ '--hue': hue }}>
      <Link to={to}>
        <span className="category-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <span className="category-name">{name}</span>
        <span className="small muted">{count} item{count === 1 ? '' : 's'}</span>
      </Link>
    </Reveal>
  );
}

/** Every category as a tile, finished with one for the whole catalog. */
export function CategoryGrid({ categories }) {
  const total = categories.reduce((sum, category) => sum + category.count, 0);
  return (
    <ul className="category-grid">
      {categories.map((category, index) => (
        <CategoryTile
          key={category._id}
          index={index}
          hue={HUES[category.slug]}
          to={`/products?category=${category.slug}`}
          icon={ICONS[category.icon] ?? Package}
          name={category.name}
          count={category.count}
        />
      ))}
      {categories.length > 0 && <CategoryTile to="/products" icon={LayoutGrid} name="All products" count={total} index={categories.length} />}
    </ul>
  );
}
