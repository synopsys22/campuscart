import mongoose from 'mongoose';
import { SETUP_SLOTS } from './Product.js';

const slotSchema = new mongoose.Schema(
  {
    slot: { type: String, enum: SETUP_SLOTS, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { _id: false },
);

// A build saved from the Build Your Setup configurator.
const setupSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    budget: { type: Number, min: 0, default: null },
    slots: [slotSchema],
  },
  { timestamps: true },
);

export const Setup = mongoose.model('Setup', setupSchema);
