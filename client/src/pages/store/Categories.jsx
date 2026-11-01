import { useQuery } from '@tanstack/react-query';
import { productApi } from '../../api/index.js';
import { CategoryGrid } from '../../components/category.jsx';
import { ErrorState, PathCrumbs, SkeletonRows } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';

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
      <CategoryGrid categories={data?.categories ?? []} />
    </div>
  );
}
