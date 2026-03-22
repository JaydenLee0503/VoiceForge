import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

type SupabaseServices = {
  client: SupabaseClient;
};

let servicesCache: SupabaseServices | null = null;
let sessionPromise: Promise<Session | null> | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseServices() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!servicesCache) {
    servicesCache = {
      client: createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            storageKey: "voiceforge-supabase-auth",
          },
        },
      ),
    };
  }

  return servicesCache;
}

export async function ensureSupabaseUser(): Promise<User | null> {
  const services = getSupabaseServices();

  if (!services) {
    return null;
  }

  const {
    data: { user: existingUser },
  } = await services.client.auth.getUser();

  if (existingUser) {
    return existingUser;
  }

  if (!sessionPromise) {
    sessionPromise = services.client.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        return data.session;
      })
      .catch((error) => {
        sessionPromise = null;
        throw error;
      });
  }

  const session = await sessionPromise;
  return session?.user ?? null;
}
