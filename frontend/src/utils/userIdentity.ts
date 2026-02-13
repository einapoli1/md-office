// User identity management for collaboration

export interface UserIdentity {
  id: string;
  name: string;
  color: string;
}

const USER_STORAGE_KEY = 'md-office-user-identity';

// Predefined colors for user avatars/cursors
const USER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Light Yellow
  '#BB8FCE', // Light Purple
  '#85C1E9', // Light Blue
  '#F8C471', // Orange
  '#82E0AA', // Light Green
];

// Generate a random color from the predefined set
function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

// Generate a random user ID
function generateUserId(): string {
  return 'user-' + Math.random().toString(36).substr(2, 9);
}

// Generate a random name suggestion
function generateRandomName(): string {
  const adjectives = ['Quick', 'Bright', 'Clever', 'Swift', 'Bold', 'Wise', 'Calm', 'Kind'];
  const nouns = ['Writer', 'Editor', 'Author', 'Scribe', 'Pen', 'Mind', 'Voice', 'Soul'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective} ${noun}`;
}

// Get user identity from localStorage or create new one
export function getUserIdentity(): UserIdentity {
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  
  if (stored) {
    try {
      const identity = JSON.parse(stored);
      // Validate the stored identity
      if (identity.id && identity.name && identity.color) {
        return identity;
      }
    } catch (error) {
      console.warn('Invalid stored user identity:', error);
    }
  }
  
  // Create new user identity
  return createNewUserIdentity();
}

// Create a new user identity
export function createNewUserIdentity(): UserIdentity {
  const identity: UserIdentity = {
    id: generateUserId(),
    name: generateRandomName(),
    color: getRandomColor(),
  };
  
  // Save to localStorage
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(identity));
  
  return identity;
}

// Update user identity
export function updateUserIdentity(updates: Partial<Omit<UserIdentity, 'id'>>): UserIdentity {
  const current = getUserIdentity();
  const updated = { ...current, ...updates };
  
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
  
  return updated;
}

// Prompt user for their name (called on first visit)
export function promptUserName(): string | null {
  const suggestion = generateRandomName();
  const name = window.prompt(
    `Welcome to MD Office! What would you like to be called during collaboration?`,
    suggestion
  );
  
  return name?.trim() || null;
}

// Clear user identity (for testing)
export function clearUserIdentity(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}