// Data to fill the form
const personalData = {
  Lastname: "Elshourbagy",
  Firstname: "Mahmoud",
  DateOfBirth: "08/10/1996",
  TraveldocumentNumber: "A32221108",
  Sex: "Male",
  Street: "alfath st",
  Postcode: "35738",
  City: "alainbilawin",
  Country: "EGYPT",
  Telephone: "+201022014166",
  Email: "mahmoudfathy2424@gmail.com",
  LastnameAtBirth: "Mahmoud",
  NationalityAtBirth: "EGYPT",
  CountryOfBirth: "IRAQ",
  PlaceOfBirth: "Baghdad",
  NationalityForApplication: "EGYPT",
  TraveldocumentDateOfIssue: "11/22/2022",
  TraveldocumentValidUntil: "11/21/2029",
  TraveldocumentIssuingAuthority: "EGYPT",
};

// Function to fill the form using Playwright's page.evaluate
async function autofillForm(page, data = personalData) {
  await page.evaluate((formData) => {
    for (const key in formData) {
      const element = document.getElementById(key);
      if (element) {
        if (element.tagName === "SELECT") {
          for (let i = 0; i < element.options.length; i++) {
            if (
              element.options[i].text.toUpperCase() ===
              formData[key].toUpperCase()
            ) {
              element.value = element.options[i].value;
              break;
            }
          }
        } else {
          element.value = formData[key];
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        console.warn(`Element with ID '${key}' not found.`);
      }
    }

    // Check and click the privacy checkbox if it exists
    // This assumes the checkbox has the ID 'DSGVOAccepted

    const privacyCheckbox = document.getElementById("DSGVOAccepted");
    if (privacyCheckbox && !privacyCheckbox.checked) {
      privacyCheckbox.click();
    }

    console.log(
      "Form filled successfully! Please review the data and enter the CAPTCHA."
    );
  }, data);
}

module.exports = { autofillForm, personalData };
