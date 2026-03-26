const BULLET_ONLY_REGEX = /^[•·*\-\u2022\s]+$/;
const BULLET_WITH_TEXT_REGEX = /^[•·*\-\u2022]\s+(.+)$/;

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const toParagraphHtmlFromPlainText = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  return lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
};

const isBlockElement = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'P' || tag === 'DIV';
};

const getText = (el) => String(el?.textContent || '').trim();
const isBulletOnly = (el) => BULLET_ONLY_REGEX.test(getText(el));
const isEmptyBlock = (el) => isBlockElement(el) && getText(el) === '';

const getNextMeaningfulBlock = (el) => {
  let cursor = el;
  while (cursor) {
    if (isBlockElement(cursor) && getText(cursor) !== '') return cursor;
    cursor = cursor.nextElementSibling;
  }
  return null;
};

export const normalizeProductDescriptionHtml = (inputHtml) => {
  if (!inputHtml || typeof inputHtml !== 'string') return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return inputHtml;

  try {
    const hasAnyTag = /<\/?[a-z][\s\S]*>/i.test(inputHtml);
    const sourceHtml = hasAnyTag ? inputHtml : toParagraphHtmlFromPlainText(inputHtml);

    const parser = new DOMParser();
    const doc = parser.parseFromString(sourceHtml, 'text/html');
    const root = doc.body;

    let current = root.firstElementChild;
    while (current) {
      if (!isBlockElement(current)) {
        current = current.nextElementSibling;
        continue;
      }

      const text = getText(current);
      const inlineBulletMatch = text.match(BULLET_WITH_TEXT_REGEX);

      if (inlineBulletMatch) {
        const ul = doc.createElement('ul');
        let cursor = current;

        while (cursor && isBlockElement(cursor)) {
          const bulletLine = getText(cursor).match(BULLET_WITH_TEXT_REGEX);
          if (!bulletLine) break;

          const li = doc.createElement('li');
          li.textContent = bulletLine[1];
          ul.appendChild(li);

          const next = getNextMeaningfulBlock(cursor.nextElementSibling);
          root.removeChild(cursor);
          cursor = next;
        }

        if (ul.children.length > 0) {
          if (cursor) root.insertBefore(ul, cursor);
          else root.appendChild(ul);
        }

        current = cursor;
        continue;
      }

      if (isBulletOnly(current)) {
        const ul = doc.createElement('ul');
        let cursor = current;

        while (cursor && isBlockElement(cursor) && isBulletOnly(cursor)) {
          const textNode = getNextMeaningfulBlock(cursor.nextElementSibling);
          if (!textNode || !isBlockElement(textNode)) break;

          const li = doc.createElement('li');
          li.innerHTML = textNode.innerHTML;
          ul.appendChild(li);

          const next = textNode.nextElementSibling;

          // Remove bullet node + any empty blocks up to the text node + text node itself
          let removeCursor = cursor;
          while (removeCursor && removeCursor !== textNode) {
            const removeNext = removeCursor.nextElementSibling;
            if (isBlockElement(removeCursor)) {
              root.removeChild(removeCursor);
            }
            removeCursor = removeNext;
          }
          root.removeChild(textNode);

          cursor = getNextMeaningfulBlock(next);
        }

        if (ul.children.length > 0) {
          if (cursor) root.insertBefore(ul, cursor);
          else root.appendChild(ul);
        }

        current = cursor;
        continue;
      }

      current = current.nextElementSibling;
    }

    return root.innerHTML;
  } catch {
    return inputHtml;
  }
};
