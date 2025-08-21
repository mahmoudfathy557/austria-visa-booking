// Data to fill the form
const { personalData } = require("./personal-data");
const { sendTelegramPhoto, getTelegramUpdates } = require("./telegram-bot");
const path = require("path");
const fs = require("fs").promises;

// Helper function for random delays
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fills personal data fields on the page.
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {Object} data - The personal data to fill.
 */
async function fillPersonalData(page, data) {
  console.log("Filling personal data fields...");
  for (const key in data) {
    const value = data[key];
    try {
      const selectElement = await page.$(
        `select#${key}, select[name="${key}"]`
      );
      if (selectElement) {
        await page.selectOption(`select#${key}, select[name="${key}"]`, {
          label: value,
        });
        await page.waitForTimeout(getRandomDelay(200, 300)); // Delay after selecting option
      } else {
        await page.type(
          `input#${key}, input[name="${key}"], textarea#${key}, textarea[name="${key}"]`,
          value,
          { delay: getRandomDelay(50, 79) } // Simulate typing speed
        );
        await page.waitForTimeout(getRandomDelay(200, 300)); // Delay after typing
      }
    } catch (error) {
      console.warn(
        `Could not fill element '${key}' with value '${value}': ${error.message}`
      );
    }
  }
}

/**
 * Handles the privacy checkbox.
 * @param {import('playwright').Page} page - The Playwright page object.
 */
async function handlePrivacyCheckbox(page) {
  console.log("Handling privacy checkbox...");
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
}

/**
 * Checks for a specific error message on the page and sends a screenshot to Telegram if found.
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} errorMessageText - The error message text to look for.
 * @returns {Promise<boolean>} - True if the error message is found, false otherwise.
 */
async function checkAndHandleError(page, errorMessageText) {
  const pageContent = await page.textContent("body");
  if (pageContent.includes(errorMessageText)) {
    console.error(`Error: '${errorMessageText}' found on page.`);
    const errorScreenshotPath = path.join(__dirname, "error.png");
    await page.screenshot({ path: errorScreenshotPath });
    await sendTelegramPhoto(errorScreenshotPath);
    await fs.unlink(errorScreenshotPath);
    console.log(
      `Error screenshot sent to Telegram and deleted from ${errorScreenshotPath}`
    );
    return true;
  }
  return false;
}

/**
 * Handles the CAPTCHA process, including taking screenshots, sending to Telegram,
 * waiting for input, filling, clicking next, and checking for errors.
 * @param {import('playwright').Page} page - The Playwright page object.
 * @returns {Promise<boolean>} - True if a CAPTCHA error occurred, false otherwise.
 */
async function handleCaptcha(page) {
  const captchaInputField = await page.$("#CaptchaText");
  const captchaImage = await page.$("#Captcha_CaptchaImage");

  if (!captchaImage) {
    console.warn("CAPTCHA image element (Captcha_CaptchaImage) not found.");
    return false; // No CAPTCHA to handle, proceed
  }

  console.log("CAPTCHA image element found.");
  const screenshotPath = path.join(__dirname, "captcha.png");
  await captchaImage.screenshot({ path: screenshotPath });
  console.log(`CAPTCHA image saved to ${screenshotPath}`);

  let initialOffset = 0;
  const initialUpdates = await getTelegramUpdates(0);
  if (initialUpdates.length > 0) {
    initialOffset = initialUpdates[initialUpdates.length - 1].update_id + 1;
  }

  await sendTelegramPhoto(screenshotPath);
  await fs.unlink(screenshotPath);
  console.log(`CAPTCHA screenshot deleted from ${screenshotPath}`);

  console.log("Waiting for CAPTCHA text from Telegram...");
  let captchaText = null;
  let currentOffset = initialOffset;

  while (!captchaText) {
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
    if (!captchaText) {
      await page.waitForTimeout(50000);
    }
  }

  if (captchaInputField && captchaText) {
    await captchaInputField.type(captchaText.trim(), {
      delay: getRandomDelay(50, 150),
    }); // Simulate typing speed
    console.log(`CAPTCHA field filled with: ${captchaText}`);
  } else if (!captchaInputField) {
    console.warn("CAPTCHA input field (CaptchaText) not found.");
  }

  await page.click('input[type="submit"][value="Next"]');
  console.log("Clicked 'Next' after CAPTCHA submission.");

  const captchaError = await checkAndHandleError(
    page,
    "Captcha: The text from the picture does not match with your entry"
  );
  if (captchaError) {
    return true; // Indicate that a CAPTCHA error occurred
  }

  const generalError = await checkAndHandleError(
    page,
    "The following information is missing or erroneous"
  );
  if (generalError) {
    return true; // Indicate that a general error occurred
  }

  return false; // No errors, CAPTCHA handled successfully
}

/**
 * Main function to autofill the form.
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {Object} data - The personal data to fill.
 */
async function autofillForm(page, data = personalData) {
  console.log("Entering autofillForm function...");
  await page.waitForTimeout(2000);

  await fillPersonalData(page, data);
  await handlePrivacyCheckbox(page);

  let captchaErrorOccurred = true;
  while (captchaErrorOccurred) {
    captchaErrorOccurred = await handleCaptcha(page);
    if (captchaErrorOccurred) {
      console.log("CAPTCHA error detected. Retrying CAPTCHA process...");
      // Optionally, add a delay before retrying
      await page.waitForTimeout(5000);
    }
  }

  console.log(
    "Form filling process completed. CAPTCHA entered and form submitted."
  );
}

module.exports = { autofillForm, personalData };
