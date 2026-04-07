set search_path = public, extensions;

-- Step 1: Create the question type enum
DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM (
    'multiple_choice',
    'fill_in_blank',
    'checkbox',
    'dropdown',
    'picture'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add question_type column (defaults existing rows to 'multiple_choice')
ALTER TABLE public.subject_qa_pairs
  ADD COLUMN IF NOT EXISTS question_type public.question_type NOT NULL DEFAULT 'multiple_choice';

-- Step 3: Add question_image_url for picture-type questions
ALTER TABLE public.subject_qa_pairs
  ADD COLUMN IF NOT EXISTS question_image_url text;

-- Step 4: Index for filtering by question type
CREATE INDEX IF NOT EXISTS subject_qa_pairs_question_type_idx
  ON public.subject_qa_pairs (question_type)
  WHERE deleted_at IS NULL;

-- Step 5: Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('question-images', 'question-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Step 6: Storage policy - admins can upload question images
CREATE POLICY question_images_insert_admin
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images' AND
    public.is_admin()
  );

-- Step 7: Storage policy - anyone can read question images (public bucket)
CREATE POLICY question_images_select_all
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'question-images');

-- Step 8: Storage policy - admins can delete question images
CREATE POLICY question_images_delete_admin
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-images' AND
    public.is_admin()
  );
