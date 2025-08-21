// Data to fill the form
const { personalData } = require("./personal-data");
const { sendTelegramPhoto } = require("./telegram-bot");
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
  const captchaImage = await page.$("#Captcha_CaptchaImage");
  if (captchaImage) {
    console.log("CAPTCHA image element found.");
    const screenshotPath = path.join(__dirname, "captcha.png");
    await captchaImage.screenshot({ path: screenshotPath });
    console.log(`CAPTCHA image saved to ${screenshotPath}`);

    // Send the screenshot file to the user through Telegram
    await sendTelegramPhoto(screenshotPath);

    // Optionally, delete the screenshot after sending
    await fs.unlink(screenshotPath);
    console.log(`CAPTCHA screenshot deleted from ${screenshotPath}`);
  } else {
    console.warn("CAPTCHA image element (Captcha_CaptchaImage) not found.");
  }

  console.log(
    "Form filling process completed. Please review the data and enter the CAPTCHA."
  );
}

module.exports = { autofillForm, personalData };
