export type Gender = "male" | "female";
export type WaitlistStatus = "pending" | "approved" | "rejected" | "activated";
export type SwipeAction = "like" | "pass";
export type SubscriptionStatus = "pending" | "active" | "cancelled";

export type Hobby = { emoji: string; hobbie: string };
export type HobbyTag = Hobby & { common: boolean };

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
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  hobbies: Hobby[];
  height_cm: number | null;
  skin_color: string | null;
  church: string | null;
  pref_genders: string[];
  pref_churches: string[];
  pref_skin_colors: string[];
  onboarded_at: string | null;
  app_installed_at: string | null;
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
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  hobbies: Hobby[];
  height_cm: number | null;
  church: string | null;
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
  place: string | null;
  hobbies: HobbyTag[];
  sameRegion: boolean;
  church: string | null;
  sameChurch: boolean;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type Conversation = {
  id: string;
  name: string;
  nickname: string | null;
  age: number | null;
  photo_paths: string[];
  matched_at: string;
  last_body: string | null;
  last_at: string | null;
  last_from_me: boolean | null;
  unread: number;
};

// Retorno das RPCs list_events e get_event.
export type EventRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  location: string;
  organizer: string;
  starts_at: string;
  photo_paths: string[];
  going_count: number;
  going: boolean;
};

export type EventPerson = {
  id: string;
  nickname: string;
  photo_path: string | null;
};

export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
