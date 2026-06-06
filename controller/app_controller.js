const USERS = require("../models/users.model");
const { fileTypeFromBuffer } = require("file-type");
const admin = require("../config/firebase");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

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
      parseFloat(height) * 30.48;

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
    // MAINTENANCE CALORIES
    // Light activity factor
    // -----------------------------
    const maintenanceCalories =
      Math.round(bmr * 1.375);

    let targetCalories =
      maintenanceCalories;

    // -----------------------------
    // GOAL
    // -----------------------------
    switch (
      goal.toLowerCase().trim()
    ) {
      case "lose":
      case "lose weight":
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
        "lose"
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
const analyze_food = async (req, res) => {
    try {
        // 1. Check image exists
        if (!req.file) {
            console.log("BODY:", req.body);
            console.log("FILE:", req.file);

            return res.status(400).json({
                success: false,
                message: "Image is required",
            });
        }

        // 2. Detect real image type from buffer (MOST IMPORTANT FIX)
        const type = await fileTypeFromBuffer(req.file.buffer);

        const mimeType = type?.mime || req.file.mimetype || "image/jpeg";

        // 3. Prompt
        const prompt = `
Analyze this food image carefully.

IMPORTANT:
- A coin is present in the image and MUST be used as the primary scale reference.
- First, detect the coin and assume a standard diameter based on a common Indian coin (typically 2 cm to 2.5 cm range). If coin type is unclear, assume 2.2 cm as default.
- Use the coin to estimate real-world dimensions (cm) of all visible food items.
- Convert estimated dimensions → volume → weight (grams) using realistic food density.

INDIAN FOOD ACCURACY RULES:
- Use standard Indian serving sizes and recipes as reference (roti, rice, dal, sabzi, curry, paneer dishes, biryani, street food, etc.).
- Consider oil/ghee usage, gravy density, and typical home-style or restaurant-style portions.
- For roti/chapati: estimate based on diameter and thickness.
- For rice: assume cooked basmati/normal Indian rice density.
- For curries/dal: include gravy + solid ingredients weight.
- For fried/snack items: account for oil absorption.

GENERAL RULES:
- Be as precise as possible in gram estimation using visual scaling.
- Break down multiple items separately (do not merge foods).
- Do NOT ignore small components like chutney, oil, salad, or garnish.
- If uncertain, choose the closest realistic Indian household portion size rather than guessing randomly.

Return ONLY raw JSON.
Do NOT include markdown, explanation, or backticks.

Return format:
{
  "foods": [
    {
      "name": "",
      "quantity_grams": 0,
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0
}
`;

        // 4. Gemini call
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    text: prompt,
                },
                {
                    inlineData: {
                        mimeType,
                        data: req.file.buffer.toString("base64"),
                    },
                },
            ],
        });

        // 5. Safe JSON parsing (IMPORTANT)
        let result;

        try {
            result = JSON.parse(response.text);
        } catch (err) {
            console.error("Gemini returned invalid JSON:", response.text);

            return res.status(500).json({
                success: false,
                message: "Invalid AI response format",
            });
        }

        // 6. Final response
        return res.status(200).json({
            success: true,
            firebase_uid: req.firebase_uid,
            data: result,
        });

    } catch (error) {
        console.error("Analyze Food Error:", error);

        return res.status(500).json({
            success: false,
            message: "Food analysis failed",
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

    const response = await ai.models.generateContent({
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


//To get calories
const getCalories=(req,res)=>{
    const {goal,height,weight,dob}=req.body
}



module.exports = {
    add_user, login, analyze_food, recalculate_food
};