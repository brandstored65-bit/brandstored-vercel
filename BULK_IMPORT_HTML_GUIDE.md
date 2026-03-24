# HTML Support in Bulk Import

## Overview
The bulk import feature fully supports HTML-formatted product descriptions. You can import rich, formatted content directly into your product catalog without losing any formatting or styling.

## Why Use HTML?

HTML descriptions allow you to create professional, engaging product pages with:
- **Rich Formatting**: Bold text, italics, underlines
- **Structured Content**: Headings, paragraphs, lists
- **Better Readability**: Visual hierarchy and spacing
- **Consistent Styling**: Professional appearance across all products
- **Links & Media**: Embedded product links and references

## Supported HTML Tags

### Text Formatting
```html
<b>Bold text</b>
<i>Italic text</i>
<strong>Strong emphasis</strong>
<em>Emphasized text</em>
<u>Underlined text</u>
<s>Strikethrough text</s>
```

### Structure
```html
<p>Paragraph of text</p>
<h1>Heading Level 1</h1>
<h2>Heading Level 2</h2>
<h3>Heading Level 3</h3>
<h4>Heading Level 4</h4>
<h5>Heading Level 5</h5>
<h6>Heading Level 6</h6>
```

### Lists
```html
<ul>
  <li>Unordered item 1</li>
  <li>Unordered item 2</li>
  <li>Unordered item 3</li>
</ul>

<ol>
  <li>Ordered item 1</li>
  <li>Ordered item 2</li>
  <li>Ordered item 3</li>
</ol>
```

### Links
```html
<a href="https://example.com">Link text</a>
<a href="https://example.com" target="_blank">Open in new tab</a>
```

### Line Breaks & Spacing
```html
<br>
<!-- Creates a line break -->

<hr>
<!-- Creates a horizontal line -->
```

## CSV Format Rules

When entering HTML in CSV files, follow these rules:

### 1. Enclose in Quotes
Always wrap HTML content in double quotes to preserve formatting:

```csv
Name,Description
"Product Name","<p>This is a <b>formatted</b> description</p>"
```

### 2. Escape Quotes Inside HTML
If your HTML contains quotes, escape them or use single quotes:

```csv
"Product","<p>Quality product - <a href=\"#\">view details</a></p>"
```

### 3. Multi-line Support
CSV supports multi-line content within quoted cells:

```csv
"Product Name","<p>Line 1</p>
<p>Line 2</p>
<p>Line 3</p>"
```

## Examples

### Example 1: Simple Product
```csv
Name,Short description,Description,Sale price,Regular price,Categories
"T-Shirt","Classic cotton tee","<p>100% cotton comfort.</p><p>Available in multiple colors.</p>",29.99,49.99,"Clothing > Apparel"
```

### Example 2: Rich Description
```csv
Name,Short description,Description,Sale price,Categories
"Bottle Warmer","Portable milk warmer","<h2>Features</h2><ul><li>6000mAh Battery</li><li>6 Temperature Settings</li><li>2-5 minute heat time</li><li>48 hour keep warm</li></ul><p>Perfect for travel and night feeds.</p>",199.00,"Baby Care > Feeding"
```

### Example 3: With Links
```csv
Name,Description,Sale price,Categories
"Smart Watch","<p>Check out our <a href=\"https://example.com/guide\">setup guide</a> for quick start instructions.</p>",299.99,"Electronics > Wearables"
```

## Excel Format

When using Excel (.xlsx):

1. **No Quote Escaping Needed**: Excel handles formatting automatically
2. **Copy-Paste HTML**: You can paste HTML directly into cells
3. **Multi-line Content**: Press Alt+Enter to add line breaks
4. **Rich Text**: Excel will preserve the content as-is

### Excel Example
In your spreadsheet:
- Column A: Name = "Product Name"
- Column D: Description = 
```
<h2>Key Features</h2>
<ul>
<li>Feature 1</li>
<li>Feature 2</li>
</ul>
```

## Best Practices

### ✅ DO
- Use semantic HTML tags (proper headings, lists, strong for emphasis)
- Keep descriptions organized with headings and paragraphs
- Use lists for features, specifications, or benefits
- Test HTML locally before bulk importing
- Use consistent formatting across products
- Keep file sizes reasonable (avoid massive descriptions)

### ❌ DON'T
- Use inline CSS styling (style attributes)
- Use table layouts for content structure
- Include JavaScript or scripts
- Use unsupported tags
- Mix excessive HTML with plain text randomly
- Copy-paste entire web pages as-is

## Plain Text Alternative

You can also use **plain text** descriptions without any HTML:

```csv
Name,Description,Sale price,Categories
"Simple Product","This is a plain text description with no HTML formatting.",49.99,"Electronics"
```

Both HTML and plain text are fully supported. Use whichever suits your needs.

## Troubleshooting

### Issue: HTML tags appearing as text
**Solution**: Ensure HTML is properly formatted and enclosed in quotes in CSV files.

### Issue: Quotes breaking the import
**Solution**: Escape quotes with backslash (`\"`) or use single quotes inside HTML.

### Issue: Multi-line HTML not working
**Solution**: Check that the cell is properly quoted and uses actual line breaks (not spaces).

### Issue: Some formatting lost
**Solution**: Verify you're using supported HTML tags. Unsupported tags will be removed.

## Sample Template

Download the sample template from the bulk import page to see working examples of:
- Plain text descriptions
- HTML-formatted descriptions
- Rich content with multiple elements
- Proper CSV formatting

## Next Steps

1. Download the template CSV
2. Fill in your product data with HTML where needed
3. Save as `.xlsx` (Excel) or `.csv` (Comma-separated values)
4. Upload via the Bulk Import page
5. Review the import results
6. Check your products to verify formatting

---

**Questions?** Contact support for assistance with HTML formatting or bulk import issues.
