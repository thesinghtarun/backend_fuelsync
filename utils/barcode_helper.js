const axios = require("axios");

/**
 * Fallback to Gemini AI to identify product and nutrition by barcode.
 */
const fallbackToGemini = async (barcode) => {
  console.log(
    `Barcode "${barcode}" lookup failed or not found in Open Food Facts. Falling back to Gemini...`
  );
  try {
    const { generateContentWithFallback } = require("./gemini");
    const { parseGeminiJson } = require("./food_helper");

    const geminiResponse = await generateContentWithFallback({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: `Identify the food product with barcode "${barcode}". If it's a known product (such as Amul Shrikhand Badam Pista, which has barcode 8906023724270), use its exact details. Otherwise, identify the product if possible.
Provide its brand name, product name, and average nutritional values per 100 grams.
Return ONLY valid JSON — no markdown, no explanation.
{
  "product_name": "Product Name",
  "brand": "Brand Name",
  "per_100g": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0
  }
}`
        }
      ]
    });

    const parsed = parseGeminiJson(geminiResponse.text);
    if (parsed && parsed.product_name && parsed.product_name !== "Product Name") {
      console.log(`Gemini resolved barcode "${barcode}" as: ${parsed.brand} - ${parsed.product_name}`);
      return {
        product_name: parsed.product_name,
        brand: parsed.brand || "Unknown Brand",
        image_url: null,
        pack_size: null,
        serving_size: null,
        per_100g: {
          calories: Number(parsed.per_100g.calories || 0),
          protein: Number(parsed.per_100g.protein || 0),
          carbs: Number(parsed.per_100g.carbs || 0),
          fat: Number(parsed.per_100g.fat || parsed.per_100g.fats || 0),
          fiber: Number(parsed.per_100g.fiber || 0),
          sugar: Number(parsed.per_100g.sugar || 0),
          sodium: Number(parsed.per_100g.sodium || 0)
        }
      };
    }
  } catch (geminiError) {
    console.error(`Gemini barcode lookup failed:`, geminiError.message);
  }
  return null;
};

/**
 * Looks up a packaged food product by barcode using the Open Food Facts API.
 * Returns nutrition data per 100g, or null if not found.
 */
const searchFoodByBarcode = async (barcode) => {
  try {
    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}`,
      {
        params: {
          fields:
            "product_name,brands,nutriments,image_url,quantity,serving_size",
        },
        timeout: 10000,
      }
    );

    if (
      response.data.status !== 1 ||
      !response.data.product
    ) {
      return await fallbackToGemini(barcode);
    }

    const product = response.data.product;
    const nutriments = product.nutriments || {};

    const productName =
      product.product_name || "Unknown Product";
    const brand = product.brands || "Unknown Brand";

    // Nutrition per 100g from the packet
    const caloriesPer100g =
      nutriments["energy-kcal_100g"] ||
      nutriments["energy_100g"] / 4.184 ||
      0;
    const proteinPer100g =
      nutriments["proteins_100g"] || 0;
    const carbsPer100g =
      nutriments["carbohydrates_100g"] || 0;
    const fatPer100g =
      nutriments["fat_100g"] || 0;
    const fiberPer100g =
      nutriments["fiber_100g"] || 0;
    const sugarPer100g =
      nutriments["sugars_100g"] || 0;
    const sodiumPer100g =
      nutriments["sodium_100g"] || 0;

    console.log(
      `Barcode "${barcode}" found in Open Food Facts: ${brand} - ${productName}`
    );

    return {
      product_name: productName,
      brand: brand,
      image_url: product.image_url || null,
      pack_size: product.quantity || null,
      serving_size: product.serving_size || null,

      // Per 100g values (as printed on packet)
      per_100g: {
        calories: Number(caloriesPer100g.toFixed(1)),
        protein: Number(proteinPer100g.toFixed(1)),
        carbs: Number(carbsPer100g.toFixed(1)),
        fat: Number(fatPer100g.toFixed(1)),
        fiber: Number(fiberPer100g.toFixed(1)),
        sugar: Number(sugarPer100g.toFixed(1)),
        sodium: Number((sodiumPer100g * 1000).toFixed(1)), // convert g to mg
      },
    };
  } catch (error) {
    console.log(
      `Barcode lookup failed for "${barcode}" (fetching Open Food Facts):`,
      error.message
    );
    return await fallbackToGemini(barcode);
  }
};

module.exports = { searchFoodByBarcode };
