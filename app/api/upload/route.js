import imagekit from "@/configs/imageKit";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  try {
    // Get userId from Authorization header (Firebase ID token)
    const authHeader = request.headers.get('authorization') || '';
    let userId = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      // Decode Firebase token to get userId (sub)
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      userId = payload.user_id || payload.sub || null;
    }
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = [...formData.getAll('files'), ...formData.getAll('file')].filter(Boolean);
    
    if (!files || files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedUrls = [];
    
    for (const file of files) {
      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Determine folder based on file type
      const isVideo = file.type.startsWith('video/');
      const folder = isVideo ? 'returns/videos' : 'returns/images';
      const fileName = `return_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
      
      // Upload to ImageKit
      const response = await imagekit.upload({
        file: buffer,
        fileName: fileName,
        folder: folder
      });
      
      // Return optimized URL
      const transformation = isVideo 
        ? [] // No transformation for videos
        : [{ quality: "auto" }, { format: "webp" }, { width: "800" }];
      
      const url = imagekit.url({
        path: response.filePath,
        transformation: transformation
      });
      
      uploadedUrls.push(url);
    }

    return Response.json({ 
      success: true,
      url: uploadedUrls[0] || null,
      urls: uploadedUrls 
    });
  } catch (error) {
    console.error('File upload error:', error);
    return Response.json({ 
      error: error.message || "Failed to upload files" 
    }, { status: 500 });
  }
}
