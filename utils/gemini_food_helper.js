const getNutritionFor100g = async (
  foodName
) => {
  const response =
    await generateContentWithFallback({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: `
Provide average nutrition values per 100 grams for "${foodName}".

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

  return parseGeminiJson(
    response.text
  );
};

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

module.exports={getNutritionFor100g, getOrCreateFoodDataFromGemini};