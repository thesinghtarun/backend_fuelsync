const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

/**
 * Uploads a file buffer directly to Cloudinary using a write stream.
 * @param {Buffer} fileBuffer - The image file buffer.
 * @returns {Promise<string>} The secure URL of the uploaded image.
 */
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "fuelsync_meals",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  uploadToCloudinary,
};
