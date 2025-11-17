# Guide Article Template

This template provides a consistent structure for all padel racket buying guides. Follow this format to ensure all guides have a professional, cohesive structure.

## Template Structure

### 1. Introduction Section

```markdown
## Introduction

[Engaging hook - 2-3 sentences that grab attention]
[Brief overview of what the guide covers - 1-2 sentences]
[What the reader will learn - bullet points or short paragraph]
```

**Example:**
```markdown
## Introduction

Choosing the right padel racket can make or break your game. With hundreds of models available, finding the perfect match for your skill level and playing style can feel overwhelming.

This comprehensive guide will walk you through everything you need to know about selecting a padel racket. By the end, you'll understand:
- How racket shapes affect your gameplay
- Which features matter most for your skill level
- How to match rackets to your playing style
- What to look for when testing rackets
```

---

### 2. Main Content Sections

Use 3-5 main sections based on your topic. Each section should be substantial (300-500 words) and provide actionable information.

```markdown
## [Main Topic Section 1]

[Content paragraph 1 - Introduction to the concept]

[Content paragraph 2 - Detailed explanation]

[Content paragraph 3 - Examples or practical applications]

### Subsection (if needed)

[More detailed information]

- Bullet point 1
- Bullet point 2
- Bullet point 3

## [Main Topic Section 2]

[Content following same structure...]
```

**Important**: When explaining concepts, use actual rackets from the database as examples. Link to them naturally:
- Example: "For instance, the [Brand Model](/rackets/[racket-id]) demonstrates this principle with its [specific feature]."
- Compare real rackets to illustrate differences
- Reference actual specifications when making points

**Formatting Guidelines:**
- Use `##` for main section headings (H2)
- Use `###` for subsections (H3)
- Use `**bold**` for emphasis on key terms
- Use `*italic*` for subtle emphasis
- Use bullet lists (`-` or `*`) for key points
- Use numbered lists (`1.`) for step-by-step instructions

---

### 3. Key Takeaways Section

Summarize the most important points from the guide.

```markdown
## Key Takeaways

- **Takeaway 1**: [Brief summary point]
- **Takeaway 2**: [Brief summary point]
- **Takeaway 3**: [Brief summary point]
- **Takeaway 4**: [Brief summary point]
```

**Example:**
```markdown
## Key Takeaways

- **Round shapes offer maximum control**: Perfect for beginners who need forgiveness and easy power generation
- **Balance matters more than weight**: A well-balanced racket feels lighter and more maneuverable
- **Test before you buy**: Always try a racket if possible, as personal feel is crucial
- **Invest in quality early**: A good racket can last years and improve your game faster
```

---

### 4. Recommended Rackets Section (Required for Most Guides)

**IMPORTANT**: Most guides MUST include actual rackets from the database. This section is required for guides that recommend specific rackets.

```markdown
## Recommended Rackets

### [Brand] [Model]

**Why we recommend it**: [Brief explanation based on actual racket data - 1-2 sentences]

**Key features** (from database):
- [Feature 1 based on actual specifications]
- [Feature 2 based on actual specifications]
- [Feature 3 based on actual specifications]

**Specifications**:
- Shape: [Actual shape from database]
- Power Rating: [Actual rating from database]
- Control Rating: [Actual rating from database]
- Price: [Current price from database]

[View full details →](/rackets/[racket-id])

### [Brand] [Model]

[Same structure for each recommended racket...]
```

**Requirements**:
- **MUST use actual rackets from the database** - not generic recommendations
- Query the database for rackets matching your guide's criteria (shape, ratings, price range, etc.)
- Include 3-7 rackets depending on the guide type
- Link to each racket using format: `/rackets/[racket-id]` where `[racket-id]` is the actual racket ID from the database
- Reference actual specifications (ratings, prices, features) from the database
- Explain why each racket fits the guide's recommendations

**Database Query Examples**:
- Beginner guides: Filter by `shape = 'round'`, `controlRating >= 70`, `currentPrice <= 150`
- Intermediate guides: Filter by `shape = 'teardrop'`, balanced ratings, `currentPrice 150-250`
- Advanced guides: Filter by `shape = 'diamond'`, `powerRating >= 80`, `currentPrice >= 250`
- Price guides: Filter by price ranges matching each section

**Note**: Guides that are purely educational (like "Understanding Ratings") may include fewer rackets, but should still reference real examples from the database.

---

### 5. Conclusion Section

Wrap up the guide with final thoughts and next steps.

```markdown
## Conclusion

[Final summary paragraph - 2-3 sentences]

[Call to action or next steps - 1-2 sentences]

[Encouragement or closing thought - 1 sentence]
```

**Example:**
```markdown
## Conclusion

Choosing the right padel racket is a personal journey that depends on your skill level, playing style, and physical attributes. By understanding the fundamentals covered in this guide, you're now equipped to make an informed decision.

Ready to find your perfect racket? Browse our [complete racket collection](/rackets) or check out our [other buying guides](/guides) for more expert advice.

Remember, the best racket is the one that feels right in your hands and helps you enjoy the game you love.
```

---

## HTML Conversion Guidelines

When converting this markdown to HTML for database storage, follow these rules:

### Headings
- `# Title` → `<h1>Title</h1>` (usually not used in content, reserved for page title)
- `## Section` → `<h2>Section</h2>`
- `### Subsection` → `<h3>Subsection</h3>`

### Text Formatting
- `**bold**` → `<strong>bold</strong>`
- `*italic*` → `<em>italic</em>`

### Lists
- Bullet lists:
  ```markdown
  - Item 1
  - Item 2
  ```
  → 
  ```html
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
  ```

- Numbered lists:
  ```markdown
  1. Step 1
  2. Step 2
  ```
  →
  ```html
  <ol>
    <li>Step 1</li>
    <li>Step 2</li>
  </ol>
  ```

### Paragraphs
- Separate paragraphs with blank lines in markdown
- Convert to `<p>...</p>` tags in HTML

### Links
- `[Link text](/path)` → `<a href="/path">Link text</a>`
- External links: `[Link text](https://example.com)` → `<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link text</a>`

### Images (if needed)
- `![Alt text](image-url.jpg)` → `<img src="image-url.jpg" alt="Alt text" />`
- Always include descriptive alt text for accessibility

---

## Content Guidelines

### Tone and Style
- **Professional yet approachable**: Write as if speaking to a friend who's interested in padel
- **Clear and concise**: Avoid jargon, or explain it when necessary
- **Actionable**: Provide specific, useful advice readers can apply
- **Evidence-based**: Reference common knowledge, expert opinions, or technical specifications

### Word Count
- **Introduction**: 100-200 words
- **Each main section**: 300-500 words
- **Key Takeaways**: 50-100 words
- **Recommended Rackets** (if included): 100-200 words per racket
- **Conclusion**: 100-150 words
- **Total guide length**: 1,500-3,000 words

### SEO Considerations
- Include target keywords naturally in headings and content
- Use descriptive headings that answer common questions
- Structure content with clear hierarchy (H2, H3)
- Include internal links to related rackets, guides, or pages

### Accessibility
- Use descriptive headings (not just "Section 1")
- Include alt text for all images
- Ensure sufficient color contrast (handled by CSS)
- Use semantic HTML structure

---

## Placeholders

When creating a new guide, replace these placeholders:

- `[Guide Title]` - The full title of the guide
- `[Category]` - One of: beginners, intermediate, advanced, general
- `[Year]` - Current year (e.g., 2025)
- `[Racket Name]` - Specific racket model names
- `[Racket ID]` - Database ID or slug for racket links
- `[Image URL]` - URL for featured images or inline images

---

## Example: Complete Guide Structure

```markdown
## Introduction

[Engaging introduction paragraph]

## Understanding [Main Concept]

[Detailed explanation section]

### [Sub-concept 1]

[More detailed information]

### [Sub-concept 2]

[More detailed information]

## [Practical Application Section]

[How to apply the concepts]

## [Comparison or Analysis Section]

[Compare options, analyze features, etc.]

## Key Takeaways

- **Point 1**: [Summary]
- **Point 2**: [Summary]
- **Point 3**: [Summary]

## Recommended Rackets (Optional)

### [Racket 1]

[Description and link]

### [Racket 2]

[Description and link]

## Conclusion

[Final thoughts and call to action]
```

---

## Notes

- **Featured Image**: Each guide should have a featured image (stored in `featuredImage` field). Use high-quality images related to padel rackets.
- **Excerpt**: Create a compelling 1-2 sentence excerpt that summarizes the guide (stored in `excerpt` field). This appears in guide listings.
- **Slug**: Create a URL-friendly slug from the title (e.g., "Best Padel Rackets for Beginners 2025" → "best-padel-rackets-beginners-2025")
- **Published Date**: Set `publishedAt` to current date when creating the guide
- **Category**: Must match one of: "beginners", "intermediate", "advanced", "general" (case-insensitive)

---

## Quality Checklist

Before finalizing a guide, ensure:

- [ ] Introduction hooks the reader
- [ ] All main sections are substantial (300+ words each)
- [ ] Content is accurate and up-to-date
- [ ] Key takeaways are clear and actionable
- [ ] Conclusion provides closure and next steps
- [ ] All links work correctly
- [ ] Images have descriptive alt text
- [ ] Content matches the target audience
- [ ] SEO keywords are naturally integrated
- [ ] Formatting is consistent throughout
- [ ] No placeholder text remains
- [ ] Excerpt is compelling and accurate
- [ ] Slug is URL-friendly and unique

