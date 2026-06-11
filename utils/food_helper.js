const FOODDATA = require("../models/food_data.model");
const { generateContentWithFallback } = require("./gemini");
const {searchFoodFromUSDA} = require("./food_search_helper");

const normalizeFoodName = (name) =>
    String(name || "")
        .toLowerCase()
        .trim();

const parseGeminiJson = (text) => {
    try {
        return JSON.parse(text);
    } catch (error) {
        const cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(cleaned);
    }
};

const calculateNutrition = (
    foodData,
    quantityGrams
) => {
    const ratio = quantityGrams / 100;

    return {
        calories: Number(
            (foodData.calories * ratio).toFixed(1)
        ),
        protein: Number(
            (foodData.protein * ratio).toFixed(1)
        ),
        carbs: Number(
            (foodData.carbs * ratio).toFixed(1)
        ),
        fat: Number(
            (foodData.fats * ratio).toFixed(1)
        ),
    };
};

const getNutritionFor100g = async (
    foodName
) => {
    const response =
        await generateContentWithFallback({
            model: "gemini-2.5-flash",
            contents: [
                {
                    text: `
Provide average nutritional values per 100 grams of "${foodName}".

Use USDA/FSSAI standard references where possible.

Return ONLY JSON.

{
  "food_name":"${foodName}",
  "quantity":100,
  "calories":0,
  "protein":0,
  "carbs":0,
  "fats":0
}
`,
                },
            ],
        });

    return parseGeminiJson(response.text);
};

const getOrCreateFoodData = async (
    foodName
) => {
    const normalizedName =
        normalizeFoodName(foodName);

    let food = await FOODDATA.findOne({
        food_name: normalizedName,
    });

    if (food) {
        return food;
    }

   const nutrition =
  await searchFoodFromUSDA(
    normalizedName
  );

if (!nutrition) {
  throw new Error(
    "Food not found"
  );
}

    food =
        await FOODDATA.findOneAndUpdate(
            {
                food_name: normalizedName,
            },
            {
                $setOnInsert: {
                    food_name: normalizedName,
                    quantity: 100,
                    calories:
                        nutrition.calories || 0,
                    protein:
                        nutrition.protein || 0,
                    carbs:
                        nutrition.carbs || 0,
                    fats:
                        nutrition.fats || 0,
                },
            },
            {
                upsert: true,
                new: true,
            }
        );

    return food;
};

module.exports = {
    parseGeminiJson,
    calculateNutrition,
    getOrCreateFoodData,
};