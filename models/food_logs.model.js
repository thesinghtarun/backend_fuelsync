const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
    {
        food_name: {
            type: String,
            required: true,
        },

        quantity_grams: {
            type: Number,
            required: true,
        },

        calories: {
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

        fat: {
            type: Number,
            required: true,
        },

        fiber: {
            type: Number,
            required: true,
        },
    },
    {
        _id: false,
    }
);

const mealSchema = new mongoose.Schema(
    {
        firebase_uid: {
            type: String,
            required: true,
            index: true,
        },

        foods: {
            type: [foodSchema],
            required: true,
        },

        total_calories: {
            type: Number,
            required: true,
            default: 0,
        },

        total_protein: {
            type: Number,
            required: true,
            default: 0,
        },

        total_carbs: {
            type: Number,
            required: true,
            default: 0,
        },

        total_fat: {
            type: Number,
            required: true,
            default: 0,
        },

        total_fiber: {
            type: Number,
            required: true,
            default: 0,
        },

        image_url: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const FOODLOGS = mongoose.model(
    "FOODLOGS",
    mealSchema,
);

module.exports = FOODLOGS;