-- Create the transfers table
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sequential_number integer NOT NULL,
  requester_name text NOT NULL,
  description text NOT NULL,
  request_date date NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  responsible_id uuid REFERENCES public.profiles(id),
  type text DEFAULT 'solicitada'
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.transfers
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users only" ON public.transfers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users only" ON public.transfers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users only" ON public.transfers
  FOR DELETE USING (auth.role() = 'authenticated');
