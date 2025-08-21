# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Install Playwright's system dependencies
# These are the libraries identified as missing in the previous build logs
RUN apt-get update && apt-get install -y \
    libgtk-4-dev \
    libgraphene-1.0-0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libenchant-2-2 \
    libsecret-1-0 \
    libmanette-0.2-0 \
    libgles2 \
    # Additional dependencies often required by Playwright browsers
    fonts-liberation \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm-dev \
    libxkbcommon-dev \
    libxshmfence-dev \
    libgbm-dev \
    libwebp-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libharfbuzz-dev \
    libfreetype-dev \
    libfontconfig1 \
    libglib2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    libappindicator1 \
    libdbus-glib-1-2 \
    libevent-2.1-7 \
    libgconf-2-4 \
    libnotify4 \
    libvulkan1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

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
RUN npx playwright install

# Expose the port your app runs on (e.g., 10000 as seen in your logs)
EXPOSE 10000

# Define the command to run your app
CMD [ "node", "index.js" ]
