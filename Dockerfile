# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Install Playwright's system dependencies
# These are the libraries identified as missing in the previous build logs

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
# This allows us to install dependencies before copying the rest of the app
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Install Playwright browsers
# This will download the browser binaries into the container
RUN npx playwright install  --with-deps

# Expose the port your app runs on (e.g., 10000 as seen in your logs)
EXPOSE 10000

# Define the command to run your app
CMD [ "node", "index.js" ]
