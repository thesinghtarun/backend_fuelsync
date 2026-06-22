const mongoose =
  require("mongoose");

const performedActivitySchema =
  new mongoose.Schema(
    {
      activity_id: {
        type: String,
        required: true,
      },

      activity_name: {
        type: String,
        required: true,
      },

      duration: {
        type: Number,
        required: true,
      },

      calories_burned: {
        type: Number,
        required: true,
      },

      created_at: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );

const activitySchema =
  new mongoose.Schema(
    {
      firebase_uid: {
        type: String,
        required: true,
        unique: true,
      },

      activities: [
        performedActivitySchema,
      ],
    },
    {
      timestamps: true,
    }
  );

  const ACTIVITY=mongoose.model("ACTIVITY",activitySchema);

module.exports =ACTIVITY;