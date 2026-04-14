-- Migration: Create photos table and storage bucket
-- Run this in Supabase SQL Editor

-- Create photos table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    caption TEXT,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create index for incident lookups
CREATE INDEX IF NOT EXISTS idx_photos_incident_id ON public.photos(incident_id);

-- Enable RLS
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view photos for incidents they have access to
CREATE POLICY "Users can view photos for accessible incidents"
    ON public.photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = photos.incident_id
        )
    );

-- Policy: FIELD users can create photos
CREATE POLICY "FIELD users can create photos"
    ON public.photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('FIELD', 'COMMAND', 'ADMIN')
        )
    );

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
    ON public.photos
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('COMMAND', 'ADMIN')
        )
    );

-- Create storage bucket for incident photos
-- Note: This needs to be done via Supabase Dashboard or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('incident-photos', 'incident-photos', true);

-- Storage RLS policies (run these in Supabase SQL Editor after creating bucket)
/*
-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'incident-photos'
        AND auth.role() = 'authenticated'
    );

-- Allow public access to view photos
CREATE POLICY "Photos are publicly viewable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'incident-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'incident-photos'
        AND auth.uid() = owner
    );
*/
