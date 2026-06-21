import { useEffect, useState, useRef, useCallback } from 'react';
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
  siblingPlaces?: Place[];
  onNavigate?: (placeId: string) => void;
};

function buildMemoryCards(place: Place): MemoryCardData[] {
  const cards: MemoryCardData[] = [];
  const photoMap = new Map(place.photos.map((p) => [p.id, p]));
  const linkedPhotoIds = new Set<string>();

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

const SWIPE_THRESHOLD = 60; // px

export function PlaceDrawer({
  place,
  onUpdatePlace,
  onDeletePhoto,
  onDeletePost,
  onDeletePlace,
  onClose,
  onAppendMemory,
  siblingPlaces,
  onNavigate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [cards, setCards] = useState<MemoryCardData[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Swipe state
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const siblingCount = siblingPlaces?.length ?? 0;
  const currentIndex = siblingPlaces?.findIndex((p) => p.id === place?.id) ?? 0;
  const showSwipe = siblingCount > 1 && onNavigate;

  useEffect(() => {
    if (place) {
      setCards(buildMemoryCards(place));
      setEditing(false);
      setSwipeOffset(0);
    } else {
      setCards([]);
    }
  }, [place]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!showSwipe) return;
    touchStartX.current = e.touches[0].clientX;
    setSwiping(true);
  }, [showSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping || !showSwipe) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    // Clamp: don't allow swiping past boundaries
    if ((currentIndex === 0 && delta > 0) || (currentIndex === siblingCount - 1 && delta < 0)) {
      setSwipeOffset(delta * 0.3); // rubber band
    } else {
      setSwipeOffset(delta);
    }
  }, [swiping, showSwipe, currentIndex, siblingCount]);

  const handleTouchEnd = useCallback(() => {
    if (!showSwipe) return;
    setSwiping(false);
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      if (swipeOffset < 0 && currentIndex < siblingCount - 1) {
        onNavigate!(siblingPlaces![currentIndex + 1].id);
      } else if (swipeOffset > 0 && currentIndex > 0) {
        onNavigate!(siblingPlaces![currentIndex - 1].id);
      }
    }
    setSwipeOffset(0);
  }, [showSwipe, swipeOffset, currentIndex, siblingCount, siblingPlaces, onNavigate]);

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

  const heroUrl = cards.find((c) => c.photoUrls.length > 0)?.photoUrls[activePhotoIndex] ?? null;

  return (
    <div
      className="panel-content"
      ref={panelRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
        <div
          className="swipe-container"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swiping ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {/* Dot indicators */}
          {showSwipe && (
            <div className="swipe-dots">
              {siblingPlaces!.map((p, i) => (
                <span
                  key={p.id}
                  className={`swipe-dot ${i === currentIndex ? 'active' : ''}`}
                  onClick={() => onNavigate!(p.id)}
                />
              ))}
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
            {place.note && <p className="info-note">{place.note}</p>}
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
        </div>
      )}
    </div>
  );
}
