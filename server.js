const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require("./cron/delete_daily_activity");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const chalk = require("chalk");
const cors = require("cors");

const verifyFirebaseToken = require("./middleware/auth_middleware");
const upload = require("./middleware/upload_middleware");


const {
  add_user,
  remove_user,
  login,
  analyze_food,
  recalculate_food,
  saveMeal,
  getTodayConsumption,
  updateGoal,
  deleteMeal,
  getWeeklyReport,
  getMonthlyReport,
  searchFood,
  scanFood,
  deductCredit,
  creditsCost,
  getPlans,
  createOrder,
  verifyPayment,
  getActivities,
  addActivity,
  getUserActivities,
  deleteActivity
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

app.get("/", (req, res) => { res.status(200).json({ success: true, message: "FuelSync Backend Running", }); });

/*
  Public Routes
*/
app.post("/fuelsync/users", add_user);
app.post("/fuelsync/login", login);

/*
  All routes below this line require Firebase token
*/
app.use(verifyFirebaseToken);

app.post("/fuelsync/remove/user", remove_user);

app.post("/fuelsync/food/analyze", upload.single("image"), analyze_food);

app.post("/fuelsync/food/recalculate", recalculate_food);

// SAVE MEAL
app.post("/fuelsync/food/save", saveMeal);

//UPDATE GOAL
app.put("/fuelsync/user/goal", updateGoal);

//DELETE MEAL
app.delete("/fuelsync/food/:meal_id", deleteMeal);

// GET TODAY CONSUMPTION
app.get("/fuelsync/food/today", getTodayConsumption);

//GET WEEKLY REPORT
app.get("/fuelsync/reports/weekly", getWeeklyReport);

//GET MONTHLY REPORT
app.get("/fuelsync/reports/monthly", getMonthlyReport);

//SEARCH FOOD
app.post("/fuelsync/food/search", searchFood);

//SCAN FOOD (Barcode)
app.post("/fuelsync/food/scan", scanFood);

//GET PLANS
app.get("/fuelsync/credits/price", getPlans);

//CREDITS COST
app.get("/fuelsync/credits/cost", creditsCost);

//DEDUCT CREDIT
app.post("/fuelsync/credits/deduct", deductCredit);

// CREATE PAYMENT ORDER
app.post("/fuelsync/payment/order", createOrder);

// VERIFY PAYMENT
app.post("/fuelsync/payment/verify", verifyPayment);

//GET ACTIVITIES
app.get("/fuelsync/get/activities", getActivities);

//ADD ACTIVITIES
app.post("/fuelsync/post/activities", addActivity);

//GET USER ACTIVITIES
app.get("/fuelsync/get/user/activities", getUserActivities);

//DELETE ACTIVITY
app.delete("/fuelsync/delete/activity/:activityId", deleteActivity);




app.listen(port, () => {
  console.log(chalk.green(`Server running on port ${port}`));
});