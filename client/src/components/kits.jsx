import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { kitApi } from '../api/index.js';
import { announceBulkAdd, useRequireLogin } from '../hooks/shop.js';
import { formatINR } from '../utils/format.js';
import { Reveal, staggerDelay } from './motion.jsx';

export function useAddKit() {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const mutation = useMutation({
    mutationFn: kitApi.addToCart,
    onSuccess: (result) => {
      queryClient.setQueryData(['cart'], result.cart);
      announceBulkAdd(result);
    },
    onError: (error) => toast.error(error.message),
  });
  return {
    add: (kit) => {
      if (requireLogin('Log in to add kits to your cart.')) mutation.mutate(kit._id);
    },
    isPending: mutation.isPending,
    pendingId: mutation.isPending ? mutation.variables : null,
  };
}

export function KitCard({ kit }) {
  const addKit = useAddKit();
  return (
    <article className="kit">
      <Link to={`/kits/${kit.slug}`} tabIndex={-1} aria-hidden="true">
        <img src={kit.image} alt="" className="kit-image" loading="lazy" />
      </Link>
      <div className="kit-body">
        <h3>
          <Link to={`/kits/${kit.slug}`}>{kit.name}</Link>
        </h3>
        <p className="small muted">{kit.audience}</p>
        <p className="small kit-count">
          {kit.itemCount} items{kit.semester ? `, for semester ${kit.semester}` : ''}
        </p>
        <div className="row-between kit-foot">
          <strong className="kit-price">{formatINR(kit.totalPrice)}</strong>
          <button
            type="button"
            className="btn btn-small btn-soft"
            disabled={addKit.pendingId === kit._id}
            aria-label={`Add all of ${kit.name} to cart`}
            onClick={() => addKit.add(kit)}
          >
            <PackagePlus size={14} aria-hidden="true" /> Add all
          </button>
        </div>
      </div>
    </article>
  );
}

export function KitRow({ kits, isLoading }) {
  if (isLoading) return <div className="kit-row skeleton skeleton-kits" aria-hidden="true" />;
  return (
    <div className="kit-row">
      {kits.map((kit, index) => (
        <Reveal key={kit._id} delay={staggerDelay(index, 3)}>
          <KitCard kit={kit} />
        </Reveal>
      ))}
    </div>
  );
}
