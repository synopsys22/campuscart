import mongoose from 'mongoose';

// Holds running numbers, such as the sequence used for order numbers.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);
