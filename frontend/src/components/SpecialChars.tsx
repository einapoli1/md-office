import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SpecialCharsProps {
  onSelect: (char: string) => void;
  onClose: () => void;
}

const CHAR_CATEGORIES: Record<string, { label: string; chars: string[] }> = {
  arrows: {
    label: 'Arrows',
    chars: ['←','→','↑','↓','↔','↕','↖','↗','↘','↙','⇐','⇒','⇑','⇓','⇔','⇕','➜','➝','➞','➡','⟵','⟶','⟷','⟸','⟹','⟺','↩','↪','↰','↱','↲','↳','↴','↵','⤴','⤵'],
  },
  math: {
    label: 'Math',
    chars: ['±','×','÷','=','≠','≈','≡','≤','≥','<','>','∞','√','∛','∜','∑','∏','∫','∂','∇','∆','∅','∈','∉','∋','∌','⊂','⊃','⊆','⊇','∪','∩','∧','∨','¬','⊕','⊗','⊥','∥','∠','∡','∝','∴','∵','ℕ','ℤ','ℚ','ℝ','ℂ','ℵ','⅓','⅔','¼','½','¾','⅛','⅜','⅝','⅞'],
  },
  currency: {
    label: 'Currency',
    chars: ['$','€','£','¥','₹','¢','₣','₤','₧','₨','₩','₪','₫','₭','₮','₯','₰','₱','₲','₳','₴','₵','₶','₷','₸','₹','₺','₻','₼','₽','₾','₿'],
  },
  legal: {
    label: 'Legal & Marks',
    chars: ['©','®','™','§','¶','†','‡','‖','¦','℗','℠','℡','℮','⁂','※','⁑','⁕'],
  },
  typography: {
    label: 'Typography',
    chars: ['—','–','−','…','·','•','°','′','″','‴','‰','‱','⁄','⁊','⁋','№','℃','℉','Å','µ','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹','⁰','ⁿ','ⁱ','⁺','⁻','⁼','₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','₊','₋','₌'],
  },
  greek: {
    label: 'Greek',
    chars: ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','τ','υ','φ','χ','ψ','ω','Α','Β','Γ','Δ','Ε','Ζ','Η','Θ','Ι','Κ','Λ','Μ','Ν','Ξ','Ο','Π','Ρ','Σ','Τ','Υ','Φ','Χ','Ψ','Ω'],
  },
  misc: {
    label: 'Miscellaneous',
    chars: ['★','☆','✓','✗','✘','✔','✕','✖','✚','✦','✧','✩','✪','✫','✬','✭','✮','✯','✰','❖','❘','❙','❚','❛','❜','❝','❞','❨','❩','❪','❫','❬','❭','❮','❯','❰','❱','❲','❳','❴','❵','♠','♣','♥','♦','♤','♧','♡','♢','☀','☁','☂','☃','☄','★','☎','☏','♩','♪','♫','♬','♭','♮','♯'],
  },
};

const SpecialChars: React.FC<SpecialCharsProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('arrows');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const allChars = search
    ? Object.values(CHAR_CATEGORIES).flatMap(c => c.chars)
    : CHAR_CATEGORIES[activeCategory]?.chars || [];

  return (
    <div className="special-chars-panel" ref={panelRef}>
      <div className="special-chars-header">
        <span className="special-chars-title">Special Characters</span>
        <button className="special-chars-close" onClick={onClose}><X size={14} /></button>
      </div>
      <input
        type="text"
        className="special-chars-search"
        placeholder="Search characters..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {!search && (
        <div className="special-chars-categories">
          {Object.entries(CHAR_CATEGORIES).map(([key, { label }]) => (
            <button
              key={key}
              className={`special-chars-cat-btn ${activeCategory === key ? 'active' : ''}`}
              onClick={() => setActiveCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="special-chars-grid">
        {allChars.map((char, i) => (
          <button
            key={i}
            className="special-chars-item"
            onClick={() => onSelect(char)}
            title={`U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SpecialChars;
