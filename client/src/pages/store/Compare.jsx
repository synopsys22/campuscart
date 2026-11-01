import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../../api/index.js';
import { ProductImage } from '../../components/product.jsx';
import { EmptyState, ErrorState, PathCrumbs, Price, Spinner, Stars } from '../../components/ui.jsx';
import { useCompare } from '../../context/CompareContext.jsx';
import { useAddToCart, usePageTitle } from '../../hooks/shop.js';

/** Lists every spec any of the products has, in a stable order, grouped. */
function collectSpecRows(products) {
  const rows = new Map();
  for (const product of products) {
    for (const spec of product.specs) {
      const id = `${spec.group}::${spec.key}`;
      if (!rows.has(id)) rows.set(id, { id, group: spec.group, key: spec.key });
    }
  }
  return [...rows.values()];
}

const specValue = (product, row) =>
  product.specs.find((spec) => spec.group === row.group && spec.key === row.key)?.value ?? null;

export default function Compare() {
  usePageTitle('Compare');
  const compare = useCompare();
  const cart = useAddToCart();
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const ids = compare.items.map((item) => item._id);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['compare', ids],
    queryFn: () => productApi.compare(ids),
    enabled: ids.length > 0,
  });

  if (ids.length === 0) {
    return (
      <div className="container page">
        <PathCrumbs parts={[{ label: 'compare' }]} />
        <EmptyState
          icon={GitCompareArrows}
          title="Nothing to compare yet"
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
        >
          Use the compare button on any product to line up to 4 side by side.
        </EmptyState>
      </div>
    );
  }
  if (isLoading) return <Spinner />;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  const allRows = collectSpecRows(products);
  const differs = (row) => new Set(products.map((product) => specValue(product, row))).size > 1;
  const rows = onlyDifferences ? allRows.filter(differs) : allRows;
  const lowestPrice = Math.min(...products.map((product) => product.price));

  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'compare' }]} />
      <div className="row-between catalog-head">
        <h1>Compare products</h1>
        <label className="check">
          <input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} />
          <span>Show differences only</span>
        </label>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Product comparison">
        <table className="compare-table">
          <thead>
            <tr>
              <td />
              {products.map((product) => (
                <th key={product._id} scope="col">
                  <button type="button" className="icon-btn compare-remove" aria-label={`Remove ${product.name}`} onClick={() => compare.remove(product._id)}>
                    <X size={15} aria-hidden="true" />
                  </button>
                  <ProductImage src={product.images?.[0]} alt="" className="compare-image" />
                  <Link to={`/products/${product.slug}`} className="compare-name">{product.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Price</th>
              {products.map((product) => (
                <td key={product._id} className={products.length > 1 && product.price === lowestPrice ? 'compare-best' : ''}>
                  <Price price={product.price} mrp={product.mrp} />
                  {products.length > 1 && product.price === lowestPrice && <p className="small">Lowest price</p>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Rating</th>
              {products.map((product) => (
                <td key={product._id}>
                  {product.ratingCount > 0 ? <Stars value={product.ratingAvg} count={product.ratingCount} /> : <span className="muted">No reviews yet</span>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Category</th>
              {products.map((product) => <td key={product._id}>{product.category.name}</td>)}
            </tr>
            {rows.map((row) => (
              <tr key={row.id} className={differs(row) ? 'compare-differs' : ''}>
                <th scope="row">{row.key}</th>
                {products.map((product) => (
                  <td key={product._id} className="mono">
                    {specValue(product, row) ?? <span className="muted">Not listed</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {products.map((product) => (
                <td key={product._id}>
                  <button type="button" className="btn btn-small" disabled={product.stock === 0} onClick={() => cart.add(product)}>
                    {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
