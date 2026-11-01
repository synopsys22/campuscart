import {
  GitCompareArrows,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  ShoppingCart,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCompare } from '../context/CompareContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCart } from '../hooks/shop.js';
import { CommandPalette } from './CommandPalette.jsx';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="CampusCart home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect x="9" y="9" width="14" height="14" rx="2" fill="var(--accent)" />
        <path
          d="M13 9V4M19 9V4M13 28v-5M19 28v-5M4 13h5M4 19h5M23 13h5M23 19h5"
          stroke="var(--accent)"
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

function AccountMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      <button
        type="button"
        className="icon-btn"
        aria-label={`Account menu for ${user.name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <User size={18} aria-hidden="true" />
      </button>
      {open && (
        <>
          <button type="button" className="menu-backdrop" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="menu-panel">
            <p className="menu-name">
              <strong>{user.name}</strong>
              <span className="small muted">{user.email}</span>
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
          </div>
        </>
      )}
    </div>
  );
}

function CartLink() {
  const { data: cart } = useCart();
  const count = cart?.pricing.itemCount ?? 0;
  return (
    <Link to="/cart" className="icon-btn cart-link" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
      <ShoppingCart size={18} aria-hidden="true" />
      {count > 0 && <span className="cart-count mono" aria-hidden="true">{count}</span>}
    </Link>
  );
}

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-btn" aria-label={`Switch to ${next} theme`} onClick={toggleTheme}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
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
              {link.label}
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
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  );
}

export function CompareTray() {
  const compare = useCompare();
  const { pathname } = useLocation();
  if (compare.items.length === 0 || pathname === '/compare' || pathname.startsWith('/admin')) return null;
  return (
    <aside className="compare-tray" aria-label="Products to compare">
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
    </aside>
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
        </nav>
        <nav aria-label="Account links" className="footer-links">
          <h2 className="small">Account</h2>
          <Link to="/account">Profile</Link>
          <Link to="/account/orders">Orders</Link>
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
  // The braces matter: React treats a returned value as a cleanup function, and
  // current browsers return a promise from scrollTo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function StoreLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollReset />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <CompareTray />
    </>
  );
}
