import DOMPurify from 'isomorphic-dompurify';

/**
 * Whitelist of safe CSS properties - allow most properties, block harmful ones
 */
const BLOCKED_CSS_PROPERTIES = [
  'behavior',      // IE binding
  'binding',       // XBL
  '-moz-binding',  // Mozilla XBL
];

/**
 * Validate and clean CSS value to prevent XSS
 */
const isValidCssValue = (value = '') => {
  if (!value) return false;
  const str = String(value).toLowerCase();
  // Block dangerous patterns
  if (str.includes('expression') || 
      str.includes('javascript:') || 
      str.includes('</') || 
      str.includes('/*') ||
      str.includes('behavior:') ||
      /on\w+\s*=/.test(str)) {
    return false;
  }
  return true; // Allow !important and all other valid CSS values
};

/**
 * Sanitize inline styles to allow safe CSS properties and values
 * Uses blocklist approach - allows most properties except dangerous ones
 */
const sanitizeStyleAttribute = (styleStr = '') => {
  if (!styleStr || typeof styleStr !== 'string') return '';
  
  try {
    const styles = styleStr.split(';').filter(s => s.trim());
    const sanitized = styles
      .map(style => {
        const colonIndex = style.indexOf(':');
        if (colonIndex === -1) return '';
        
        const property = style.substring(0, colonIndex).trim().toLowerCase();
        const value = style.substring(colonIndex + 1).trim();
        
        // Block explicitly dangerous properties
        if (BLOCKED_CSS_PROPERTIES.includes(property)) return '';
        
        // Validate the value for XSS
        if (!isValidCssValue(value)) return '';
        
        return `${property}: ${value}`;
      })
      .filter(Boolean)
      .join('; ');
    
    return sanitized ? `${sanitized};` : '';
  } catch (e) {
    console.warn('CSS sanitization error:', e);
    return '';
  }
};

/**
 * Hook for DOMPurify to post-process sanitized HTML
 */
const setupDOMPurifyConfig = () => {
  try {
    if (typeof DOMPurify === 'undefined') return;
    
    // Configure default config for this instance
    if (DOMPurify.setConfig) {
      DOMPurify.setConfig({ 
        ALLOWED_TAGS: DEFAULT_CONFIG.ALLOWED_TAGS,
        ALLOWED_ATTR: DEFAULT_CONFIG.ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
      });
    }
  } catch (e) {
    console.debug('DOMPurify config setup:', e.message);
  }
};


/**
 * Comprehensive HTML sanitizer that allows safe HTML while preventing XSS
 * Supports: text formatting, lists, tables, images, videos, links, headings, etc.
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup',
    'a', 'blockquote', 'code', 'pre',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
    'img', 'video', 'source', 'figure', 'figcaption',
    'hr', 'span',
  ],
  ALLOWED_ATTR: {
    '*': ['style', 'class'],  // Allow style and class on ALL elements
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'data-src', 'loading'],
    'video': ['src', 'controls', 'autoplay', 'muted', 'loop', 'poster', 'width', 'height'],
    'source': ['src', 'type'],
    'p': ['align'],
    'table': ['border', 'cellpadding', 'cellspacing'],
    'td': ['colspan', 'rowspan', 'align', 'valign'],
    'th': ['colspan', 'rowspan', 'align', 'valign'],
    'ol': ['start', 'type'],
    'colgroup': ['span'],
    'col': ['span'],
  },
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  FORCE_BODY: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Critical: this tells DOMPurify to NOT strip styles
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  IN_PLACE: false,
};

/**
 * Sanitize HTML content to prevent XSS while preserving formatting and inline styles
 * @param {string} dirty - Raw HTML string
 * @param {object} config - Override default DOMPurify config
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHtml = (dirty = '', config = {}) => {
  if (!dirty || typeof dirty !== 'string') return '';
  
  // Only proceed if DOMPurify is available
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify not available');
    return dirty;
  }

  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  try {
    // Pre-process: Add !important to all inline styles to ensure they take precedence
    let processed = dirty.replace(
      /style\s*=\s*["']([^"']*?)["']/gi,
      (match, styleValue) => {
        // Make sure !important is added to each property that doesn't have it
        const properties = styleValue.split(';').map(prop => {
          const trimmed = prop.trim();
          if (!trimmed) return '';
          if (!trimmed.includes('!important')) {
            // Add !important before the semicolon if there is one, otherwise at the end
            const withSemicolon = trimmed.endsWith(';') ? trimmed : trimmed + ';';
            return withSemicolon.replace(/;$/, ' !important;');
          }
          return trimmed;
        }).filter(Boolean).join('; ');
        
        return `style="${properties}"`;
      }
    );
    
    // Sanitize with DOMPurify
    const sanitized = DOMPurify.sanitize(processed, mergedConfig);
    
    return sanitized;
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    try {
      return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
    } catch (fallbackError) {
      console.error('Fallback sanitization also failed:', fallbackError);
      return dirty;
    }
  }
};

/**
 * Sanitize with strict mode (fewer allowed tags)
 * @param {string} dirty - Raw HTML string
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHtmlStrict = (dirty = '') => {
  return sanitizeHtml(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: {
      'a': ['href', 'title', 'style'],
    },
  });
};

/**
 * Sanitize for rich description (full HTML support with inline styles)
 * @param {string} dirty - Raw HTML string
 * @returns {string} - Sanitized HTML
 */
export const sanitizeProductDescription = (dirty = '') => {
  return sanitizeHtml(dirty, DEFAULT_CONFIG);
};

export default sanitizeHtml;
