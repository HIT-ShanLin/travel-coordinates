export type Photo = {
  id: string;
  user_id: string;
  place_id: string;
  url: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  place_id: string;
  title: string;
  content: string;
  photo_id: string | null;
  created_at: string;
};

export type Place = {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  travel_date: string;
  note: string;
  place_type: string;
  country: string;
  city: string;
  created_at: string;
  updated_at: string;
  photos: Photo[];
  posts: Post[];
};

export type PlaceInput = {
  name: string;
  latitude: number;
  longitude: number;
  travel_date: string;
  note: string;
  place_type: string;
  country: string;
  city: string;
};

// --- geo ---

export interface GeoItem {
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

export interface ReverseGeoResult {
  country: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

// --- post draft (unified form state) ---

export interface PhotoDraft {
  id: string; // temporary client-side id
  file: File;
  cropData?: CropData;
  isCover: boolean;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- memory card (for PlaceDrawer display) ---

export interface MemoryCardData {
  id: string;
  type: 'post_with_photo' | 'post_only' | 'photo_only';
  photoUrls: string[];
  title: string;
  content: string;
  date: string;
  placeName: string;
}
