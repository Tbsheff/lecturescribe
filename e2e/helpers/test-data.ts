export const TEST_USER = {
  email: 'testuser@example.com',
  password: 'TestPassword123!'
};

export const generateUniqueEmail = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
};

export const generateUniqueFolderName = (): string => {
  return `Folder-${Date.now()}-${Math.random().toString(36).substring(7)}`;
};

export const generateUniqueNoteName = (): string => {
  return `Note-${Date.now()}-${Math.random().toString(36).substring(7)}`;
};

export const TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 5000,
  LONG: 30000,
  SAVE_DELAY: 2000,
  PROCESSING: 30000
};

export const SAMPLE_MARKDOWN = {
  basic: `# Sample Note
This is a basic note with **bold** and *italic* text.`,
  
  withLists: `# Note with Lists
## Bullet Points
- First item
- Second item
  - Nested item
  
## Numbered List
1. Step one
2. Step two
3. Step three`,
  
  withCode: `# Code Examples
Here's some inline \`code\`.

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\``,
  
  complex: `# Complex Note
## Overview
This note demonstrates various **markdown** features.

### Features
- **Bold text**
- *Italic text*
- ~~Strikethrough~~
- \`Inline code\`

### Code Block
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`

### Links and Images
[Visit GitHub](https://github.com)
![Alt text](https://via.placeholder.com/150)

### Table
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

> This is a blockquote with **nested** formatting.

---

### Task List
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task`
};