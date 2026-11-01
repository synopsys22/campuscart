import { useMutation } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FormError, SelectField, TextField } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePageTitle } from '../../hooks/shop.js';

const DEMO_ACCOUNTS = [
  { label: 'Student', icon: GraduationCap, email: 'student@campuscart.dev', password: 'Student@123' },
  { label: 'Admin', icon: ShieldCheck, email: 'admin@campuscart.dev', password: 'Admin@123' },
];

function useAfterAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  return (account) => {
    const destination = location.state?.from ?? (account.role === 'admin' ? '/admin' : '/');
    navigate(destination, { replace: true });
  };
}

function RedirectIfLoggedIn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate('/', { replace: true });
    // Only checked when the page opens. Login itself navigates through useAfterAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function Login() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const finish = useAfterAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });

  const submit = useMutation({
    mutationFn: login,
    onSuccess: (account) => {
      toast.success(`Welcome back, ${account.name.split(' ')[0]}`);
      finish(account);
    },
  });
  const errors = submit.error?.fieldErrors ?? {};

  return (
    <div className="container page auth">
      <RedirectIfLoggedIn />
      <h1>Log in</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate(form);
        }}
      >
        <TextField label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {!submit.error?.fieldErrors && <FormError error={submit.error} />}
        <button type="submit" className="btn btn-primary btn-large" disabled={submit.isPending}>
          {submit.isPending ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <section className="demo-accounts" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="small">Try a demo account</h2>
        <div className="demo-buttons">
          {DEMO_ACCOUNTS.map(({ label, icon: Icon, email, password }) => (
            <button key={label} type="button" className="btn" disabled={submit.isPending} onClick={() => submit.mutate({ email, password })}>
              <Icon size={16} aria-hidden="true" /> Log in as {label}
            </button>
          ))}
        </div>
      </section>

      <p className="muted small">
        New here?{' '}
        <Link to="/register" state={location.state} className="text-link">Create an account</Link>
      </p>
    </div>
  );
}

export function Register() {
  usePageTitle('Create an account');
  const { register } = useAuth();
  const finish = useAfterAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', college: '', branch: 'CSE', semester: '' });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = useMutation({
    mutationFn: () => register({ ...form, semester: form.semester || undefined }),
    onSuccess: (account) => {
      toast.success(`Welcome to CampusCart, ${account.name.split(' ')[0]}`);
      finish(account);
    },
  });
  const errors = submit.error?.fieldErrors ?? {};

  return (
    <div className="container page auth">
      <RedirectIfLoggedIn />
      <h1>Create an account</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <TextField label="Full name" autoComplete="name" value={form.name} error={errors.name} onChange={set('name')} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={set('email')} />
        <TextField label="Password" type="password" autoComplete="new-password" hint="Use at least 8 characters." value={form.password} error={errors.password} onChange={set('password')} />
        <TextField label="College (optional)" value={form.college} error={errors.college} onChange={set('college')} />
        <div className="form-row">
          <TextField label="Branch (optional)" value={form.branch} error={errors.branch} onChange={set('branch')} />
          <SelectField label="Semester (optional)" value={form.semester} error={errors.semester} onChange={set('semester')}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
        </div>
        {!submit.error?.fieldErrors && <FormError error={submit.error} />}
        <button type="submit" className="btn btn-primary btn-large" disabled={submit.isPending}>
          {submit.isPending ? 'Creating your account...' : 'Create account'}
        </button>
      </form>
      <p className="muted small">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="text-link">Log in</Link>
      </p>
    </div>
  );
}
