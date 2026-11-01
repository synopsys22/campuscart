import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categoryApi, productApi, uploadImage } from '../../api/index.js';
import {
  ConfirmDialog,
  ErrorState,
  FormError,
  Modal,
  Pagination,
  SelectField,
  SkeletonRows,
  TextArea,
  TextField,
} from '../../components/ui.jsx';
import { useDebounce, usePageTitle } from '../../hooks/shop.js';
import { formatINR } from '../../utils/format.js';
import { CheckField, useAdminMutation } from './shared.jsx';

const SLOTS = ['laptop', 'mouse', 'keyboard', 'monitor', 'headset', 'storage', 'bag'];

const toLines = (list) => (list ?? []).join('\n');
const fromLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const fromCommas = (text) => text.split(',').map((part) => part.trim()).filter(Boolean);

function ImageEditor({ images, onChange }) {
  const [error, setError] = useState(null);
  const upload = useAdminMutation(uploadImage, {
    quietErrors: true,
    onDone: ({ url }) => {
      setError(null);
      onChange([...images, url]);
    },
  });
  return (
    <div className="stack">
      <p className="small"><strong>Images</strong></p>
      <div className="image-list">
        {images.map((image) => (
          <div className="image-item" key={image}>
            <img src={image} alt="" />
            <button type="button" className="icon-btn" aria-label="Remove image" onClick={() => onChange(images.filter((item) => item !== image))}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div>
        <label className="btn btn-small">
          <ImagePlus size={14} aria-hidden="true" /> {upload.isPending ? 'Uploading...' : 'Upload image'}
          <input
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            data-testid="product-image-input"
            onChange={(event) => {
              const file = event.target.files[0];
              event.target.value = '';
              if (file) upload.mutate(file, { onError: setError });
            }}
          />
        </label>
      </div>
      <p className="field-hint">JPG, PNG or WebP, up to 2 MB.</p>
      <FormError error={error} />
    </div>
  );
}

function SpecsEditor({ specs, onChange }) {
  const update = (index, key, value) =>
    onChange(specs.map((spec, i) => (i === index ? { ...spec, [key]: value } : spec)));
  return (
    <fieldset className="stack plain-fieldset">
      <legend className="small"><strong>Specifications</strong></legend>
      {specs.map((spec, index) => (
        <div className="spec-row" key={index}>
          <input className="input" aria-label={`Spec ${index + 1} group`} placeholder="Group" value={spec.group} onChange={(e) => update(index, 'group', e.target.value)} />
          <input className="input" aria-label={`Spec ${index + 1} name`} placeholder="Name" value={spec.key} onChange={(e) => update(index, 'key', e.target.value)} />
          <input className="input" aria-label={`Spec ${index + 1} value`} placeholder="Value" value={spec.value} onChange={(e) => update(index, 'value', e.target.value)} />
          <button type="button" className="icon-btn" aria-label={`Remove spec ${index + 1}`} onClick={() => onChange(specs.filter((_, i) => i !== index))}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-small" onClick={() => onChange([...specs, { group: 'General', key: '', value: '' }])}>
          <Plus size={14} aria-hidden="true" /> Add spec
        </button>
      </div>
    </fieldset>
  );
}

function ProductForm({ product, categories, onClose }) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    sku: product?.sku ?? '',
    category: product?.category?._id ?? categories[0]?._id ?? '',
    price: product?.price ?? '',
    mrp: product?.mrp ?? '',
    stock: product?.stock ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 5,
    description: product?.description ?? '',
    highlights: toLines(product?.highlights),
    tags: (product?.tags ?? []).join(', '),
    setupSlot: product?.setupSlot ?? '',
    semesters: (product?.semesters ?? []).join(', '),
    isFeatured: product?.isFeatured ?? false,
    isActive: product?.isActive ?? true,
    images: product?.images ?? [],
    specs: (product?.specs ?? []).map(({ group, key, value }) => ({ group, key, value })),
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useAdminMutation(
    (body) => (product ? productApi.update(product._id, body) : productApi.create(body)),
    {
      quietErrors: true,
      success: product ? 'Product saved' : 'Product created',
      invalidate: ['admin-products', 'products', 'product', 'product-filters', 'analytics-low', 'analytics-summary', 'setup-slots'],
      onDone: onClose,
    },
  );
  const errors = save.error?.fieldErrors ?? {};

  const submit = (event) => {
    event.preventDefault();
    save.mutate({
      ...form,
      highlights: fromLines(form.highlights),
      tags: fromCommas(form.tags),
      semesters: fromCommas(form.semesters).map(Number).filter((n) => n >= 1 && n <= 8),
      setupSlot: form.setupSlot || null,
    });
  };

  return (
    <Modal title={product ? `Edit ${product.name}` : 'Add a product'} onClose={onClose} wide>
      <form className="stack" onSubmit={submit}>
        <div className="form-row">
          <TextField label="Name" value={form.name} error={errors.name} onChange={set('name')} />
          <TextField label="Brand" value={form.brand} error={errors.brand} onChange={set('brand')} />
        </div>
        <div className="form-row">
          <TextField label="SKU" className="input mono" value={form.sku} error={errors.sku} onChange={set('sku')} />
          <SelectField label="Category" value={form.category} error={errors.category} onChange={set('category')}>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </SelectField>
        </div>
        <div className="form-row">
          <TextField label="Price (₹)" inputMode="numeric" value={form.price} error={errors.price} onChange={set('price')} />
          <TextField label="MRP (₹)" inputMode="numeric" value={form.mrp} error={errors.mrp} onChange={set('mrp')} />
          <TextField label="Stock" inputMode="numeric" value={form.stock} error={errors.stock} onChange={set('stock')} />
          <TextField label="Low-stock alert at" inputMode="numeric" value={form.lowStockThreshold} error={errors.lowStockThreshold} onChange={set('lowStockThreshold')} />
        </div>
        <TextArea label="Description" value={form.description} error={errors.description} onChange={set('description')} />
        <TextArea label="Highlights" hint="One per line." rows={3} value={form.highlights} error={errors.highlights} onChange={set('highlights')} />
        <div className="form-row">
          <TextField label="Tags" hint="Separate with commas." value={form.tags} error={errors.tags} onChange={set('tags')} />
          <TextField label="Semesters" hint="For example 3, 5" value={form.semesters} error={errors.semesters} onChange={set('semesters')} />
          <SelectField label="Build Your Setup slot" value={form.setupSlot} error={errors.setupSlot} onChange={set('setupSlot')}>
            <option value="">None</option>
            {SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </SelectField>
        </div>
        <ImageEditor images={form.images} onChange={(images) => setForm({ ...form, images })} />
        <SpecsEditor specs={form.specs} onChange={(specs) => setForm({ ...form, specs })} />
        <div className="row">
          <CheckField label="Featured on the home page" checked={form.isFeatured} onChange={(isFeatured) => setForm({ ...form, isFeatured })} />
          <CheckField label="Visible in the store" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </div>
        <FormError error={save.error} />
        {Object.keys(errors).length > 0 && (
          <ul className="field-error">
            {Object.entries(errors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}
          </ul>
        )}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : product ? 'Save product' : 'Create product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminProducts() {
  usePageTitle('Manage products');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const term = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-products', term, page],
    queryFn: () => productApi.list({ q: term, page, limit: 15, includeInactive: 'true', sort: 'newest' }),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list() });
  const remove = useAdminMutation((id) => productApi.remove(id), {
    success: 'Product hidden from the store',
    invalidate: ['admin-products', 'products', 'product-filters', 'analytics-low'],
    onDone: () => setRemoving(null),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Products</h1>
        <button type="button" className="btn btn-primary" disabled={!categories.data} onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" /> Add product
        </button>
      </div>
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          className="input"
          placeholder="Search by name, brand or SKU"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {data && <span className="small muted">{data.meta.total} products</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th><span className="visually-hidden">Image</span></th>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th>Status</th>
                <th><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((product) => (
                <tr key={product._id}>
                  <td><img className="table-image" src={product.images[0]} alt="" /></td>
                  <td>
                    {product.name}
                    <div className="small muted mono">{product.sku}</div>
                  </td>
                  <td>{product.category?.name}</td>
                  <td className="num">{formatINR(product.price)}</td>
                  <td className="num">{product.stock}</td>
                  <td>
                    <span className={`badge ${product.isActive ? 'badge-success' : ''}`}>{product.isActive ? 'Visible' : 'Hidden'}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="text-link small" aria-label={`Edit ${product.name}`} onClick={() => setEditing(product)}>Edit</button>
                      {product.isActive && (
                        <button type="button" className="text-link small" aria-label={`Hide ${product.name}`} onClick={() => setRemoving(product)}>Hide</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {editing && (
        <ProductForm
          product={editing._id ? editing : null}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Hide ${removing.name}?`}
          confirmLabel="Hide product"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          It disappears from the store, and past orders keep their details. You can make it visible again by editing it.
        </ConfirmDialog>
      )}
    </div>
  );
}

function StockRow({ product }) {
  const [value, setValue] = useState(String(product.stock));
  const save = useAdminMutation((stock) => productApi.setStock(product._id, stock), {
    success: `Updated stock for ${product.name}`,
    invalidate: ['admin-inventory', 'admin-products', 'products', 'product', 'analytics-low', 'analytics-summary', 'setup-slots'],
  });
  const changed = value !== String(product.stock);
  const low = product.stock <= product.lowStockThreshold;
  return (
    <tr>
      <td><img className="table-image" src={product.images[0]} alt="" /></td>
      <td>
        {product.name}
        <div className="small muted mono">{product.sku}</div>
      </td>
      <td>{product.category?.name}</td>
      <td className="num">{product.lowStockThreshold}</td>
      <td>{low ? <span className={`badge ${product.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>{product.stock === 0 ? 'Sold out' : 'Low'}</span> : <span className="badge badge-success">OK</span>}</td>
      <td>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed) save.mutate(Number(value));
          }}
        >
          <label className="visually-hidden" htmlFor={`stock-${product._id}`}>Stock for {product.name}</label>
          <input
            id={`stock-${product._id}`}
            className="input stock-input"
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn btn-small" disabled={!changed || value === '' || save.isPending}>Save</button>
        </form>
      </td>
    </tr>
  );
}

export function AdminInventory() {
  usePageTitle('Inventory');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search);
  const lowOnly = params.get('lowStock') === 'true';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-inventory', term, page, lowOnly],
    queryFn: () =>
      productApi.list({ q: term, page, limit: 15, sort: 'newest', lowStock: lowOnly ? 'true' : undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <h1>Inventory</h1>
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="inventory-search">Search inventory</label>
        <input
          id="inventory-search"
          className="input"
          placeholder="Search by name, brand or SKU"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <CheckField
          label="Low stock only"
          checked={lowOnly}
          onChange={(checked) => {
            setParams(checked ? { lowStock: 'true' } : {});
            setPage(1);
          }}
        />
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th><span className="visually-hidden">Image</span></th>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Alert at</th>
                <th>State</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {/* The key includes stock, so the box resets once a save has refreshed the row. */}
              {data.items.map((product) => <StockRow key={`${product._id}-${product.stock}`} product={product} />)}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}

function CategoryForm({ category, onClose }) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    description: category?.description ?? '',
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  });
  const save = useAdminMutation(
    (body) => (category ? categoryApi.update(category._id, body) : categoryApi.create(body)),
    {
      quietErrors: true,
      success: category ? 'Category saved' : 'Category created',
      invalidate: ['categories', 'admin-categories', 'product-filters'],
      onDone: onClose,
    },
  );
  const errors = save.error?.fieldErrors ?? {};
  return (
    <Modal title={category ? `Edit ${category.name}` : 'Add a category'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(form);
        }}
      >
        <TextField label="Name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextArea label="Description" rows={2} value={form.description} error={errors.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <TextField label="Sort order" inputMode="numeric" value={form.sortOrder} error={errors.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        <CheckField label="Visible in the store" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        {!save.error?.fieldErrors && <FormError error={save.error} />}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : category ? 'Save category' : 'Create category'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCategories() {
  usePageTitle('Manage categories');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => categoryApi.list({ includeInactive: 'true' }),
  });
  const filters = useQuery({ queryKey: ['product-filters'], queryFn: productApi.filters });
  const count = (id) => filters.data?.categories.find((category) => category._id === id)?.count ?? 0;
  const remove = useAdminMutation((id) => categoryApi.remove(id), {
    success: 'Category deleted',
    invalidate: ['categories', 'admin-categories', 'product-filters'],
    onDone: () => setRemoving(null),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Categories</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" /> Add category
        </button>
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Description</th><th className="num">Products</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td>
                  <td className="muted">{category.description}</td>
                  <td className="num">{count(category._id)}</td>
                  <td><span className={`badge ${category.isActive ? 'badge-success' : ''}`}>{category.isActive ? 'Visible' : 'Hidden'}</span></td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="text-link small" aria-label={`Edit ${category.name}`} onClick={() => setEditing(category)}>Edit</button>
                      <button type="button" className="text-link small" aria-label={`Delete ${category.name}`} onClick={() => setRemoving(category)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CategoryForm category={editing._id ? editing : null} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          confirmLabel="Delete category"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          A category that still has products can't be deleted. Move those products first.
        </ConfirmDialog>
      )}
    </div>
  );
}
