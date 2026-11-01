import { useQuery } from '@tanstack/react-query';
import {
  Backpack,
  BookOpen,
  Coffee,
  Cpu,
  HardDrive,
  Keyboard,
  KeyRound,
  Laptop,
  Package,
  PenLine,
  Plug,
  Shirt,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productApi } from '../../api/index.js';
import { ErrorState, PathCrumbs, SkeletonRows } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';

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

export default function Categories() {
  usePageTitle('Categories');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product-filters'],
    queryFn: productApi.filters,
  });

  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'categories' }]} />
      <h1 className="page-title">Categories</h1>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      <ul className="category-grid">
        {data?.categories.map((category) => {
          const Icon = ICONS[category.icon] ?? Package;
          return (
            <li key={category._id}>
              <Link to={`/products?category=${category.slug}`}>
                <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                <span className="category-name">{category.name}</span>
                <span className="mono small muted">{category.count} items</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
