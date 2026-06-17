const axios = require("axios");

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
      console.log(
        `Barcode "${barcode}" not found in Open Food Facts.`
      );
      return null;
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
      `Barcode "${barcode}" found: ${brand} - ${productName}`
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
    console.error(
      `Barcode lookup failed for "${barcode}":`,
      error.message
    );
    return null;
  }
};

module.exports = { searchFoodByBarcode };
