import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  DocumentData,
} from "firebase/firestore";

export interface CourseHole {
  holeNumber: number;
  par: number;
  distance: number;
  handicap?: number;
  holeType?: string;
}

export interface Course {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
  par: number;
  distanceFt: number;
  description: string;
  courseType: string;
  terrain: string;
  amenities: string[];
  isFree: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  coverPhotoUrl?: string;
  galleryPhotoUrls?: string[];
  communityAverage?: number;
  latitude?: number;
  longitude?: number;
  holes: CourseHole[];
  createdBy: string;
  createdById: string;
  reviewStatus: string;
  lastModified: number;
}

export interface CourseScore {
  playerId: string;
  playerName: string;
  username: string;
  courseId: string;
  courseName: string;
  relativeToPar: number;
  holesPlayed: number;
  gameIQ: number;
  date: number;
  layoutName?: string;
}

function docToCourse(id: string, data: DocumentData): Course {
  return {
    id,
    name: data.name ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    holeCount: data.holeCount ?? 0,
    par: data.par ?? 0,
    distanceFt: data.distanceFt ?? 0,
    description: data.description ?? "",
    courseType: data.courseType ?? "",
    terrain: data.terrain ?? "",
    amenities: data.amenities ?? [],
    isFree: data.isFree ?? true,
    isPublic: data.isPublic ?? true,
    isFeatured: data.isFeatured ?? false,
    coverPhotoUrl: data.coverPhotoUrl,
    galleryPhotoUrls: data.galleryPhotoUrls,
    communityAverage: data.communityAverage,
    latitude: data.latitude,
    longitude: data.longitude,
    holes: (data.holes ?? []).map((h: DocumentData) => ({
      holeNumber: h.holeNumber ?? 0,
      par: h.par ?? 3,
      distance: h.distance ?? 0,
      handicap: h.handicap,
      holeType: h.holeType,
    })),
    createdBy: data.createdBy ?? "",
    createdById: data.createdById ?? "",
    reviewStatus: data.reviewStatus ?? "",
    lastModified: data.lastModified ?? 0,
  };
}

export async function getAllCourses(): Promise<Course[]> {
  const q = query(
    collection(db, "courses"),
    where("reviewStatus", "==", "approved")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToCourse(d.id, d.data()));
}

export async function getCourseById(id: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, "courses", id));
  if (!snap.exists()) return null;
  return docToCourse(snap.id, snap.data());
}

export async function getCourseScores(
  courseId: string,
  max = 20
): Promise<CourseScore[]> {
  const q = query(
    collection(db, "courseScores"),
    where("courseId", "==", courseId),
    orderBy("relativeToPar", "asc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      playerId: data.playerId ?? "",
      playerName: data.playerName ?? "",
      username: data.username ?? "",
      courseId: data.courseId ?? "",
      courseName: data.courseName ?? "",
      relativeToPar: data.relativeToPar ?? 0,
      holesPlayed: data.holesPlayed ?? 0,
      gameIQ: data.gameIQ ?? 0,
      date: data.date ?? 0,
      layoutName: data.layoutName,
    };
  });
}

export function slugify(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${id.slice(0, 8)}`;
}

export function idFromSlug(slug: string): string | null {
  const parts = slug.split("-");
  if (parts.length < 2) return null;
  const shortId = parts[parts.length - 1];
  return shortId;
}
