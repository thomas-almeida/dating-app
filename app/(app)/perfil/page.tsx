import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/dal";

async function OwnProfile(): Promise<never> {
  const { user } = await requireMember();
  redirect(`/perfil/${user.id}`);
}

export default function ProfileRedirectPage() {
  return (
    <Suspense fallback={null}>
      <OwnProfile />
    </Suspense>
  );
}
