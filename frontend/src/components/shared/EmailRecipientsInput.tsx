import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, User, Plus } from 'lucide-react';
import { contactListPaginated } from '@/lib/contactApi';
import { cn } from '@/lib/utils';

interface EmailRecipientsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function EmailRecipientsInput({ value, onChange, placeholder = 'Destinatarios' }: EmailRecipientsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; correo: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const recipients = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const match = s.match(/"([^"]+)"\s*<([^>]+)>|([^\s,;@]+@[^\s,;]+)/);
      if (match?.[2]) return { name: match[1], email: match[2] };
      if (match?.[3]) return { name: match[3], email: match[3] };
      return { name: s, email: s };
    });

  const searchTerm = inputValue.split(',').pop()?.trim() || '';

  const searchContacts = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await contactListPaginated({ search: query, limit: 8 });
      setResults(res.data.map((c) => ({ id: c.id, name: c.name, correo: c.correo })));
    } catch { setResults([]); }
    finally { setLoading(false); setFocusedIndex(-1); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(() => {
      setShowResults(true);
      searchContacts(searchTerm);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, searchContacts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    const parts = val.split(',');
    if (parts.length > 1) {
      const complete = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (complete.length > 0) {
        onChange([...recipients.map(r => r.email), ...complete].join(', '));
      }
      setInputValue(last);
    }
  }

  function selectContact(contact: { name: string; correo: string }) {
    const newRecip = `"${contact.name}" <${contact.correo}>`;
    const newVal = recipients.length > 0
      ? [...recipients.map(r => r.email), contact.correo].join(', ')
      : contact.correo;
    onChange(newVal);
    setInputValue('');
    setShowResults(false);
    inputRef.current?.focus();
  }

  function removeRecipient(index: number) {
    const newList = [...recipients.map(r => r.email)];
    newList.splice(index, 1);
    onChange(newList.join(', '));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      removeRecipient(recipients.length - 1);
    }
    if (e.key === 'Enter' && searchTerm && results.length > 0 && focusedIndex >= 0) {
      e.preventDefault();
      selectContact(results[focusedIndex]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
    }
    if (e.key === 'Escape') {
      setShowResults(false);
    }
    if (e.key === 'Enter' && searchTerm && !(results.length > 0 && focusedIndex >= 0)) {
      e.preventDefault();
      const newVal = recipients.length > 0
        ? [...recipients.map(r => r.email), searchTerm].join(', ')
        : searchTerm;
      onChange(newVal);
      setInputValue('');
      setShowResults(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1 py-2">
        {recipients.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {r.email}
            <button type="button" onClick={() => removeRecipient(i)} className="rounded-sm p-0.5 hover:bg-primary/20 transition-colors">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setShowResults(true); }}
          placeholder={recipients.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {showResults && searchTerm && (
        <div className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {searchTerm.includes('@') ? (
                <span>Presiona Enter para agregar <strong>{searchTerm}</strong></span>
              ) : (
                'Sin resultados'
              )}
            </div>
          ) : (
            results.map((contact, i) => (
              <button
                key={contact.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  focusedIndex === i ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                )}
                onClick={() => selectContact(contact)}
                onMouseEnter={() => setFocusedIndex(i)}
              >
                <User className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{contact.correo}</p>
                </div>
                <Plus className="size-4 shrink-0 text-muted-foreground/50" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
