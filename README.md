This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Brand Review App

This application integrates with Sitecore XM Cloud Pages to extract content from the current page and send it to a brand review API for analysis.

### Features

- Retrieves current page context from Sitecore XM Cloud
- Extracts page content including fields, layout, and metadata
- Sends content to a configurable brand review API
- Provides real-time feedback on the review submission status

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, configure your brand review API:

1. Copy `.env.local` and update the API endpoint:
```bash
cp .env.local .env.local.example
```

2. Edit `.env.local` with your actual API details:
```env
NEXT_PUBLIC_BRAND_REVIEW_API_URL=https://your-brand-review-api.com/review
# Add authentication if required
BRAND_REVIEW_API_KEY=your-api-key
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. The app will display the current page information when loaded within Sitecore XM Cloud Pages
2. Click the "Send to Brand Review" button to submit the page content
3. The app will show the status of the submission

## API Integration

The app sends a POST request to the configured brand review API with the following payload:

```json
{
  "content": {
    "pageId": "page-id",
    "displayName": "Page Display Name",
    "fields": {...},
    "layout": "...",
    "template": {...},
    "language": "en-US",
    "siteInfo": {...},
    "url": "...",
    "path": "..."
  },
  "metadata": {
    "timestamp": "2024-01-14T...",
    "source": "sitecore-xm-cloud-marketplace",
    "appName": "App Name",
    "userAgent": "..."
  }
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
