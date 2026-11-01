import mongoose from 'mongoose';

export const SETUP_SLOTS = ['laptop', 'mouse', 'keyboard', 'monitor', 'headset', 'storage', 'bag'];

const specSchema = new mongoose.Schema(
  {
    group: { type: String, trim: true, default: 'General' },
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    brand: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    highlights: [{ type: String, trim: true }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    // Money is stored in whole rupees to avoid decimal rounding errors.
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    images: [{ type: String }],
    specs: [specSchema],
    setupSlot: { type: String, enum: [...SETUP_SLOTS, null], default: null },
    semesters: [{ type: Number, min: 1, max: 8 }],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, soldCount: -1 });

export const Product = mongoose.model('Product', productSchema);
