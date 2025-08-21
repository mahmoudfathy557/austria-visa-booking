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

    while (!captchaText) {
      const updates = await getTelegramUpdates(currentOffset);
      if (updates.length > 0) {
        // Find the latest update with a message
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
          currentOffset = latestUpdate.update_id + 1; // Update offset for next poll
        }
      }
      if (!captchaText) {
        await page.waitForTimeout(50000); // Wait 50 seconds before checking for updates again
      }
    }

    if (captchaInputField && captchaText) {
      await captchaInputField.fill(captchaText);
      console.log(`CAPTCHA field filled with: ${captchaText}`);
    } else if (!captchaInputField) {
      console.warn("CAPTCHA input field (CaptchaText) not found.");
    }
  } else {
    console.warn("CAPTCHA image element (Captcha_CaptchaImage) not found.");
  }

  console.log("Form filling process completed. CAPTCHA entered.");
}

module.exports = { autofillForm, personalData };
