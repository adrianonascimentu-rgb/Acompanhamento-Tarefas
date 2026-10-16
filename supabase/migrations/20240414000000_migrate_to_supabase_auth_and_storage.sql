-- Migration: Supabase Auth & Storage Migration
-- Migração de Senhas para Supabase Auth e Imagens Base64 para Supabase Storage

-- 1. Criação do Bucket 'avatars' no Supabase Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permitir leitura pública para o bucket 'avatars'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access to Avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public Access to Avatars" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Permitir upload de imagens para o bucket 'avatars'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow Upload to Avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow Upload to Avatars" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

-- Permitir atualização de imagens no bucket 'avatars'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow Update to Avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow Update to Avatars" 
    ON storage.objects FOR UPDATE 
    USING (bucket_id = 'avatars');
  END IF;
END $$;

-- 2. Ajuste na tabela profiles:
-- Remove valor padrão de geração aleatória de UUID caso vá vincular diretamente com auth.users(id)
ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;

-- Vincular chave estrangeira de profiles(id) para auth.users(id) se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    BEGIN
      ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Constraint profiles_id_fkey não pôde ser aplicada diretamente devido a IDs pré-existentes: %', SQLERRM;
    END;
  END IF;
END $$;

-- Remover a coluna password da tabela profiles (as senhas agora ficam criptografadas no Supabase Auth)
ALTER TABLE profiles DROP COLUMN IF EXISTS password;
