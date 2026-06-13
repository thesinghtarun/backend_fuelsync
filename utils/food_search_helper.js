const axios = require("axios");

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
          pageSize: 1,
          api_key:
            process.env.USDA_API_KEY,
        },
      }
    );

    console.log(`FOOD SEARCH: ${response}`);

  const food =
    response.data.foods?.[0];

  if (!food) {
    return null;
  }

  const nutrients =
    food.foodNutrients || [];

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