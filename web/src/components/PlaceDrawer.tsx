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

const SWIPE_THRESHOLD = 80;

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

  // Card stack state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });

  const siblings = siblingPlaces ?? [];
  const currentIdx = siblings.findIndex((p) => p.id === place?.id);
  const hasSiblings = siblings.length > 1 && onNavigate;
  // Show next 2 cards behind current (for stack effect)
  const stackedCards = hasSiblings
    ? [
        siblings[currentIdx],
        siblings[(currentIdx + 1) % siblings.length],
        siblings[(currentIdx + 2) % siblings.length],
      ].filter(Boolean)
    : place ? [place] : [];

  useEffect(() => {
    if (place) {
      setCards(buildMemoryCards(place));
      setEditing(false);
      setSwipeOffset(0);
      setIsAnimating(false);
    } else {
      setCards([]);
    }
  }, [place]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!hasSiblings || currentIdx < 0) return;
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsSwiping(true);
    },
    [hasSiblings, currentIdx],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping) return;
      const dx = e.touches[0].clientX - touchStart.current.x;
      // Rubber band at edges
      if ((currentIdx === 0 && dx > 0) || (currentIdx === siblings.length - 1 && dx < 0)) {
        setSwipeOffset(dx * 0.25);
      } else {
        setSwipeOffset(dx);
      }
    },
    [isSwiping, currentIdx, siblings.length],
  );

  const handleTouchEnd = useCallback(() => {
    if (!hasSiblings || currentIdx < 0) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }
    setIsSwiping(false);

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      const dir = swipeOffset < 0 ? 1 : -1;
      const newIdx = currentIdx + dir;
      if (newIdx >= 0 && newIdx < siblings.length) {
        // Animate card out
        setIsAnimating(true);
        setSwipeOffset(dir > 0 ? -window.innerWidth : window.innerWidth);
        setTimeout(() => {
          onNavigate!(siblings[newIdx].id);
        }, 250);
        return;
      }
    }
    // Snap back
    setIsAnimating(true);
    setSwipeOffset(0);
    setTimeout(() => setIsAnimating(false), 300);
  }, [hasSiblings, currentIdx, swipeOffset, siblings, onNavigate]);

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

  const heroUrl =
    cards.find((c) => c.photoUrls.length > 0)?.photoUrls[activePhotoIndex] ?? null;

  return (
    <div
      className="panel-content card-stack-wrapper"
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
        <>
          {/* Dot indicators */}
          {hasSiblings && (
            <div className="swipe-dots">
              {siblings.map((p, i) => (
                <span
                  key={p.id}
                  className={`swipe-dot ${i === currentIdx ? 'active' : ''}`}
                  onClick={() => onNavigate!(p.id)}
                />
              ))}
            </div>
          )}

          {/* Card stack */}
          <div className="card-stack">
            {stackedCards.map((sibling, i) => {
              const isTop = i === 0;
              const scale = isTop ? 1 : 0.95 - i * 0.03;
              const translateY = i * -8;
              const zIndex = stackedCards.length - i;
              const opacity = isTop ? 1 : 0.5 - i * 0.2;

              return (
                <div
                  key={sibling.id}
                  className="card-stack-item"
                  style={{
                    transform: isTop
                      ? `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)`
                      : `scale(${scale}) translateY(${translateY}px)`,
                    zIndex,
                    opacity,
                    transition: isSwiping ? 'none' : 'transform 0.3s ease-out, opacity 0.3s',
                    pointerEvents: isTop ? 'auto' : 'none',
                  }}
                >
                  <CardContent
                    place={sibling}
                    cards={isTop ? cards : []}
                    heroUrl={isTop ? heroUrl : null}
                    activePhotoIndex={isTop ? activePhotoIndex : 0}
                    onSetActivePhoto={isTop ? setActivePhotoIndex : undefined}
                    onEdit={isTop ? () => setEditing(true) : undefined}
                    onClose={isTop ? onClose : undefined}
                    onDeleteCard={isTop ? handleDeleteCard : undefined}
                    onAppendMemory={isTop ? onAppendMemory : undefined}
                    onDeletePlace={isTop ? onDeletePlace : undefined}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CardContent — renders one place's full content                     */
/* ------------------------------------------------------------------ */

function CardContent({
  place,
  cards,
  heroUrl,
  activePhotoIndex,
  onSetActivePhoto,
  onEdit,
  onClose,
  onDeleteCard,
  onAppendMemory,
  onDeletePlace,
}: {
  place: Place;
  cards: MemoryCardData[];
  heroUrl: string | null;
  activePhotoIndex: number;
  onSetActivePhoto?: React.Dispatch<React.SetStateAction<number>>;
  onEdit?: () => void;
  onClose?: () => void;
  onDeleteCard?: (id: string, type: string) => void;
  onAppendMemory?: () => void;
  onDeletePlace?: () => void;
}) {
  return (
    <div className="card-content">
      {/* Header */}
      <div className="drawer-header">
        <div>
          <h3>{place.name}</h3>
          <p className="drawer-subtitle">
            {place.country} · {place.city}
          </p>
        </div>
        <div className="drawer-header-actions">
          {onEdit && (
            <button className="mini-btn" onClick={onEdit}>
              编辑
            </button>
          )}
          {onClose && (
            <button className="mini-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Hero gallery */}
      {heroUrl ? (
        <div className="hero-gallery">
          <div className="hero-image" style={{ backgroundImage: `url(${heroUrl})` }} />
          {cards.filter((c) => c.photoUrls.length > 0).length > 1 && onSetActivePhoto && (
            <div className="hero-nav">
              <button
                className="hero-nav-btn"
                onClick={() =>
                  onSetActivePhoto((p) =>
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
                      onClick={() => onSetActivePhoto(i)}
                    />
                  ))}
              </span>
              <button
                className="hero-nav-btn"
                onClick={() =>
                  onSetActivePhoto((p) =>
                    (p + 1) % (cards.filter((c) => c.photoUrls.length > 0).length || 1),
                  )
                }
              >
                ›
              </button>
            </div>
          )}
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
      {cards.length > 0 && (
        <div className="section-block">
          <h4>旅行记忆 ({cards.length})</h4>
          <div className="memory-list">
            {cards.map((card) => (
              <MemoryCard
                key={card.id}
                card={card}
                onEdit={onAppendMemory}
                onDelete={
                  onDeleteCard ? () => onDeleteCard(card.id, card.type) : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {onAppendMemory && (
        <div className="drawer-bottom-actions">
          <button className="primary-btn" onClick={onAppendMemory}>
            ＋ 添加记忆
          </button>
        </div>
      )}

      {/* Delete place */}
      {onDeletePlace && (
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
      )}
    </div>
  );
}
