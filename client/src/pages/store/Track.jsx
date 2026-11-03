import { useQuery } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deliveryApi } from '../../api/index.js';
import { Enter } from '../../components/motion.jsx';
import { ORDER_FLOW, OrderTimeline } from '../../components/orders.jsx';
import { ErrorState, PathCrumbs, SkeletonRows, StatusBadge } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { DELIVERY_LABELS, formatDay, statusLabel } from '../../utils/format.js';

function Progress({ shipment }) {
  const index = ORDER_FLOW.indexOf(shipment.status === 'Returned' ? 'Delivered' : shipment.status);
  const percent = Math.max(0, (index / (ORDER_FLOW.length - 1)) * 100);
  return (
    <div
      className="track-progress"
      role="progressbar"
      aria-label="Delivery progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={statusLabel(shipment.status, shipment.method)}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Shipment({ trackingNumber }) {
  const { data: shipment, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['track', trackingNumber],
    queryFn: () => deliveryApi.track(trackingNumber),
    retry: (count, err) => ![400, 404].includes(err.status) && count < 1,
  });
  if (isLoading) return <SkeletonRows count={3} />;
  if (isError) {
    return [400, 404].includes(error.status)
      ? <p className="form-error" role="alert">{error.fieldErrors?.trackingNumber ?? error.message}</p>
      : <ErrorState error={error} onRetry={refetch} />;
  }

  const pickup = shipment.method === 'pickup';
  const finished = ['Delivered', 'Returned'].includes(shipment.status);
  return (
    <Enter className="stack-lg">
      <section className="panel track-card" aria-labelledby="shipment-heading">
        <div className="row-between">
          <div>
            <p className="small muted">{shipment.courier}</p>
            <h2 id="shipment-heading" className="mono">{shipment.trackingNumber}</h2>
          </div>
          <StatusBadge status={shipment.status} label={statusLabel(shipment.status, shipment.method)} />
        </div>
        <Progress shipment={shipment} />
        <dl className="review-facts track-facts">
          <div>
            <dt className="muted small">{pickup ? 'Pickup point' : 'Going to'}</dt>
            <dd>{shipment.destination}{pickup && shipment.pickupSlot ? `, ${shipment.pickupSlot}` : ''}</dd>
          </div>
          <div>
            <dt className="muted small">Service</dt>
            <dd>{DELIVERY_LABELS[shipment.method]}, {shipment.itemCount} item{shipment.itemCount === 1 ? '' : 's'}</dd>
          </div>
          {!finished && (
            <div>
              <dt className="muted small">{pickup ? 'Ready from' : 'Expected by'}</dt>
              <dd>{formatDay(shipment.estimatedDelivery)}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="stack" aria-labelledby="journey-heading">
        <h2 id="journey-heading">Journey</h2>
        <OrderTimeline order={shipment} />
      </section>
    </Enter>
  );
}

export default function Track() {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(trackingNumber ?? '');
  usePageTitle(trackingNumber ? `Tracking ${trackingNumber}` : 'Track a parcel');

  return (
    <div className="container page narrow track-page">
      <PathCrumbs parts={[{ label: 'track' }]} />
      <div className="page-intro">
        <h1 className="row"><PackageSearch size={28} aria-hidden="true" /> Track a parcel</h1>
        <p className="muted">Enter the tracking number from your order page. Anyone you share it with can follow the parcel too.</p>
      </div>
      <form
        className="track-form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim().toUpperCase();
          if (value) navigate(`/track/${value}`);
        }}
      >
        <label className="visually-hidden" htmlFor="tracking-number">Tracking number</label>
        <input
          id="tracking-number"
          className="input mono"
          placeholder="CCT0000000000"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn btn-primary">Track</button>
      </form>
      {trackingNumber && <Shipment key={trackingNumber} trackingNumber={trackingNumber.toUpperCase()} />}
    </div>
  );
}
