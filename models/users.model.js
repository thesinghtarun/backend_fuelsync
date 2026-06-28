const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },

    gender: { type: String, required: true },
    goal: { type: String, required: true },

    height: { type: String, required: true }, // feet
    weight: { type: String, required: true }, // kg
    dob: { type: String, required: true },
    activity: { type: String, required: true },

    firebase_uid: { type: String, required: true },

    age: { type: Number, default: 0 },

    bmr: { type: Number, default: 0 },

    maintenance_calories: { type: Number, default: 0 },

    target_calories: { type: Number, default: 0 },

    protein_goal: { type: Number, default: 0 },

    carbs_goal: { type: Number, default: 0 },

    fat_goal: { type: Number, default: 0 },

    fiber_goal: { type: Number, default: 0 },

    calories_to_burn: { type: Number, default: 0 },

    is_subscribed: { type: Boolean, default: false },

    credits: { type: Number, default: 10 }
  },
  {
    timestamps: true,
  }
);

const USERS = mongoose.model("USERS", userSchema);

module.exports = USERS;