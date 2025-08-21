require("dotenv").config();
const express = require("express");
const app = express();
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const { autofillForm } = require("./fill-form-script");
const { sendTelegramMessage, sendTelegramPhoto } = require("./telegram-bot");

// Helper function for random delays
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const APPOINTMENT_URL = "https://appointment.bmeia.gv.at/";
const checkIntervalInMins = 5; // 5 minutes
const CHECK_INTERVAL = 1000 * 60 * checkIntervalInMins; // Convert minutes to milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = CHECK_INTERVAL;
async function checkAppointments() {
  //  for testing purposes
  // const office = "ANKARA";
  // const calendarId = "Aufenthaltstitel / Oturum müsaadesi";

  // for Prooduction
  const office = "KAIRO";
  const calendarId =
    "Aufenthaltsbewilligung Student (nur Master, PhD und Stipendiate)";

  const personCount = "1";

  let browser;
  let selectedSlotValue = null;
  try {
    console.log("Starting a new check for appointments...");
    const isProduction = process.env.NODE_ENV === "production";

    browser = await chromium.launch({
      headless: isProduction,
      args: [
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36",
      ],
    });
    const page = await browser.newPage();
    await page.goto(APPOINTMENT_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(getRandomDelay(1000, 1400)); // Initial random delay
    await page.evaluate(() =>
      window.scrollBy(0, Math.floor(Math.random() * 200) + 50)
    ); // Random scroll down
    await page.waitForTimeout(getRandomDelay(500, 700)); // Small delay after scroll

    // Step 1: Select "KAIRO" and click Next
    await page.waitForSelector("#Office", { timeout: 15000 });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay before select
    await page.selectOption("#Office", { label: office });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay after select
    await page.click('input[type="submit"][value="Next"]');
    await page.waitForTimeout(getRandomDelay(1000, 1400)); // Delay after click

    // Step 2: Select "Master" and click Next
    await page.waitForSelector("#CalendarId", { timeout: 15000 });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay before select
    await page.selectOption("#CalendarId", {
      label: calendarId,
    });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay after select
    await page.click('input[type="submit"][value="Next"]');
    await page.waitForTimeout(getRandomDelay(1000, 1400)); // Delay after click

    // Step 3: Enter "1" and click Next
    await page.waitForSelector("#PersonCount", { timeout: 15000 });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay before select
    await page.selectOption("#PersonCount", {
      label: personCount,
    });
    await page.waitForTimeout(getRandomDelay(500, 700)); // Delay after select
    await page.click('input[type="submit"][value="Next"]');
    await page.waitForTimeout(getRandomDelay(1000, 1400)); // Delay after click

    // Step 4: Click Next again
    await page.click('input[type="submit"][value="Next"]');
    await page.waitForTimeout(getRandomDelay(1000, 1400)); // Delay after click
    await page.evaluate(() =>
      window.scrollBy(0, Math.floor(Math.random() * 200) + 50)
    ); // Random scroll down
    await page.waitForTimeout(getRandomDelay(500, 700)); // Small delay after scroll

    // Step 5: Check for "no appointments" message
    const currentPageBody = await page.textContent("body");
    if (
      currentPageBody.includes(
        "For your selection there are unfortunately no appointments available"
      )
    ) {
      console.log(
        `No appointments available. Will check again in ${checkIntervalInMins} minutes.`
      );
    } else {
      // Find and click the last available appointment slot
      console.log("Searching for available slots...");
      const lastSlot = page
        .locator('td[valign="top"]')
        .nth(-1)
        .locator('input[type="radio"]')
        .nth(-1);

      await page.waitForTimeout(getRandomDelay(1000, 2500)); // Delay before clicking slot
      await lastSlot.click({ timeout: 15000 });
      console.log("Appointment slot found and selected!");

      selectedSlotValue = await lastSlot.evaluate((el) => el.value);

      await page.waitForTimeout(getRandomDelay(1000, 2500)); // Delay before clicking next
      await page.click('input[type="submit"][value="Next"]');
      await page.waitForTimeout(getRandomDelay(1000, 1400)); // Delay after click

      console.log("APPOINTMENT SLOT FOUND! Sending Telegram notification...");
      await sendTelegramMessage(
        `An appointment slot has been found for ${selectedSlotValue}!`
      );
      console.log("Notification sent. The bot will continue to monitor.");

      // Step 6: Fill the form
      await autofillForm(page);

      // Step 7: Wait for navigation after form submission and confirm the booking appointment

      await page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }); // Wait for navigation up to 60 seconds
      console.log(`Navigated to: ${page.url()}`);

      const confirmationText = await page.textContent("body");
      if (confirmationText.includes("Confirmation of reservation")) {
        console.log("Confirmation of reservation found. Taking screenshot...");
        const screenshotPath = "confirmation.png";
        await page.screenshot({ path: screenshotPath });
        await sendTelegramPhoto(screenshotPath, "Booking Confirmation");
        console.log("Screenshot sent to Telegram.");

        if (selectedSlotValue) {
          await sendTelegramMessage(
            `Appointment booked for: ${selectedSlotValue}`
          );
          console.log(
            `Telegram message sent: Appointment booked for ${selectedSlotValue}`
          );
          clearInterval(appointmentCheckInterval);
          clearInterval(pingInterval);
          console.log("Bot stopped after successful appointment booking.");
        }
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

let appointmentCheckInterval;
let pingInterval;

appointmentCheckInterval = setInterval(runCheckWithRetries, CHECK_INTERVAL);
pingInterval = setInterval(pingSelf, CHECK_INTERVAL);
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(
    `Server is working on port ${PORT} and url http://localhost:${PORT}`
  );
  runCheckWithRetries();
});
