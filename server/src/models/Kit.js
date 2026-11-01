import mongoose from 'mongoose';

const kitItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, min: 1, default: 1 },
  },
  { _id: false },
);

const kitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true, trim: true },
    audience: { type: String, trim: true, default: '' },
    semester: { type: Number, min: 1, max: 8, default: null },
    items: { type: [kitItemSchema], required: true },
    image: { type: String, default: '' },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Kit = mongoose.model('Kit', kitSchema);
