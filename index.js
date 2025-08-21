require("dotenv").config();
const express = require("express");
const app = express();
const { chromium } = require("playwright");
const axios = require("axios");
const path = require("path");
const http = require("http");
const { autofillForm } = require("./fill-form-script");
const { sendTelegramMessage, sendTelegramPhoto } = require("./telegram-bot");

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

async function checkAppointments() {
  // const office = "ANKARA";
  // const calendarId = "Aufenthaltstitel / Oturum müsaadesi";
  const office = "KAIRO";
  const calendarId =
    "Aufenthaltsbewilligung Student (nur Master, PhD und Stipendiate)";
  const personCount = "1";

  let browser;
  let selectedSlotValue = null; // Declare selectedSlotValue here
  try {
    console.log("Starting a new check for appointments...");
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(APPOINTMENT_URL, { waitUntil: "domcontentloaded" });

    // Step 1: Select "KAIRO" and click Next
    await page.waitForSelector("#Office", { timeout: 15000000 });
    await page.selectOption("#Office", { label: office });
    await page.click('input[type="submit"][value="Next"]');

    // Step 2: Select "Master" and click Next
    await page.waitForSelector("#CalendarId", { timeout: 15000000 });
    await page.selectOption("#CalendarId", {
      label: calendarId,
    });
    await page.click('input[type="submit"][value="Next"]');

    // Step 3: Enter "1" and click Next
    await page.waitForSelector("#PersonCount", { timeout: 15000000 });
    await page.selectOption("#PersonCount", {
      label: personCount,
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
      // New Logic: Find and click the last available appointment slot
      console.log("Searching for available slots...");
      // Select the last radio button within the last table cell containing appointment slots
      const lastSlot = page
        .locator('td[valign="top"]')
        .nth(-1)
        .locator('input[type="radio"]')
        .nth(-1);

      await lastSlot.click({ timeout: 15000 });
      console.log("Appointment slot found and selected!");

      // Get the value of the selected slot before clicking next
      selectedSlotValue = await lastSlot.evaluate((el) => el.value); // Assign to the declared variable

      // Click the 'Next' button to proceed after selecting the slot
      await page.click('input[type="submit"][value="Next"]');

      console.log("APPOINTMENT SLOT FOUND! Sending Telegram notification...");
      await sendTelegramMessage(
        `An appointment slot has been found for ${selectedSlotValue}!`
      );
      console.log("Notification sent. The bot will continue to monitor.");
    }

    // Step 6: fill the form using the autofill script, which now handles CAPTCHA and submission
    await autofillForm(page);
    // Send message after final submission (this will now be triggered after CAPTCHA and form submission in autofillForm)
    if (selectedSlotValue) {
      await sendTelegramMessage(`Appointment booked for: ${selectedSlotValue}`);
      console.log(
        `Telegram message sent: Appointment booked for ${selectedSlotValue}`
      );
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
    await sendTelegramMessage(`Pinging response: ${res.statusCode}`);
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
