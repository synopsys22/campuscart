import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarX, Check, MessageSquare, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { productApi, reviewApi } from '../../api/index.js';
import { PincodeCheck } from '../../components/delivery.jsx';
import { Enter, GrowBar, Reveal } from '../../components/motion.jsx';
import {
  CartIcon,
  CompareButton,
  ProductBin,
  ProductImage,
  StockNote,
  WishlistButton,
} from '../../components/product.jsx';
import {
  EmptyState,
  ErrorState,
  FormError,
  Pagination,
  PathCrumbs,
  Price,
  SkeletonRows,
  Spinner,
  Stars,
  Stepper,
  TextArea,
  TextField,
} from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAddToCart, usePageTitle } from '../../hooks/shop.js';
import { formatDate } from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';

function SpecsTable({ specs }) {
  const groups = new Map();
  for (const spec of specs) {
    if (!groups.has(spec.group)) groups.set(spec.group, []);
    groups.get(spec.group).push(spec);
  }
  return (
    <div className="specs">
      {[...groups].map(([group, rows]) => (
        <section key={group}>
          <h3 className="small">{group}</h3>
          <dl>
            {rows.map((row) => (
              <div key={row.key}>
                <dt className="muted">{row.key}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function RatingBars({ distribution, total }) {
  return (
    <ul className="rating-bars">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution?.[star] ?? 0;
        return (
          <li key={star}>
            <span className="small">{star}</span>
            <span className="rating-bar" aria-hidden="true">
              <GrowBar percent={total ? (count / total) * 100 : 0} color="var(--star)" />
            </span>
            <span className="small muted">{count}<span className="visually-hidden"> reviews with {star} stars</span></span>
          </li>
        );
      })}
    </ul>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <fieldset className="star-picker">
      <legend>Your rating</legend>
      <div className="row">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className={`chip ${value === star ? 'chip-on' : ''}`}>
            <input
              className="visually-hidden"
              type="radio"
              name="review-rating"
              checked={value === star}
              onChange={() => onChange(star)}
            />
            {star}
            <span className="visually-hidden"> stars</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ productId, existing, onDone }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    rating: existing?.rating ?? 5,
    title: existing?.title ?? '',
    body: existing?.body ?? '',
  });

  const save = useMutation({
    mutationFn: () => (existing ? reviewApi.update(existing._id, form) : reviewApi.create(productId, form)),
    onSuccess: () => {
      toast.success(existing ? 'Review updated' : 'Review posted');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-eligibility', productId] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
      onDone?.();
    },
  });

  const errors = save.error?.fieldErrors ?? {};
  return (
    <form
      className="stack review-form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <StarPicker value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
      <TextField label="Title" value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <TextArea label="Your review" value={form.body} error={errors.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      {!save.error?.fieldErrors && <FormError error={save.error} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : existing ? 'Update review' : 'Post review'}
        </button>
      </div>
    </form>
  );
}

function WriteReview({ productId }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data } = useQuery({
    queryKey: ['review-eligibility', productId],
    queryFn: () => reviewApi.eligibility(productId),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <p className="muted small">
        <Link to="/login" className="text-link">Log in</Link> to review products you have bought.
      </p>
    );
  }
  if (!data) return null;
  if (data.canReview) {
    return (
      <div className="stack">
        <h3>Write a review</h3>
        <ReviewForm productId={productId} />
      </div>
    );
  }
  if (data.existingReview) {
    return editing ? (
      <div className="stack">
        <h3>Edit your review</h3>
        <ReviewForm productId={productId} existing={data.existingReview} onDone={() => setEditing(false)} />
      </div>
    ) : (
      <div className="row">
        <p className="muted small">You have reviewed this product.</p>
        <button type="button" className="text-link small" onClick={() => setEditing(true)}>Edit your review</button>
      </div>
    );
  }
  return <p className="muted small">{data.reason}</p>;
}

function Reviews({ product }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reviews', product._id, page],
    queryFn: () => reviewApi.forProduct(product._id, { page, limit: 5 }),
  });

  return (
    <Reveal as="section" id="reviews" className="detail-section" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Reviews</h2>
      <div className="reviews">
        <div className="reviews-side stack">
          {product.ratingCount > 0 && (
            <>
              <p className="reviews-score">{product.ratingAvg.toFixed(1)}</p>
              <Stars value={product.ratingAvg} count={product.ratingCount} size={17} showValue={false} />
              <RatingBars distribution={data?.summary?.distribution} total={product.ratingCount} />
            </>
          )}
          <WriteReview productId={product._id} />
        </div>
        <div className="reviews-list">
          {isLoading && <SkeletonRows count={3} />}
          {isError && <ErrorState error={error} onRetry={refetch} />}
          {data?.items.length === 0 && (
            <EmptyState icon={MessageSquare} title="No reviews yet">
              Reviews come from students who bought this product.
            </EmptyState>
          )}
          {data?.items.map((review) => (
            <article key={review._id} className="review">
              <div className="row-between">
                <Stars value={review.rating} />
                <span className="small muted">{formatDate(review.createdAt)}</span>
              </div>
              <h3>{review.title}</h3>
              <p>{review.body}</p>
              <p className="small muted review-author">
                <span>{review.user?.name ?? 'Former student'}</span>
                {review.user?.branch && <span>{review.user.branch}</span>}
                {review.verified && (
                  <span className="verified">
                    <BadgeCheck size={14} aria-hidden="true" /> Verified purchase
                  </span>
                )}
              </p>
            </article>
          ))}
          <Pagination meta={data?.meta} onPage={setPage} />
        </div>
      </div>
    </Reveal>
  );
}

// The key gives each product fresh page state, so a chosen quantity doesn't carry over.
export default function ProductDetail() {
  const { slug } = useParams();
  return <ProductPage key={slug} slug={slug} />;
}

function ProductPage({ slug }) {
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const cart = useAddToCart();

  const { data: product, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => productApi.get(slug),
    retry: (count, err) => err.status !== 404 && count < 1,
  });
  const related = useQuery({
    queryKey: ['product-related', slug],
    queryFn: () => productApi.related(slug),
    enabled: Boolean(product),
  });
  usePageTitle(product?.name);
  const { isAdmin } = useAuth();

  if (isLoading) return <Spinner />;
  if (error?.status === 404) return <NotFound message="This product is not available." />;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  const soldOut = product.stock === 0;
  const images = product.images?.length ? product.images : [''];

  return (
    <div className="container page">
      <PathCrumbs
        parts={[
          { label: 'shop', to: '/products' },
          { label: product.category.slug, to: `/products?category=${product.category.slug}` },
          { label: product.slug },
        ]}
      />
      <div className="detail">
        <div className="detail-gallery">
          <Enter key={images[imageIndex]} from={{ y: 0, scale: 0.98 }}>
            <ProductImage src={images[imageIndex]} alt={product.name} className="detail-image" />
          </Enter>
          {images.length > 1 && (
            <div className="row">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  className={`thumb ${index === imageIndex ? 'thumb-on' : ''}`}
                  aria-label={`Show image ${index + 1}`}
                  onClick={() => setImageIndex(index)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-head">
            <p className="muted">{product.brand}</p>
            <h1>{product.name}</h1>
            {product.ratingCount > 0 && (
              <a href="#reviews" className="detail-rating">
                <Stars value={product.ratingAvg} count={product.ratingCount} />
              </a>
            )}
          </div>

          <Enter className="buy-box" from={{ y: 14 }} delay={0.08}>
            <div className="buy-price">
              <Price price={product.price} mrp={product.mrp} large />
              <StockNote product={product} />
            </div>
            <div className="buy-row">
              {!soldOut && <Stepper value={qty} max={Math.min(product.stock, 99)} onChange={setQty} />}
              <button
                type="button"
                className="btn btn-primary btn-large buy-button"
                disabled={soldOut || cart.isPending}
                onClick={() => cart.add(product, qty)}
              >
                <CartIcon added={cart.addedId === product._id} size={18} />
                {soldOut ? 'Out of stock' : 'Add to cart'}
              </button>
            </div>
            <div className="row buy-secondary">
              <WishlistButton product={product} withLabel />
              <CompareButton product={product} withLabel />
            </div>
            <PincodeCheck price={product.price} />
            <ul className="buy-facts small">
              <li>
                <CalendarX size={16} aria-hidden="true" />
                <span>Cancel any time before it ships. Return within 7 days of delivery.</span>
              </li>
            </ul>
          </Enter>

          {isAdmin && (
            <p className="admin-note admin-area">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Only admins see this: <strong>{product.stock} in stock</strong></span>
              <Link to="/admin/inventory" className="text-link">Manage inventory</Link>
            </p>
          )}

          <p>{product.description}</p>
          {product.highlights?.length > 0 && (
            <ul className="highlights">
              {product.highlights.map((highlight) => (
                <li key={highlight}>
                  <Check size={16} aria-hidden="true" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted mono">SKU {product.sku}</p>
        </div>
      </div>

      <Reveal as="section" className="detail-section" aria-labelledby="specs-heading">
        <h2 id="specs-heading">Specifications</h2>
        <SpecsTable specs={product.specs} />
      </Reveal>

      <Reviews product={product} />

      {related.data?.length > 0 && (
        <section className="detail-section" aria-labelledby="related-heading">
          <h2 id="related-heading">More in {product.category.name}</h2>
          <ProductBin products={related.data} />
        </section>
      )}
    </div>
  );
}
