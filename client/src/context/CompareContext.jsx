import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'campuscart-compare';
export const MAX_COMPARE = 4;
const CompareContext = createContext(null);

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

/** Products chosen for comparison, kept between visits. Needs no login. */
export function CompareProvider({ children }) {
  const [items, setItems] = useState(readSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Comparison still works for this visit.
    }
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      has: (id) => items.some((item) => item._id === id),
      toggle: (product) => {
        if (items.some((item) => item._id === product._id)) {
          setItems(items.filter((item) => item._id !== product._id));
          return;
        }
        if (items.length >= MAX_COMPARE) {
          toast.error(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
          return;
        }
        const { _id, name, slug, images } = product;
        setItems([...items, { _id, name, slug, image: images?.[0] ?? '' }]);
      },
      remove: (id) => setItems(items.filter((item) => item._id !== id)),
      clear: () => setItems([]),
    }),
    [items],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  return useContext(CompareContext);
}
