const cron = require("node-cron");
const ACTIVITY = require("../models/activity_model");

// Every day at 12:01 AM
cron.schedule("1 0 * * *", async () => {
  try {
    const result = await ACTIVITY.deleteMany({});

    console.log(
      `Deleted ${result.deletedCount} activity documents`
    );
  } catch (e) {
    console.log(
      "Activity cleanup failed",
      e,
    );
  }
});