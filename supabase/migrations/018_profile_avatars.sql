-- Add avatar support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Allow any authenticated user to update their own profile (needed for avatar upload)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
