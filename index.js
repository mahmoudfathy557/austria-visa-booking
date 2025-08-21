require("dotenv").config();
const express = require("express");
const app = express();
const { chromium } = require("playwright");
const axios = require("axios");
const path = require("path");
const http = require("http");

// ⚠️ REPLACE WITH YOUR TELEGRAM BOT API TOKEN AND CHAT ID ⚠️
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set in the environment variables.");
  process.exit(1);
}
const TELEGRAM_CHAT_ID = process.env.MY_USER_TELEGRAM_CHAT_ID;
if (!TELEGRAM_CHAT_ID) {
  console.error(
    "MY_USER_TELEGRAM_CHAT_ID is not set in the environment variables."
  );
  process.exit(1);
}

const APPOINTMENT_URL = "https://appointment.bmeia.gv.at/";
const checkIntervalInMins = 5; // 5 minutes
const CHECK_INTERVAL = 1000 * 60 * checkIntervalInMins; // Convert minutes to milliseconds

async function sendTelegramNotification(msg) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
    });
    console.log("Telegram notification sent successfully!");
  } catch (error) {
    console.error("Failed to send Telegram notification:", error.message);
  }
}

async function checkAppointments() {
  let browser;
  try {
    console.log("Starting a new check for appointments...");
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(APPOINTMENT_URL, { waitUntil: "domcontentloaded" });

    // Step 1: Select "KAIRO" and click Next
    await page.waitForSelector("#Office", { timeout: 15000000 });
    await page.selectOption("#Office", { label: "KAIRO" });
    await page.click('input[type="submit"][value="Next"]');

    // Step 2: Select "Master" and click Next
    await page.waitForSelector("#CalendarId", { timeout: 15000000 });
    await page.selectOption("#CalendarId", {
      label: "Aufenthaltsbewilligung Student (nur Master, PhD und Stipendiate)",
    });
    await page.click('input[type="submit"][value="Next"]');

    // Step 3: Enter "1" and click Next
    await page.waitForSelector("#PersonCount", { timeout: 15000000 });
    await page.selectOption("#PersonCount", {
      label: "1",
    });
    await page.click('input[type="submit"][value="Next"]');

    // Step 4: Click Next again
    await page.click('input[type="submit"][value="Next"]');

    // Step 5: Check for "no appointments" message
    const noAppointmentsText = await page.textContent("body");
    if (
      noAppointmentsText.includes(
        "For your selection there are unfortunately no appointments available"
      )
    ) {
      console.log(
        `No appointments available. Will check again in ${checkIntervalInMins} minutes.`
      );
    } else {
      console.log("APPOINTMENT SLOT FOUND! Sending Telegram notification...");
      await sendTelegramNotification("An appointment slot has been found!");
      console.log("Notification sent. The bot will continue to monitor.");
    }
  } catch (error) {
    console.error("An error occurred during the check:", error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Keep the service alive and run the check periodically
app.get("/", (req, res) => {
  res.send("Appointment bot is running.");
});

function pingSelf() {
  console.log("Pinging myself to stay awake...");
  const options = {
    hostname: "localhost",
    port: PORT,
    path: "/",
  };
  const httpRequest = http.request(options, async (res) => {
    console.log(`Pinging response: ${res.statusCode}`);
    await sendTelegramNotification(`Pinging response: ${res.statusCode}`);
  });
  httpRequest.on("error", (e) => {
    console.error(`Ping error: ${e.message}`);
  });
  httpRequest.end();
}

setInterval(checkAppointments, CHECK_INTERVAL);
setInterval(pingSelf, CHECK_INTERVAL);
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(
    `Server is working on port ${PORT} and url http://localhost:${PORT}`
  );
  checkAppointments();
});
