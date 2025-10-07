import { useAuth } from "./useAuth";

export function useUserId(): string | undefined {
  const { user } = useAuth();
  return user?.id;
}
