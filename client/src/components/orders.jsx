import { motion, useReducedMotion } from 'motion/react';
import { formatDateTime } from '../utils/format.js';
import { EASE_OUT } from './motion.jsx';

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
  const reduce = useReducedMotion();

  return (
    <ol className="timeline">
      {steps.map((status, index) => {
        const event = events.get(status);
        const done = index <= currentIndex;
        const stateClass = status === 'Cancelled' ? 'timeline-cancelled' : done ? 'timeline-done' : '';
        return (
          <motion.li
            key={status}
            className={stateClass}
            aria-current={status === order.status ? 'step' : undefined}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: index * 0.09 }}
          >
            <span className="timeline-pad" aria-hidden="true" />
            <div>
              <strong>{STEP_LABELS[status]}</strong>
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
