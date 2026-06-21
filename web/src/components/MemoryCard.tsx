import { useState } from 'react';

export interface MemoryCardData {
  id: string;
  type: 'post_with_photo' | 'post_only' | 'photo_only';
  photoUrls: string[];
  title: string;
  content: string;
  date: string;
  placeName: string;
}

interface Props {
  card: MemoryCardData;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MemoryCard({ card, onEdit, onDelete }: Props) {
  const [activePhoto, setActivePhoto] = useState(0);

  return (
    <div className="memory-card">
      {card.photoUrls.length > 0 && (
        <div className="mc-photos">
          <div
            className="mc-photo-main"
            style={{ backgroundImage: `url(${card.photoUrls[activePhoto]})` }}
          />
          {card.photoUrls.length > 1 && (
            <div className="mc-photo-nav">
              <button
                className="mc-nav-btn"
                onClick={() =>
                  setActivePhoto(
                    (p) =>
                      (p - 1 + card.photoUrls.length) % card.photoUrls.length,
                  )
                }
              >
                ‹
              </button>
              <span className="mc-photo-dots">
                {card.photoUrls.map((_, i) => (
                  <span
                    key={i}
                    className={`mc-dot ${i === activePhoto ? 'active' : ''}`}
                    onClick={() => setActivePhoto(i)}
                  />
                ))}
              </span>
              <button
                className="mc-nav-btn"
                onClick={() =>
                  setActivePhoto((p) => (p + 1) % card.photoUrls.length)
                }
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mc-meta">
        <div className="mc-place">📍 {card.placeName}</div>
        <div className="mc-date">📅 {card.date}</div>
        {card.content && <div className="mc-content">{card.content}</div>}
        {card.type === 'photo_only' && (
          <p className="mc-add-text-hint">💡 点击编辑为此照片补充文字</p>
        )}
      </div>
      <div className="mc-actions">
        {onEdit && (
          <button className="mini-btn" onClick={onEdit}>
            编辑
          </button>
        )}
        {onDelete && (
          <button className="mini-btn mc-delete-btn" onClick={onDelete}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
