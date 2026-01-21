FROM node:20-alpine

WORKDIR /app

# Don't run npm install here.
# We'll run npm install after Vite scaffolds package.json (on the mounted volume).

EXPOSE 5173
CMD ["sh", "-lc", "npm install && npm run dev -- --host 0.0.0.0 --port 5173"]
