import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productApi } from '../../api/index.js';
import { NoProducts, ProductBin } from '../../components/product.jsx';
import { ErrorState, Pagination, PathCrumbs, SkeletonGrid } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';

const SORTS = [
  ['featured', 'Featured'],
  ['popular', 'Most popular'],
  ['rating', 'Top rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['newest', 'Newest'],
];

const csvValues = (value) => (value ? value.split(',').filter(Boolean) : []);

function PriceFilter({ params, update }) {
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');

  // Keeps the boxes in step when filters are cleared.
  useEffect(() => {
    setMin(params.get('minPrice') ?? '');
    setMax(params.get('maxPrice') ?? '');
  }, [params]);

  const apply = (event) => {
    event.preventDefault();
    update({ minPrice: min, maxPrice: max });
  };

  return (
    <form className="price-filter" onSubmit={apply}>
      <label className="visually-hidden" htmlFor="min-price">Minimum price</label>
      <input id="min-price" className="input mono" inputMode="numeric" placeholder="₹ Min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
      <label className="visually-hidden" htmlFor="max-price">Maximum price</label>
      <input id="max-price" className="input mono" inputMode="numeric" placeholder="₹ Max" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
      <button type="submit" className="btn btn-small">Apply</button>
    </form>
  );
}

function Filters({ options, params, update, toggleValue }) {
  const selected = (key) => csvValues(params.get(key));
  return (
    <div className="filters">
      <fieldset>
        <legend>Category</legend>
        {options.categories.map((category) => (
          <label className="check" key={category.slug}>
            <input
              type="checkbox"
              checked={selected('category').includes(category.slug)}
              onChange={() => toggleValue('category', category.slug)}
            />
            <span>{category.name}</span>
            <span className="mono small muted">{category.count}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Price</legend>
        <PriceFilter params={params} update={update} />
      </fieldset>

      <fieldset>
        <legend>Rating</legend>
        {[4, 3].map((rating) => (
          <label className="check" key={rating}>
            <input
              type="radio"
              name="rating"
              checked={params.get('rating') === String(rating)}
              onChange={() => update({ rating })}
            />
            <span>{rating} stars and up</span>
          </label>
        ))}
        <label className="check">
          <input type="radio" name="rating" checked={!params.get('rating')} onChange={() => update({ rating: '' })} />
          <span>Any rating</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Availability</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={params.get('inStock') === 'true'}
            onChange={(event) => update({ inStock: event.target.checked ? 'true' : '' })}
          />
          <span>In stock only</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>For semester</legend>
        <div className="chip-row">
          {options.semesters.map((semester) => (
            <button
              type="button"
              key={semester}
              className={`chip mono ${params.get('semester') === String(semester) ? 'chip-on' : ''}`}
              aria-pressed={params.get('semester') === String(semester)}
              onClick={() => update({ semester: params.get('semester') === String(semester) ? '' : semester })}
            >
              {semester}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Brand</legend>
        <div className="filter-scroll">
          {options.brands.map((brand) => (
            <label className="check" key={brand}>
              <input
                type="checkbox"
                checked={selected('brand').includes(brand)}
                onChange={() => toggleValue('brand', brand)}
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [listView, setListView] = useState(false);
  usePageTitle('Shop');

  const query = Object.fromEntries(params);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['products', query],
    queryFn: () => productApi.list({ limit: 12, ...query }),
    placeholderData: keepPreviousData,
  });
  const filters = useQuery({ queryKey: ['product-filters'], queryFn: productApi.filters });

  /** Applies filter changes and returns to page 1, since results have changed. */
  const update = (changes) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === undefined || value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };

  const toggleValue = (key, value) => {
    const values = csvValues(params.get(key));
    const updated = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    update({ [key]: updated.join(',') });
  };

  const goToPage = (page) => {
    const next = new URLSearchParams(params);
    next.set('page', page);
    setParams(next);
    window.scrollTo(0, 0);
  };

  const activeFilterCount = [...params.keys()].filter((key) => !['page', 'sort', 'q'].includes(key)).length;
  const hasAnyFilter = activeFilterCount > 0 || params.get('q');
  const clearAll = () => setParams({});
  const categoryName = (slug) => filters.data?.categories.find((category) => category.slug === slug)?.name;
  const onlyCategory = csvValues(params.get('category')).length === 1 ? categoryName(params.get('category')) : null;
  const heading = params.get('q') ? `Results for "${params.get('q')}"` : onlyCategory || 'All products';

  return (
    <div className="container page">
      <PathCrumbs
        parts={[
          { label: 'shop', to: onlyCategory ? '/products' : undefined },
          ...(onlyCategory ? [{ label: params.get('category') }] : []),
        ]}
      />
      <div className="row-between catalog-head">
        <div>
          <h1>{heading}</h1>
          <p className="muted small" aria-live="polite">
            {data ? `${data.meta.total} product${data.meta.total === 1 ? '' : 's'}` : 'Loading products'}
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn filter-toggle" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters
            {activeFilterCount > 0 && <span className="mono">({activeFilterCount})</span>}
          </button>
          <label className="visually-hidden" htmlFor="sort">Sort by</label>
          <select
            id="sort"
            className="input input-auto"
            value={params.get('sort') ?? 'featured'}
            onChange={(event) => update({ sort: event.target.value })}
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-label="Grid view" aria-pressed={!listView} onClick={() => setListView(false)}>
              <LayoutGrid size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="List view" aria-pressed={listView} onClick={() => setListView(true)}>
              <List size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="catalog">
        <aside className={`catalog-side ${drawerOpen ? 'catalog-side-open' : ''}`} aria-label="Filters">
          <div className="row-between catalog-side-head">
            <h2 className="small">Filters</h2>
            <div className="row">
              {hasAnyFilter && (
                <button type="button" className="text-link small" onClick={clearAll}>
                  Clear all
                </button>
              )}
              <button type="button" className="icon-btn filter-close" aria-label="Close filters" onClick={() => setDrawerOpen(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          {filters.data && <Filters options={filters.data} params={params} update={update} toggleValue={toggleValue} />}
        </aside>

        <div className="catalog-main" aria-busy={isFetching}>
          {isLoading && <SkeletonGrid count={9} />}
          {isError && <ErrorState error={error} onRetry={refetch} />}
          {data?.items.length === 0 && (
            <NoProducts action={<button type="button" className="btn" onClick={clearAll}>Clear filters</button>} />
          )}
          {data?.items.length > 0 && (
            <>
              <ProductBin products={data.items} list={listView} />
              <Pagination meta={data.meta} onPage={goToPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
