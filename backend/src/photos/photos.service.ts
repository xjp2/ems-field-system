import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../config/supabase.config';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

export interface Photo {
  id: string;
  incident_id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  taken_at: string;
  created_at: string;
  created_by?: string;
}

@Injectable()
export class PhotosService {
  private readonly BUCKET_NAME = 'incident-photos';

  constructor(private supabaseConfig: SupabaseConfig) {}

  /**
   * Upload a photo to storage and create database record
   */
  async uploadPhoto(
    user: AuthenticatedUser,
    incidentId: string,
    file: Express.Multer.File,
    caption?: string,
    takenAt?: string,
  ): Promise<Photo> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);
    const serviceClient = this.supabaseConfig.getServiceClient();

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${incidentId}/${timestamp}-${file.originalname}`;

    // Upload to Supabase Storage using service client (bypasses RLS)
    const { error: uploadError } = await serviceClient.storage
      .from(this.BUCKET_NAME)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = serviceClient.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filename);

    // Create database record
    const { data, error } = await client
      .from('photos')
      .insert({
        incident_id: incidentId,
        storage_path: filename,
        public_url: publicUrl,
        caption: caption || null,
        taken_at: takenAt || new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // Cleanup uploaded file if DB insert fails
      await serviceClient.storage.from(this.BUCKET_NAME).remove([filename]);
      throw new Error(`Failed to create photo record: ${error.message}`);
    }

    return data as Photo;
  }

  /**
   * Get all photos for an incident
   */
  async findByIncident(user: AuthenticatedUser, incidentId: string): Promise<Photo[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('photos')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    return (data || []) as Photo[];
  }

  /**
   * Get a single photo by ID
   */
  async findOne(user: AuthenticatedUser, id: string): Promise<Photo> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('photos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Photo not found');
    }

    return data as Photo;
  }

  /**
   * Delete a photo
   */
  async delete(user: AuthenticatedUser, id: string): Promise<void> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);
    const serviceClient = this.supabaseConfig.getServiceClient();

    // Get photo details first
    const { data: photo, error: fetchError } = await client
      .from('photos')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (fetchError || !photo) {
      throw new NotFoundException('Photo not found');
    }

    // Delete from storage
    const { error: storageError } = await serviceClient.storage
      .from(this.BUCKET_NAME)
      .remove([photo.storage_path]);

    if (storageError) {
      console.error('Failed to delete photo from storage:', storageError);
    }

    // Delete from database
    const { error } = await client
      .from('photos')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
  }
}
