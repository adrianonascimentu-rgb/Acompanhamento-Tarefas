-- Tabela para armazenar os tokens de push notification dos dispositivos
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_subscription UNIQUE(user_id, subscription)
);

-- Ativar RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores se houver
DROP POLICY IF EXISTS "Utilizadores gerem as suas subscrições" ON push_subscriptions;

-- Permitir que utilizadores façam gestão das suas próprias subscrições
CREATE POLICY "Utilizadores gerem as suas subscrições"
ON push_subscriptions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
