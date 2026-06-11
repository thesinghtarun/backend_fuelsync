const mongoose = require("mongoose");

const foodDataSchema = new mongoose.Schema(
  {
    food_name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 100,
    },

    calories: {
      type: Number,
      required: true,
    },

    fats: {
      type: Number,
      required: true,
    },

    protein: {
      type: Number,
      required: true,
    },

    carbs: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const FOODDATA = mongoose.model(
  "FOODDATA",
  foodDataSchema
);

module.exports =  FOODDATA ;