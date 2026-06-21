import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeoItem } from '../lib/types';
import { suggestPlaces, reverseGeocode } from '../lib/api';

export interface LocationValue {
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  onOpenMapPicker?: () => void;
}

export default function LocationPicker({ value, onChange, onOpenMapPicker }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = useCallback((text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!text.trim()) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const items = await suggestPlaces(text);
        setSuggestions(items);
        setOpen(items.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (item: GeoItem) => {
    onChange({
      name: item.name,
      country: item.country,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
    });
    setQuery(`${item.country} · ${item.name}`);
    setOpen(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const rr = await reverseGeocode(latitude, longitude);
          onChange({
            name: rr.name,
            country: rr.country,
            city: rr.city,
            lat: rr.lat,
            lng: rr.lng,
          });
          setQuery(`${rr.country} · ${rr.name}`);
        } catch {
          onChange({
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            country: '',
            city: '',
            lat: latitude,
            lng: longitude,
          });
          setQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      (err) => {
        console.warn('geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  useEffect(() => {
    if (value.name) {
      setQuery(`${value.country ? value.country + ' · ' : ''}${value.name}`);
    }
  }, [value.name, value.country]);

  return (
    <div className="location-picker">
      <div className="lp-input-row">
        <input
          className="lp-search"
          type="text"
          placeholder="搜索地点..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        <button type="button" className="lp-btn" onClick={handleLocate} title="使用当前位置">
          📍
        </button>
        {onOpenMapPicker && (
          <button type="button" className="lp-btn" onClick={onOpenMapPicker} title="地图选点">
            🗺️
          </button>
        )}
      </div>
      {open && (
        <ul className="lp-dropdown">
          {loading && <li className="lp-loading">搜索中...</li>}
          {suggestions.map((item, i) => (
            <li key={i} className="lp-item" onClick={() => handleSelect(item)}>
              <span className="lp-name">{item.name}</span>
              <span className="lp-admin">
                {item.country} · {item.city}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
