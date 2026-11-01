import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { orderApi, profileApi } from '../../api/index.js';
import { AddressForm } from '../../components/AddressForm.jsx';
import { Enter } from '../../components/motion.jsx';
import { ProductImage } from '../../components/product.jsx';
import { ErrorState, PathCrumbs, SkeletonRows, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart, usePageTitle } from '../../hooks/shop.js';
import { formatINR, PAYMENT_LABELS } from '../../utils/format.js';
import { OrderSummaryRows } from './Cart.jsx';

const PAYMENT_OPTIONS = [
  { id: 'COD', icon: Banknote, help: 'Pay when your order arrives.' },
  { id: 'MOCK_UPI', icon: Smartphone, help: 'A simulated UPI payment. No money moves.' },
  { id: 'MOCK_CARD', icon: CreditCard, help: 'A simulated card payment. No card details are asked for.' },
];
const PROCESSING_MS = 1400;

const describeAddress = (a) =>
  [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');

function Steps({ step }) {
  const steps = ['Address', 'Payment', 'Review'];
  return (
    <ol className="steps" aria-label="Checkout steps">
      {steps.map((label, index) => (
        <li
          key={label}
          className={index === step ? 'step-on' : index < step ? 'step-done' : ''}
          aria-current={index === step ? 'step' : undefined}
        >
          <span className="step-pad" aria-hidden="true">{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function AddressStep({ selectedId, onSelect, onContinue }) {
  const { user, setUser } = useAuth();
  const [adding, setAdding] = useState(user.addresses.length === 0);
  const add = useMutation({
    mutationFn: profileApi.addAddress,
    onSuccess: (addresses) => {
      setUser({ ...user, addresses });
      onSelect(addresses[addresses.length - 1]._id);
      setAdding(false);
    },
  });

  return (
    <section className="stack" aria-labelledby="address-heading">
      <h2 id="address-heading">Where should we deliver?</h2>
      <div role="radiogroup" aria-labelledby="address-heading" className="choice-list">
        {user.addresses.map((address) => (
          <label key={address._id} className={`choice ${selectedId === address._id ? 'choice-on' : ''}`}>
            <input type="radio" name="address" checked={selectedId === address._id} onChange={() => onSelect(address._id)} />
            <span>
              <strong>{address.label}</strong>
              <span className="small muted choice-detail">{describeAddress(address)}</span>
            </span>
          </label>
        ))}
      </div>
      {adding ? (
        <AddressForm
          submitLabel="Save address"
          isPending={add.isPending}
          error={add.error}
          onSubmit={(body) => add.mutate(body)}
          onCancel={user.addresses.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        <div className="row">
          <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Add a new address</button>
          <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={onContinue}>Continue to payment</button>
        </div>
      )}
    </section>
  );
}

function PaymentStep({ method, onSelect, onBack, onContinue }) {
  return (
    <section className="stack" aria-labelledby="payment-heading">
      <h2 id="payment-heading">How do you want to pay?</h2>
      <div role="radiogroup" aria-labelledby="payment-heading" className="choice-list">
        {PAYMENT_OPTIONS.map(({ id, icon: Icon, help }) => (
          <label key={id} className={`choice ${method === id ? 'choice-on' : ''}`}>
            <input type="radio" name="payment" checked={method === id} onChange={() => onSelect(id)} />
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{PAYMENT_LABELS[id]}</strong>
              <span className="small muted choice-detail">{help}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="small notice">This is a demo store. Nothing here takes a real payment.</p>
      <div className="row">
        <button type="button" className="btn btn-quiet" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onContinue}>Review order</button>
      </div>
    </section>
  );
}

function ReviewStep({ cart, address, method, isPlacing, onBack, onPlace }) {
  return (
    <section className="stack" aria-labelledby="review-heading">
      <h2 id="review-heading">Check your order</h2>
      <dl className="review-facts">
        <div>
          <dt className="muted small">Deliver to</dt>
          <dd><strong>{address.label}</strong>: {describeAddress(address)}</dd>
        </div>
        <div>
          <dt className="muted small">Payment</dt>
          <dd>{PAYMENT_LABELS[method]}</dd>
        </div>
      </dl>
      <ul className="line-list">
        {cart.items.map(({ product, qty, lineTotal }) => (
          <li key={product._id} className="line">
            <ProductImage src={product.images?.[0]} alt="" className="line-image" />
            <div className="line-info">
              <span className="line-name">{product.name}</span>
              <span className="small muted">Qty {qty}</span>
            </div>
            <span>{formatINR(lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="row">
        <button type="button" className="btn btn-quiet" disabled={isPlacing} onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary btn-large" disabled={isPlacing} onClick={onPlace}>
          {isPlacing ? (method === 'COD' ? 'Placing your order...' : 'Processing payment...') : `Place order for ${formatINR(cart.pricing.total)}`}
        </button>
      </div>
    </section>
  );
}

export default function Checkout() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: cart, isLoading, isError, error, refetch } = useCart();
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState('COD');

  useEffect(() => {
    if (!addressId && user.addresses.length > 0) {
      setAddressId((user.addresses.find((a) => a.isDefault) ?? user.addresses[0])._id);
    }
  }, [user.addresses, addressId]);

  const address = user.addresses.find((a) => a._id === addressId);

  const place = useMutation({
    mutationFn: async () => {
      // The mock methods pause briefly, so it reads like a payment being processed.
      if (method !== 'COD') await new Promise((resolve) => setTimeout(resolve, PROCESSING_MS));
      const { label, line1, line2, city, state, pincode } = address;
      return orderApi.place({ address: { label, line1, line2, city, state, pincode }, paymentMethod: method });
    },
    onSuccess: (order) => {
      // Stops the empty-cart redirect below from running before the success page opens.
      navigate(`/order-success/${order._id}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    // The refreshed cart shows what went wrong, such as an item that has just sold out.
    onError: (failure) => {
      toast.error(failure.message);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  if (isLoading) return <div className="container page"><SkeletonRows /></div>;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;
  if (place.isSuccess) return <Spinner />;
  if (!cart.canCheckout) return <Navigate to="/cart" replace />;

  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'cart', to: '/cart' }, { label: 'checkout' }]} />
      <h1 className="page-title">Checkout</h1>
      <Steps step={step} />
      <div className="two-col">
        <Enter key={step} from={{ x: 16 }}>
          {step === 0 && <AddressStep selectedId={addressId} onSelect={setAddressId} onContinue={() => setStep(1)} />}
          {step === 1 && <PaymentStep method={method} onSelect={setMethod} onBack={() => setStep(0)} onContinue={() => setStep(2)} />}
          {step === 2 && address && (
            <ReviewStep
              cart={cart}
              address={address}
              method={method}
              isPlacing={place.isPending}
              onBack={() => setStep(1)}
              onPlace={() => place.mutate()}
            />
          )}
        </Enter>
        <aside className="summary">
          <h2>Order summary</h2>
          {cart.couponCode && !cart.couponError && <p className="small">Coupon <strong className="mono">{cart.couponCode}</strong> applied.</p>}
          <OrderSummaryRows pricing={cart.pricing} />
        </aside>
      </div>
    </div>
  );
}
