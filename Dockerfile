# Use the official Node.js 14 image as the base image
FROM node:latest

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the app source code to the working directory
COPY . .

# Expose port 4000
EXPOSE 4000

# Start the app
CMD ["npm", "run", "start"]
