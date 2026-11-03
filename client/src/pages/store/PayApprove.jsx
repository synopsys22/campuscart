import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, XCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { paymentApi } from '../../api/index.js';
import { Logo } from '../../components/Layout.jsx';
import { SuccessMark } from '../../components/motion.jsx';
import { FormError, Spinner } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatINR } from '../../utils/format.js';

/**
 * Opens on the phone that scanned a UPI QR code. It plays the part of a UPI app: one tap
 * approves the demo payment, and the screen that showed the code moves on by itself.
 */
export default function PayApprove() {
  usePageTitle('Approve payment');
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ['approval', id],
    queryFn: () => paymentApi.approval(id, token),
    retry: false,
  });
  const approve = useMutation({
    mutationFn: () => paymentApi.approve(id, token),
    onSuccess: (result) => queryClient.setQueryData(['approval', id], result),
  });

  let body;
  if (details.isLoading) body = <Spinner label="Loading the payment" />;
  else if (details.isError) {
    body = (
      <>
        <XCircle size={48} strokeWidth={1.5} className="pay-failed-icon" aria-hidden="true" />
        <h1>This link doesn't work</h1>
        <p className="muted">{details.error.fieldErrors?.token ?? details.error.message}</p>
      </>
    );
  } else {
    const payment = details.data;
    const waiting = ['Created', 'Awaiting approval'].includes(payment.status);
    body = (
      <>
        <p className="small muted">Pay {payment.payee}</p>
        <p className="pay-amount">{formatINR(payment.amount)}</p>
        <p className="small muted mono">{payment.reference}</p>
        {waiting && (
          <>
            <button type="button" className="btn btn-primary btn-large btn-full" disabled={approve.isPending} onClick={() => approve.mutate()}>
              <ShieldCheck size={18} aria-hidden="true" />
              {approve.isPending ? 'Approving...' : `Approve ${formatINR(payment.amount)}`}
            </button>
            <FormError error={approve.error} />
            <p className="small muted">This is a demo payment. Approving it moves no real money.</p>
          </>
        )}
        {payment.status === 'Succeeded' && (
          <div role="status" className="stack approve-done">
            <SuccessMark />
            <h1>Payment approved</h1>
            <p className="muted">You can close this page. The other screen has moved on by itself.</p>
          </div>
        )}
        {['Failed', 'Expired', 'Refunded'].includes(payment.status) && (
          <p className="form-error" role="alert">This payment is no longer waiting for approval.</p>
        )}
      </>
    );
  }

  return (
    <main className="approve-page">
      <div className="approve-card stack">
        <Logo />
        {body}
      </div>
    </main>
  );
}
