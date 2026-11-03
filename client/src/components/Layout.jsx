import {
  GitCompareArrows,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sun,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCompare } from '../context/CompareContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCart } from '../hooks/shop.js';
import { CommandPalette } from './CommandPalette.jsx';
import { EASE_OUT, Enter, SPRING, ScrollProgress } from './motion.jsx';

export function Logo() {
  const gradient = useId();
  return (
    <Link to="/" className="logo" aria-label="CampusCart home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--logo-from)" />
            <stop offset="1" stopColor="var(--logo-to)" />
          </linearGradient>
        </defs>
        <rect x="9" y="9" width="14" height="14" rx="3" fill={`url(#${gradient})`} />
        <path
          d="M13 9V4M19 9V4M13 28v-5M19 28v-5M4 13h5M4 19h5M23 13h5M23 19h5"
          stroke="var(--logo-from)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>CampusCart</span>
    </Link>
  );
}

const NAV_LINKS = [
  { to: '/products', label: 'Shop' },
  { to: '/kits', label: 'Project Kits' },
  { to: '/setup-builder', label: 'Build Your Setup' },
  { to: '/categories', label: 'Categories' },
];

/** Says which kind of account is logged in. */
function RolePill() {
  const { isAdmin } = useAuth();
  return <span className={`role-pill ${isAdmin ? 'role-pill-admin' : ''}`}>{isAdmin ? 'Admin' : 'Student'}</span>;
}

/** On every page for an admin: which mode they are in, and the way across to the other side. */
function AdminStrip() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  if (!isAdmin) return null;
  const managing = pathname.startsWith('/admin');
  return (
    <aside className="admin-strip" aria-label="Admin mode">
      <div className="container admin-strip-inner">
        <ShieldCheck size={16} aria-hidden="true" />
        <strong>Admin mode</strong>
        <span className="admin-strip-note">
          {managing ? 'You are managing the store.' : 'You are viewing the store as customers see it.'}
        </span>
        <Link to={managing ? '/' : '/admin'}>{managing ? 'View the store' : 'Go to dashboard'}</Link>
      </div>
    </aside>
  );
}

function AccountMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!user) {
    return (
      <Link to="/login" state={{ from: location.pathname + location.search }} className="btn btn-small">
        Log in
      </Link>
    );
  }

  return (
    <div className="menu">
      <RolePill />
      <button
        type="button"
        className="icon-btn"
        aria-label={`Account menu for ${user.name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <User size={18} aria-hidden="true" />
      </button>
      {open && <button type="button" className="menu-backdrop" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />}
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu-panel"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            style={{ originX: 1, originY: 0 }}
          >
            <p className="menu-name">
              <strong>{user.name}</strong>
              <span className="small muted">{user.email}</span>
              <RolePill />
            </p>
            {isAdmin && (
              <Link to="/admin">
                <LayoutDashboard size={16} aria-hidden="true" /> Admin dashboard
              </Link>
            )}
            <Link to="/account">
              <User size={16} aria-hidden="true" /> My profile
            </Link>
            <Link to="/account/orders">
              <Package size={16} aria-hidden="true" /> My orders
            </Link>
            <Link to="/account/wallet">
              <Wallet size={16} aria-hidden="true" /> Wallet
            </Link>
            <Link to="/wishlist">
              <Heart size={16} aria-hidden="true" /> Wishlist
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartLink() {
  const { data: cart } = useCart();
  const count = cart?.pricing.itemCount ?? 0;
  const reduce = useReducedMotion();
  return (
    <Link to="/cart" className="icon-btn cart-link" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
      <ShoppingCart size={18} aria-hidden="true" />
      {count > 0 && (
        <motion.span
          key={count}
          className="cart-count"
          aria-hidden="true"
          initial={reduce ? false : { scale: 1.6 }}
          animate={{ scale: 1 }}
          transition={SPRING}
        >
          {count}
        </motion.span>
      )}
    </Link>
  );
}

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const reduce = useReducedMotion();
  return (
    <button type="button" className="icon-btn" aria-label={`Switch to ${next} theme`} onClick={toggleTheme}>
      <motion.span
        key={theme}
        className="icon-swap"
        initial={reduce ? false : { rotate: -70, opacity: 0, scale: 0.7 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={SPRING}
      >
        {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </motion.span>
    </button>
  );
}

export function Header() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => setNavOpen(false), [location]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen(!navOpen)}
        >
          {navOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
        <Logo />
        <nav className={`main-nav ${navOpen ? 'main-nav-open' : ''}`} aria-label="Main">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={SPRING} />}
                  <span className="nav-label">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="header-tools">
          <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={16} aria-hidden="true" />
            <span>Search</span>
            <kbd className="mono">Ctrl K</kbd>
          </button>
          <ThemeButton />
          <CartLink />
          <AccountMenu />
        </div>
      </div>
      <ScrollProgress />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  );
}

/** The side menu on account and admin pages. The highlight slides between items. */
export function SideNav({ label, links, heading }) {
  return (
    <nav className="side-nav" aria-label={label}>
      {heading && <div className="side-head">{heading}</div>}
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId={`side-pill-${label}`} className="nav-pill" transition={SPRING} />}
              <span className="nav-label">
                {link.icon && <link.icon size={16} aria-hidden="true" />}
                {link.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** One line at the top of a page, saying what this role can do here. */
export function RoleBanner({ links }) {
  const { pathname } = useLocation();
  const current = links.find((link) => (link.end ? pathname === link.to : pathname.startsWith(link.to)));
  if (!current?.hint) return null;
  return <p className="role-banner">{current.hint}</p>;
}

export function CompareTray() {
  const compare = useCompare();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const show = compare.items.length > 0 && pathname !== '/compare' && !pathname.startsWith('/admin');
  return (
    <AnimatePresence>
      {show && <CompareTrayPanel compare={compare} reduce={reduce} />}
    </AnimatePresence>
  );
}

function CompareTrayPanel({ compare, reduce }) {
  return (
    <motion.aside
      className="compare-tray"
      aria-label="Products to compare"
      initial={reduce ? false : { y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: 60, opacity: 0, transition: { duration: 0.16 } }}
      transition={SPRING}
    >
      <div className="compare-tray-items">
        {compare.items.map((item) => (
          <img key={item._id} src={item.image} alt={item.name} title={item.name} />
        ))}
        <span className="small">
          {compare.items.length} of 4 selected
        </span>
      </div>
      <div className="row">
        <button type="button" className="btn btn-quiet btn-small" onClick={compare.clear}>
          Clear
        </button>
        <Link to="/compare" className="btn btn-primary btn-small">
          <GitCompareArrows size={14} aria-hidden="true" /> Compare
        </Link>
      </div>
    </motion.aside>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p className="muted small footer-note">
            A full-stack project built with React, Node.js, Express and MongoDB. Prices, products and payments are for
            demonstration only.
          </p>
        </div>
        <nav aria-label="Shop links" className="footer-links">
          <h2 className="small">Shop</h2>
          <Link to="/products">All products</Link>
          <Link to="/kits">Project Kits</Link>
          <Link to="/setup-builder">Build Your Setup</Link>
          <Link to="/compare">Compare</Link>
          <Link to="/track">Track a parcel</Link>
        </nav>
        <nav aria-label="Account links" className="footer-links">
          <h2 className="small">Account</h2>
          <Link to="/account">Profile</Link>
          <Link to="/account/orders">Orders</Link>
          <Link to="/account/wallet">Wallet</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/cart">Cart</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Scrolls back to the top when moving to a new page. */
function ScrollReset() {
  const { pathname } = useLocation();
  const firstPage = useRef(true);
  // The braces matter: React treats a returned value as a cleanup function, and
  // current browsers return a promise from scrollTo.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    // Screen readers and keyboards continue from the new page, not the link that was left behind.
    const main = document.getElementById('main');
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

/** Account and admin pages keep their side menu in place, and animate their own content. */
const transitionKey = (pathname) =>
  /^\/(account|admin)(\/|$)/.test(pathname) ? pathname.split('/')[1] : pathname;

export function StoreLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollReset />
      <AdminStrip />
      <Header />
      <main id="main" tabIndex={-1}>
        <Enter key={transitionKey(pathname)}>
          <Outlet />
        </Enter>
      </main>
      <Footer />
      <CompareTray />
    </>
  );
}
