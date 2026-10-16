-- Migrations for Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT,
  type TEXT CHECK (type IN ('admin', 'user', 'vendedor')) DEFAULT 'user',
  location TEXT,
  image_url TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  stats_completed INTEGER DEFAULT 0,
  stats_on_time TEXT DEFAULT '100%',
  stats_active INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add password column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='password') THEN
        ALTER TABLE profiles ADD COLUMN password TEXT NOT NULL DEFAULT '123456';
    END IF;
END $$;

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  priority TEXT CHECK (priority IN ('Alta', 'Média', 'Baixa')),
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pendente',
  collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_name TEXT NOT NULL,
  author_role TEXT,
  date TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Skills Table
CREATE TABLE IF NOT EXISTS profile_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skills ENABLE ROW LEVEL SECURITY;

-- Permissive Policies for Demo (Allow all operations)
-- In a production app, these should be restricted to authenticated users or specific roles.
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
    DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on profiles') THEN
        CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Tasks
    DROP POLICY IF EXISTS "Tasks are viewable by everyone." ON tasks;
    DROP POLICY IF EXISTS "Admins can manage tasks." ON tasks;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on tasks') THEN
        CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Reviews
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on reviews') THEN
        CREATE POLICY "Allow all on reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Skills
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on skills') THEN
        CREATE POLICY "Allow all on skills" ON profile_skills FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Seed Data for Initial Collaborators
INSERT INTO profiles (id, name, role, type, location, image_url, email, phone, password, stats_completed, stats_on_time, stats_active)
VALUES 
('77777777-7777-7777-7777-777777777777', 'Adriano Nascimento', 'Administrador Geral', 'admin', 'Escritório Central', 'https://picsum.photos/seed/adriano-n/200', 'adrianonascimentu@gmail.com', '+55 (11) 99999-7777', 'admin123', 500, '100%', 2),
('11111111-1111-1111-1111-111111111111', 'Djalma', 'Estoque', 'user', 'Setor de Estoque', 'https://picsum.photos/seed/djalma/200', 'djalma@empresa.com', '+55 (11) 99999-1111', '123456', 128, '98%', 5),
('22222222-2222-2222-2222-222222222222', 'João', 'Estoque', 'user', 'Setor de Estoque', 'https://picsum.photos/seed/joao/200', 'joao@empresa.com', '+55 (11) 99999-2222', '123456', 45, '95%', 3),
('33333333-3333-3333-3333-333333333333', 'Izabella', 'Estoque', 'user', 'Setor de Estoque', 'https://picsum.photos/seed/izabella/200', 'izabella@empresa.com', '+55 (11) 99999-3333', '123456', 12, '100%', 1),
('44444444-4444-4444-4444-444444444444', 'Messias', 'Entregas e Estoque', 'user', 'Logística', 'https://picsum.photos/seed/messias/200', 'messias@empresa.com', '+55 (11) 99999-4444', '123456', 312, '99%', 8),
('55555555-5555-5555-5555-555555555555', 'Roberto', 'Entregas e Estoque', 'user', 'Logística', 'https://picsum.photos/seed/roberto/200', 'roberto@empresa.com', '+55 (11) 99999-5555', '123456', 89, '92%', 4),
('66666666-6666-6666-6666-666666666666', 'Adriana', 'Caixa e Auxiliar Administrativo', 'user', 'Escritório Central', 'https://picsum.photos/seed/adriana/200', 'adriana@empresa.com', '+55 (11) 99999-6666', '123456', 245, '100%', 3),
('88888888-8888-8888-8888-888888888888', 'Carlos Vendedor', 'Consultor de Vendas', 'vendedor', 'Campo', 'https://picsum.photos/seed/carlos/200', 'carlos@empresa.com', '+55 (11) 99999-8888', '123456', 150, '95%', 10),
('99999999-9999-9999-9999-999999999999', 'Mariana Vendas', 'Consultora de Vendas', 'vendedor', 'Campo', 'https://picsum.photos/seed/mariana/200', 'mariana@empresa.com', '+55 (11) 99999-9999', '123456', 200, '98%', 15)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  type = EXCLUDED.type,
  location = EXCLUDED.location,
  image_url = EXCLUDED.image_url,
  phone = EXCLUDED.phone,
  password = EXCLUDED.password,
  stats_completed = EXCLUDED.stats_completed,
  stats_on_time = EXCLUDED.stats_on_time,
  stats_active = EXCLUDED.stats_active;

-- Seed Tasks
INSERT INTO tasks (title, description, due_date, priority, progress, status, collaborator_id)
VALUES
('Conferência de Estoque', 'Finalizar a conferência semanal do setor A.', '2026-03-25', 'Alta', 65, 'Em Progresso', '11111111-1111-1111-1111-111111111111'),
('Organização de Prateleiras', 'Reorganizar o setor de eletrônicos.', '2026-03-28', 'Média', 30, 'Pendente', '11111111-1111-1111-1111-111111111111'),
('Fechamento de Caixa', 'Realizar o fechamento diário.', '2026-03-23', 'Alta', 90, 'Em Progresso', '66666666-6666-6666-6666-666666666666'),
('Relatório Mensal', 'Preparar o relatório de vendas.', '2026-03-30', 'Alta', 45, 'Pendente', '66666666-6666-6666-6666-666666666666'),
('Gestão de Sistema', 'Monitorar desempenho das tarefas.', '2026-03-23', 'Alta', 100, 'Concluída', '77777777-7777-7777-7777-777777777777');

-- Seed Reviews
INSERT INTO reviews (author_name, author_role, date, rating, text, collaborator_id)
VALUES
('Adriano', 'Administrador', '28 Set, 2023', 5, 'Excelente organização e rapidez na conferência.', '11111111-1111-1111-1111-111111111111'),
('Messias', 'Entregas', '15 Ago, 2023', 4, 'Sempre disposto a ajudar na separação das cargas.', '11111111-1111-1111-1111-111111111111'),
('Roberto', 'Entregas', '01 Out, 2023', 5, 'Muito organizada com a documentação das entregas.', '66666666-6666-6666-6666-666666666666');

-- Seed Skills
INSERT INTO profile_skills (profile_id, skill)
VALUES
('11111111-1111-1111-1111-111111111111', 'Gestão de Estoque'),
('11111111-1111-1111-1111-111111111111', 'Conferência'),
('11111111-1111-1111-1111-111111111111', 'Logística'),
('66666666-6666-6666-6666-666666666666', 'Fluxo de Caixa'),
('66666666-6666-6666-6666-666666666666', 'Administração'),
('77777777-7777-7777-7777-777777777777', 'Gestão Estratégica'),
('77777777-7777-7777-7777-777777777777', 'Liderança');
