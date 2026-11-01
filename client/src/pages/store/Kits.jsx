import { useQuery } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { kitApi } from '../../api/index.js';
import { useAddKit, KitCard } from '../../components/kits.jsx';
import { ProductImage, StockNote } from '../../components/product.jsx';
import { ErrorState, PathCrumbs, SkeletonRows, Spinner } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatINR } from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';

export function KitList() {
  usePageTitle('Project Kits');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['kits'], queryFn: () => kitApi.list() });
  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'kits' }]} />
      <div className="page-intro">
        <h1>Project Kits</h1>
        <p className="muted">
          Bundles for a lab, a semester or a hackathon. One click adds every part to your cart, and you can change
          anything before you check out.
        </p>
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      <div className="kit-row">
        {data?.map((kit) => <KitCard key={kit._id} kit={kit} />)}
      </div>
    </div>
  );
}

export function KitDetail() {
  const { slug } = useParams();
  const addKit = useAddKit();
  const { data: kit, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kit', slug],
    queryFn: () => kitApi.get(slug),
    retry: (count, err) => err.status !== 404 && count < 1,
  });
  usePageTitle(kit?.name);

  if (isLoading) return <Spinner />;
  if (error?.status === 404) return <NotFound message="This kit is not available." />;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  const savings = kit.mrpTotal - kit.totalPrice;
  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'kits', to: '/kits' }, { label: kit.slug }]} />
      <div className="kit-detail">
        <div className="stack">
          <h1>{kit.name}</h1>
          <p className="muted">{kit.audience}</p>
          <p>{kit.description}</p>
          <h2 className="kit-parts-title">What's inside</h2>
          <ul className="line-list">
            {kit.items.map(({ product, qty }) => (
              <li key={product._id} className="line">
                <ProductImage src={product.images?.[0]} alt="" className="line-image" />
                <div className="line-info">
                  <Link to={`/products/${product.slug}`} className="line-name">{product.name}</Link>
                  <StockNote product={product} />
                </div>
                <span className="mono small muted">Qty {qty}</span>
                <span className="mono">{formatINR(product.price * qty)}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="summary">
          <h2>Kit total</h2>
          <dl className="summary-rows">
            <div><dt>Items</dt><dd className="mono">{kit.itemCount}</dd></div>
            {savings > 0 && <div><dt>You save on MRP</dt><dd className="mono summary-good">{formatINR(savings)}</dd></div>}
            <div className="summary-total"><dt>Total</dt><dd className="mono">{formatINR(kit.totalPrice)}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary btn-large btn-full" disabled={addKit.isPending} onClick={() => addKit.add(kit)}>
            <PackagePlus size={18} aria-hidden="true" /> Add all to cart
          </button>
          {!kit.inStock && <p className="small stock-low">Some items are short on stock. Those will be skipped.</p>}
        </aside>
      </div>
    </div>
  );
}
