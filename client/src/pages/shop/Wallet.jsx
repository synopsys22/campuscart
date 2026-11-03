import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone, Wallet as WalletIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { walletApi } from '../../api/index.js';
import { AnimatedNumber } from '../../components/motion.jsx';
import { PaymentGateway } from '../../components/payment.jsx';
import { EmptyState, ErrorState, Pagination, SkeletonRows } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatDateTime, formatINR } from '../../utils/format.js';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

function TopUp({ summary, onAdded }) {
  const [amount, setAmount] = useState('1000');
  const [method, setMethod] = useState('MOCK_UPI');
  const [paying, setPaying] = useState(null);
  const value = Number(amount);
  const room = summary.balanceMax - summary.balance;
  let error = null;
  if (!Number.isInteger(value) || value < summary.topupMin) error = `Add at least ${formatINR(summary.topupMin)}.`;
  else if (value > summary.topupMax) error = `Add at most ${formatINR(summary.topupMax)} at a time.`;
  else if (value > room) error = `A wallet holds up to ${formatINR(summary.balanceMax)}, so you can add ${formatINR(Math.max(room, 0))} more.`;

  const request = useMemo(() => paying && { purpose: 'wallet_topup', amount: paying }, [paying]);
  const onPaid = useCallback(
    (payment) => {
      onAdded(payment.amount);
      setTimeout(() => setPaying(null), 900);
    },
    [onAdded],
  );

  return (
    <section className="panel" aria-labelledby="topup-heading">
      <h2 id="topup-heading">Add money</h2>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!error) setPaying(value);
        }}
      >
        <div className="chip-row" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((quick) => (
            <button key={quick} type="button" className={`chip ${value === quick ? 'chip-on' : ''}`} aria-pressed={value === quick} onClick={() => setAmount(String(quick))}>
              {formatINR(quick)}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="topup-amount">Amount (₹)</label>
          <input
            id="topup-amount"
            className="input"
            inputMode="numeric"
            value={amount}
            aria-invalid={Boolean(error)}
            aria-describedby="topup-help"
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
          />
          <p id="topup-help" className={error ? 'field-error' : 'field-hint'}>
            {error ?? `Between ${formatINR(summary.topupMin)} and ${formatINR(summary.topupMax)} at a time.`}
          </p>
        </div>
        <div className="pay-tabs" role="group" aria-label="Pay with">
          <button type="button" aria-pressed={method === 'MOCK_UPI'} onClick={() => setMethod('MOCK_UPI')}>
            <Smartphone size={16} aria-hidden="true" /> UPI
          </button>
          <button type="button" aria-pressed={method === 'MOCK_CARD'} onClick={() => setMethod('MOCK_CARD')}>
            <CreditCard size={16} aria-hidden="true" /> Card
          </button>
        </div>
        <button type="submit" className="btn btn-primary" disabled={Boolean(error)}>
          Add {error ? 'money' : formatINR(value)}
        </button>
      </form>
      {paying && (
        <PaymentGateway
          method={method}
          request={request}
          finishingLabel="Adding it to your wallet..."
          onPaid={onPaid}
          onClose={() => setPaying(null)}
        />
      )}
    </section>
  );
}

export default function Wallet() {
  usePageTitle('Wallet');
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wallet', 'statement', page],
    queryFn: () => walletApi.get({ page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const onAdded = useCallback(
    (amount) => {
      toast.success(`Added ${formatINR(amount)} to your wallet`);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setUser({ ...user, walletBalance: (user.walletBalance ?? 0) + amount });
    },
    [queryClient, setUser, user],
  );

  if (isLoading) return <SkeletonRows />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const { summary } = data;

  return (
    <div className="stack-lg">
      <h1>Wallet</h1>
      <div className="panel-grid wallet-grid">
        <section className="wallet-balance" aria-labelledby="balance-heading">
          <WalletIcon size={22} aria-hidden="true" />
          <h2 id="balance-heading" className="small">CampusCart balance</h2>
          <p className="wallet-amount" data-testid="wallet-balance"><AnimatedNumber value={summary.balance} format={formatINR} /></p>
          <p className="small">Pay for orders in one tap. Refunds for wallet and cash orders come back here.</p>
          <p className="small wallet-demo">Demo money only. It cannot be withdrawn.</p>
        </section>
        <TopUp summary={summary} onAdded={onAdded} />
      </div>

      <section className="stack" aria-labelledby="statement-heading">
        <h2 id="statement-heading">Statement</h2>
        {data.items.length === 0 ? (
          <EmptyState icon={WalletIcon} title="No wallet activity yet">Money you add, spend and get back appears here.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Details</th><th className="num">Amount</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {data.items.map((line) => (
                  <tr key={line._id}>
                    <td className="small">{formatDateTime(line.createdAt)}</td>
                    <td>
                      <span className="row statement-line">
                        {line.type === 'credit'
                          ? <ArrowDownLeft size={16} className="summary-good" aria-hidden="true" />
                          : <ArrowUpRight size={16} className="muted" aria-hidden="true" />}
                        {line.order ? <Link to={`/account/orders/${line.order}`} className="text-link">{line.description}</Link> : line.description}
                      </span>
                    </td>
                    <td className={`num ${line.type === 'credit' ? 'summary-good' : ''}`}>
                      {line.type === 'credit' ? '+' : '-'}{formatINR(line.amount)}
                    </td>
                    <td className="num">{formatINR(line.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data.meta} onPage={setPage} />
      </section>
    </div>
  );
}
