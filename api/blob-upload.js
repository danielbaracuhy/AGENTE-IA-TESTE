import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
          'video/x-matroska',
        ],
        maximumSizeInBytes: 200 * 1024 * 1024,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('blob upload completed:', blob.url);
      },
    });
    return res.json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
