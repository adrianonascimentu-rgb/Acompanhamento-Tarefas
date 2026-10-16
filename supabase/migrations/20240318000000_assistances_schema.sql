-- Create assistances table
CREATE TABLE IF NOT EXISTS assistances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    fabricante TEXT NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT,
    celular TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT
);

-- Enable Row Level Security
ALTER TABLE assistances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" ON assistances
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON assistances
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON assistances
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON assistances
    FOR DELETE USING (auth.role() = 'authenticated');
