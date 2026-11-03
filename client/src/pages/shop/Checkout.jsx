import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { orderApi, profileApi, walletApi } from '../../api/index.js';
import { AddressForm } from '../../components/AddressForm.jsx';
import { DeliveryMethodPicker, PickupPicker, useDeliveryEstimate, useDeliveryOptions } from '../../components/delivery.jsx';
import { Enter } from '../../components/motion.jsx';
import { PaymentGateway } from '../../components/payment.jsx';
import { ProductImage } from '../../components/product.jsx';
import { ErrorState, PathCrumbs, SkeletonRows, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart, usePageTitle } from '../../hooks/shop.js';
import { DELIVERY_LABELS, formatDay, formatINR, PAYMENT_LABELS } from '../../utils/format.js';
import { OrderSummaryRows } from './Cart.jsx';

const GATEWAY = ['MOCK_UPI', 'MOCK_CARD'];

const describeAddress = (a) =>
  [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');

export function useWalletBalance() {
  return useQuery({ queryKey: ['wallet', 'balance'], queryFn: () => walletApi.get({ limit: 1 }).then((page) => page.summary.balance) });
}

function Steps({ step }) {
  const steps = ['Delivery', 'Payment', 'Review'];
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

function AddressChooser({ selectedId, onSelect }) {
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
    <fieldset className="plain-fieldset stack">
      <legend><strong>Deliver to</strong></legend>
      <div role="radiogroup" aria-label="Delivery address" className="choice-list">
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
        <div>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setAdding(true)}>Add a new address</button>
        </div>
      )}
    </fieldset>
  );
}

function DeliveryStep({ cart, choice, setChoice, address, estimate, onContinue }) {
  const options = useDeliveryOptions();
  const pickup = choice.method === 'pickup';
  const unserviceable = !pickup && estimate && !estimate.serviceable;
  const ready = pickup ? Boolean(choice.pickupPoint && choice.pickupSlot) : Boolean(address) && !unserviceable;

  return (
    <section className="stack" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading">How should we get it to you?</h2>
      <DeliveryMethodPicker
        options={cart.pricing.deliveryOptions}
        estimate={estimate}
        value={choice.method}
        onChange={(method) => setChoice((current) => ({ ...current, method }))}
      />
      {pickup ? (
        options.data && (
          <PickupPicker
            points={options.data.pickupPoints}
            slots={options.data.pickupSlots}
            point={choice.pickupPoint}
            slot={choice.pickupSlot}
            onPoint={(pickupPoint) => setChoice((current) => ({ ...current, pickupPoint }))}
            onSlot={(pickupSlot) => setChoice((current) => ({ ...current, pickupSlot }))}
          />
        )
      ) : (
        <AddressChooser selectedId={choice.addressId} onSelect={(addressId) => setChoice((current) => ({ ...current, addressId }))} />
      )}
      {unserviceable && <p className="small form-error" role="alert">{estimate.message}</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={onContinue}>Continue to payment</button>
      </div>
    </section>
  );
}

function PaymentStep({ method, onSelect, total, pickup, onBack, onContinue }) {
  const balance = useWalletBalance();
  const walletShort = balance.data !== undefined && balance.data < total;
  const options = [
    { id: 'COD', icon: Banknote, help: pickup ? 'Pay in cash when you collect it.' : 'Pay in cash when your order arrives.' },
    { id: 'MOCK_UPI', icon: Smartphone, help: 'Scan a QR code or approve a request in your UPI app.' },
    { id: 'MOCK_CARD', icon: CreditCard, help: 'Debit or credit card, with an OTP from your bank.' },
    {
      id: 'WALLET',
      icon: Wallet,
      help: balance.data === undefined ? 'Pay from your CampusCart balance.' : `Balance ${formatINR(balance.data)}.${walletShort ? ' Not enough for this order.' : ''}`,
      disabled: walletShort,
    },
  ];
  return (
    <section className="stack" aria-labelledby="payment-heading">
      <h2 id="payment-heading">How do you want to pay?</h2>
      <div role="radiogroup" aria-labelledby="payment-heading" className="choice-list">
        {options.map(({ id, icon: Icon, help, disabled }) => (
          <label key={id} className={`choice ${method === id ? 'choice-on' : ''} ${disabled ? 'choice-disabled' : ''}`}>
            <input type="radio" name="payment" checked={method === id} disabled={disabled} onChange={() => onSelect(id)} />
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{PAYMENT_LABELS[id]}</strong>
              <span className="small muted choice-detail">{help}</span>
            </span>
          </label>
        ))}
      </div>
      {walletShort && (
        <p className="small muted">
          <Link to="/account/wallet" className="text-link">Add money to your wallet</Link> to pay with it.
        </p>
      )}
      <p className="small notice">This is a demo store. Card and UPI payments use a practice gateway, and no real money moves.</p>
      <div className="row">
        <button type="button" className="btn btn-quiet" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onContinue}>Review order</button>
      </div>
    </section>
  );
}

function ReviewStep({ cart, choice, address, pickupPoint, pickupSlot, expected, method, total, isPlacing, onBack, onPlace }) {
  const pays = GATEWAY.includes(method);
  return (
    <section className="stack" aria-labelledby="review-heading">
      <h2 id="review-heading">Check your order</h2>
      <dl className="review-facts">
        <div>
          <dt className="muted small">{choice.method === 'pickup' ? 'Pick up at' : 'Deliver to'}</dt>
          <dd>
            {choice.method === 'pickup'
              ? <><strong>{pickupPoint?.name}</strong>, {pickupSlot?.label}</>
              : <><strong>{address.label}</strong>: {describeAddress(address)}</>}
          </dd>
        </div>
        <div>
          <dt className="muted small">{DELIVERY_LABELS[choice.method]}</dt>
          <dd>{expected ? `${choice.method === 'pickup' ? 'Ready from' : 'Arrives by'} ${formatDay(expected)}` : 'Date shown after ordering'}</dd>
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
          {isPlacing
            ? method === 'WALLET' ? 'Paying from your wallet...' : 'Placing your order...'
            : pays ? `Pay ${formatINR(total)}` : `Place order for ${formatINR(total)}`}
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
  const options = useDeliveryOptions();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState({ method: 'standard', addressId: null, pickupPoint: null, pickupSlot: null });
  const [method, setMethod] = useState('COD');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!choice.addressId && user.addresses.length > 0) {
      const preferred = user.addresses.find((a) => a.isDefault) ?? user.addresses[0];
      setChoice((current) => ({ ...current, addressId: preferred._id }));
    }
  }, [user.addresses, choice.addressId]);

  const address = user.addresses.find((a) => a._id === choice.addressId);
  const pickup = choice.method === 'pickup';
  const estimateQuery = useDeliveryEstimate(address?.pincode ?? '600001');
  const estimate = estimateQuery.data;
  const expected = pickup ? estimate?.pickup?.date : estimate?.serviceable ? estimate[choice.method]?.date : null;
  const pickupPoint = options.data?.pickupPoints.find((p) => p.id === choice.pickupPoint);
  const pickupSlot = options.data?.pickupSlots.find((s) => s.id === choice.pickupSlot);

  // The summary shows the fee for the chosen delivery. The server charges the same.
  const pricing = useMemo(() => {
    if (!cart) return null;
    const fee = cart.pricing.deliveryOptions.find((option) => option.id === choice.method)?.fee ?? cart.pricing.shippingFee;
    return { ...cart.pricing, shippingFee: fee, total: cart.pricing.subtotal - cart.pricing.discount + fee };
  }, [cart, choice.method]);

  const place = useMutation({
    mutationFn: (paymentId) => {
      const body = {
        delivery: pickup
          ? { method: 'pickup', pickupPoint: choice.pickupPoint, pickupSlot: choice.pickupSlot }
          : { method: choice.method },
        paymentMethod: method,
        ...(paymentId && { paymentId }),
      };
      if (!pickup) {
        const { label, line1, line2, city, state, pincode } = address;
        body.address = { label, line1, line2, city, state, pincode };
      }
      return orderApi.place(body);
    },
    onSuccess: (order) => {
      // Stops the empty-cart redirect below from running before the success page opens.
      navigate(`/order-success/${order._id}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    // The refreshed cart shows what went wrong, such as an item that has just sold out.
    onError: (failure) => {
      setPaying(false);
      toast.error(failure.message, { duration: 6000 });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const gatewayRequest = useMemo(() => ({ purpose: 'order', deliveryMethod: choice.method }), [choice.method]);
  const onPaid = useCallback((payment) => place.mutateAsync(payment._id).catch(() => {}), [place]);

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
          {step === 0 && (
            <DeliveryStep cart={cart} choice={choice} setChoice={setChoice} address={address} estimate={estimate} onContinue={() => setStep(1)} />
          )}
          {step === 1 && (
            <PaymentStep method={method} onSelect={setMethod} total={pricing.total} pickup={pickup} onBack={() => setStep(0)} onContinue={() => setStep(2)} />
          )}
          {step === 2 && (pickup || address) && (
            <ReviewStep
              cart={cart}
              choice={choice}
              address={address}
              pickupPoint={pickupPoint}
              pickupSlot={pickupSlot}
              expected={expected}
              method={method}
              total={pricing.total}
              isPlacing={place.isPending}
              onBack={() => setStep(1)}
              onPlace={() => (GATEWAY.includes(method) ? setPaying(true) : place.mutate())}
            />
          )}
        </Enter>
        <aside className="summary">
          <h2>Order summary</h2>
          {cart.couponCode && !cart.couponError && <p className="small">Coupon <strong className="mono">{cart.couponCode}</strong> applied.</p>}
          <OrderSummaryRows pricing={pricing} deliveryLabel={DELIVERY_LABELS[choice.method]} />
        </aside>
      </div>
      {paying && (
        <PaymentGateway method={method} request={gatewayRequest} onPaid={onPaid} onClose={() => setPaying(false)} />
      )}
    </div>
  );
}
