// Data to fill the form
const { personalData } = require("./personal-data");
const { sendTelegramPhoto, getTelegramUpdates } = require("./telegram-bot");
const path = require("path");
const fs = require("fs").promises;

// Function to fill the form using Playwright's page.evaluate
async function autofillForm(page, data = personalData) {
  console.log("Entering autofillForm function..."); // Log to Node.js console
  await page.waitForTimeout(2000); // Add a small delay to ensure elements are loaded

  for (const key in data) {
    const value = data[key];
    try {
      // Check if it's a select element
      const selectElement = await page.$(
        `select#${key}, select[name="${key}"]`
      );
      if (selectElement) {
        // For select elements, use page.selectOption
        await page.selectOption(`select#${key}, select[name="${key}"]`, {
          label: value,
        });
      } else {
        // For other input types, use page.fill
        await page.fill(
          `input#${key}, input[name="${key}"], textarea#${key}, textarea[name="${key}"]`,
          value
        );
      }
    } catch (error) {
      console.warn(
        `Could not fill element '${key}' with value '${value}': ${error.message}`
      );
    }
  }

  // Handle privacy checkbox
  await page.evaluate(async () => {
    const privacyCheckbox = document.getElementById("DSGVOAccepted");
    if (privacyCheckbox && !privacyCheckbox.checked) {
      privacyCheckbox.click();
      console.log("Privacy checkbox clicked.");
    } else if (privacyCheckbox && privacyCheckbox.checked) {
      console.log("Privacy checkbox already checked.");
    } else {
      console.warn("Privacy checkbox (DSGVOAccepted) not found.");
    }
  });

  // Handle captcha field
  const captchaInputField = await page.$("#CaptchaText");
  const captchaImage = await page.$("#Captcha_CaptchaImage");
  if (captchaImage) {
    console.log("CAPTCHA image element found.");
    const screenshotPath = path.join(__dirname, "captcha.png");
    await captchaImage.screenshot({ path: screenshotPath });
    console.log(`CAPTCHA image saved to ${screenshotPath}`);

    // Get the current highest update_id before sending the photo
    let initialOffset = 0;
    const initialUpdates = await getTelegramUpdates(0);
    if (initialUpdates.length > 0) {
      initialOffset = initialUpdates[initialUpdates.length - 1].update_id + 1;
    }

    // Send the screenshot file to the user through Telegram
    await sendTelegramPhoto(screenshotPath);

    // Optionally, delete the screenshot after sending
    await fs.unlink(screenshotPath);
    console.log(`CAPTCHA screenshot deleted from ${screenshotPath}`);

    // Wait for the user to send the CAPTCHA text back
    console.log("Waiting for CAPTCHA text from Telegram...");
    let captchaText = null;
    let currentOffset = initialOffset;
    const CAPTCHA_WAIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const POLL_INTERVAL_MS = 10 * 1000; // Poll every 10 seconds
    const startTime = Date.now();

    while (!captchaText && Date.now() - startTime < CAPTCHA_WAIT_TIMEOUT_MS) {
      try {
        const updates = await getTelegramUpdates(currentOffset);
        if (updates.length > 0) {
          let latestUpdate = null;
          for (const update of updates) {
            if (update.message && update.message.text) {
              if (!latestUpdate || update.update_id > latestUpdate.update_id) {
                latestUpdate = update;
              }
            }
          }

          if (latestUpdate) {
            captchaText = latestUpdate.message.text;
            currentOffset = latestUpdate.update_id + 1;
          }
        }
      } catch (telegramError) {
        console.error(
          `Error fetching Telegram updates: ${telegramError.message}`
        );
        await sendTelegramMessage(
          `Error fetching Telegram updates for CAPTCHA: ${telegramError.message}`
        );
      }

      if (!captchaText) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }

    if (captchaText) {
      if (captchaInputField) {
        await captchaInputField.fill(captchaText);
        console.log(`CAPTCHA field filled with: ${captchaText}`);
        // await page.click('input[type="submit"][value="Next"]');
        console.log("Clicked 'Next' after CAPTCHA submission.");
      } else {
        console.warn(
          "CAPTCHA input field (CaptchaText) not found after receiving text."
        );
        await sendTelegramMessage(
          "CAPTCHA text received, but input field not found. Manual intervention may be needed."
        );
      }
    } else {
      console.error("Timed out waiting for CAPTCHA text from Telegram.");
      await sendTelegramMessage(
        "Timed out waiting for CAPTCHA text. Please check the bot."
      );
      throw new Error("CAPTCHA resolution timed out."); // Throw an error to be caught by checkAppointments retry logic
    }
  } else {
    console.warn(
      "CAPTCHA image element (Captcha_CaptchaImage) not found. Skipping CAPTCHA handling."
    );
  }

  console.log("Form filling process completed.");
}

module.exports = { autofillForm, personalData };
