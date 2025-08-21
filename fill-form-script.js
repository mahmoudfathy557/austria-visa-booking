// Data to fill the form
// copy it to the console and run it on the page
// This script is designed to fill out a visa application form automatically
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
  NationalityForApplication: "EGYPT", // Corrected ID
  TraveldocumentDateOfIssue: "11/22/2022", // Corrected ID
  TraveldocumentValidUntil: "11/21/2029", // Corrected ID
  TraveldocumentIssuingAuthority: "EGYPT", // Corrected ID
};

// Function to fill the form
function autofillForm(data) {
  for (const key in data) {
    const element = document.getElementById(key);
    if (element) {
      // For dropdowns, we need to select the option by its text
      if (element.tagName === "SELECT") {
        for (let i = 0; i < element.options.length; i++) {
          if (
            element.options[i].text.toUpperCase() === data[key].toUpperCase()
          ) {
            element.value = element.options[i].value;
            break;
          }
        }
      } else {
        element.value = data[key];
      }
      // Dispatching input event to trigger any validation or UI updates
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      console.warn(`Element with ID '${key}' not found.`);
    }
  }

  // Check the privacy policy checkbox
  const privacyCheckbox = document.getElementById("datenschutzbox");
  if (privacyCheckbox && !privacyCheckbox.checked) {
    privacyCheckbox.click();
  }

  console.log(
    "Form filled successfully! Please review the data and enter the CAPTCHA."
  );
}

// Run the function
autofillForm(personalData);
