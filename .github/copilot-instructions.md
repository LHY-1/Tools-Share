# Tool Share - Project Guidelines

## Project Overview

Tool Share 是一个个人工具分享网站，允许用户存储和组织文字、图片和链接等内容。所有数据都存储在浏览器的 localStorage 中，完全本地化。

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks with useState/useEffect
- **Storage**: Browser localStorage

## Project Structure

```
app/
├── components/
│   ├── Icons.tsx          - SVG icon components
│   ├── ToolCard.tsx       - Individual tool display card
│   └── AddToolModal.tsx   - Modal for adding new tools
├── types/
│   └── index.ts           - TypeScript type definitions
├── page.tsx               - Main home page
├── layout.tsx             - Root layout wrapper
└── globals.css            - Global Tailwind styles
```

## Key Features

1. **Three Content Types**:
   - Text: Store notes and snippets
   - Image: Display images from URLs
   - Link: Store and display URLs with notes

2. **Search & Filter**:
   - Real-time search by title, description, or tags
   - Filter by content type
   - Combine search and filters

3. **Tool Management**:
   - Create new tools with modal form
   - Copy tool content to clipboard
   - Delete tools with confirmation
   - Tag-based organization

4. **Local Storage**:
   - Automatic save on changes
   - Persist data across sessions
   - No backend required

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Create production build
- `npm start` - Run production build
- `npm run lint` - Run ESLint

## Component Architecture

### ToolCard.tsx
- Displays individual tools with type-specific rendering
- Handles copy and delete actions
- Shows tags and metadata
- Responsive card design

### AddToolModal.tsx
- Modal form for creating/editing tools
- Type selection triggers different input fields
- Tag management with add/remove functionality
- Form validation

### Icons.tsx
- SVG icon components (Plus, Github, Copy, Trash2, etc.)
- Custom icons to avoid external dependencies
- Reusable icon components

## Styling Approach

- Utility-first CSS with Tailwind
- Responsive design (mobile-first)
- Color scheme: Blue/Indigo primary colors
- Gradient backgrounds and smooth transitions
- Card-based layout with shadows and hover effects

## Important Notes

- All data is stored in browser's localStorage
- No server/backend required
- Users should backup important data
- Clearing browser cache will delete all data
- Fully functional offline

## Future Enhancement Ideas

- Cloud sync and backup
- Export/import functionality
- Dark mode support
- Advanced sorting options
- Batch operations
- Sharing functionality
- Performance optimizations

## Performance Considerations

- Client-side rendering only
- No image optimization needed (URLs only)
- localStorage is fast for small to medium collections
- Consider pagination for very large collections

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires localStorage support
- JavaScript enabled
