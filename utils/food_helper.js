const { generateContentWithFallback } = require("./gemini");
const axios = require("axios");

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

const calculateNutrition = (foodData, quantityGrams) => {
    const ratio = quantityGrams / 100;

    return {
        calories: Number((foodData.calories * ratio).toFixed(1)),
        protein:  Number((foodData.protein  * ratio).toFixed(1)),
        carbs:    Number((foodData.carbs    * ratio).toFixed(1)),
        fat:      Number(((foodData.fats || foodData.fat || 0) * ratio).toFixed(1)),
        fiber:    Number((foodData.fiber    * ratio).toFixed(1)),
    };
};

// ── Gemini fallback ────────────────────────────────────────────────────────────
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

// ── OpenFoodFacts search ───────────────────────────────────────────────────────
const searchFoodFromOpenFoodFacts = async (foodName) => {
    try {
        const response = await axios.get(
            "https://world.openfoodfacts.org/cgi/search.pl",
            {
                params: {
                    search_terms: foodName,
                    search_simple: 1,
                    action: "process",
                    json: 1,
                    page_size: 5,
                    fields: "product_name,brands,nutriments,quantity,serving_size",
                },
                timeout: 10000,
            }
        );

        const products = response.data.products || [];
        if (!products.length) {
            console.log(`No Open Food Facts results for "${foodName}"`);
            return null;
        }

        const matchedProduct = products.find(
            (p) =>
                p.nutriments &&
                (p.nutriments["energy-kcal_100g"] !== undefined ||
                    p.nutriments["energy_100g"] !== undefined)
        );

        if (!matchedProduct) {
            console.log(`No product with nutrition in Open Food Facts for "${foodName}"`);
            return null;
        }

        const n = matchedProduct.nutriments;
        const caloriesPer100g =
            n["energy-kcal_100g"] ||
            (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0);

        console.log(`Open Food Facts match: "${matchedProduct.product_name}" for "${foodName}"`);

        return {
            food_name: foodName.toLowerCase().trim(),
            quantity:  100,
            calories:  Number(caloriesPer100g.toFixed(1)),
            protein:   Number((n["proteins_100g"]       || 0).toFixed(1)),
            carbs:     Number((n["carbohydrates_100g"]   || 0).toFixed(1)),
            fats:      Number((n["fat_100g"]             || 0).toFixed(1)),
            fiber:     Number((n["fiber_100g"]           || 0).toFixed(1)),
        };
    } catch (error) {
        console.error(`Open Food Facts search failed for "${foodName}":`, error.message);
        return null;
    }
};

// ── Main resolver: OpenFoodFacts → Gemini fallback (no DB cache) ───────────────
const getFoodNutrition = async (foodName) => {
    const normalizedName = normalizeFoodName(foodName);

    // 1. Try OpenFoodFacts
    let nutrition = await searchFoodFromOpenFoodFacts(normalizedName);

    // 2. Fall back to Gemini
    if (!nutrition) {
        console.log(`"${normalizedName}" not in OpenFoodFacts — using Gemini...`);
        const gemini = await getNutritionFor100g(normalizedName);
        if (gemini) {
            nutrition = {
                food_name: normalizedName,
                quantity:  100,
                calories:  gemini.calories || 0,
                protein:   gemini.protein  || 0,
                carbs:     gemini.carbs    || 0,
                fats:      gemini.fats     || 0,
                fiber:     gemini.fiber    || 0,
            };
        }
    }

    if (!nutrition) {
        console.log(`Could not resolve nutrition for "${normalizedName}"`);
        return null;
    }

    return nutrition;
};

// Keep old name as an alias so existing call-sites in app_controller still work
const getOrCreateFoodDataFromOpenFoodFacts = getFoodNutrition;
// Gemini-only path (still used by analyze_food)
const getOrCreateFoodDataFromGemini = async (foodName) => {
    const normalizedName = normalizeFoodName(foodName);
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

module.exports = {
    parseGeminiJson,
    calculateNutrition,
    searchFoodFromOpenFoodFacts,
    getNutritionFor100g,
    getFoodNutrition,
    getOrCreateFoodDataFromOpenFoodFacts,
    getOrCreateFoodDataFromGemini,
};