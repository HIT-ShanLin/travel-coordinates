export type Photo = {
  id: string;
  filename: string;
  content_type: string;
  path: string;
  url: string;
  created_at: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  image_path: string;
  image_url: string;
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
