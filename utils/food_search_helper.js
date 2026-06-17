const axios = require("axios");

/**
 * Checks if the USDA result is an exact match for the queried food name.
 * The USDA description must contain ALL words from the query to be considered a match.
 */
const isExactMatch = (queryName, usdaDescription) => {
  const normalize = (str) =>
    String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "");

  const normalizedQuery = normalize(queryName);
  const normalizedDescription = normalize(usdaDescription);

  // Check if the USDA description contains the full query as-is
  if (normalizedDescription.includes(normalizedQuery)) {
    return true;
  }

  // Also check if ALL words from the query appear in the description
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const allWordsMatch = queryWords.every((word) =>
    normalizedDescription.includes(word)
  );

  return allWordsMatch;
};

const searchFoodFromUSDA = async (
  foodName
) => {
  const response =
    await axios.get(
      "https://api.nal.usda.gov/fdc/v1/foods/search",
      {
        family:4,
        params: {
          query: foodName,
          pageSize: 5,
          api_key:
            process.env.USDA_API_KEY,
        },
      }
    );

    console.log(`FOOD SEARCH: queried "${foodName}"`);

  const foods = response.data.foods || [];

  if (!foods.length) {
    console.log(`No USDA results found for "${foodName}"`);
    return null;
  }

  // Find the first result that is an exact match
  const matchedFood = foods.find((f) =>
    isExactMatch(foodName, f.description)
  );

  if (!matchedFood) {
    console.log(
      `No exact match in USDA for "${foodName}". ` +
      `Top result was: "${foods[0]?.description}" — skipped.`
    );
    return null;
  }

  console.log(`Exact USDA match found: "${matchedFood.description}" for query "${foodName}"`);

  const nutrients =
    matchedFood.foodNutrients || [];

  const getValue = (id) =>
    nutrients.find(
      (n) =>
        n.nutrientId === id
    )?.value || 0;

    
    
  return {
    food_name: foodName
      .toLowerCase()
      .trim(),
    quantity: 100,

    calories: getValue(1008),
    protein: getValue(1003),
    fats: getValue(1004),
    carbs: getValue(1005),
  };
};

module.exports = {
  searchFoodFromUSDA,
};