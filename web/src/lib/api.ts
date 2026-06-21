import { getToken } from "./auth";
import type { Place, PlaceInput, GeoItem, ReverseGeoResult } from "./types";

const baseUrl = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

// --- auth ---

export async function sendCode(phone: string): Promise<void> {
  await request("/api/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function login(phone: string, code: string): Promise<{
  user: { id: string; phone: string; nickname: string };
  token: string;
}> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

// --- places ---

export async function listPlaces(): Promise<Place[]> {
  const data = await request<{ places: Place[] }>("/api/places");
  return data.places;
}

export async function createPlace(input: PlaceInput): Promise<Place> {
  return request<Place>("/api/places", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePlace(id: string, input: PlaceInput): Promise<Place> {
  return request<Place>(`/api/places/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deletePlace(id: string): Promise<void> {
  await request<void>(`/api/places/${id}`, { method: "DELETE" });
}

export async function uploadPhoto(placeId: string, file: File): Promise<Place> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Place>(`/api/places/${placeId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export async function deletePhoto(placeId: string, photoId: string): Promise<void> {
  await request<void>(`/api/places/${placeId}/photos/${photoId}`, {
    method: "DELETE",
  });
}

export async function createPost(
  placeId: string,
  input: { title: string; content: string; file?: File | null },
): Promise<Place> {
  if (input.file) {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("content", input.content);
    formData.append("file", input.file);
    return request<Place>(`/api/places/${placeId}/posts`, {
      method: "POST",
      body: formData,
    });
  }
  return request<Place>(`/api/places/${placeId}/posts`, {
    method: "POST",
    body: JSON.stringify({ title: input.title, content: input.content }),
  });
}

export async function deletePost(
  placeId: string,
  postId: string,
): Promise<void> {
  await request<void>(`/api/places/${placeId}/posts/${postId}`, {
    method: "DELETE",
  });
}

// --- geo ---

export async function suggestPlaces(keyword: string): Promise<GeoItem[]> {
  if (!keyword.trim()) return [];
  const data = await request<{ suggestions: GeoItem[] }>(
    `/api/geo/suggest?q=${encodeURIComponent(keyword)}`,
  );
  return data.suggestions ?? [];
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeoResult> {
  return request<ReverseGeoResult>(
    `/api/geo/reverse?lat=${lat}&lng=${lng}`,
  );
}
