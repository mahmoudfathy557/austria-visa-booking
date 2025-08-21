// Data to fill the form
const { personalData } = require("./personal-data");
const { sendTelegramPhoto } = require("./telegram-bot");

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

  // Handle privacy checkbox and captcha field within page.evaluate for direct DOM interaction
  const captchaImageSrc = await page.evaluate(async () => {
    // Check and click the privacy checkbox if it exists
    const privacyCheckbox = document.getElementById("DSGVOAccepted");
    if (privacyCheckbox && !privacyCheckbox.checked) {
      privacyCheckbox.click();
      console.log("Privacy checkbox clicked."); // This log will appear in the browser console
    } else if (privacyCheckbox && privacyCheckbox.checked) {
      console.log("Privacy checkbox already checked."); // This log will appear in the browser console
    } else {
      console.warn("Privacy checkbox (DSGVOAccepted) not found."); // This log will appear in the browser console
    }

    // Get the captcha image source if it exists
    const captchaImage = document.getElementById("Captcha_CaptchaImage");
    if (captchaImage) {
      return captchaImage.src;
    }
    return null;
  });

  if (captchaImageSrc) {
    console.log("CAPTCHA field found. Image src:", captchaImageSrc);
    // Send the src of the captcha image to the user through Telegram
    await sendTelegramPhoto(captchaImageSrc);
  } else {
    console.warn("CAPTCHA field not found.");
  }

  console.log(
    "Form filling process completed. Please review the data and enter the CAPTCHA."
  );
}

module.exports = { autofillForm, personalData };
