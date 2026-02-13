import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, 
  Quote, Code, Table, Minus, Image, Type 
} from 'lucide-react';

interface SlashCommand {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: Editor) => void;
  searchTerms: string[];
}

interface SlashCommandsProps {
  editor: Editor;
  onSelect?: () => void;
}

export interface SlashCommandsRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommands = forwardRef<SlashCommandsRef, SlashCommandsProps>(
  ({ editor, onSelect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const commands: SlashCommand[] = [
      {
        id: 'paragraph',
        title: 'Text',
        description: 'Just start typing with plain text.',
        icon: <Type size={18} />,
        action: (editor) => {
          editor.chain().focus().setParagraph().run();
        },
        searchTerms: ['p', 'paragraph', 'text'],
      },
      {
        id: 'heading1',
        title: 'Heading 1',
        description: 'Big section heading.',
        icon: <Heading1 size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        },
        searchTerms: ['h1', 'heading1', 'title'],
      },
      {
        id: 'heading2',
        title: 'Heading 2',
        description: 'Medium section heading.',
        icon: <Heading2 size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        },
        searchTerms: ['h2', 'heading2', 'subtitle'],
      },
      {
        id: 'heading3',
        title: 'Heading 3',
        description: 'Small section heading.',
        icon: <Heading3 size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        },
        searchTerms: ['h3', 'heading3', 'subheading'],
      },
      {
        id: 'bulletList',
        title: 'Bullet List',
        description: 'Create a simple bullet list.',
        icon: <List size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleBulletList().run();
        },
        searchTerms: ['ul', 'bullet', 'list', 'unordered'],
      },
      {
        id: 'orderedList',
        title: 'Numbered List',
        description: 'Create a list with numbering.',
        icon: <ListOrdered size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleOrderedList().run();
        },
        searchTerms: ['ol', 'numbered', 'ordered', 'list'],
      },
      {
        id: 'taskList',
        title: 'Task List',
        description: 'Track tasks with a checklist.',
        icon: <CheckSquare size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleTaskList().run();
        },
        searchTerms: ['todo', 'task', 'checklist', 'checkbox'],
      },
      {
        id: 'quote',
        title: 'Quote',
        description: 'Capture a quote.',
        icon: <Quote size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleBlockquote().run();
        },
        searchTerms: ['quote', 'blockquote', 'cite'],
      },
      {
        id: 'codeBlock',
        title: 'Code Block',
        description: 'Capture a code snippet.',
        icon: <Code size={18} />,
        action: (editor) => {
          editor.chain().focus().toggleCodeBlock().run();
        },
        searchTerms: ['code', 'codeblock', 'snippet'],
      },
      {
        id: 'table',
        title: 'Table',
        description: 'Insert a table.',
        icon: <Table size={18} />,
        action: (editor) => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        },
        searchTerms: ['table', 'grid'],
      },
      {
        id: 'horizontalRule',
        title: 'Horizontal Rule',
        description: 'Insert a horizontal divider.',
        icon: <Minus size={18} />,
        action: (editor) => {
          editor.chain().focus().setHorizontalRule().run();
        },
        searchTerms: ['hr', 'rule', 'divider', 'separator'],
      },
      {
        id: 'image',
        title: 'Image',
        description: 'Insert an image.',
        icon: <Image size={18} />,
        action: (editor) => {
          const url = window.prompt('Enter image URL:');
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        },
        searchTerms: ['image', 'img', 'picture', 'photo'],
      },
    ];

    useEffect(() => {
      const filtered = commands.filter(command =>
        command.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        command.searchTerms.some(term => 
          term.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
      setFilteredCommands(filtered);
      setSelectedIndex(0);
    }, [searchQuery]);

    useEffect(() => {
      setFilteredCommands(commands);
    }, []);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % filteredCommands.length);
          return true;
        }

        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + filteredCommands.length - 1) % filteredCommands.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    const selectItem = (index: number) => {
      const command = filteredCommands[index];
      if (command) {
        command.action(editor);
        onSelect?.();
      }
    };

    const handleSearch = (query: string) => {
      setSearchQuery(query);
    };

    return (
      <div className="slash-commands-popup">
        <div className="slash-commands-header">
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="slash-search-input"
            autoFocus
          />
        </div>
        <div className="slash-commands-list">
          {filteredCommands.map((command, index) => (
            <div
              key={command.id}
              className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="slash-command-icon">
                {command.icon}
              </div>
              <div className="slash-command-content">
                <div className="slash-command-title">{command.title}</div>
                <div className="slash-command-description">{command.description}</div>
              </div>
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="slash-command-empty">
              No commands found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    );
  }
);

SlashCommands.displayName = 'SlashCommands';

export default SlashCommands;