import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function CheckboxMultiSelect({ label, options, selected, setSelected }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef(null);
  const buttonId = useMemo(
    () => `multi-select-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    [label],
  );
  const selectableOptions = useMemo(
    () => options.filter((opt) => typeof opt === 'string'),
    [options],
  );
  const showSearch = selectableOptions.length > 10;
  const filteredOptions = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) => {
      if (typeof opt !== 'string') return true;
      return opt.toLowerCase().includes(normalized);
    });
  }, [options, searchTerm]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleValue = (value) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
      return;
    }
    setSelected([...selected, value]);
  };

  let summary = `Select ${label}`;
  if (selected.length === 1) {
    summary = selected[0];
  } else if (selected.length > 1) {
    summary = `${selected.length} selected`;
  }

  return (
    <div className="filter-section" ref={rootRef}>
      <label>{label}</label>
      <button
        id={buttonId}
        type="button"
        className={`multi-select-trigger${isOpen ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((open) => {
            const next = !open;
            if (!next) setSearchTerm('');
            return next;
          });
        }}
      >
        <span className={`multi-select-summary${selected.length === 0 ? ' placeholder' : ''}`}>
          {summary}
        </span>
        <span className="multi-select-trigger-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="multi-select-menu" role="listbox" aria-labelledby={buttonId} aria-multiselectable="true">
          <div className="multi-select-actions">
            <button
              type="button"
              className="multi-select-action"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Clear
            </button>
          </div>
          {showSearch && (
            <div className="multi-select-search-wrap">
              <input
                type="text"
                className="multi-select-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
              />
            </div>
          )}
          <div className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">No matching options</div>
            ) : (
              filteredOptions.map((opt) => {
                if (typeof opt !== 'string') {
                  return (
                    <div key={opt.id || opt.label} className="multi-select-divider" aria-hidden="true">
                      <span className="multi-select-divider-line"></span>
                      {opt.label && <span className="multi-select-divider-label">{opt.label}</span>}
                    </div>
                  );
                }

                return (
                  <label key={opt} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => toggleValue(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((item) => (
            <span className="chip" key={item}>
              {item}
              <button type="button" onClick={() => toggleValue(item)} aria-label={`Remove ${item}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
