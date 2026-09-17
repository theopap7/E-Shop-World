const cloudinary = require('cloudinary').v2;

const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ecommerce', public_id: publicId, resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Cloudinary URLs embed the public_id between "/upload/[v<version>/]" and the
// file extension — pull it back out so a delete doesn't need a stored column.
function destroyByUrl(url) {
  const match = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/.exec(url || '');
  if (!match) return Promise.resolve();
  return cloudinary.uploader.destroy(match[1]).catch(() => {});
}

module.exports = { isConfigured, uploadBuffer, destroyByUrl };
