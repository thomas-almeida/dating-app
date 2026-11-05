export type Gender = "male" | "female";
export type WaitlistStatus = "pending" | "approved" | "rejected" | "activated";
export type SwipeAction = "like" | "pass";
export type SubscriptionStatus = "pending" | "active" | "cancelled";

export type Profile = {
  id: string;
  name: string;
  nickname: string | null;
  bio: string | null;
  gender: Gender | null;
  birth_date: string | null;
  video_path: string | null;
  photo_paths: string[];
  is_pro: boolean;
  onboarded_at: string | null;
  created_at: string;
};

export type WaitlistEntry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: WaitlistStatus;
  invite_expires_at: string | null;
  approved_at: string | null;
  user_id: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  checkout_id: string | null;
  subscription_id: string | null;
  customer_id: string | null;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
};

// Retorno das RPCs discover_profiles e get_public_profile.
export type PublicProfile = {
  id: string;
  name: string;
  nickname: string | null;
  bio: string | null;
  age: number | null;
  video_path: string | null;
  photo_paths: string[];
  is_pro: boolean;
};

export type StoryProfile = {
  id: string;
  nickname: string | null;
  photo_path: string | null;
  has_story: boolean;
};

export type StoryMediaType = "image" | "video";

export type StoryRow = {
  id: string;
  user_id: string;
  media_path: string;
  media_type: StoryMediaType;
  created_at: string;
  liked: boolean;
};

export type StoryMedia = {
  id: string;
  type: StoryMediaType;
  url: string;
  liked: boolean;
};

export type StoryPerson = {
  id: string;
  label: string;
  photoUrl: string | null;
  stories: StoryMedia[];
};

export type StoryAudienceRow = {
  user_id: string;
  nickname: string | null;
  photo_path: string | null;
  viewed_at: string;
  liked: boolean;
};

export type StoryAudienceMember = {
  id: string;
  label: string;
  photoUrl: string | null;
  liked: boolean;
};

export type ProfileStats = {
  profile_views: number;
  likes_received: number;
};

export type LikerProfile = {
  id: string;
  name: string;
  nickname: string | null;
  age: number | null;
  photo_paths: string[];
  liked_at: string;
};

export type MatchProfile = {
  id: string;
  name: string;
  nickname: string | null;
  age: number | null;
  video_path: string | null;
  photo_paths: string[];
  matched_at: string;
};

// O que o cliente recebe: caminhos do Storage já trocados por URLs assinadas.
export type DeckCard = {
  id: string;
  displayName: string;
  age: number | null;
  bio: string | null;
  isPro: boolean;
  videoUrl: string | null;
  posterUrl: string | null;
};

export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
