# Blog Post Template

This template provides a consistent structure for all blog posts. Follow this format to ensure all posts have a professional, cohesive structure with optimal SEO.

## Template Structure

### 1. Title and Metadata

```markdown
Title: [Engaging, SEO-optimized title with target keyword]
Slug: [url-friendly-slug-from-title]
Excerpt: [Compelling 1-2 sentence summary for listings - 120-160 characters]
Author: [Author name]
Featured Image: [URL to high-quality image]
Published Date: [YYYY-MM-DD]
```

**Title Guidelines:**
- Include primary keyword naturally
- Keep under 60 characters for optimal display
- Make it compelling and click-worthy
- Use numbers or questions when appropriate

**Excerpt Guidelines:**
- 120-160 characters (optimal for search results)
- Include primary keyword
- Create curiosity or value proposition
- Should summarize the post's main benefit

---

### 2. Introduction Section

```markdown
## Introduction

[Hook - 2-3 sentences that grab attention and address the reader's need]

[Context - 1-2 sentences setting up the topic]

[What they'll learn - brief overview or bullet points]
```

**Example:**
```markdown
## Introduction

Padel is exploding in popularity worldwide, but many players are still using rackets that don't match their skill level or playing style. This mismatch can hold you back from reaching your full potential on the court.

In this comprehensive guide, we'll explore the key factors that separate beginner-friendly rackets from professional-grade equipment. By the end, you'll understand:

- How to identify the right racket for your current skill level
- What features matter most as you progress
- When it's time to upgrade your equipment
- How to test rackets effectively before buying
```

---

### 3. Main Content Sections

Use 3-5 main sections based on your topic. Each section should be substantial (400-600 words) and provide actionable information.

```markdown
## [Main Topic Section 1]

[Opening paragraph - introduce the concept]

[Body paragraph 1 - detailed explanation with examples]

[Body paragraph 2 - practical applications or case studies]

[Body paragraph 3 - tips, best practices, or common mistakes]

### Subsection (if needed)

[More detailed information]

- Key point 1
- Key point 2
- Key point 3

## [Main Topic Section 2]

[Content following same structure...]
```

**Content Guidelines:**
- Use **bold** for key terms and important concepts
- Use *italic* for subtle emphasis
- Include internal links to related rackets, guides, or blog posts
- Reference actual rackets from the database when relevant
- Use bullet lists for key points
- Use numbered lists for step-by-step instructions

**SEO Best Practices:**
- Include target keywords naturally in headings (H2, H3)
- Use semantic HTML structure
- Include internal links (2-3 per section)
- Use descriptive headings that answer questions
- Include relevant images with alt text

---

### 4. Key Takeaways Section

Summarize the most important points from the post.

```markdown
## Key Takeaways

- **Takeaway 1**: [Brief summary point - actionable]
- **Takeaway 2**: [Brief summary point - actionable]
- **Takeaway 3**: [Brief summary point - actionable]
- **Takeaway 4**: [Brief summary point - actionable]
```

**Example:**
```markdown
## Key Takeaways

- **Skill level matters most**: Choose a racket that matches your current ability, not your aspirations
- **Shape determines play style**: Round for control, diamond for power, teardrop for balance
- **Test before you buy**: Personal feel is crucial - what works for others may not work for you
- **Invest in quality**: A well-chosen racket can last years and improve your game faster
```

---

### 5. Related Content Section (Optional)

Link to related rackets, guides, or blog posts.

```markdown
## Related Content

- [Related Guide Title](/guides/[guide-slug])
- [Related Blog Post Title](/blog/[post-slug])
- [Browse All Rackets](/rackets)
- [View All Guides](/guides)
```

---

### 6. Conclusion Section

Wrap up the post with final thoughts and call to action.

```markdown
## Conclusion

[Final summary paragraph - 2-3 sentences reinforcing main points]

[Call to action - direct readers to next steps]

[Encouragement or closing thought - 1 sentence]
```

**Example:**
```markdown
## Conclusion

Choosing the right padel racket is a journey that evolves with your skill level and playing style. By understanding the fundamentals covered in this post, you're now equipped to make informed decisions that will enhance your game.

Ready to find your perfect racket? Browse our [complete racket collection](/rackets) or check out our [buying guides](/guides) for more expert advice.

Remember, the best racket is the one that feels right in your hands and helps you enjoy every moment on the court.
```

---

## HTML Conversion Guidelines

When converting markdown to HTML for database storage:

### Headings
- `# Title` → `<h1>Title</h1>` (usually not used in content)
- `## Section` → `<h2>Section</h2>`
- `### Subsection` → `<h3>Subsection</h3>`

### Text Formatting
- `**bold**` → `<strong>bold</strong>`
- `*italic*` → `<em>italic</em>`

### Lists
- Bullet lists: `- Item` → `<ul><li>Item</li></ul>`
- Numbered lists: `1. Item` → `<ol><li>Item</li></ol>`

### Links
- `[Link text](/path)` → `<a href="/path">Link text</a>`
- External links: `[Link text](https://example.com)` → `<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link text</a>`

### Paragraphs
- Separate paragraphs with blank lines
- Convert to `<p>...</p>` tags

---

## Content Guidelines

### Tone and Style
- **Conversational yet authoritative**: Write as an expert sharing knowledge
- **Clear and accessible**: Avoid jargon, explain technical terms
- **Actionable**: Provide specific, useful advice readers can apply
- **Engaging**: Use storytelling, examples, and real-world scenarios

### Word Count
- **Introduction**: 150-250 words
- **Each main section**: 400-600 words
- **Key Takeaways**: 100-150 words
- **Conclusion**: 150-200 words
- **Total post length**: 2,000-3,500 words (optimal for SEO)

### SEO Optimization
- **Primary keyword**: Include in title, first paragraph, and at least one H2 heading
- **Secondary keywords**: Use naturally throughout content
- **Meta description**: Use excerpt (120-160 characters)
- **Internal linking**: 5-10 internal links per post
- **Image optimization**: Use descriptive filenames and alt text
- **URL structure**: Use descriptive slugs with keywords

### Accessibility
- Use descriptive headings (not just "Section 1")
- Include alt text for all images
- Ensure sufficient color contrast
- Use semantic HTML structure
- Write in plain language

---

## Quality Checklist

Before publishing, ensure:

- [ ] Title is compelling and SEO-optimized
- [ ] Excerpt is 120-160 characters and engaging
- [ ] Introduction hooks the reader
- [ ] All main sections are substantial (400+ words each)
- [ ] Content is accurate and up-to-date
- [ ] Key takeaways are clear and actionable
- [ ] Conclusion provides closure and call to action
- [ ] All internal links work correctly
- [ ] Images have descriptive alt text
- [ ] SEO keywords are naturally integrated
- [ ] Formatting is consistent throughout
- [ ] No placeholder text remains
- [ ] Slug is URL-friendly and unique
- [ ] Featured image is high-quality and relevant

---

## Example: Complete Blog Post Structure

```markdown
# [Blog Post Title]

## Introduction

[Engaging introduction]

## [Main Topic 1]

[Detailed content]

### [Sub-topic]

[More details]

## [Main Topic 2]

[Detailed content]

## Key Takeaways

- **Point 1**: [Summary]
- **Point 2**: [Summary]
- **Point 3**: [Summary]

## Related Content

- [Link to related content]

## Conclusion

[Final thoughts and call to action]
```

