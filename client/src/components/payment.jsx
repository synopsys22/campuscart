import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard, Lock, QrCode, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { paymentApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR } from '../utils/format.js';
import { cardBrand, checkCard, digitsOnly, formatCardNumber, formatExpiry, UPI_ID_PATTERN } from '../utils/payment.js';
import { SuccessMark } from './motion.jsx';
import { FormError, Modal, Spinner, TextField } from './ui.jsx';

const PENDING = ['Created', 'Awaiting OTP', 'Awaiting approval'];
const RESEND_SECONDS = 30;

/** Seconds left until a moment, ticking once a second. */
function useSecondsLeft(until) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000)) : 0;
}

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function GatewayHeader({ payment, purpose }) {
  const secondsLeft = useSecondsLeft(PENDING.includes(payment.status) ? payment.expiresAt : null);
  return (
    <div className="pay-head">
      <div>
        <p className="small muted">{purpose === 'wallet_topup' ? 'Add money to your wallet' : 'Paying CampusCart'}</p>
        <p className="pay-amount">{formatINR(payment.amount)}</p>
        <p className="small muted mono">{payment.reference}</p>
      </div>
      {PENDING.includes(payment.status) && (
        <p className={`pay-timer small ${secondsLeft < 60 ? 'stock-low' : 'muted'}`} aria-live="off">
          Expires in <span className="mono">{clock(secondsLeft)}</span>
        </p>
      )}
    </div>
  );
}

function TestCards({ cards, onUse }) {
  return (
    <details className="test-cards" open>
      <summary className="small">Test cards for this demo</summary>
      <ul>
        {cards.map((card) => (
          <li key={card.number}>
            <span>
              <span className="mono">{formatCardNumber(card.number)}</span>
              <span className="small muted test-card-label">{card.label}</span>
            </span>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => onUse(card.number)}>
              Use
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">Any future expiry date and any 3-digit CVV work.</p>
    </details>
  );
}

function CardForm({ payment, testDetails, onUpdate }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ number: '', name: user?.name ?? '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState({});
  const submit = useMutation({
    mutationFn: () => paymentApi.card(payment._id, { ...form, number: digitsOnly(form.number) }),
    onSuccess: onUpdate,
    onError: (error) => setErrors(error.fieldErrors ?? {}),
  });
  const brand = cardBrand(digitsOnly(form.number));
  const set = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const useTestCard = (number) => {
    const year = String((new Date().getFullYear() + 3) % 100).padStart(2, '0');
    setForm((current) => ({ ...current, number: formatCardNumber(number), expiry: `12/${year}`, cvv: '123' }));
    setErrors({});
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // A number that is not a test card is stopped here, so it never leaves the browser.
        const found = checkCard(form, testDetails.cards.map((card) => card.number));
        if (Object.keys(found).length > 0) setErrors(found);
        else submit.mutate();
      }}
    >
      <div className="card-number">
        <TextField
          label="Card number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234 5678 9012 3456"
          value={form.number}
          error={errors.number}
          onChange={(event) => set('number', formatCardNumber(event.target.value))}
        />
        {brand && <span className="card-brand" aria-hidden="true">{brand}</span>}
      </div>
      <TextField label="Name on card" autoComplete="off" value={form.name} error={errors.name} onChange={(event) => set('name', event.target.value)} />
      <div className="form-row">
        <TextField
          label="Expiry (MM/YY)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/YY"
          value={form.expiry}
          error={errors.expiry}
          onChange={(event) => set('expiry', formatExpiry(event.target.value))}
        />
        <TextField
          label="CVV"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={form.cvv}
          error={errors.cvv}
          onChange={(event) => set('cvv', digitsOnly(event.target.value).slice(0, 3))}
        />
      </div>
      {submit.error && !submit.error.fieldErrors && <FormError error={submit.error} />}
      <button type="submit" className="btn btn-primary btn-large btn-full" disabled={submit.isPending}>
        <Lock size={16} aria-hidden="true" />
        {submit.isPending ? 'Contacting your bank...' : `Pay ${formatINR(payment.amount)}`}
      </button>
      <TestCards cards={testDetails.cards} onUse={useTestCard} />
    </form>
  );
}

function OtpForm({ payment, testDetails, onUpdate }) {
  const { user } = useAuth();
  const [otp, setOtp] = useState('');
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const resendIn = useSecondsLeft(resendAt);
  const verify = useMutation({
    mutationFn: () => paymentApi.otp(payment._id, otp),
    onSuccess: onUpdate,
    onError: () => setOtp(''),
  });
  const phoneEnd = user?.phone ? user.phone.slice(-4) : null;

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        verify.mutate();
      }}
    >
      <div className="otp-intro">
        <ShieldCheck size={22} aria-hidden="true" />
        <p>
          {payment.card?.brand} card ending <span className="mono">{payment.card?.last4}</span>. Your bank sent a 6-digit OTP
          {phoneEnd ? <> to the phone number ending <span className="mono">{phoneEnd}</span></> : ' to your phone'}.
        </p>
      </div>
      <TextField
        label="One-time password (OTP)"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="input otp-input mono"
        maxLength={6}
        value={otp}
        error={verify.error?.fieldErrors?.otp}
        onChange={(event) => setOtp(digitsOnly(event.target.value).slice(0, 6))}
        hint={`Demo OTP: ${testDetails.otp}`}
        autoFocus
      />
      {verify.error && !verify.error.fieldErrors && <FormError error={verify.error} />}
      <button type="submit" className="btn btn-primary btn-large btn-full" disabled={verify.isPending || otp.length !== 6}>
        {verify.isPending ? 'Checking...' : 'Verify and pay'}
      </button>
      <button
        type="button"
        className="text-link small"
        disabled={resendIn > 0}
        onClick={() => {
          setResendAt(Date.now() + RESEND_SECONDS * 1000);
          toast(`A new OTP is on its way. In this demo it is always ${testDetails.otp}.`);
        }}
      >
        {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
      </button>
    </form>
  );
}

function UpiPanel({ payment, token, testDetails, onUpdate }) {
  const [tab, setTab] = useState('qr');
  const [upiId, setUpiId] = useState('');
  const [idError, setIdError] = useState(null);
  const request = useMutation({
    mutationFn: () => paymentApi.upi(payment._id, upiId.trim().toLowerCase()),
    onSuccess: onUpdate,
    onError: (error) => setIdError(error.fieldErrors?.upiId ?? error.message),
  });
  const approveHere = useMutation({ mutationFn: () => paymentApi.approve(payment._id, token), onSuccess: () => paymentApi.get(payment._id).then(onUpdate) });
  const approvalUrl = `${window.location.origin}/pay/${payment._id}?token=${token}`;

  if (payment.status === 'Awaiting approval' && payment.upiFlow === 'collect') {
    return (
      <div className="stack upi-waiting" role="status">
        <span className="spinner" aria-hidden="true" />
        <p><strong>Approve the request in your UPI app</strong></p>
        <p className="small muted">
          We sent a payment request to <span className="mono">{payment.upiId}</span>. This screen updates by itself once you approve it.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="pay-tabs" role="group" aria-label="How to pay by UPI">
        <button type="button" aria-pressed={tab === 'qr'} onClick={() => setTab('qr')}>
          <QrCode size={16} aria-hidden="true" /> Scan QR code
        </button>
        <button type="button" aria-pressed={tab === 'id'} onClick={() => setTab('id')}>
          <Smartphone size={16} aria-hidden="true" /> Pay by UPI ID
        </button>
      </div>

      {tab === 'qr' ? (
        <div className="stack upi-qr">
          <div className="qr-frame">
            <QRCodeSVG value={approvalUrl} size={184} marginSize={2} title="QR code for this demo payment" />
          </div>
          <p className="small muted">
            Scan this with your phone camera. It opens a CampusCart page where you approve this demo payment, and this screen updates by itself.
          </p>
          <button type="button" className="btn btn-quiet btn-full" disabled={approveHere.isPending} onClick={() => approveHere.mutate()}>
            {approveHere.isPending ? 'Approving...' : 'No phone handy? Approve on this device'}
          </button>
          <FormError error={approveHere.error} />
        </div>
      ) : (
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!UPI_ID_PATTERN.test(upiId.trim().toLowerCase())) setIdError('Enter a UPI ID like yourname@bank.');
            else request.mutate();
          }}
        >
          <TextField
            label="UPI ID"
            placeholder="yourname@bank"
            autoComplete="off"
            autoCapitalize="none"
            value={upiId}
            error={idError}
            onChange={(event) => {
              setUpiId(event.target.value);
              setIdError(null);
            }}
            hint={`Demo: ${testDetails.upi.declines} is declined. Any other ID, such as ${testDetails.upi.approves}, is approved.`}
          />
          <button type="submit" className="btn btn-primary btn-large btn-full" disabled={request.isPending}>
            {request.isPending ? 'Sending...' : `Send a request for ${formatINR(payment.amount)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function Result({ payment, finishing, finishingLabel, onRetry, onClose }) {
  if (payment.status === 'Succeeded') {
    return (
      <div className="pay-result" role="status">
        <SuccessMark />
        <p><strong>Payment successful</strong></p>
        <p className="small muted">{finishing ? finishingLabel : 'You can close this window.'}</p>
        {finishing && <span className="spinner" aria-hidden="true" />}
      </div>
    );
  }
  const expired = payment.status === 'Expired';
  return (
    <div className="pay-result" role="alert">
      <XCircle size={56} strokeWidth={1.5} className="pay-failed-icon" aria-hidden="true" />
      <p><strong>{expired ? 'Payment timed out' : 'Payment failed'}</strong></p>
      <p className="muted">{payment.failureReason}. No money was taken.</p>
      <div className="row">
        <button type="button" className="btn btn-quiet" onClick={onClose}>Choose another way to pay</button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
      </div>
    </div>
  );
}

/**
 * The demo payment gateway window. It opens a payment on the server, walks through the
 * card or UPI steps, and hands a successful payment to onPaid, which may return a promise.
 */
export function PaymentGateway({ method, request, finishingLabel = 'Placing your order...', onPaid, onClose }) {
  const [payment, setPayment] = useState(null);
  const [token, setToken] = useState(null);
  const [startError, setStartError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startedAttempt = useRef(-1);
  const handedOver = useRef(null);
  const testDetails = useQuery({ queryKey: ['payment-test-details'], queryFn: paymentApi.testDetails, staleTime: Infinity });

  // A ref, not the effect's cleanup, stops a second payment opening when React runs effects twice.
  useEffect(() => {
    if (startedAttempt.current === attempt) return;
    startedAttempt.current = attempt;
    setPayment(null);
    setStartError(null);
    paymentApi
      .create({ ...request, method })
      .then((created) => {
        setToken(created.approvalToken);
        setPayment(created);
      })
      .catch(setStartError);
  }, [attempt, method, request]);

  // While a UPI app or a phone is expected to answer, checks every moment for the result.
  const waiting = payment?.method === 'MOCK_UPI' && ['Created', 'Awaiting approval'].includes(payment.status);
  const paymentId = payment?._id;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => {
      paymentApi.get(paymentId).then(setPayment).catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [waiting, paymentId]);

  // The countdown ran out, so the server is asked for the final state.
  const secondsLeft = useSecondsLeft(payment && PENDING.includes(payment.status) ? payment.expiresAt : null);
  useEffect(() => {
    if (payment && PENDING.includes(payment.status) && secondsLeft === 0) {
      paymentApi.get(payment._id).then(setPayment).catch(() => {});
    }
  }, [secondsLeft, payment]);

  useEffect(() => {
    if (payment?.status !== 'Succeeded' || handedOver.current === payment._id) return;
    handedOver.current = payment._id;
    setFinishing(true);
    Promise.resolve(onPaid(payment)).finally(() => setFinishing(false));
  }, [payment, onPaid]);

  const close = () => {
    if (finishing) return;
    if (payment && PENDING.includes(payment.status)) paymentApi.cancel(payment._id).catch(() => {});
    onClose();
  };

  const Icon = method === 'MOCK_CARD' ? CreditCard : Smartphone;
  let body;
  if (startError) body = <><FormError error={startError} /><button type="button" className="btn" onClick={onClose}>Close</button></>;
  else if (!payment || !testDetails.data) body = <Spinner label="Opening the payment screen" />;
  else if (!PENDING.includes(payment.status)) {
    body = <Result payment={payment} finishing={finishing} finishingLabel={finishingLabel} onRetry={() => setAttempt((n) => n + 1)} onClose={close} />;
  } else if (method === 'MOCK_CARD') {
    body = payment.status === 'Awaiting OTP'
      ? <OtpForm payment={payment} testDetails={testDetails.data} onUpdate={setPayment} />
      : <CardForm payment={payment} testDetails={testDetails.data} onUpdate={setPayment} />;
  } else {
    body = <UpiPanel payment={payment} token={token} testDetails={testDetails.data} onUpdate={setPayment} />;
  }

  return (
    <Modal title={method === 'MOCK_CARD' ? 'Pay by card' : 'Pay by UPI'} onClose={close}>
      <div className="stack gateway">
        {payment && <GatewayHeader payment={payment} purpose={request.purpose} />}
        {body}
        <p className="small muted pay-foot">
          <Icon size={14} aria-hidden="true" /> CampusCart demo gateway. No real money moves.
        </p>
      </div>
    </Modal>
  );
}
