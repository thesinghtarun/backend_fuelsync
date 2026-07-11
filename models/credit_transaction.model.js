const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    firebase_uid: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    balance_after: { type: Number, required: true },
  },
  { timestamps: true }
);

const CREDIT_TRANSACTIONS = mongoose.model(
  "CREDIT_TRANSACTIONS",
  creditTransactionSchema
);

module.exports = CREDIT_TRANSACTIONS;
