import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MentionUser } from '../extensions/Mention';

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="mention-list">
        <div className="mention-list-empty">No people found</div>
      </div>
    );
  }

  return (
    <div className="mention-list">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          className={`mention-list-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="mention-list-avatar">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <div className="mention-list-info">
            <div className="mention-list-name">{item.name}</div>
            {item.email && <div className="mention-list-email">{item.email}</div>}
          </div>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';
export default MentionList;
