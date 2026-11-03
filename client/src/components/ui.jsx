import { AlertTriangle, ChevronLeft, ChevronRight, Minus, Plus, Star, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { discountPercent, formatINR } from '../utils/format.js';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="bin" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="bin-cell" key={index}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={36} strokeWidth={1.5} aria-hidden="true" />}
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <AlertTriangle size={36} strokeWidth={1.5} aria-hidden="true" />
      <h2>This didn't load</h2>
      <p className="muted">{error?.message || 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={() => onRetry()}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Stars({ value = 0, count, size = 15, showValue = true }) {
  const label = `Rated ${value} out of 5${count !== undefined ? `, from ${count} review${count === 1 ? '' : 's'}` : ''}`;
  return (
    <span className="stars" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'star-on' : 'star-off'} aria-hidden="true" />
      ))}
      {count !== undefined && showValue && <span className="stars-value">{Number(value).toFixed(1)}</span>}
      {count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}

export function Price({ price, mrp, large = false }) {
  const off = discountPercent(price, mrp);
  return (
    <span className={`price ${large ? 'price-large' : ''}`}>
      <strong>{formatINR(price)}</strong>
      {off > 0 && (
        <>
          <s className="muted">{formatINR(mrp)}</s>
          <span className="price-off">{off}% off</span>
        </>
      )}
    </span>
  );
}

const STATUS_CLASS = {
  // Orders
  Pending: 'badge-warning',
  Confirmed: 'badge-info',
  Shipped: 'badge-info',
  'Out for Delivery': 'badge-info',
  Delivered: 'badge-success',
  Cancelled: 'badge-danger',
  Returned: 'badge-info',
  // Order payments
  Paid: 'badge-success',
  Refunded: 'badge-info',
  // Payment attempts
  Created: 'badge-warning',
  'Awaiting OTP': 'badge-warning',
  'Awaiting approval': 'badge-warning',
  Succeeded: 'badge-success',
  Failed: 'badge-danger',
  Expired: 'badge-danger',
  // Returns
  Requested: 'badge-warning',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
};

/** A coloured status. The label can differ from the status, such as "Ready for pickup". */
export function StatusBadge({ status, label }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? ''}`}>{label ?? status}</span>;
}

export function Stepper({ value, min = 1, max = 99, onChange, disabled, label = 'Quantity' }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={15} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase quantity" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages } = meta;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <span className="small muted">
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-quiet" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

/** A path-style trail, for example ~/shop/dev-hardware. */
export function PathCrumbs({ parts }) {
  return (
    <nav className="crumbs mono" aria-label="Breadcrumb">
      <Link to="/">~</Link>
      {parts.map((part) => (
        <span key={part.label}>
          <span className="crumbs-sep" aria-hidden="true">/</span>
          {part.to ? <Link to={part.to}>{part.label}</Link> : <span aria-current="page">{part.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Field({ label, error, hint, children, render }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy };
  return (
    <div className={`field ${error ? 'field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {render ? render(control) : children(control)}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

export function TextField({ label, error, hint, ...input }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => <input className="input" {...control} {...input} />}
    </Field>
  );
}

export function TextArea({ label, error, hint, ...input }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => <textarea className="input" rows={4} {...control} {...input} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, children, ...input }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <select className="input" {...control} {...input}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {error.message}
    </p>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    const previouslyFocused = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, danger = false, isPending, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        <div className="muted">{children}</div>
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Keep it as is
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
