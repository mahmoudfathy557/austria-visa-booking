const axios = require("axios"); // Assuming axios is installed and available
require("dotenv").config();

// Make sure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are defined, e.g., from environment variables
// For demonstration, we'll assume they are globally accessible or passed in.
// In a real scenario, you might load them from a .env file.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.MY_USER_TELEGRAM_CHAT_ID;

async function sendTelegramMessage(msg) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error(
      "Telegram bot token or chat ID is not defined. Cannot send message."
    );
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
    });
    console.log("Telegram message sent successfully!");
  } catch (error) {
    console.error("Failed to send Telegram message:", error.message);
  }
}

async function sendTelegramPhoto(photoUrl, caption = "") {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error(
      "Telegram bot token or chat ID is not defined. Cannot send photo."
    );
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption: caption,
    });
    console.log("Telegram photo sent successfully!");
  } catch (error) {
    console.error("Failed to send Telegram photo:", error.message);
  }
}

module.exports = { sendTelegramMessage, sendTelegramPhoto };
