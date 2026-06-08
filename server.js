
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const chalk = require("chalk");
const cors = require("cors");

const verifyFirebaseToken = require("./middleware/auth_middleware");
const upload = require("./middleware/upload_middleware");

const {
  add_user,
  login,
  analyze_food,
  recalculate_food,
  saveMeal,
  getTodayConsumption,
  updateGoal
} = require("./controller/app_controller");

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const mongo =
  process.env.MONGODB || "mongodb+srv://oyetarun31:RajputTarun1!@fuelsync.vyqkzxt.mongodb.net/fuelsync";

mongoose
  .connect(mongo)
  .then(() => console.log(chalk.blue("MongoDB Connected")))
  .catch((err) =>
    console.log(chalk.red(`MongoDB Connection Error: ${err}`))
  );

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FuelSync Backend Running",
  });
});

/*
  Public Routes
*/
app.post("/fuelsync/users", add_user);
app.post("/fuelsync/login", login);

/*
  All routes below this line require Firebase token
*/
app.use(verifyFirebaseToken);

app.post("/fuelsync/food/analyze",
  upload.single("image"),
  analyze_food);

app.post("/fuelsync/food/recalculate", recalculate_food);

// SAVE MEAL
app.post(
  "/fuelsync/food/save",
  saveMeal
);

//UPDATE GOAL
app.put(
  "/fuelsync/user/goal",
  updateGoal
);

// GET TODAY CONSUMPTION
app.get(
  "/fuelsync/food/today",
  getTodayConsumption
);


app.listen(port, () => {
  console.log(chalk.green(`Server running on port ${port}`));
});