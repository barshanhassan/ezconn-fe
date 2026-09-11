import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Option {
  id: string;
  name: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  width?: string;
  showSelectedOption?: boolean;
  showSearch?: boolean;
  className?: string; // Add className prop
  triggerContent?: React.ReactNode; // Add triggerContent prop
  popoutWidth?: string;
  popoutAlign?: 'left' | 'right';
  // Controlled open state — when provided, this dropdown coordinates with
  // sibling toolbar dropdowns (only one open at a time) instead of managing
  // its open/closed state purely internally.
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  selected,
  onChange,
  placeholder,
  width = "180px",
  showSelectedOption = false,
  showSearch = true,
  className = "", // Default to empty string
  triggerContent, // Destructure triggerContent
  popoutWidth,
  popoutAlign = 'left',
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    if (!isControlled) setInternalIsOpen(open);
  };
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: string) => {
    if (showSelectedOption) {
      // Single selection mode
      onChange([id]);
      setIsOpen(false);
    } else {
      // Multi-selection mode
      if (selected.includes(id)) {
        onChange(selected.filter(item => item !== id));
      } else {
        onChange([...selected, id]);
      }
    }
  };

  const selectedOption = showSelectedOption ? options.find(opt => opt.id === selected[0]) : null;

  return (
    <div className="relative" style={{ width }} ref={dropdownRef}>
      <div
        role="button"
        tabIndex={0}
        style={{ borderRadius: '6px' }}
        className={cn(
          "h-9 w-full flex items-center justify-between px-3 text-left bg-white dark:bg-slate-800/50 border border-input shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer focus:outline-none text-[12px] font-medium text-slate-700 dark:text-slate-200 transition-all",
          className
        )}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(!isOpen);
          }
        }}
      >
        {triggerContent ? (
          triggerContent
        ) : (
          <>
            <span className="truncate flex items-center gap-2">
              {selected.length === 0 ? (
                <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
              ) : showSelectedOption ? (
                <>
                  {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
                  <span>{selectedOption?.name || placeholder}</span>
                </>
              ) : (
                <span className="text-slate-900 dark:text-white font-bold">{placeholder} ({selected.length})</span>
              )}
            </span>
            <span className="ml-2 text-slate-400">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
            </span>
          </>
        )}
      </div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-[100] mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-none animate-in fade-in-0 zoom-in-95 duration-100",
            popoutAlign === 'right' ? 'right-0' : 'left-0'
          )}
          style={{ width: popoutWidth ?? 'max-content', minWidth: '160px' }}
        >
          {showSearch && (
            <div className="flex items-center px-3 py-2 border-b dark:border-slate-700">
              <span className="flex items-center w-5 h-5 mr-2 justify-center flex-shrink-0">
                <Search className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
              </span>
              <input
                type="text"
                placeholder={t("custom_dropdown.search_placeholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-sm focus:outline-none bg-transparent focus:ring-0 text-foreground dark:text-white dark:placeholder-gray-500"
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground dark:text-gray-400 text-sm">{t("custom_dropdown.no_results")}</li>
            )}
            {filteredOptions.map(option => (
              <li
                key={option.id}
                className={`group flex items-center px-3 py-2 text-sm cursor-pointer select-none transition-colors rounded-md hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white text-foreground dark:text-gray-300`}
                onClick={() => handleSelect(option.id)}
                title={option.name}
              >
                <span
                  className="flex items-center w-5 h-5 mr-2 justify-center flex-shrink-0 rounded-full"
                  style={{ backgroundColor: selected.includes(option.id) ? "hsl(var(--primary))" : "transparent" }}
                >
                  <Check
                    className="h-3 w-3"
                    style={{ color: selected.includes(option.id) ? "#fff" : "transparent" }}
                  />
                </span>
                {option.icon && <span className="mr-2 flex-shrink-0">{option.icon}</span>}
                <span className="truncate overflow-hidden">{option.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;