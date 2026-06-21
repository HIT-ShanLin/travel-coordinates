import { useState } from 'react';
import type { PlaceInput } from '../lib/types';
import LocationPicker, { type LocationValue } from './LocationPicker';

interface Props {
  initial: PlaceInput & {
    originalName?: string;
    originalCountry?: string;
    originalCity?: string;
  };
  onSave: (input: PlaceInput) => void;
  onCancel: () => void;
}

export default function PlaceEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial.name || '');
  const [note, setNote] = useState(initial.note || '');
  const [date, setDate] = useState(initial.travel_date || '');
  const [placeType, setPlaceType] = useState(initial.place_type || '');
  const [location, setLocation] = useState<LocationValue>({
    name: initial.originalName || initial.name || '',
    country: initial.originalCountry || initial.country || '',
    city: initial.originalCity || initial.city || '',
    lat: initial.latitude || 30,
    lng: initial.longitude || 120,
  });

  const handleSave = () => {
    onSave({
      name,
      note,
      travel_date: date,
      place_type: placeType,
      country: location.country,
      city: location.city,
      latitude: location.lat,
      longitude: location.lng,
    });
  };

  return (
    <div className="place-editor">
      <div className="pe-field">
        <label>地点名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：茶卡盐湖"
        />
      </div>
      <div className="pe-field">
        <label>位置</label>
        <LocationPicker value={location} onChange={setLocation} />
      </div>
      <div className="pe-field">
        <label>旅行日期</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="pe-field">
        <label>类型</label>
        <input
          value={placeType}
          onChange={(e) => setPlaceType(e.target.value)}
          placeholder="例如：自然风光"
        />
      </div>
      <div className="pe-field">
        <label>备注</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>
      <div className="pe-actions">
        <button className="ghost-btn" onClick={onCancel}>
          取消
        </button>
        <button className="primary-btn" onClick={handleSave}>
          保存
        </button>
      </div>
    </div>
  );
}
