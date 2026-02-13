import React, { useState } from 'react';
import { Template, templates } from '../utils/templates';
import { FileText, X } from 'lucide-react';

interface TemplateSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ isVisible, onClose, onSelect }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0]?.id || '');

  if (!isVisible) return null;

  const handleSelect = () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      onSelect(template);
      onClose();
    }
  };

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onSelect(template);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal template-selector-modal">
        <div className="modal-header">
          <h3>Choose a Template</h3>
          <button onClick={onClose} className="close-button">
            <X size={16} />
          </button>
        </div>
        
        <div className="template-grid">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
              onClick={() => handleTemplateClick(template.id)}
            >
              <div className="template-icon">
                <FileText size={24} />
              </div>
              <div className="template-info">
                <h4 className="template-name">{template.name}</h4>
                <p className="template-description">{template.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="template-preview">
          {selectedTemplate && (
            <div className="template-preview-content">
              <h4>Preview</h4>
              <div className="template-preview-text">
                {templates.find(t => t.id === selectedTemplate)?.content.substring(0, 300) || ''}
                {(templates.find(t => t.id === selectedTemplate)?.content.length || 0) > 300 && '...'}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSelect} className="primary" disabled={!selectedTemplate}>
            Create from Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;