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
  currentUserId?: string;
};

/* ------------------------------------------------------------------ */
/*  Build memory cards for a given place                               */
/* ------------------------------------------------------------------ */

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
        id: photo.id, type: 'photo_only',
        photoUrls: [photo.url], title: '', content: '',
        date: photo.created_at.slice(0, 10),
        placeName: `${place.country} · ${place.city || place.name}`,
      });
    }
  }
  return cards;
}

/* ------------------------------------------------------------------ */
/*  PostCarousel — inner carousel for posts/photos within one place    */
/* ------------------------------------------------------------------ */

function PostCarousel({ cards, isOwner, onEdit, onDeleteCard }: {
  cards: MemoryCardData[];
  isOwner: boolean;
  onEdit?: () => void;
  onDeleteCard: (cardId: string, cardType: string) => void;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const single = cards.length <= 1;

  // IntersectionObserver to track which post card is visible
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || single) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!isNaN(idx)) setActiveIdx(idx);
          }
        }
      },
      { threshold: 0.6, root: el },
    );

    el.querySelectorAll('.post-card-item').forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [cards.length, single]);

  const scrollTo = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const items = el.querySelectorAll('.post-card-item');
    if (items[idx]) {
      items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  if (cards.length === 0) {
    return (
      <div className="hero-empty" style={{ flex: 1 }}>
        <p>暂无记忆</p>
        {isOwner && <p className="pg-hint">点击下方按钮添加旅行记忆</p>}
      </div>
    );
  }

  return (
    <>
      <div
        className={`post-carousel ${single ? 'single' : ''}`}
        ref={carouselRef}
        style={single ? { padding: '0 12px', overflowX: 'hidden' } : undefined}
      >
        {cards.map((card, i) => (
          <div
            className="post-card-item"
            key={card.id}
            data-idx={i}
            style={single ? { flex: '1 1 100%' } : undefined}
          >
            <MemoryCard
              card={card}
              onEdit={isOwner ? onEdit : undefined}
              onDelete={
                isOwner
                  ? () => onDeleteCard(card.id, card.type)
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {/* dot indicators (only when > 1) */}
      {!single && (
        <div className="post-dots">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`post-dot ${i === activeIdx ? 'active' : ''}`}
              onClick={() => scrollTo(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  PlaceCard — a single place's content                               */
/* ------------------------------------------------------------------ */

function PlaceCard({
  place,
  cards,
  isOwner,
  onEdit,
  onDeleteCard,
  onAppendMemory,
  onDeletePlace,
}: {
  place: Place;
  cards: MemoryCardData[];
  isOwner: boolean;
  onEdit: () => void;
  onDeleteCard: (cardId: string, cardType: string) => void;
  onAppendMemory?: () => void;
  onDeletePlace: () => void;
}) {
  const handleDeleteCard = useCallback(
    (cardId: string, cardType: string) => {
      if (cardType === 'photo_only') {
        if (confirm('删除这张照片？')) onDeleteCard(cardId, cardType);
      } else {
        if (confirm('删除这条记忆？')) onDeleteCard(cardId, cardType);
      }
    },
    [onDeleteCard],
  );

  return (
    <div className="place-card" data-place-id={place.id}>
      {/* header */}
      <div className="place-card-header">
        <div>
          <h3>{place.name}</h3>
          <div className="place-card-sub">
            {place.country} · {place.city || place.name}
          </div>
        </div>
        <div className="place-card-meta">
          {isOwner && (
            <button className="mini-btn" onClick={onEdit}>
              编辑
            </button>
          )}
        </div>
      </div>

      {/* body: post carousel */}
      <div className="place-card-body">
        <PostCarousel
          cards={cards}
          isOwner={isOwner}
          onEdit={onAppendMemory}
          onDeleteCard={handleDeleteCard}
        />
      </div>

      {/* footer (owner actions) */}
      {isOwner && (
        <div className="place-card-footer">
          {onAppendMemory && (
            <button className="primary-btn" onClick={onAppendMemory}>
              ＋ 添加记忆
            </button>
          )}
          <button
            className="mini-btn mc-delete-btn"
            onClick={() => {
              if (confirm('确定删除此地点及其所有记忆？')) onDeletePlace();
            }}
          >
            删除此地点
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PlaceDrawer — outer carousel of places                             */
/* ------------------------------------------------------------------ */

export function PlaceDrawer({
  place, onUpdatePlace, onDeletePhoto, onDeletePost, onDeletePlace,
  onClose, onAppendMemory, siblingPlaces, onNavigate, currentUserId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activePlaceIdx, setActivePlaceIdx] = useState(0);

  const siblings = siblingPlaces ?? [];
  const currentIdx = siblings.findIndex((p) => p.id === place?.id);
  const siblingCount = siblings.length;
  const isOwner = place ? place.user_id === (currentUserId ?? '') : false;

  // Pre-compute cards for all sibling places
  const placeCards = siblings.map((p) => ({
    place: p,
    cards: buildMemoryCards(p),
  }));

  // Reset editing when place changes
  useEffect(() => {
    if (place) setEditing(false);
  }, [place]);

  // IntersectionObserver: detect which place is in view → navigate + map sync
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || siblingCount < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const placeId = (entry.target as HTMLElement).dataset.placeId;
            const idx = siblings.findIndex((p) => p.id === placeId);
            if (placeId && idx >= 0 && idx !== activePlaceIdx) {
              setActivePlaceIdx(idx);
              if (onNavigate) onNavigate(placeId);
            }
          }
        }
      },
      { threshold: 0.6, root: el },
    );

    el.querySelectorAll('.place-card').forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [siblings, siblingCount, activePlaceIdx, onNavigate]);

  // Sync activePlaceIdx when place prop changes externally (e.g., marker click)
  useEffect(() => {
    if (currentIdx >= 0 && currentIdx !== activePlaceIdx) {
      setActivePlaceIdx(currentIdx);
    }
  }, [currentIdx, activePlaceIdx]);

  // Desktop: scroll to specific place
  const scrollToPlace = useCallback((idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.place-card');
    if (cards[idx]) {
      cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  // Scroll to current place when `place` prop changes from outside
  useEffect(() => {
    if (currentIdx >= 0) {
      // Small delay to let DOM render
      const timer = setTimeout(() => scrollToPlace(currentIdx), 50);
      return () => clearTimeout(timer);
    }
  }, [place?.id, currentIdx, scrollToPlace]);

  const handleArrow = useCallback(
    (dir: 1 | -1) => {
      const newIdx = activePlaceIdx + dir;
      if (newIdx >= 0 && newIdx < siblingCount) scrollToPlace(newIdx);
    },
    [activePlaceIdx, siblingCount, scrollToPlace],
  );

  /* ---- empty state ---- */
  if (!place) return (
    <div className="panel-content"><p className="empty-hint">点击标记查看旅行记忆</p></div>
  );

  /* ---- editing state ---- */
  if (editing) return (
    <div className="panel-content">
      <PlaceEditor
        initial={{
          name: place.name, latitude: place.latitude, longitude: place.longitude,
          travel_date: place.travel_date, note: place.note, place_type: place.place_type,
          country: place.country, city: place.city,
          originalName: place.name, originalCountry: place.country, originalCity: place.city,
        }}
        onSave={async (input) => { await onUpdatePlace(input); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </div>
  );

  /* ---- normal state with carousel ---- */
  return (
    <div className="swipe-panel">
      {/* Top bar */}
      <div className="swipe-topbar">
        <div className="swipe-topbar-left">
          <h3>{place.name}</h3>
          <span className="swipe-topbar-sub">{place.country} · {place.city}</span>
        </div>
        <div className="swipe-topbar-right">
          {siblingCount > 1 && (
            <span className="swipe-counter">
              {activePlaceIdx + 1}/{siblingCount}
            </span>
          )}
          {isOwner && (
            <button className="mini-btn" onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
          <button className="mini-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Place carousel */}
      <div className="place-carousel-container" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div className="place-carousel" ref={carouselRef}>
          {placeCards.map(({ place: p, cards }) => (
            <PlaceCard
              key={p.id}
              place={p}
              cards={cards}
              isOwner={p.user_id === (currentUserId ?? '')}
              onEdit={() => setEditing(true)}
              onDeleteCard={(cardId, cardType) => {
                if (cardType === 'photo_only') onDeletePhoto(cardId);
                else onDeletePost(cardId);
              }}
              onAppendMemory={onAppendMemory}
              onDeletePlace={onDeletePlace}
            />
          ))}
        </div>

        {/* Desktop arrows (only when > 1 sibling) */}
        {siblingCount > 1 && (
          <>
            <button
              className="carousel-arrow carousel-arrow-left"
              onClick={() => handleArrow(-1)}
              style={{ display: activePlaceIdx <= 0 ? 'none' : undefined }}
            >
              ‹
            </button>
            <button
              className="carousel-arrow carousel-arrow-right"
              onClick={() => handleArrow(1)}
              style={{ display: activePlaceIdx >= siblingCount - 1 ? 'none' : undefined }}
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Place dot indicators */}
      {siblingCount > 1 && (
        <div className="place-dots">
          {siblings.map((p, i) => (
            <span
              key={p.id}
              className={`place-dot ${i === activePlaceIdx ? 'active' : ''}`}
              onClick={() => scrollToPlace(i)}
            />
          ))}
        </div>
      )}

      {/* Bottom bar (owner only, for current place) */}
      {isOwner && (
        <div className="swipe-bottom">
          {onAppendMemory && (
            <button className="primary-btn" onClick={onAppendMemory}>
              ＋ 添加记忆
            </button>
          )}
          <button
            className="mini-btn mc-delete-btn"
            onClick={() => {
              if (confirm('确定删除此地点及其所有记忆？')) onDeletePlace();
            }}
          >
            删除此地点
          </button>
        </div>
      )}
    </div>
  );
}
