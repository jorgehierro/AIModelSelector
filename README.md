# AI Model Selector Platform

A rich, interactive single-page web application to help you find the best AI model for your specific use case. It combines a guided decision pipeline with powerful filtering and visual data exploration.

## Features

- 🧭 **Guided Wizard:** Answer a few simple questions (task, budget, context, speed) and get the top recommended models tailored to your needs.
- 📊 **Model Explorer:** Filter through a curated database of top AI models. Filter by provider, open-source status, deployment options, price, and intelligence score. Includes a detailed side-by-side comparison tool.
- 📈 **Quality vs. Cost Chart:** A visual scatter plot showing the intelligence score against the blended price, with bubble sizes indicating output speed.

## How to Run

Because this app uses purely static files (HTML/CSS/JS) with no build tools or dependencies, you can run it entirely offline by opening it directly in your browser.

1. Simply double-click `index.html` to open it in your default web browser.
2. **Alternatively**, you can use a local development server for a more "native" experience (recommended if you face any local file CORS issues in certain browsers):
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

## Customizing the Database

All the AI models and their associated data are stored in `data.js`. The app comes pre-loaded with ~30 of the most relevant models as of early 2024.

To add or update models:
1. Open `data.js`.
2. Locate the `MODELS` array.
3. Add a new object following the existing schema:

```javascript
{
  id: "model-id",
  name: "Model Name",
  provider: "Provider Name",
  family: "Model Family",
  tasks: ["text", "code", "vision"], // See TASKS array for options
  openSource: true/false,
  contextWindow: 128000,
  inputPrice: 1.00, // $/M tokens
  outputPrice: 2.00, // $/M tokens
  blendedPrice: 1.50, // Calculated average
  speed: 100, // tok/s
  intelligenceScore: 80, // 0-100 score
  supportsFinetuning: true/false,
  multimodal: true/false,
  deploymentOptions: ["api", "self-hosted"],
  license: "apache2",
  description: "Brief summary.",
  tags: ["tag1", "tag2"],
  link: "https://link-to-docs.com"
}
```

## Architecture

- `index.html`: The app shell and view containers.
- `styles.css`: The full dark-mode, glassmorphism design system.
- `app.js`: State management, wizard logic, filtering engine, and chart rendering.
- `data.js`: The static model database.
