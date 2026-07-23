-- SQL Migration: Masterclass Reward & Bonus Credits
-- Add ai_calls_bonus to profiles and create RPC reward_masterclass_bonus

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_calls_bonus INT DEFAULT 0;

CREATE OR REPLACE FUNCTION public.reward_masterclass_bonus(target_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET ai_calls_bonus = COALESCE(ai_calls_bonus, 0) + 100,
        updated_at = now()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
