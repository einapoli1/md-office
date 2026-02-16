import React, { useState, useEffect } from 'react';
import { getInitials } from '../utils/collabColors';

interface CollabUser {
  name: string;
  color: string;
}

interface CollabPresenceProps {
  provider: any; // HocuspocusProvider
  currentUser: string;
}

const CollabPresence: React.FC<CollabPresenceProps> = ({ provider, currentUser }) => {
  const [users, setUsers] = useState<CollabUser[]>([]);

  useEffect(() => {
    if (!provider?.awareness) return;

    const update = () => {
      const states = provider.awareness.getStates() as Map<number, any>;
      const seen = new Map<string, CollabUser>();
      states.forEach((state: any) => {
        const user = state?.user;
        if (user?.name && !seen.has(user.name)) {
          seen.set(user.name, { name: user.name, color: user.color });
        }
      });
      setUsers(Array.from(seen.values()));
    };

    provider.awareness.on('change', update);
    update();
    return () => { provider.awareness.off('change', update); };
  }, [provider]);

  // Don't show if alone
  if (users.length <= 1) return null;

  const others = users.filter(u => u.name !== currentUser);
  const maxShow = 4;
  const visible = others.slice(0, maxShow);
  const overflow = others.length - maxShow;

  return (
    <div className="collab-presence">
      {visible.map(user => (
        <div
          key={user.name}
          className="collab-avatar"
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {getInitials(user.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="collab-avatar collab-avatar-overflow" title={`${overflow} more`}>
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default CollabPresence;
