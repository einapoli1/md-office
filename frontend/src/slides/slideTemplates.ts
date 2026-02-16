import { Presentation, Slide, genSlideId, TransitionDuration } from './slideModel';

export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  theme: string;
  icon: string;
  slides: Omit<Slide, 'id'>[];
}

function mkSlide(content: string, layout: Slide['layout'] = 'content', transition: Slide['transition'] = 'none'): Omit<Slide, 'id'> {
  return { content, layout, notes: '', transition, transitionDuration: '0.5s' as TransitionDuration, fragments: [], shapes: [], comments: [] };
}

export const TEMPLATES: SlideTemplate[] = [
  {
    id: 'business',
    name: 'Business',
    description: 'Professional quarterly report / pitch deck',
    theme: 'corporate',
    icon: '💼',
    slides: [
      mkSlide('<!-- slide: title -->\n# Quarterly Business Review\n## Q1 2025 Results', 'title', 'fade'),
      mkSlide('<!-- slide: content -->\n# Agenda\n\n- Financial Overview\n- Key Metrics\n- Strategic Initiatives\n- Q2 Outlook', 'content', 'fade'),
      mkSlide('<!-- slide: two-column -->\n# Revenue Summary\n\n:::: left\n**Revenue:** $12.4M\n\n**Growth:** +18% YoY\n::::\n\n:::: right\n**Margin:** 34%\n\n**New Clients:** 47\n::::', 'two-column', 'fade'),
      mkSlide('<!-- slide: content -->\n# Key Takeaways\n\n- Strong growth trajectory\n- Market expansion on track\n- Investing in R&D', 'content', 'fade'),
      mkSlide('<!-- slide: section -->\n# Thank You\n## Questions?', 'section', 'fade'),
    ],
  },
  {
    id: 'education',
    name: 'Education',
    description: 'Lecture or course material',
    theme: 'default',
    icon: '🎓',
    slides: [
      mkSlide('<!-- slide: title -->\n# Course Title\n## Lecture 1: Introduction', 'title', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Learning Objectives\n\n- Understand core concepts\n- Apply theory to practice\n- Develop critical thinking', 'content', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Key Concepts\n\n- **Concept A**: Definition and examples\n- **Concept B**: How it relates to A\n- **Concept C**: Real-world applications', 'content', 'slide-left'),
      mkSlide('<!-- slide: two-column -->\n# Compare & Contrast\n\n:::: left\n### Approach A\n- Advantage 1\n- Advantage 2\n::::\n\n:::: right\n### Approach B\n- Advantage 1\n- Advantage 2\n::::', 'two-column', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Summary & Next Steps\n\n- Review key points\n- Complete reading assignment\n- Prepare for next lecture', 'content', 'slide-left'),
    ],
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Colorful portfolio or creative pitch',
    theme: 'modern',
    icon: '🎨',
    slides: [
      mkSlide('<!-- slide: title -->\n# Creative Brief\n## Reimagining the Future', 'title', 'zoom'),
      mkSlide('<!-- slide: section -->\n# The Big Idea', 'section', 'zoom'),
      mkSlide('<!-- slide: content -->\n# Our Vision\n\n- Bold and innovative\n- User-centered design\n- Sustainable solutions', 'content', 'zoom'),
      mkSlide('<!-- slide: image -->\n# Mood Board\n\n![Inspiration](https://via.placeholder.com/800x400/6c63ff/fff?text=Creative+Vision)', 'image', 'zoom'),
      mkSlide('<!-- slide: content -->\n# Let\'s Create Together\n\n- Collaboration is key\n- Iterate and refine\n- Launch with impact', 'content', 'zoom'),
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, focused presentation',
    theme: 'default',
    icon: '◻️',
    slides: [
      mkSlide('<!-- slide: title -->\n# One Thing\n## Keep it simple', 'title'),
      mkSlide('<!-- slide: section -->\n# Focus', 'section', 'fade'),
      mkSlide('<!-- slide: content -->\n# The Point\n\nSay less. Mean more.', 'content', 'fade'),
      mkSlide('<!-- slide: section -->\n# End', 'section', 'fade'),
    ],
  },
  {
    id: 'tech',
    name: 'Tech',
    description: 'Technical talk or product demo',
    theme: 'dark',
    icon: '💻',
    slides: [
      mkSlide('<!-- slide: title -->\n# Product Launch\n## v2.0 — What\'s New', 'title', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Architecture Overview\n\n- Microservices backend\n- React frontend\n- Real-time sync via WebSocket', 'content', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Code Example\n\n```typescript\nasync function fetchData(id: string) {\n  const res = await fetch(`/api/${id}`);\n  return res.json();\n}\n```', 'content', 'slide-left'),
      mkSlide('<!-- slide: content -->\n# Performance\n\n- 3x faster load times\n- 50% smaller bundle\n- 99.9% uptime', 'content', 'slide-left'),
      mkSlide('<!-- slide: section -->\n# Demo Time 🚀', 'section', 'zoom'),
    ],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Showcase your work',
    theme: 'modern',
    icon: '📸',
    slides: [
      mkSlide('<!-- slide: title -->\n# My Portfolio\n## Design & Development', 'title', 'fade'),
      mkSlide('<!-- slide: section -->\n# Selected Work', 'section', 'fade'),
      mkSlide('<!-- slide: image -->\n# Project Alpha\n\n![Project](https://via.placeholder.com/800x400/6c63ff/fff?text=Project+Alpha)', 'image', 'fade'),
      mkSlide('<!-- slide: image -->\n# Project Beta\n\n![Project](https://via.placeholder.com/800x400/e94560/fff?text=Project+Beta)', 'image', 'fade'),
      mkSlide('<!-- slide: content -->\n# Get In Touch\n\n- email@example.com\n- github.com/username\n- linkedin.com/in/username', 'content', 'fade'),
    ],
  },
];

export function createFromTemplate(template: SlideTemplate): Presentation {
  return {
    meta: { title: template.name + ' Presentation', theme: template.theme, aspectRatio: '16:9' },
    slides: template.slides.map(s => ({ ...s, id: genSlideId() })),
  };
}
