import { Check, Copy, ExternalLink, KeyRound, PackageCheck, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatDateTime, formatINR, statusLabel } from '../utils/format.js';
import { EASE_OUT } from './motion.jsx';
import { StatusBadge } from './ui.jsx';

export const ORDER_FLOW = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
export const ORDER_STATUSES = [...ORDER_FLOW, 'Cancelled', 'Returned'];

/**
 * Order tracking drawn as a trace running through solder pads. Takes either an order or
 * the public tracking view, which share status, statusHistory or events, and delivery method.
 */
export function OrderTimeline({ order }) {
  const history = order.statusHistory ?? order.events;
  const method = order.delivery?.method ?? order.method;
  const cancelled = order.status === 'Cancelled';
  const returned = order.status === 'Returned';
  const events = new Map(history.map((event) => [event.status, event]));
  let steps = ORDER_FLOW;
  if (cancelled) steps = history.map((event) => event.status);
  if (returned) steps = [...ORDER_FLOW, 'Returned'];
  const currentIndex = steps.indexOf(order.status);
  const reduce = useReducedMotion();

  return (
    <ol className="timeline">
      {steps.map((status, index) => {
        const event = events.get(status);
        const done = index <= currentIndex;
        let stateClass = done ? 'timeline-done' : '';
        if (status === 'Cancelled') stateClass = 'timeline-cancelled';
        if (status === 'Returned') stateClass = 'timeline-done timeline-returned';
        return (
          <motion.li
            key={status}
            className={stateClass}
            aria-current={status === order.status ? 'step' : undefined}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: index * 0.07 }}
          >
            <span className="timeline-pad" aria-hidden="true" />
            <div>
              <strong>{statusLabel(status, method)}</strong>
              {event ? (
                <p className="small muted">
                  <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  {event.note && event.note !== 'Order placed' && <span className="timeline-note">{event.note}</span>}
                </p>
              ) : (
                <p className="small muted">Waiting</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={copied ? 'Copied' : label}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
    >
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  );
}

/** The courier and tracking number, with a link to the public tracking page. */
export function TrackingCard({ order }) {
  const { delivery } = order;
  if (!delivery?.trackingNumber) {
    if (['Cancelled'].includes(order.status)) return null;
    return (
      <p className="small muted tracking-wait">
        {delivery?.method === 'pickup'
          ? 'You get a tracking number once your order is sent to the pickup point.'
          : 'You get a tracking number as soon as your order ships.'}
      </p>
    );
  }
  return (
    <div className="tracking-card">
      <div>
        <p className="small muted">{delivery.courier}</p>
        <p className="row tracking-number">
          <span className="mono">{delivery.trackingNumber}</span>
          <CopyButton text={delivery.trackingNumber} label="Copy tracking number" />
        </p>
      </div>
      <Link to={`/track/${delivery.trackingNumber}`} className="btn btn-small">
        <ExternalLink size={15} aria-hidden="true" /> Tracking page
      </Link>
    </div>
  );
}

/** The 4-digit code the customer hands over when the parcel arrives. */
export function DeliveryCodeCard({ order }) {
  if (order.status !== 'Out for Delivery' || !order.delivery?.code) return null;
  const pickup = order.delivery.method === 'pickup';
  return (
    <section className="code-card" aria-labelledby="code-heading">
      <KeyRound size={22} aria-hidden="true" />
      <div>
        <h2 id="code-heading">Your delivery code</h2>
        <p className="code-digits mono" aria-label={`Delivery code ${order.delivery.code.split('').join(' ')}`}>
          {order.delivery.code}
        </p>
        <p className="small muted">
          {pickup
            ? `Show this code at ${order.delivery.pickupPoint} when you collect your order.`
            : 'Give this code to the courier when your parcel arrives. They need it to hand it over.'}{' '}
          Don't share it before then.
        </p>
      </div>
    </section>
  );
}

const RETURN_TEXT = {
  Requested: 'We have your return request and will reply soon.',
  Approved: 'Your return was approved.',
  Rejected: 'Your return could not be accepted.',
};

/** Where a return request stands, for the customer or the admin. */
export function ReturnStatus({ order, forAdmin = false }) {
  const request = order.returnRequest;
  if (!request) return null;
  return (
    <div className={`return-card return-${request.status.toLowerCase()}`}>
      <div className="row-between">
        <p className="row">
          {request.status === 'Approved' ? <PackageCheck size={18} aria-hidden="true" /> : <RotateCcw size={18} aria-hidden="true" />}
          <strong>Return {request.status.toLowerCase()}</strong>
        </p>
        <StatusBadge status={request.status} />
      </div>
      {!forAdmin && <p className="small">{RETURN_TEXT[request.status]}</p>}
      <dl className="return-facts small">
        <div><dt className="muted">Reason</dt><dd>{request.reason}</dd></div>
        {request.comment && <div><dt className="muted">{forAdmin ? 'Customer said' : 'You said'}</dt><dd>{request.comment}</dd></div>}
        <div><dt className="muted">Requested</dt><dd>{formatDate(request.requestedAt)}</dd></div>
        {request.status === 'Approved' && request.refundAmount > 0 && (
          <div><dt className="muted">Refund</dt><dd>{formatINR(request.refundAmount)}</dd></div>
        )}
        {request.resolutionNote && <div><dt className="muted">Store note</dt><dd>{request.resolutionNote}</dd></div>}
      </dl>
    </div>
  );
}
