import { useState, useEffect } from 'react';
import { authAPI } from '../utils/api';
import { User } from '../types';
import { User as UserIcon, ChevronDown, LogOut, Settings } from 'lucide-react';

interface UserMenuProps {
  onLogout: () => void;
}

function UserMenu({ onLogout }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to get user from localStorage first
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Then fetch fresh data from API
        const currentUser = await authAPI.getCurrentUser();
        setUser(currentUser);
        localStorage.setItem('user', JSON.stringify(currentUser));
      } catch (err) {
        console.error('Failed to load user:', err);
        // If API call fails, keep the stored user data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    onLogout();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        fontSize: '14px',
        minWidth: '120px'
      }}>
        <UserIcon size={16} />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        <UserIcon size={16} />
        <span>Not logged in</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          minWidth: '150px',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserIcon size={16} />
          <span style={{ fontWeight: 500 }}>{user.username}</span>
        </div>
        <ChevronDown size={16} style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          marginTop: '4px',
          minWidth: '200px'
        }}>
          {/* User Info */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #eee'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#007bff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '14px' }}>
                  {user.username}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ padding: '4px 0' }}>
            {/* Settings placeholder - could be expanded later */}
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Add settings functionality
                alert('Settings coming soon!');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#495057'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>

            {/* Logout */}
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#dc3545'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default UserMenu;