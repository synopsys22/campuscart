import { formatDateTime } from '../utils/format.js';

export const ORDER_FLOW = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

const STEP_LABELS = {
  Pending: 'Order placed',
  Confirmed: 'Confirmed',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

/** Order tracking drawn as a trace running through solder pads. */
export function OrderTimeline({ order }) {
  const cancelled = order.status === 'Cancelled';
  const events = new Map(order.statusHistory.map((event) => [event.status, event]));
  const steps = cancelled ? order.statusHistory.map((event) => event.status) : ORDER_FLOW;
  const currentIndex = steps.indexOf(order.status);

  return (
    <ol className="timeline">
      {steps.map((status, index) => {
        const event = events.get(status);
        const done = index <= currentIndex;
        const stateClass = status === 'Cancelled' ? 'timeline-cancelled' : done ? 'timeline-done' : '';
        return (
          <li key={status} className={stateClass} aria-current={status === order.status ? 'step' : undefined}>
            <span className="timeline-pad" aria-hidden="true" />
            <div>
              <strong>{STEP_LABELS[status]}</strong>
              {event ? (
                <p className="small muted">
                  <time className="mono" dateTime={event.at}>{formatDateTime(event.at)}</time>
                  {event.note && event.note !== 'Order placed' && <span className="timeline-note">{event.note}</span>}
                </p>
              ) : (
                <p className="small muted">Waiting</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
