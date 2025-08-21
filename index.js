require("dotenv").config();
const express = require("express");
const app = express();
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const { autofillForm } = require("./fill-form-script");
const { sendTelegramMessage, sendTelegramPhoto } = require("./telegram-bot");

const APPOINTMENT_URL = "https://appointment.bmeia.gv.at/";
const checkIntervalInMins = 5; // 5 minutes
const CHECK_INTERVAL = 1000 * 60 * checkIntervalInMins; // Convert minutes to milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = CHECK_INTERVAL;
async function checkAppointments() {
  // const office = "KAIRO";
  // const calendarId =
  //   "Aufenthaltsbewilligung Student (nur Master, PhD und Stipendiate)";

  const office = "ANKARA";
  const calendarId = "Aufenthaltstitel / Oturum müsaadesi";

  const personCount = "1";

  let browser;
  let selectedSlotValue = null;
  try {
    console.log("Starting a new check for appointments...");
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(APPOINTMENT_URL, { waitUntil: "domcontentloaded" });

    // Step 1: Select "KAIRO" and click Next
    await page.waitForSelector("#Office", { timeout: 15000 });
    await page.selectOption("#Office", { label: office });
    await page.click('input[type="submit"][value="Next"]');

    // Step 2: Select "Master" and click Next
    await page.waitForSelector("#CalendarId", { timeout: 15000 });
    await page.selectOption("#CalendarId", {
      label: calendarId,
    });
    await page.click('input[type="submit"][value="Next"]');

    // Step 3: Enter "1" and click Next
    await page.waitForSelector("#PersonCount", { timeout: 15000 });
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
      const lastSlot = page
        .locator('td[valign="top"]')
        .nth(-1)
        .locator('input[type="radio"]')
        .nth(-1);

      await lastSlot.click({ timeout: 15000 });
      console.log("Appointment slot found and selected!");

      selectedSlotValue = await lastSlot.evaluate((el) => el.value);

      await page.click('input[type="submit"][value="Next"]');

      console.log("APPOINTMENT SLOT FOUND! Sending Telegram notification...");
      await sendTelegramMessage(
        `An appointment slot has been found for ${selectedSlotValue}!`
      );
      console.log("Notification sent. The bot will continue to monitor.");
      await autofillForm(page);
      if (selectedSlotValue) {
        await sendTelegramMessage(
          `Appointment booked for: ${selectedSlotValue}`
        );
        console.log(
          `Telegram message sent: Appointment booked for ${selectedSlotValue}`
        );
      }
    }
    return true; // Indicate success
  } catch (error) {
    console.error("An error occurred during the check:", error.message);
    return false; // Indicate failure
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runCheckWithRetries(attempt = 1) {
  console.log(`Attempt ${attempt} to check appointments...`);
  const success = await checkAppointments();
  if (!success && attempt < MAX_RETRIES) {
    console.log(
      `Check failed. Retrying in ${RETRY_DELAY_MS / 1000} seconds...`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    await runCheckWithRetries(attempt + 1);
  } else if (!success) {
    console.error(
      `All ${MAX_RETRIES} attempts failed. Skipping this interval.`
    );
    await sendTelegramMessage(
      `Appointment check failed after ${MAX_RETRIES} attempts. Please check the bot logs.`
    );
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
    // Only send Telegram message for successful pings to avoid spam
    if (res.statusCode === 200) {
      await sendTelegramMessage(`Pinging response: ${res.statusCode}`);
    }
  });
  httpRequest.on("error", async (e) => {
    console.error(`Ping error: ${e.message}`);
    await sendTelegramMessage(`Ping error: ${e.message}`);
  });
  httpRequest.end();
}

setInterval(runCheckWithRetries, CHECK_INTERVAL);
setInterval(pingSelf, CHECK_INTERVAL);
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(
    `Server is working on port ${PORT} and url http://localhost:${PORT}`
  );
  runCheckWithRetries();
});
