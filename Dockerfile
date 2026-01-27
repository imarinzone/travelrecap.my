# Use a lightweight Nginx image to serve static files
FROM nginx:alpine

# Copy all project files to the Nginx root directory
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
