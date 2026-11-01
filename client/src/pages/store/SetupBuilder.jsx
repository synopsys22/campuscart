import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Save, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { cartApi, setupApi } from '../../api/index.js';
import { AnimatedNumber, useSmoothList } from '../../components/motion.jsx';
import { ProductImage } from '../../components/product.jsx';
import { ErrorState, PathCrumbs, Price, SkeletonRows, TextField } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { announceBulkAdd, usePageTitle, useRequireLogin } from '../../hooks/shop.js';
import { formatINR } from '../../utils/format.js';

function SlotPicker({ slot, chosenId, onChoose }) {
  return (
    <section className="slot" aria-labelledby={`slot-${slot.slot}`}>
      <h2 id={`slot-${slot.slot}`} className="slot-title">{slot.label}</h2>
      <div className="slot-options" role="radiogroup" aria-labelledby={`slot-${slot.slot}`}>
        {slot.products.map((product) => {
          const chosen = chosenId === product._id;
          return (
            <button
              type="button"
              key={product._id}
              role="radio"
              aria-checked={chosen}
              className={`slot-option ${chosen ? 'slot-option-on' : ''}`}
              onClick={() => onChoose(slot.slot, chosen ? null : product)}
            >
              <ProductImage src={product.images?.[0]} alt="" className="slot-image" />
              <span className="slot-name">{product.name}</span>
              <Price price={product.price} />
              {chosen && <Check size={16} className="slot-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BudgetMeter({ total, budget }) {
  if (!budget) return null;
  const percent = Math.min((total / budget) * 100, 100);
  const over = total > budget;
  return (
    <div className="budget">
      <div className={`budget-bar ${over ? 'budget-over' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(total, budget)} aria-label="Budget used">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className={`small ${over ? 'budget-text-over' : 'muted'}`}>
        {over ? `${formatINR(total - budget)} over budget` : `${formatINR(budget - total)} left in your budget`}
      </p>
    </div>
  );
}

export default function SetupBuilder() {
  usePageTitle('Build Your Setup');
  const buildRef = useSmoothList();
  const { user } = useAuth();
  const requireLogin = useRequireLogin();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const editId = params.get('setup');

  const [chosen, setChosen] = useState({});
  const [budget, setBudget] = useState('');
  const [name, setName] = useState('My setup');
  const [savedId, setSavedId] = useState(null);

  const slots = useQuery({ queryKey: ['setup-slots'], queryFn: setupApi.slots });
  const saved = useQuery({ queryKey: ['setups'], queryFn: setupApi.mine, enabled: Boolean(user) });

  // Opening a saved build from the account page loads it into the builder.
  useEffect(() => {
    const build = saved.data?.find((setup) => setup._id === editId);
    if (!build) return;
    setChosen(Object.fromEntries(build.slots.map((entry) => [entry.slot, entry.product])));
    setBudget(build.budget ?? '');
    setName(build.name);
    setSavedId(build._id);
  }, [saved.data, editId]);

  const picks = useMemo(() => Object.entries(chosen).filter(([, product]) => product), [chosen]);
  const total = picks.reduce((sum, [, product]) => sum + product.price, 0);
  const choose = (slot, product) => setChosen((current) => ({ ...current, [slot]: product }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        budget: budget === '' ? null : Number(budget),
        slots: picks.map(([slot, product]) => ({ slot, product: product._id })),
      };
      return savedId ? setupApi.update(savedId, body) : setupApi.create(body);
    },
    onSuccess: (setup) => {
      setSavedId(setup._id);
      queryClient.invalidateQueries({ queryKey: ['setups'] });
      toast.success(`Saved ${setup.name}`);
    },
    onError: (error) => toast.error(error.fieldErrors?.name ?? error.message),
  });

  // Works on the current picks, including a build that hasn't been saved.
  const addAll = useMutation({
    mutationFn: async () => {
      const added = [];
      const skipped = [];
      let cart = null;
      for (const [, product] of picks) {
        try {
          cart = await cartApi.add(product._id, 1);
          added.push({ name: product.name });
        } catch (error) {
          skipped.push({ name: product.name, reason: error.message });
        }
      }
      return { cart, added, skipped };
    },
    onSuccess: (result) => {
      if (result.cart) queryClient.setQueryData(['cart'], result.cart);
      announceBulkAdd(result);
    },
  });

  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'setup-builder' }]} />
      <div className="page-intro">
        <h1>Build Your Setup</h1>
        <p className="muted">Choose one item per slot and watch the total against your budget. Choosing is free, and nothing is bought until you check out.</p>
      </div>

      {slots.isLoading && <SkeletonRows />}
      {slots.isError && <ErrorState error={slots.error} onRetry={slots.refetch} />}

      {slots.data && (
        <div className="builder">
          <div className="builder-slots">
            {slots.data.map((slot) => (
              <SlotPicker key={slot.slot} slot={slot} chosenId={chosen[slot.slot]?._id} onChoose={choose} />
            ))}
          </div>

          <aside className="summary builder-summary">
            <h2>Your build</h2>
            <TextField label="Build name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Budget (₹, optional)" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} />
            {picks.length === 0 ? (
              <p className="muted small">Pick something from a slot to start.</p>
            ) : (
              <ul className="build-list" ref={buildRef}>
                {picks.map(([slot, product]) => (
                  <li key={slot}>
                    <span>{product.name}</span>
                    <span className="small">{formatINR(product.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="summary-rows">
              <div className="summary-total">
                <dt>Total</dt>
                <dd data-testid="setup-total"><AnimatedNumber value={total} format={formatINR} /></dd>
              </div>
            </dl>
            <BudgetMeter total={total} budget={Number(budget)} />
            <button
              type="button"
              className="btn btn-primary btn-full"
              disabled={picks.length === 0 || addAll.isPending}
              onClick={() => {
                if (requireLogin('Log in to add your build to the cart.')) addAll.mutate();
              }}
            >
              <ShoppingCart size={16} aria-hidden="true" /> {addAll.isPending ? 'Adding...' : 'Add all to cart'}
            </button>
            <button
              type="button"
              className="btn btn-full"
              disabled={picks.length === 0 || save.isPending}
              onClick={() => {
                if (requireLogin('Log in to save your build.')) save.mutate();
              }}
            >
              <Save size={16} aria-hidden="true" /> {savedId ? 'Update saved build' : 'Save build'}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
