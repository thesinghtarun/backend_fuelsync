const FOODDATA = require("../models/food_data.model");
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
                    fields: "product_name,brands,nutriments,quantity,serving_size"
                },
                timeout: 10000,
            }
        );
        const products = response.data.products || [];
        if (!products.length) {
            console.log(`No Open Food Facts results found for "${foodName}"`);
            return null;
        }

        // Find the first product that has nutrition values
        const matchedProduct = products.find(
            (p) => p.nutriments && (p.nutriments["energy-kcal_100g"] !== undefined || p.nutriments["energy_100g"] !== undefined)
        );
        if (!matchedProduct) {
            console.log(`No product with nutrition found in Open Food Facts for "${foodName}"`);
            return null;
        }

        const nutriments = matchedProduct.nutriments;
        const caloriesPer100g = nutriments["energy-kcal_100g"] || (nutriments["energy_100g"] ? nutriments["energy_100g"] / 4.184 : 0);
        const proteinPer100g = nutriments["proteins_100g"] || 0;
        const carbsPer100g = nutriments["carbohydrates_100g"] || 0;
        const fatPer100g = nutriments["fat_100g"] || 0;

        console.log(`Open Food Facts match found: "${matchedProduct.product_name}" for query "${foodName}"`);

        return {
            food_name: foodName.toLowerCase().trim(),
            quantity: 100,
            calories: Number(caloriesPer100g.toFixed(1)),
            protein: Number(proteinPer100g.toFixed(1)),
            carbs: Number(carbsPer100g.toFixed(1)),
            fats: Number(fatPer100g.toFixed(1)),
        };
    } catch (error) {
        console.error(`Open Food Facts search failed for "${foodName}":`, error.message);
        return null;
    }
};

const getOrCreateFoodDataFromUSDA = async (
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

    try {
        // Query Open Food Facts directly instead of USDA
        let nutrition = await searchFoodFromOpenFoodFacts(normalizedName);

        // Fallback to Gemini if Open Food Facts search fails
        if (!nutrition) {
            console.log(`Food "${normalizedName}" not found in Open Food Facts. Falling back to Gemini...`);
            const geminiNutrient = await getNutritionFor100g(normalizedName);
            if (geminiNutrient) {
                nutrition = {
                    food_name: normalizedName,
                    calories: geminiNutrient.calories || 0,
                    protein: geminiNutrient.protein || 0,
                    carbs: geminiNutrient.carbs || 0,
                    fats: geminiNutrient.fats || 0,
                };
            }
        }

        if (!nutrition) {
            console.log(`Food "${normalizedName}" could not be resolved from any source.`);
            return null;
        }

        food = await FOODDATA.findOneAndUpdate(
            {
                food_name: normalizedName,
            },
            {
                $setOnInsert: {
                    food_name: normalizedName,
                    quantity: 100,
                    calories: nutrition.calories || 0,
                    protein: nutrition.protein || 0,
                    carbs: nutrition.carbs || 0,
                    fats: nutrition.fats || 0,
                },
            },
            {
                upsert: true,
                new: true,
            }
        );

        return food;
    } catch (error) {
        console.error(`Food lookup failed for "${normalizedName}":`, error.message);
        return null;
    }
};


// const getNutritionFor100g = async (
//   foodName
// ) => {
//   const response =
//     await generateContentWithFallback({
//       model: "gemini-2.5-flash",
//       contents: [
//         {
//           text: `
// Provide average nutrition values per 100 grams for "${foodName}".

// Return ONLY JSON.

// {
//   "food_name":"${foodName}",
//   "quantity":100,
//   "calories":0,
//   "protein":0,
//   "carbs":0,
//   "fats":0
// }
// `,
//         },
//       ],
//     });

//   return parseGeminiJson(
//     response.text
//   );
// };

const getOrCreateFoodDataFromGemini =
  async (foodName) => {
    const normalizedName =
      normalizeFoodName(foodName);

    let food =
      await FOODDATA.findOne({
        food_name: normalizedName,
      });

    if (food) {
      return food;
    }

    const nutrition =
      await getNutritionFor100g(
        normalizedName
      );

    food =
      await FOODDATA.create({
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
      });

    return food;
  };


module.exports = {
    parseGeminiJson,
    calculateNutrition,
    getOrCreateFoodDataFromUSDA,
    getOrCreateFoodDataFromGemini
};