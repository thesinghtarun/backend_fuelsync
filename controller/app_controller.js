const USERS = require("../models/users.model");
const { fileTypeFromBuffer } = require("file-type");
const admin = require("../config/firebase");
// const { GoogleGenAI } = require("@google/genai");
const { generateContentWithFallback } = require("../utils/gemini");
const FOODLOGS = require("../models/food_logs.model");
const { calculateNutrition, getOrCreateFoodDataFromUSDA, parseGeminiJson, getOrCreateFoodDataFromGemini } = require("../utils/food_helper");
const { searchFoodByBarcode } = require("../utils/barcode_helper");
const FOODDATA = require("../models/food_data.model");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { razorpay } = require("../config/razor_pay");
const { uploadToCloudinary } = require("../utils/cloudinary");
const ACTIVITY = require("../models/activity_model");
const activities=require("../data/activities");




// async function generateContentWithFallback(config) {
//   const keys = [
//     process.env.GEMINI_API_KEY,
//     process.env.GEMINI_API_KEY_ALTERNATE,
//   ].filter(Boolean);

//   let lastError;

//   for (const key of keys) {
//     try {
//       const ai = new GoogleGenAI({ apiKey: key });

//       return await ai.models.generateContent(config);
//     } catch (error) {
//       lastError = error;

//       // Try next key only for quota/rate-limit errors
//       if ([429, 503].includes(error.status)) {
//         console.log(
//           `Gemini error ${error.status}. Trying next key...`
//         );
//         continue;
//       }

//       throw error;

//       console.log(
//         `Quota exceeded for key. Trying next key...`
//       );
//     }
//   }

//   throw lastError;
// }


// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

const add_user = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      password,
      gender,
      goal,
      height,
      weight,
      dob,
      activity,
      firebase_uid,
    } = req.body;

    if (
      !firstname ||
      !lastname ||
      !email ||
      !password ||
      !gender ||
      !goal ||
      !height ||
      !weight ||
      !dob ||
      !activity ||
      !firebase_uid
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await USERS.findOne({
      $or: [
        { email },
        { firebase_uid },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // -----------------------------
    // AGE
    // -----------------------------
    const birthDate = new Date(dob);
    const today = new Date();

    let age =
      today.getFullYear() -
      birthDate.getFullYear();

    const monthDiff =
      today.getMonth() -
      birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 &&
        today.getDate() <
        birthDate.getDate())
    ) {
      age--;
    }

    // -----------------------------
    // HEIGHT FT -> CM
    // -----------------------------
    const heightCm =
      parseFloat(height);

    const weightKg =
      parseFloat(weight);

    // -----------------------------
    // BMR
    // -----------------------------
    let bmr = 0;

    if (
      gender.toLowerCase() === "male"
    ) {
      bmr =
        10 * weightKg +
        6.25 * heightCm -
        5 * age +
        5;
    } else {
      bmr =
        10 * weightKg +
        6.25 * heightCm -
        5 * age -
        161;
    }

    // -----------------------------
    // ACTIVITY FACTOR
    // -----------------------------
    let activityFactor = 1.375;

    switch (activity.toLowerCase().trim()) {
      case "less than 3 days":
      case "less than 3 days a week":
        activityFactor = 1.375;
        break;

      case "3-5 days":
      case "3-5 days a week":
        activityFactor = 1.55;
        break;

      case "6-7 days":
      case "6-7 days a week":
        activityFactor = 1.725;
        break;

      default:
        activityFactor = 1.375;
        break;
    }

    // -----------------------------
    // MAINTENANCE CALORIES
    // -----------------------------
    const maintenanceCalories = Math.round(
      bmr * activityFactor
    );

    let targetCalories = maintenanceCalories;

    // -----------------------------
    // GOAL
    // -----------------------------
    switch (
    goal.toLowerCase().trim()
    ) {
      case "loose":
      case "loose weight":
      case "weight loss":
        targetCalories =
          maintenanceCalories - 500;
        break;

      case "gain":
      case "gain weight":
      case "weight gain":
        targetCalories =
          maintenanceCalories + 500;
        break;

      case "maintain":
      default:
        targetCalories =
          maintenanceCalories;
        break;
    }

    // -----------------------------
    // MACROS
    // -----------------------------

    // Protein:
    // lose = 2g/kg
    // maintain = 1.6g/kg
    // gain = 2.2g/kg

    let proteinGoal = 0;

    if (
      goal.toLowerCase().includes(
        "loose"
      )
    ) {
      proteinGoal = Math.round(
        weightKg * 2
      );
    } else if (
      goal.toLowerCase().includes(
        "gain"
      )
    ) {
      proteinGoal = Math.round(
        weightKg * 2.2
      );
    } else {
      proteinGoal = Math.round(
        weightKg * 1.6
      );
    }

    // Fat = 25% calories
    const fatGoal = Math.round(
      (targetCalories * 0.25) / 9
    );

    // Remaining calories → carbs
    const carbCalories =
      targetCalories -
      proteinGoal * 4 -
      fatGoal * 9;

    const carbsGoal =
      Math.round(carbCalories / 4);

    // -----------------------------
    // CREATE USER
    // -----------------------------
    const newUser =
      await USERS.create({
        firstname,
        lastname,
        email,
        password,

        gender,
        goal,

        height,
        weight,
        dob,
        activity,

        firebase_uid,

        age,

        bmr: Math.round(bmr),

        maintenance_calories:
          maintenanceCalories,

        target_calories:
          targetCalories,

        protein_goal:
          proteinGoal,

        carbs_goal:
          carbsGoal,

        fat_goal:
          fatGoal,
      });

    return res.status(201).json({
      success: true,
      message:
        "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal Server Error",
    });
  }
};


const remove_user = async (req, res) => {
  try {
    const { email, firebase_uid } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    if (!firebase_uid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID required",
      });
    }

    console.log(`Account to delete: ${email} ${firebase_uid}`);

    // Delete user from MongoDB
    const deletedUser =
      await USERS.findOneAndDelete({
        email,
        firebase_uid,
      });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(
        firebase_uid
      );
    } catch (firebaseError) {
      console.error(
        "Firebase delete failed:",
        firebaseError
      );

      return res.status(500).json({
        success: false,
        message:
          "User removed from database but failed in Firebase",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "User deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal Server Error",
    });
  }
};


const login = async (req, res) => {
  try {
    const { token } = req.body;

    const decodedToken = await admin
      .auth()
      .verifyIdToken(token);

    const firebase_uid = decodedToken.uid;

    const user = await USERS.findOne({
      firebase_uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};


//To analyze the food
// const analyze_food = async (req, res) => {
//   try {
//     // 1. Check image exists
//     if (!req.file) {
//       console.log("BODY:", req.body);
//       console.log("FILE:", req.file);

//       return res.status(400).json({
//         success: false,
//         message: "Image is required",
//       });
//     }

//     // 2. Detect real image type from buffer (MOST IMPORTANT FIX)
//     const type = await fileTypeFromBuffer(req.file.buffer);

//     const mimeType = type?.mime || req.file.mimetype || "image/jpeg";

//     // 3. Prompt
//     const prompt = `
// Analyze this food image carefully.

// IMPORTANT:
// - A coin is present in the image and MUST be used as the primary scale reference.
// - First, detect the coin and assume a standard diameter based on a common Indian coin (typically 2 cm to 2.5 cm range). If coin type is unclear, assume 2.2 cm as default.
// - Use the coin to estimate real-world dimensions (cm) of all visible food items.
// - Convert estimated dimensions → volume → weight (grams) using realistic food density.

// INDIAN FOOD ACCURACY RULES:
// - Use standard Indian serving sizes and recipes as reference (roti, rice, dal, sabzi, curry, paneer dishes, biryani, street food, etc.).
// - Consider oil/ghee usage, gravy density, and typical home-style or restaurant-style portions.
// - For roti/chapati: estimate based on diameter and thickness.
// - For rice: assume cooked basmati/normal Indian rice density.
// - For curries/dal: include gravy + solid ingredients weight.
// - For fried/snack items: account for oil absorption.

// GENERAL RULES:
// - Be as precise as possible in gram estimation using visual scaling.
// - Break down multiple items separately (do not merge foods).
// - Do NOT ignore small components like chutney, oil, salad, or garnish.
// - If uncertain, choose the closest realistic Indian household portion size rather than guessing randomly.

// Return ONLY raw JSON.
// Do NOT include markdown, explanation, or backticks.

// Return format:
// {
//   "foods": [
//     {
//       "name": "",
//       "quantity_grams": 0,
//       "calories": 0,
//       "protein": 0,
//       "carbs": 0,
//       "fat": 0
//     }
//   ],
//   "total_calories": 0,
//   "total_protein": 0,
//   "total_carbs": 0,
//   "total_fat": 0
// }
// `;

//     // 4. Gemini call
//     // const response = await ai.models.generateContent({
//     //     model: "gemini-2.5-flash",
//     //     contents: [
//     //         {
//     //             text: prompt,
//     //         },
//     //         {
//     //             inlineData: {
//     //                 mimeType,
//     //                 data: req.file.buffer.toString("base64"),
//     //             },
//     //         },
//     //     ],
//     // });

//     const response = await generateContentWithFallback({
//       model: "gemini-2.5-flash",
//       contents: [
//         {
//           text: prompt,
//         },
//         {
//           inlineData: {
//             mimeType,
//             data: req.file.buffer.toString("base64"),
//           },
//         },
//       ],
//     });

//     // 5. Safe JSON parsing (IMPORTANT)
//     let result;

//     try {
//       result = JSON.parse(response.text);
//     } catch (err) {
//       console.error("Gemini returned invalid JSON:", response.text);

//       return res.status(500).json({
//         success: false,
//         message: "Invalid AI response format",
//       });
//     }

//     // 6. Final response
//     return res.status(200).json({
//       success: true,
//       firebase_uid: req.firebase_uid,
//       data: result,
//     });

//   } catch (error) {
//     console.error("Analyze Food Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Food analysis failed",
//     });
//   }
// };


const analyze_food = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const type =
      await fileTypeFromBuffer(
        req.file.buffer
      );

    const mimeType =
      type?.mime ||
      req.file.mimetype ||
      "image/jpeg";

    // Async upload to Cloudinary (safely fall back to "" if it fails/unconfigured)
    let image_url = "";
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      if (cloudName && cloudName.trim()) {
        image_url = await uploadToCloudinary(req.file.buffer);
        console.log("Uploaded image to Cloudinary successfully:", image_url);
      } else {
        console.warn("Cloudinary not configured in .env. Skipping upload.");
      }
    } catch (uploadError) {
      console.error("Cloudinary upload failed inside analyze_food:", uploadError.message);
    }

    const prompt = `
Analyze this food image carefully.

TASK:
1. Identify all visible food items.
2. Estimate quantity in grams.

IMPORTANT:
- A coin may be present and should be used as scale reference.
- If coin type is unclear assume 2.2 cm diameter.
- Break multiple foods separately.
- Use realistic Indian food serving sizes.
- Return normalized common food names.
- Include confidence score.

Examples:
Chapati -> roti
Phulka -> roti
Curd -> yogurt
Dahi -> yogurt

Return ONLY JSON.

{
  "foods": [
    {
      "name": "",
      "quantity_grams": 0,
      "confidence": 0.95
    }
  ]
}
`;

    const response =
      await generateContentWithFallback({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType,
              data: req.file.buffer.toString(
                "base64"
              ),
            },
          },
        ],
      });

    let geminiResult;

    try {
      geminiResult =
        parseGeminiJson(
          response.text
        );
    } catch (err) {
      console.error(
        "Invalid Gemini JSON:",
        response.text
      );

      return res.status(500).json({
        success: false,
        message:
          "Invalid AI response format",
      });
    }

    if (
      !geminiResult.foods ||
      !Array.isArray(
        geminiResult.foods
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to detect food",
      });
    }

    const foods = [];

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const detectedFood of geminiResult.foods) {
      if (
        detectedFood.confidence &&
        detectedFood.confidence < 0.5
      ) {
        continue;
      }

      const quantity = Number(
        detectedFood.quantity_grams ||
        0
      );

      const foodData =
        await getOrCreateFoodDataFromGemini(
          detectedFood.name
        );



      const nutrition =
        calculateNutrition(
          foodData,
          quantity
        );

      foods.push({
        name: foodData.food_name,
        quantity_grams: quantity,
        calories:
          nutrition.calories,
        protein:
          nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      });

      totalCalories +=
        nutrition.calories;
      totalProtein +=
        nutrition.protein;
      totalCarbs += nutrition.carbs;
      totalFat += nutrition.fat;
    }

    const finalResult = {
      foods,
      total_calories: Number(
        totalCalories.toFixed(1)
      ),
      total_protein: Number(
        totalProtein.toFixed(1)
      ),
      total_carbs: Number(
        totalCarbs.toFixed(1)
      ),
      total_fat: Number(
        totalFat.toFixed(1)
      ),
    };

    return res.status(200).json({
      success: true,
      firebase_uid:
        req.firebase_uid,
      data: finalResult,
      image_url: image_url,
    });
  } catch (error) {
    console.error(
      "Analyze Food Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Food analysis failed",
    });
  }
};


const recalculate_food = async (req, res) => {
  try {
    const { foods } = req.body;

    if (!foods || !Array.isArray(foods)) {
      return res.status(400).json({
        success: false,
        message: "Foods array is required",
      });
    }

    const prompt = `
You are a nutrition expert.

Recalculate nutrition values for Indian foods.

Return ONLY valid JSON.

Foods input:
${JSON.stringify(foods)}

Rules:
- Adjust calories/macros based on realistic Indian nutrition data
- quantity_grams is important
- DO NOT change food names unless clearly wrong
- Return corrected totals

Return format:
{
  "foods": [...],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0
}
`;

    // const response = await ai.models.generateContent({
    //   model: "gemini-2.5-flash",
    //   contents: [{ text: prompt }],
    // });

    const response = await generateContentWithFallback({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }],
    });
    let text = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let result = JSON.parse(text);

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Recalculation failed",
    });
  }
};


///To save meal

const saveMeal = async (req, res) => {
  try {
    console.log("UID =>", req.firebase_uid);
    console.log("BODY =>", req.body);

    const firebase_uid = req.firebase_uid;

    const {
      foods,
      total_calories,
      total_protein,
      total_carbs,
      total_fat,
      image_url,
    } = req.body;
    console.log("RAW BODY STRING =>", req.body);
    console.log("FOODS TYPE =>", Array.isArray(req.body.foods));
    console.log("FOODS =>", req.body.foods);

    if (foods && Array.isArray(foods)) {
      for (const f of foods) {
        const normalizedName = String(f.food_name || "").toLowerCase().trim();
        if (!normalizedName) continue;

        try {
          const existing = await FOODDATA.findOne({ food_name: normalizedName });
          if (!existing) {
            const quantityGrams = Number(f.quantity_grams || 100);
            const ratio = quantityGrams > 0 ? (100 / quantityGrams) : 1;
            const caloriesPer100g = Number(((f.calories || 0) * ratio).toFixed(1));
            const proteinPer100g = Number(((f.protein || 0) * ratio).toFixed(1));
            const carbsPer100g = Number(((f.carbs || 0) * ratio).toFixed(1));
            const fatsPer100g = Number(((f.fat || 0) * ratio).toFixed(1));

            await FOODDATA.findOneAndUpdate(
              { food_name: normalizedName },
              {
                $setOnInsert: {
                  food_name: normalizedName,
                  quantity: 100,
                  calories: caloriesPer100g,
                  protein: proteinPer100g,
                  carbs: carbsPer100g,
                  fats: fatsPer100g,
                }
              },
              { upsert: true }
            );
            console.log(`Saved new food item per 100g to fooddata: ${normalizedName}`);
          }
        } catch (err) {
          console.error(`Failed to check/save food item "${normalizedName}":`, err.message);
        }
      }
    }

    const meal = await FOODLOGS.create({
      firebase_uid,
      foods,
      total_calories,
      total_protein,
      total_carbs,
      total_fat,
      image_url: image_url || "",
    });

    return res.status(201).json({
      success: true,
      data: meal,
    });

  } catch (error) {

    console.error("SAVE MEAL ERROR:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message, // IMPORTANT
    });
  }
};


///To get today's consumption

const getTodayConsumption = async (req, res) => {
  try {
    const firebase_uid = req.firebase_uid;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const meals = await FOODLOGS.find({
      firebase_uid,
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    meals.forEach((meal) => {
      totalCalories += meal.total_calories || 0;
      totalProtein += meal.total_protein || 0;
      totalCarbs += meal.total_carbs || 0;
      totalFat += meal.total_fat || 0;
    });

    return res.status(200).json({
      success: true,
      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,
      meals,
    });
  } catch (error) {
    console.error("GET TODAY CONSUMPTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch consumption",
    });
  }
};

//Update Goals
const updateGoal = async (req, res) => {
  try {
    const firebase_uid = req.firebase_uid;

    const {
      target_calories,
      protein_goal,
      carbs_goal,
      fat_goal,
    } = req.body;

    const user = await USERS.findOneAndUpdate(
      { firebase_uid },
      {
        ...(target_calories != null && {
          target_calories: Number(target_calories),
        }),
        ...(protein_goal != null && {
          protein_goal: Number(protein_goal),
        }),
        ...(carbs_goal != null && {
          carbs_goal: Number(carbs_goal),
        }),
        ...(fat_goal != null && {
          fat_goal: Number(fat_goal),
        }),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Goal updated successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update goal",
    });
  }
};

//DELETE MEAL
const deleteMeal = async (req, res) => {
  try {
    const firebase_uid = req.firebase_uid;
    const { meal_id } = req.params;

    const deletedMeal = await FOODLOGS.findOneAndDelete({
      _id: meal_id,
      firebase_uid,
    });

    if (!deletedMeal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Meal deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete meal",
    });
  }
};

//GET WEEKLY REPORT
const getWeeklyReport = async (req, res) => {
  try {
    const firebase_uid = req.firebase_uid;

    const today = new Date();

    // Start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // End of week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const meals = await FOODLOGS.find({
      firebase_uid,
      createdAt: {
        $gte: weekStart,
        $lte: weekEnd,
      },
    });

    const user = await USERS.findOne({
      firebase_uid,
    });

    const days = [
      { day: "Sun", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Mon", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Tue", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Wed", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Thu", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Fri", calories: 0, protein: 0, carbs: 0, fat: 0 },
      { day: "Sat", calories: 0, protein: 0, carbs: 0, fat: 0 },
    ];

    meals.forEach((meal) => {
      const index = new Date(meal.createdAt).getDay();

      days[index].calories += meal.total_calories || 0;
      days[index].protein += meal.total_protein || 0;
      days[index].carbs += meal.total_carbs || 0;
      days[index].fat += meal.total_fat || 0;
    });

    return res.status(200).json({
      success: true,
      week_start: weekStart,
      week_end: weekEnd,

      targets: {
        calories: user?.target_calories ?? 0,
        protein: user?.protein_goal ?? 0,
        carbs: user?.carbs_goal ?? 0,
        fat: user?.fat_goal ?? 0,
      },

      days,
    });
  } catch (error) {
    console.error("WEEKLY REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch weekly report",
    });
  }
};

//GET MONTHLY REPORT
const getMonthlyReport = async (
  req,
  res
) => {
  try {
    const firebase_uid =
      req.firebase_uid;

    const user =
      await USERS.findOne({
        firebase_uid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const now = new Date();

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const meals =
      await FOODLOGS.find({
        firebase_uid,
        createdAt: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      });

    const weeks = [
      {
        week: "W1",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      {
        week: "W2",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      {
        week: "W3",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      {
        week: "W4",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      {
        week: "W5",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ];

    meals.forEach((meal) => {
      const dayOfMonth =
        meal.createdAt.getDate();

      const weekIndex = Math.floor(
        (dayOfMonth - 1) / 7
      );

      if (
        weekIndex >= 0 &&
        weekIndex < weeks.length
      ) {
        weeks[
          weekIndex
        ].calories +=
          meal.total_calories || 0;

        weeks[
          weekIndex
        ].protein +=
          meal.total_protein || 0;

        weeks[
          weekIndex
        ].carbs +=
          meal.total_carbs || 0;

        weeks[
          weekIndex
        ].fat +=
          meal.total_fat || 0;
      }
    });

    return res.status(200).json({
      success: true,

      month: now.toLocaleString(
        "en-US",
        {
          month: "long",
          year: "numeric",
        }
      ),

      targets: {
        calories: user.target_calories * 7,
        protein: user.protein_goal * 7,
        carbs: user.carbs_goal * 7,
        fat: user.fat_goal * 7,
      },

      weeks,
    });
  } catch (error) {
    console.error(
      "MONTHLY REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch monthly report",
    });
  }
};

//SEARCH FOOD
const searchFood = async (
  req,
  res
) => {
  try {
    const {
      food_name,
      quantity,
    } = req.body;

    if (
      !food_name ||
      !quantity
    ) {
      return res.status(400).json({
        success: false,
        message:
          "food_name and quantity required",
      });
    }

    const food =
      await getOrCreateFoodDataFromUSDA(
        food_name
      );

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    console.log(`FOOD SEARCH: ${food}`);
    const nutrition =
      calculateNutrition(
        food,
        Number(quantity)
      );

    return res.status(200).json({
      success: true,
      data: {
        food_name:
          food.food_name,
        quantity:
          Number(quantity),

        calories:
          nutrition.calories,

        protein:
          nutrition.protein,

        carbs:
          nutrition.carbs,

        fat: nutrition.fat,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message,
    });
  }
};

//SCAN FOOD (Barcode)
const scanFood = async (req, res) => {
  try {
    const { barcode, quantity } = req.body;

    if (!barcode || !quantity) {
      return res.status(400).json({
        success: false,
        message: "barcode and quantity are required",
      });
    }

    const quantityGrams = Number(quantity);

    if (isNaN(quantityGrams) || quantityGrams <= 0) {
      return res.status(400).json({
        success: false,
        message: "quantity must be a positive number (in grams)",
      });
    }

    const product = await searchFoodByBarcode(barcode);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found for this barcode",
      });
    }

    // Scale nutrition from per-100g to user's quantity
    const ratio = quantityGrams / 100;

    const scaledNutrition = {
      calories: Number((product.per_100g.calories * ratio).toFixed(1)),
      protein: Number((product.per_100g.protein * ratio).toFixed(1)),
      carbs: Number((product.per_100g.carbs * ratio).toFixed(1)),
      fat: Number((product.per_100g.fat * ratio).toFixed(1)),
      fiber: Number((product.per_100g.fiber * ratio).toFixed(1)),
      sugar: Number((product.per_100g.sugar * ratio).toFixed(1)),
      sodium: Number((product.per_100g.sodium * ratio).toFixed(1)),
    };

    return res.status(200).json({
      success: true,
      data: {
        product_name: product.product_name,
        brand: product.brand,
        image_url: product.image_url,
        pack_size: product.pack_size,
        serving_size: product.serving_size,
        barcode: barcode,
        quantity_grams: quantityGrams,
        nutrition: scaledNutrition,
        per_100g: product.per_100g,
      },
    });
  } catch (error) {
    console.error("SCAN FOOD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Barcode scan failed",
    });
  }
};

//DEDUCT CREDITS
const deductCredit = async (req, res) => {
  try {
    const firebase_uid = req.firebase_uid;
    const { reduceCredit } = req.body;

    const user = await USERS.findOneAndUpdate(
      { firebase_uid },
      { $inc: { credits: -reduceCredit } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      credits: user.credits,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
};

//GET CREDITS TO REDUCE
const creditsCost = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      credits_to_reduce: 2, // change this anytime from backend
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
};

//GET PLANS
const getPlans =
  async (
    req,
    res
  ) => {

    try {

      return res
        .status(200)
        .json({

          success: true,

          plans: [

            {
              id: "base",
              title:
                "Base Plan",
              description: "",
              amount: 49,
              credits: 50
            },

            {
              id: "elite",
              title:
                "Elite Plan",
              description: "",
              amount: 99,
              credits: 100
            },

            {
              id: "developer",
              title:
                "Help Developer",
              description: "",
              amount: 499,
              credits: 150
            }

          ]

        });

    }
    catch (e) {

      return res
        .status(500)
        .json({
          success: false
        });

    }

  };


//RAZOR PAY--------------------------------------------------------------------------

// CREATE ORDER
const createOrder =
  async (
    req,
    res
  ) => {

    try {
      console.log("BODY =>", req.body);
      console.log("UID =>", req.firebase_uid);
      const {
        amount,
        credits
      }
        =
        req.body;

      if (
        !amount ||
        !credits
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              "amount and credits required"
          });

      }

      const order =
        await razorpay.orders.create({

          amount:
            Number(amount) * 100,

          currency:
            "INR",

          receipt:
            `credit_${Date.now()}`,

          notes: {
            credits: String(credits)
          }

        });
      console.log("ORDER =>", order);
      return res
        .status(200)
        .json({
          success: true,
          order
        });

    }

    catch (e) {
      console.log("RAZORPAY ERROR =>", e);
      return res
        .status(500)
        .json({
          success: false,
          message:
            e.message
        });

    }

  };



// VERIFY PAYMENT
const verifyPayment =
  async (req, res) => {
    try {

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = req.body;

      console.log("VERIFY BODY =>", req.body);

      // Verify signature
      const body =
        `${razorpay_order_id}|${razorpay_payment_id}`;

      const expected =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_SECRET_KEY
          )
          .update(body)
          .digest("hex");

      if (expected !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment"
        });
      }

      // Fetch payment
      const payment =
        await razorpay.payments.fetch(
          razorpay_payment_id
        );

      console.log("PAYMENT =>", payment);

      // Fetch order to get notes
      const order =
        await razorpay.orders.fetch(
          razorpay_order_id
        );

      console.log("ORDER =>", order);

      const credits =
        Number(
          order.notes?.credits
        );

      console.log("CREDITS =>", credits);

      if (isNaN(credits)) {
        return res.status(400).json({
          success: false,
          message: "Invalid credits"
        });
      }

      const user =
        await USERS.findOne({
          firebase_uid:
            req.firebase_uid
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      user.credits =
        (user.credits || 0)
        + credits;

      await user.save();

      console.log(
        "UPDATED USER =>",
        user
      );

      return res.status(200).json({
        success: true,
        credits:
          user.credits
      });

    } catch (e) {

      console.log(
        "VERIFY ERROR =>",
        e
      );

      return res.status(500).json({
        success: false,
        message:
          e.message
      });

    }
  };

  //GET ACTIVITIES
  const getActivities =
  async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        count: activities.length,
        data: activities,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Internal Server Error",
      });
    }
  };

  //ADD ACTIVITY
  const addActivity =
  async (req, res) => {
    try {
    const firebase_uid =
      req.user.uid; 

    const {
      activity_id,
      duration,
    } = req.body;

      if (
        !firebase_uid ||
        !activity_id ||
        !duration
      ) {
        return res.status(400)
          .json({
            success: false,
            message:
              "All fields required",
          });
      }

      const selected =
        activities.find(
          (e) =>
            e.id ===
            activity_id
        );

      if (!selected) {
        return res.status(404)
          .json({
            success: false,
            message:
              "Activity not found",
          });
      }

      const calories =
        Math.round(
          (selected.caloriesPer10Min /
              10) *
              duration
        );

      const entry = {
        activity_id,
        activity_name:
          selected.name,

        duration,

        calories_burned:
          calories,

        created_at:
          new Date(),
      };

     const result =
  await ACTIVITY.findOneAndUpdate(
    {
      firebase_uid,
    },
    {
      $push: {
        activities: entry,
      },
    },
    {
      upsert: true,
      new: true,
    }
  );

// get last inserted activity
const savedActivity =
  result.activities[
    result.activities.length - 1
  ];

return res.status(201).json({
  success: true,
  data: savedActivity,
});
      return res.status(201)
        .json({
          success: true,
          data: entry,
        });
    } catch (e) {
      console.log(e);

      return res.status(500)
        .json({
          success: false,
          message:
            "Internal Server Error",
        });
    }
  };

  //GET USER ACTIVITIES
//GET USER ACTIVITIES
const getUserActivities = async (req, res) => {
  try {
    const firebase_uid = req.user.uid;

    const userActivities = await ACTIVITY.findOne({
      firebase_uid,
    });

    if (!userActivities) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // newest first
    const sortedActivities = [
      ...userActivities.activities,
    ].sort(
      (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at),
    );

    return res.status(200).json({
      success: true,
      data: sortedActivities,
    });
  } catch (e) {
    console.log(e);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

  //DELETE ACTIVITY
  const deleteActivity =
async (req, res) => {
  try {
    const firebase_uid =
      req.user.uid;

    const {
      activityId,
    } = req.params;

    if (!activityId) {
      return res
        .status(400)
        .json({
          success:
              false,

          message:
              "Activity id required",
        });
    }

    const updated =
      await ACTIVITY.findOneAndUpdate(
        {
          firebase_uid,
        },

        {
          $pull: {
            activities: {
              _id:
                activityId,
            },
          },
        },

        {
          new: true,
        },
      );

    if (!updated) {
      return res
        .status(404)
        .json({
          success:
              false,

          message:
              "Activity not found",
        });
    }

    return res
      .status(200)
      .json({
        success:
            true,

        message:
            "Activity deleted",

        data:
            updated
                .activities,
      });
  } catch (e) {
    console.log(e);

    return res
      .status(500)
      .json({
        success:
            false,

        message:
            "Internal Server Error",
      });
  }
};

module.exports = {
  add_user, remove_user, login, analyze_food, recalculate_food, saveMeal, getTodayConsumption, updateGoal, deleteMeal, getWeeklyReport, getMonthlyReport, searchFood, scanFood, deductCredit, creditsCost, getPlans, createOrder, verifyPayment, getActivities, addActivity, getUserActivities, deleteActivity
};