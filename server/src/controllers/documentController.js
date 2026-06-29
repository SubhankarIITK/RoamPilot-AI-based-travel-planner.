import Document from '../models/Document.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import getOwnedTrip from '../utils/getOwnedTrip.js';
import {
  deleteCloudinaryAsset,
  uploadCloudinaryBuffer,
} from '../services/cloudinaryService.js';

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const { tripId, category = 'other', notes = '' } = req.body;

  await getOwnedTrip(tripId, req.user._id);
  const uploaded = await uploadCloudinaryBuffer(req.file.buffer);

  let doc;
  try {
    doc = await Document.create({
      userId: req.user._id,
      tripId,
      fileUrl: uploaded.secure_url,
      fileType: req.file.mimetype,
      cloudinaryPublicId: uploaded.public_id,
      cloudinaryResourceType: uploaded.resource_type,
      category,
      notes,
      originalName: req.file.originalname,
    });
  } catch (error) {
    await deleteCloudinaryAsset(uploaded.public_id, uploaded.resource_type).catch(() => {});
    throw error;
  }

  res.status(201).json(new ApiResponse(201, doc, 'Document uploaded'));
});

export const getTripDocuments = asyncHandler(async (req, res) => {
  const docs = await Document.find({ tripId: req.params.tripId, userId: req.user._id });
  res.json(new ApiResponse(200, docs));
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.cloudinaryPublicId) {
    await deleteCloudinaryAsset(doc.cloudinaryPublicId, doc.cloudinaryResourceType);
  }
  await doc.deleteOne();
  res.json(new ApiResponse(200, null, 'Document deleted'));
});
