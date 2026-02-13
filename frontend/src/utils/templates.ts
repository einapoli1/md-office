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
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Template for meeting minutes and notes',
    content: `# Meeting Notes

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
    content: `# Project Brief

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