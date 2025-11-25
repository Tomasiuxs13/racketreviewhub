# ChatGPT API Integration Setup

This guide explains how to use ChatGPT API to generate AI-powered reviews for padel rackets.

## Setup

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you won't be able to see it again)

### 2. Configure API Key

You have two options:

**Option A: Environment Variable (Recommended)**
```bash
export OPENAI_API_KEY="your-api-key-here"
```

**Option B: Config File**
1. Copy `config.example.json` to `config.json`:
   ```bash
   cp config.example.json config.json
   ```
2. Edit `config.json` and add your API key:
   ```json
   {
     "openai": {
       "apiKey": "your-api-key-here"
     }
   }
   ```
3. Add `config.json` to `.gitignore` to keep your key secure

## Usage

### Generate Reviews with ChatGPT

```bash
# Generate all reviews using ChatGPT API
npm run generate:reviews:ai

# Or with custom delay between requests (in milliseconds)
node scripts/generate-reviews.js --use-chatgpt --delay=3000
```

### Generate Reviews Without ChatGPT (Algorithmic)

```bash
# Generate reviews using algorithmic method (no API needed)
npm run generate:reviews
```

### Auto-generate After Sync

```bash
# Sync data and auto-generate reviews
npm run sync:with-reviews
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key
- `USE_CHATGPT=true` - Enable ChatGPT (alternative to --use-chatgpt flag)
- `CHATGPT_DELAY=2000` - Delay between API requests in milliseconds (default: 2000)
- `AUTO_GENERATE_REVIEWS=true` - Auto-generate reviews after sync

## Cost Considerations

- Using `gpt-4o-mini` model (default): ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Average review generation: ~2000-3000 tokens per racket
- For 856 rackets: approximately $2-4 total cost
- Rate limiting: 2 second delay between requests (configurable)

## Review Structure

ChatGPT generates reviews in the exact same structure as the template:
- Introduction
- Technical Analysis (Shape and Balance, Materials and Core, Technologies)
- On the Court (From the Back, At the Net, On Smash)
- Performance Breakdown (Power, Control, Rebound, Maneuverability, Sweet Spot)
- Who It's For
- Pros & Cons
- Conclusion

## Troubleshooting

### API Key Not Found
- Check that `OPENAI_API_KEY` is set or `config.json` exists with the key
- Verify the key is correct and has sufficient credits

### Rate Limit Errors
- Increase the delay: `--delay=5000` (5 seconds)
- Check your OpenAI account rate limits

### API Errors
- The script will automatically fall back to algorithmic generation if ChatGPT fails
- Check your OpenAI account for API status

## Notes

- Reviews are generated based on product specifications and calculated ratings
- ChatGPT uses the product specs, ratings, and existing description to generate comprehensive reviews
- The same HTML structure is maintained for consistency
- All reviews are saved in `articles/reviews/` directory




