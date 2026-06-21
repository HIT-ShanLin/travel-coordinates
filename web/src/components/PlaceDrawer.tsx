import { useEffect, useState } from 'react';
import type { Place, PlaceInput } from '../lib/types';
import MemoryCard, { type MemoryCardData } from './MemoryCard';
import PlaceEditor from './PlaceEditor';

type Props = {
  place: Place | null;
  onUpdatePlace: (input: PlaceInput) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onCreatePost: (input: { title: string; content: string; photo_id?: string }) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeletePlace: () => Promise<void>;
  onClose: () => void;
  onAppendMemory?: () => void;
  siblingIds?: string[];
  onNavigate?: (placeId: string) => void;
};

function buildMemoryCards(place: Place): MemoryCardData[] {
  const cards: MemoryCardData[] = [];
  const photoMap = new Map(place.photos.map((p) => [p.id, p]));
  const linkedPhotoIds = new Set<string>();

  // Posts with or without photos
  for (const post of place.posts) {
    const photo = post.photo_id ? photoMap.get(post.photo_id) : undefined;
    if (photo) linkedPhotoIds.add(photo.id);
    cards.push({
      id: post.id,
      type: photo ? 'post_with_photo' : 'post_only',
      photoUrls: photo ? [photo.url] : [],
      title: post.title,
      content: post.content,
      date: post.created_at.slice(0, 10),
      placeName: `${place.country} · ${place.city || place.name}`,
    });
  }

  // Orphan photos (not linked to any post)
  for (const photo of place.photos) {
    if (!linkedPhotoIds.has(photo.id)) {
      cards.push({
        id: photo.id,
        type: 'photo_only',
        photoUrls: [photo.url],
        title: '',
        content: '',
        date: photo.created_at.slice(0, 10),
        placeName: `${place.country} · ${place.city || place.name}`,
      });
    }
  }

  return cards;
}

export function PlaceDrawer({
  place,
  onUpdatePlace,
  onDeletePhoto,
  onDeletePost,
  onDeletePlace,
  onClose,
  onAppendMemory,
  siblingIds,
  onNavigate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [cards, setCards] = useState<MemoryCardData[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    if (place) {
      setCards(buildMemoryCards(place));
      setEditing(false);
    } else {
      setCards([]);
    }
  }, [place]);

  if (!place) {
    return (
      <div className="panel-content">
        <p className="empty-hint">点击标记查看旅行记忆</p>
      </div>
    );
  }

  const handleSavePlace = async (input: PlaceInput) => {
    await onUpdatePlace(input);
    setEditing(false);
  };

  const handleDeleteCard = (cardId: string, cardType: string) => {
    if (cardType === 'photo_only') {
      if (confirm('确定删除这张照片？')) {
        onDeletePhoto(cardId);
      }
    } else {
      if (confirm('确定删除这条记忆？')) {
        onDeletePost(cardId);
      }
    }
  };

  // Hero photo: first photo from any card, or null
  const heroUrl = cards.find((c) => c.photoUrls.length > 0)?.photoUrls[activePhotoIndex] ?? null;

  return (
    <div className="panel-content">
      {editing ? (
        <PlaceEditor
          initial={{
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            travel_date: place.travel_date,
            note: place.note,
            place_type: place.place_type,
            country: place.country,
            city: place.city,
            originalName: place.name,
            originalCountry: place.country,
            originalCity: place.city,
          }}
          onSave={handleSavePlace}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {/* City navigation */}
          {siblingIds && siblingIds.length > 1 && onNavigate && (
            <div className="city-nav">
              <button
                className="city-nav-btn"
                disabled={siblingIds.indexOf(place.id) === 0}
                onClick={() => {
                  const idx = siblingIds.indexOf(place.id);
                  if (idx > 0) onNavigate(siblingIds[idx - 1]);
                }}
              >
                ‹ 上一个
              </button>
              <span className="city-nav-info">
                {siblingIds.indexOf(place.id) + 1} / {siblingIds.length}
              </span>
              <button
                className="city-nav-btn"
                disabled={siblingIds.indexOf(place.id) === siblingIds.length - 1}
                onClick={() => {
                  const idx = siblingIds.indexOf(place.id);
                  if (idx < siblingIds.length - 1) onNavigate(siblingIds[idx + 1]);
                }}
              >
                下一个 ›
              </button>
            </div>
          )}

          {/* Header */}
          <div className="drawer-header">
            <div>
              <h3>{place.name}</h3>
              <p className="drawer-subtitle">
                {place.country} · {place.city}
              </p>
            </div>
            <div className="drawer-header-actions">
              <button className="mini-btn" onClick={() => setEditing(true)}>
                编辑
              </button>
              <button className="mini-btn" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>

          {/* Hero gallery */}
          {heroUrl ? (
            <div className="hero-gallery">
              <div
                className="hero-image"
                style={{ backgroundImage: `url(${heroUrl})` }}
              />
              <div className="hero-nav">
                <button
                  className="hero-nav-btn"
                  onClick={() =>
                    setActivePhotoIndex(
                      (p) =>
                        (p - 1 + (cards.filter((c) => c.photoUrls.length > 0).length || 1)) %
                        (cards.filter((c) => c.photoUrls.length > 0).length || 1),
                    )
                  }
                >
                  ‹
                </button>
                <span className="hero-dots">
                  {cards
                    .filter((c) => c.photoUrls.length > 0)
                    .map((_, i) => (
                      <span
                        key={i}
                        className={`hero-dot ${i === activePhotoIndex ? 'active' : ''}`}
                        onClick={() => setActivePhotoIndex(i)}
                      />
                    ))}
                </span>
                <button
                  className="hero-nav-btn"
                  onClick={() =>
                    setActivePhotoIndex(
                      (p) =>
                        (p + 1) % (cards.filter((c) => c.photoUrls.length > 0).length || 1),
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
          ) : (
            <div className="hero-empty">暂无照片</div>
          )}

          {/* Metadata */}
          <div className="info-block">
            <div className="meta-grid">
              <div>
                <span className="meta-label">旅行日期</span>
                <span>{place.travel_date || '未设置'}</span>
              </div>
              <div>
                <span className="meta-label">类型</span>
                <span>{place.place_type || '未分类'}</span>
              </div>
            </div>
            {place.note && (
              <p className="info-note">{place.note}</p>
            )}
          </div>

          {/* Memory cards */}
          <div className="section-block">
            <h4>旅行记忆 ({cards.length})</h4>
            <div className="memory-list">
              {cards.map((card) => (
                <MemoryCard
                  key={card.id}
                  card={card}
                  onEdit={onAppendMemory}
                  onDelete={() => handleDeleteCard(card.id, card.type)}
                />
              ))}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="drawer-bottom-actions">
            {onAppendMemory && (
              <button className="primary-btn" onClick={onAppendMemory}>
                ＋ 添加记忆
              </button>
            )}
          </div>

          {/* Delete place */}
          <div className="section-block">
            <button
              className="mini-btn mc-delete-btn"
              onClick={() => {
                if (confirm('确定删除此地点及其所有记忆？此操作不可撤销。')) {
                  onDeletePlace();
                }
              }}
            >
              删除此地点
            </button>
          </div>
        </>
      )}
    </div>
  );
}
