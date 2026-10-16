
-- Create social_media_tasks table
CREATE TABLE IF NOT EXISTS social_media_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    formats TEXT[] NOT NULL DEFAULT '{}',
    channels TEXT[] NOT NULL DEFAULT '{}',
    responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deadline_sla DATE NOT NULL,
    publication_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado')),
    links JSONB NOT NULL DEFAULT '{}',
    checklist JSONB NOT NULL DEFAULT '{"hashtags": false, "localKeywords": false, "taggedAccounts": false, "qualityChecked": false}',
    feedback TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE social_media_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable all for authenticated users" 
ON social_media_tasks FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_media_tasks;
