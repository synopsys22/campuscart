import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/shop.js';
import { formatINR } from '../utils/format.js';

const PAGES = [
  { label: 'All products', to: '/products' },
  { label: 'Categories', to: '/categories' },
  { label: 'Project Kits', to: '/kits' },
  { label: 'Build Your Setup', to: '/setup-builder' },
  { label: 'Compare products', to: '/compare' },
  { label: 'Cart', to: '/cart' },
  { label: 'Wishlist', to: '/wishlist' },
  { label: 'My orders', to: '/account/orders' },
  { label: 'My profile', to: '/account' },
];

export function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const dialog = useRef(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const term = useDebounce(text.trim(), 180);

  const { data: products = [] } = useQuery({
    queryKey: ['suggest', term],
    queryFn: () => productApi.suggest(term),
    enabled: term.length > 0,
  });

  const options = useMemo(() => {
    const lower = text.trim().toLowerCase();
    const pages = isAdmin ? [...PAGES, { label: 'Admin dashboard', to: '/admin' }] : PAGES;
    const matchingPages = pages
      .filter((page) => page.label.toLowerCase().includes(lower))
      .map((page) => ({ key: page.to, label: page.label, to: page.to, hint: 'Page' }));
    const matchingProducts = term
      ? products.map((product) => ({
          key: product._id,
          label: product.name,
          to: `/products/${product.slug}`,
          hint: formatINR(product.price),
        }))
      : [];
    return [...matchingProducts, ...matchingPages];
  }, [text, term, products, isAdmin]);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => setActive(0), [options.length]);

  const go = (option) => {
    onClose();
    navigate(option.to);
  };

  const searchAll = () => {
    onClose();
    navigate(`/products?q=${encodeURIComponent(text.trim())}`);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % Math.max(options.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current - 1 + options.length) % Math.max(options.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (options[active]) go(options[active]);
      else if (text.trim()) searchAll();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Quick search"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="palette-inner">
        <div className="palette-search">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={options[active] ? `palette-${active}` : undefined}
            aria-label="Search products and pages"
            placeholder="Search products and pages"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="mono">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" aria-label="Results" className="palette-results">
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`palette-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'palette-active' : ''}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(option)}
            >
              <span>{option.label}</span>
              <span className="mono small muted">{option.hint}</span>
            </li>
          ))}
          {options.length === 0 && (
            <li className="palette-none muted">No matches. Press Enter to search the whole store.</li>
          )}
        </ul>
      </div>
    </dialog>
  );
}
