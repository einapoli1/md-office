export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const templates: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start with an empty document',
    content: '',
  },
  {
    id: 'styled-document',
    name: 'Styled Document',
    description: 'Document with custom styling and metadata',
    content: `---
title: "Styled Document Example"
author: "Your Name"
font: "Georgia"
fontSize: 18
lineHeight: 1.8
pageMargins: "wide"
pageWidth: "wide"
tags: ["example", "styled"]
---

# Welcome to Your Styled Document

This document demonstrates how you can use YAML frontmatter to control the appearance and metadata of your markdown documents.

## Styling Features

The frontmatter at the top of this document controls:

- **Font:** Georgia (serif font)
- **Font size:** 18px (larger than default)
- **Line height:** 1.8 (extra spacious)
- **Page margins:** Wide margins for better readability
- **Page width:** Wide page layout
- **Title:** Custom document title
- **Author:** Document author
- **Tags:** For organization and search

## How It Works

The document remains a standard .md file that can be opened in any markdown editor, but MD Office reads the YAML frontmatter to apply visual styling when editing.

### Example Frontmatter

    ---
    title: "My Document"
    font: "Lora"
    fontSize: 16
    pageMargins: "normal"
    author: "Your Name"
    ---

## Benefits

- ✅ **Portable:** Still standard markdown
- ✅ **Visual:** Beautiful presentation in MD Office
- ✅ **Flexible:** Each document can have its own style
- ✅ **Compatible:** Works with any markdown tool

Try editing this document and changing the frontmatter values to see the styling update in real-time!`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Template for meeting minutes and notes',
    content: `---
title: "Meeting Notes"
font: "Inter"
fontSize: 15
pageMargins: "normal"
author: ""
tags: ["meeting", "notes"]
---

# Meeting Notes

**Date:** ${new Date().toLocaleDateString()}
**Attendees:** 
**Duration:** 

## Agenda
- [ ] 
- [ ] 
- [ ] 

## Discussion Points

### Topic 1


### Topic 2


## Action Items
- [ ] **Person:** Task description
- [ ] **Person:** Task description

## Next Steps


## Additional Notes

`,
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Template for project planning and briefing',
    content: `---
title: "Project Brief"
font: "Lora"
fontSize: 16
lineHeight: 1.6
pageMargins: "normal"
pageWidth: "normal"
author: ""
tags: ["project", "planning"]
---

# Project Brief

## Project Overview

**Project Name:** 
**Project Manager:** 
**Start Date:** ${new Date().toLocaleDateString()}
**Expected Completion:** 
**Status:** Planning

## Objectives

### Primary Goals
1. 
2. 
3. 

### Success Metrics
- 
- 
- 

## Scope

### In Scope
- 
- 

### Out of Scope
- 
- 

## Timeline

| Phase | Tasks | Deadline |
|-------|-------|----------|
| Phase 1 |  |  |
| Phase 2 |  |  |
| Phase 3 |  |  |

## Resources

### Team Members
- **Role:** Name
- **Role:** Name

### Budget
- Total Budget: $
- Allocated: $
- Remaining: $

## Risks and Mitigation

| Risk | Impact | Mitigation Strategy |
|------|--------|-------------------|
|  |  |  |

## Communication Plan

- **Weekly Updates:** 
- **Stakeholder Reviews:** 
- **Team Meetings:** 

`,
  },
  {
    id: 'formal-letter',
    name: 'Formal Letter',
    description: 'Professional letter template with elegant styling',
    content: `---
title: "Formal Letter"
font: "Times"
fontSize: 14
lineHeight: 1.4
pageMargins: "wide"
pageWidth: "narrow"
textAlign: "left"
author: ""
tags: ["letter", "formal"]
---

**[Your Name]**  
[Your Address]  
[City, State ZIP Code]  
[Your Email]  
[Your Phone]

[Date]

**[Recipient's Name]**  
[Recipient's Title]  
[Organization]  
[Address]  
[City, State ZIP Code]

**Re: [Subject Line]**

Dear [Recipient's Name],

[Opening paragraph - introduce yourself and state the purpose of your letter]

[Body paragraphs - provide details, explanations, or requests. Use clear, concise language and organize your thoughts logically]

[Closing paragraph - summarize your main points and indicate what action you would like the recipient to take]

Thank you for your time and consideration. I look forward to your response.

Sincerely,

[Your Signature]  
**[Your Printed Name]**  
[Your Title]

---

**Enclosures:** [List any documents you're including]  
**cc:** [List anyone receiving copies]`,
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Template for weekly status reports',
    content: `# Weekly Report

**Week Ending:** ${new Date().toLocaleDateString()}
**Reporting Period:** 

## Summary

Brief overview of the week's activities and key accomplishments.

## Accomplishments

### Completed Tasks
- [ ] Task 1 - Description
- [ ] Task 2 - Description
- [ ] Task 3 - Description

### Key Achievements
- 
- 
- 

## Metrics

| Metric | Target | Actual | Variance |
|--------|--------|--------|----------|
|  |  |  |  |
|  |  |  |  |

## Challenges

### Issues Encountered
1. **Issue:** Description
   - **Impact:** 
   - **Resolution:** 

2. **Issue:** Description
   - **Impact:** 
   - **Resolution:** 

## Next Week's Goals

### Planned Activities
- [ ] Activity 1
- [ ] Activity 2
- [ ] Activity 3

### Priorities
1. 
2. 
3. 

## Support Needed

- 
- 

## Additional Notes

`,
  },
  {
    id: 'bug-report',
    name: 'Bug Report',
    description: 'Template for reporting and tracking bugs',
    content: `# Bug Report

**Reporter:** 
**Date:** ${new Date().toLocaleDateString()}
**Severity:** High / Medium / Low
**Status:** Open

## Summary

Brief description of the bug.

## Environment

- **Browser:** 
- **OS:** 
- **Version:** 
- **Device:** 

## Steps to Reproduce

1. 
2. 
3. 
4. 

## Expected Behavior

What should have happened.

## Actual Behavior

What actually happened.

## Screenshots/Videos

![Screenshot](image-url-here)

## Console Logs

\`\`\`
Paste any relevant console logs here
\`\`\`

## Additional Information

### Workaround
- [ ] Workaround available
- **Description:** 

### Related Issues
- #
- #

## Impact

### Users Affected
- **Number:** 
- **Type:** 

### Business Impact
- 

## Testing

### Verified On
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile

### Test Data
- 

## Resolution

### Root Cause


### Fix Applied


### Verification
- [ ] Fix verified in development
- [ ] Fix verified in staging
- [ ] Fix verified in production

`,
  },
];