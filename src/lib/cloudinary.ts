import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Upload image to Cloudinary
 * @param file - File buffer or base64 string
 * @param folder - Optional folder path in Cloudinary
 * @returns Promise with upload result containing secure_url
 */
export async function uploadImage(
  file: Buffer | string,
  folder: string = 'tickets'
): Promise<{ secure_url: string; public_id: string }> {
  try {
    const uploadOptions: Record<string, unknown> = {
      folder: `sst-resolve/${folder}`,
      resource_type: 'image',
      overwrite: false,
      invalidate: true,
    };

    type UploadResult = {
      secure_url: string;
      public_id: string;
      [key: string]: unknown;
    };
    let uploadResult: UploadResult;
    if (Buffer.isBuffer(file)) {
      // Upload from buffer
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else if (result) {
              const uploadResult: UploadResult = {
                secure_url: result.secure_url || '',
                public_id: result.public_id || '',
              };
              resolve(uploadResult);
            } else {
              reject(new Error('Upload failed: no result'));
            }
          }
        );
        uploadStream.end(file);
      });
    } else {
      // Upload from base64 string
      uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
    }

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Upload failed: No URL returned');
    }

    return {
      secure_url: uploadResult.secure_url as string,
      public_id: uploadResult.public_id as string,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete image from Cloudinary
 * @param publicId - Public ID of the image to delete
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

