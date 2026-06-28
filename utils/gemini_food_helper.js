const { generateContentWithFallback } = require("./gemini");
const { parseGeminiJson } = require("./food_helper");

const getNutritionFor100g = async (foodName) => {
    const response = await generateContentWithFallback({
        model: "gemini-2.5-flash",
        contents: [
            {
                text: `Provide average nutritional values per 100 grams of "${foodName}".
Return ONLY valid JSON — no markdown, no explanation.
{
  "food_name":"${foodName}",
  "quantity":100,
  "calories":0,
  "protein":0,
  "carbs":0,
  "fats":0,
  "fiber":0
}`,
            },
        ],
    });

    return parseGeminiJson(response.text);
};

const getOrCreateFoodDataFromGemini = async (foodName) => {
    const { normalizeFoodName } = require("./food_helper");
    const normalizedName = String(foodName || "").toLowerCase().trim();
    const gemini = await getNutritionFor100g(normalizedName);
    if (!gemini) return null;
    return {
        food_name: normalizedName,
        quantity:  100,
        calories:  gemini.calories || 0,
        protein:   gemini.protein  || 0,
        carbs:     gemini.carbs    || 0,
        fats:      gemini.fats     || 0,
        fiber:     gemini.fiber    || 0,
    };
};

module.exports = { getNutritionFor100g, getOrCreateFoodDataFromGemini };