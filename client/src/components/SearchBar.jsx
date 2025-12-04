import React, { useState, useEffect, useRef } from "react";
import { getParcelSuggestions } from "../services/parcelService";

export default function SearchBar({
  onSearch,
  placeholder = "Search by parcel ID, address, or owner…",
  initialValue = "",
}) {
  const [input, setInput] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!input || input.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setHighlightIndex(-1);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getParcelSuggestions(input, 10);
        setSuggestions(data);
        setOpen(data.length > 0);
        setHighlightIndex(-1);
      } catch (_e) {
        setSuggestions([]);
        setOpen(false);
        setHighlightIndex(-1);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [input]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
      const chosen = suggestions[highlightIndex];
      if (onSearch) onSearch(chosen.id);
    } else {
      if (onSearch) onSearch(input.trim());
    }

    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleSuggestionClick = (sugg) => {
    setInput(sugg.id);
    setOpen(false);
    setHighlightIndex(-1);
    if (onSearch) onSearch(sugg.id);
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", maxWidth: 480 }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "999px",
            border: "1px solid #d0d0d0",
            fontSize: "14px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#111827",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
            zIndex: 40,
            maxHeight: "260px",
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {suggestions.map((s, idx) => (
            <div
              key={`${s.id}-${idx}`}
              onClick={() => handleSuggestionClick(s)}
              onMouseEnter={() => setHighlightIndex(idx)}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                cursor: "pointer",
                backgroundColor:
                  idx === highlightIndex ? "#f3f4f6" : "transparent",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span style={{ fontWeight: 500 }}>{s.id}</span>
              {s.label && s.label !== s.id && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {s.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
